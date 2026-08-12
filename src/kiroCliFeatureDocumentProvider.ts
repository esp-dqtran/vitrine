import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import type { RasterImage } from "./evidenceAnalysisProvider.ts";
import {
  featureDocumentClaimBudget,
  type FeatureFlowPrompt,
  type FeatureStepPrompt,
  type FeatureSynthesisPrompt,
} from "./featureDocument.ts";
import {
  FEATURE_STEP_SYSTEM_PROMPT,
  FEATURE_SYNTHESIS_SYSTEM_PROMPT,
  type FeatureDocumentProvider,
} from "./featureDocumentProvider.ts";

export interface KiroCliFeatureDocumentConfig {
  binary: string;
  model: string;
  providerModel: string;
  effort: string;
  cwd: string;
  maxOutputBytes: number;
  officialDocumentationEnabled: boolean;
  officialDocumentationDomains: string[];
}

export interface KiroCliInvocation {
  binary: string;
  args: string[];
  cwd: string;
  signal: AbortSignal;
  maxOutputBytes: number;
  label?: string;
}

export type KiroCliRunner = (invocation: KiroCliInvocation) => Promise<string>;

const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const IMAGE_EXTENSIONS: Record<RasterImage["contentType"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
// Kiro caps the base64 string at 5 MiB, so leave headroom for 4:3 encoding growth.
const MAX_KIRO_IMAGE_BYTES = 3_500_000;
const MAX_KIRO_IMAGE_DIMENSION = 2_000;
const MAX_KIRO_INPUT_PIXELS = 40_000_000;

async function kiroFlowImage(image: RasterImage): Promise<{ bytes: Uint8Array; extension: string }> {
  if (image.bytes.byteLength <= MAX_KIRO_IMAGE_BYTES) {
    return { bytes: image.bytes, extension: IMAGE_EXTENSIONS[image.contentType] };
  }
  try {
    const bytes = await sharp(image.bytes, { limitInputPixels: MAX_KIRO_INPUT_PIXELS })
      .autoOrient()
      .resize({
        width: MAX_KIRO_IMAGE_DIMENSION,
        height: MAX_KIRO_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    if (bytes.byteLength > MAX_KIRO_IMAGE_BYTES) {
      throw new Error("normalized image remains too large");
    }
    return { bytes, extension: "webp" };
  } catch {
    throw new Error("Kiro Flow image is invalid or exceeds the safe image limit");
  }
}

export function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("Invalid Kiro CLI output limit");
  return parsed;
}

export function officialDocumentationDomains(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const domains = [...new Set(
    value.split(",").map((domain) => domain.trim().toLowerCase()).filter(Boolean),
  )];
  if (
    domains.length > 12
    || domains.some((domain) =>
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
    )
  ) {
    throw new Error("Invalid official documentation domain");
  }
  return domains;
}

export function booleanSetting(value: string | undefined, fallback = false): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error("Invalid Kiro CLI boolean setting");
}

export function kiroCliFeatureDocumentConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): KiroCliFeatureDocumentConfig | undefined {
  if (FALSE_VALUES.has(environment.KIRO_CLI_FEATURE_DOCUMENT_ENABLED?.trim().toLowerCase() ?? "")) {
    return undefined;
  }
  const model = environment.KIRO_CLI_FEATURE_DOCUMENT_MODEL?.trim() || "gpt-5.6-terra";
  const effort = environment.KIRO_CLI_FEATURE_DOCUMENT_EFFORT?.trim() || "high";
  const domains = officialDocumentationDomains(
    environment.KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS,
  );
  const officialDocumentationEnabled = domains.length > 0 || booleanSetting(
    environment.KIRO_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION,
  );
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(model)) throw new Error("Invalid Kiro CLI model");
  if (!/^(low|medium|high|xhigh|max)$/i.test(effort)) throw new Error("Invalid Kiro CLI effort");
  return {
    binary: environment.KIRO_CLI_BIN?.trim() || "kiro-cli",
    model,
    providerModel: `kiro-cli:${model}${officialDocumentationEnabled ? "+official-docs" : ""}`,
    effort: effort.toLowerCase(),
    cwd: resolve(environment.KIRO_CLI_FEATURE_DOCUMENT_CWD?.trim() || process.cwd()),
    maxOutputBytes: positiveInteger(environment.KIRO_CLI_FEATURE_DOCUMENT_MAX_OUTPUT_BYTES, 4_000_000),
    officialDocumentationEnabled,
    officialDocumentationDomains: domains,
  };
}

export function kiroCliFeatureDocumentProviderModelFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return kiroCliFeatureDocumentConfigFromEnvironment(environment)?.providerModel ?? "";
}

export function extractKiroCliJson(
  output: string,
  accept: (candidate: Record<string, unknown>) => boolean = () => true,
  label = "Kiro CLI",
): unknown {
  const text = output.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g,
    "",
  );
  const candidates: Record<string, unknown>[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const character = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") quoted = false;
        continue;
      }
      if (character === "\"") quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth !== 0) continue;
        try {
          const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            candidates.push(parsed as Record<string, unknown>);
          }
        } catch {
          // Kiro prints progress before its final raw JSON response.
        }
        break;
      }
    }
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (accept(candidates[index])) return candidates[index];
  }
  throw new Error(`${label} returned invalid JSON`);
}

export const runKiroCli: KiroCliRunner = (invocation) => new Promise((resolvePromise, reject) => {
  const label = invocation.label ?? "Kiro CLI";
  if (invocation.signal.aborted) {
    reject(new Error(`${label} request aborted`));
    return;
  }
  const child = spawn(invocation.binary, invocation.args, {
    cwd: invocation.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let settled = false;
  const finish = (operation: () => void): void => {
    if (settled) return;
    settled = true;
    invocation.signal.removeEventListener("abort", abort);
    operation();
  };
  const abort = (): void => {
    child.kill("SIGTERM");
    finish(() => reject(new Error(`${label} request aborted`)));
  };
  const append = (chunk: Buffer): void => {
    output += chunk.toString("utf8");
    if (output.length > invocation.maxOutputBytes) {
      child.kill("SIGTERM");
      finish(() => reject(new Error(`${label} output exceeded the configured limit`)));
    }
  };
  invocation.signal.addEventListener("abort", abort, { once: true });
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", () => finish(() => reject(new Error(`${label} could not be started`))));
  child.on("close", (code) => finish(() => {
    if (code === 0) resolvePromise(output);
    else reject(new Error(`${label} exited with code ${code ?? 1}`));
  }));
});

function argumentsFor(
  config: KiroCliFeatureDocumentConfig,
  prompt: string,
  trustedTools: readonly string[],
): string[] {
  return [
    "chat",
    "--model",
    config.model,
    "--effort",
    config.effort,
    "--no-interactive",
    `--trust-tools=${trustedTools.join(",")}`,
    "--wrap",
    "never",
    prompt,
  ];
}

function stepPrompt(prompt: FeatureStepPrompt, imagePath: string): string {
  return [
    FEATURE_STEP_SYSTEM_PROMPT,
    `Read the screenshot at this exact absolute path with the read tool: ${imagePath}`,
    "Return only one raw JSON object with this exact shape:",
    "{\"evidenceId\":string,\"visibleUi\":string[],\"visibleText\":string[],\"likelyIntent\":string,\"availableActions\":string[],\"systemFeedback\":string[],\"friction\":string[],\"missingOrUncertainStates\":string[],\"accessibility\":string[],\"confidence\":number}",
    "The confidence value must be between 0 and 1.",
    `Flow context: ${JSON.stringify(prompt)}`,
  ].join("\n");
}

function documentShape(officialDocumentationEnabled: boolean): string {
  return [
    "{",
    "\"sourceAssessment\":{\"captureType\":\"complete-journey\"|\"partial-journey\"|\"static-screen\"|\"state-gallery\"|\"content-scroll\",\"completeness\":\"complete\"|\"partial\",\"rationale\":string,\"evidenceIds\":string[]},",
    "\"unscopedEvidence\":[{\"evidenceId\":string,\"reason\":string}],",
    ...(officialDocumentationEnabled
      ? [
        "\"documentedContext\":{\"status\":\"researched\"|\"not-found\",\"sources\":[{\"id\":string,\"title\":string,\"url\":string,\"retrievedAt\":string,\"platform\":\"ios\"|\"android\"|\"web\"|\"all\",\"region\":string}],\"claims\":[{\"id\":string,\"text\":string,\"sourceIds\":string[],\"relationship\":\"supports\"|\"extends\"|\"conflicts\"|\"unrelated\",\"visualEvidenceIds\":string[],\"unresolved\":boolean}]},",
      ]
      : []),
    "\"executiveSummary\":{\"purpose\":Claim,\"userValue\":Claim,\"recommendation\":Claim},",
    "\"observedFlow\":{\"userGoal\":Claim,\"entryPoint\":Claim,\"completionPoint\":Claim,\"journey\":Claim[],\"actors\":Claim[],\"visibleStates\":Claim[]},",
    "\"flowAnalysis\":{\"effectivePatterns\":Claim[],\"friction\":Claim[],\"missingStates\":Claim[],\"inconsistencies\":Claim[],\"risksAndAssumptions\":Claim[]},",
    "\"proposedFeature\":{\"problem\":Claim,\"targetUsers\":Claim[],\"goals\":Claim[],\"nonGoals\":Claim[],\"behavior\":Claim[],\"journey\":Claim[]},",
    "\"requirements\":Requirement[],",
    "\"edgeCases\":Claim[],\"successMetrics\":Claim[],\"guardrailMetrics\":Claim[],\"analyticsEvents\":Claim[],\"dependencies\":Claim[],\"openQuestions\":Claim[]",
    "}",
  ].join("");
}

function documentInstructions(
  prompt: FeatureFlowPrompt,
  officialDocumentationEnabled: boolean,
  officialDomains: readonly string[],
): string[] {
  const maximumRequirements = Math.max(
    1,
    Math.min(6, Math.floor(prompt.allowedEvidenceIds.length / 2)),
  );
  const interactionCount = prompt.evidenceManifest.filter(
    ({ interaction }) => Boolean(interaction?.trim()),
  ).length;
  const claimBudget = featureDocumentClaimBudget(prompt.allowedEvidenceIds.length);
  const officialResearch = officialDocumentationEnabled
    ? [
      ...(officialDomains.length > 0
        ? [
          `Use web search only for official documentation hosted on these exact domains or their subdomains: ${officialDomains.join(", ")}.`,
          "Construct search queries with site: filters for only those domains.",
        ]
        : [
          "Use web search to discover relevant first-party official documentation without assuming its domain in advance.",
          "Verify from page ownership, branding, and publisher context that each saved source is operated by the product owner or its official regional entity.",
          "Search the product's own help center, documentation, policy, support, or corporate pages. Do not treat a familiar-looking domain name alone as proof of ownership.",
        ]),
      "Never use blogs, forums, social posts, aggregators, mirrors, cached copies, or search-result snippets as sources.",
      `The retrieval timestamp for this run is ${new Date().toISOString()}.`,
      "Official documentation is documented context only. It must never be described as observed, must never receive screenshot evidence IDs, and must never upgrade an unknown visual behavior into an observed behavior.",
      "If no relevant first-party official source is found, return documentedContext with status not-found and empty sources and claims. Do not substitute third-party material.",
      "Classify every documented claim relative to the screenshots as supports, extends, conflicts, or unrelated. Preserve conflicts and uncertainty.",
    ]
    : [];
  return [
    FEATURE_SYNTHESIS_SYSTEM_PROMPT,
    ...officialResearch,
    `This capture contains ${prompt.allowedEvidenceIds.length} evidence images and ${interactionCount} explicit interaction annotations. Generate at most ${maximumRequirements} replication requirements and at most ${claimBudget} total Claims.`,
    "Claim is exactly {\"id\":string,\"kind\":\"observed\"|\"inferred\"|\"proposed\"|\"unknown\",\"text\":string,\"evidenceIds\":string[],\"confidence\"?:number}.",
    "Requirement is an observed or inferred Claim plus {\"userStory\":string,\"priority\":\"unranked\",\"preconditions\":string[],\"acceptanceCriteria\":AcceptanceCriterion[]}.",
    "AcceptanceCriterion is exactly {\"id\":string,\"kind\":\"observed\"|\"inferred\",\"given\":string,\"when\":string,\"then\":string,\"evidenceIds\":string[]}.",
    "Use globally unique id values across all claims, requirements, and acceptance criteria.",
    "Include at least one requirement. Every must requirement must include at least one acceptance criterion.",
    "For a Flow with two or more evidence images, every requirement must include at least two evidence-cited acceptance criteria. Group related happy, validation, alternate, or failure outcomes under the same user story instead of creating one-criterion requirements.",
    "A one-criterion requirement is allowed only when the Flow has one evidence image or only one supportable outcome.",
    "Every requirement must include at least one acceptance criterion and at least one evidence ID.",
    "Every acceptance criterion must include at least one evidence ID, and each of those IDs must also appear on its parent requirement.",
    "Use no null values. Arrays may be empty only when the evidence does not support entries.",
  ];
}

function synthesisPrompt(
  prompt: FeatureSynthesisPrompt,
  officialDocumentationEnabled: boolean,
  officialDomains: readonly string[],
): string {
  return [
    ...documentInstructions(prompt, officialDocumentationEnabled, officialDomains),
    "Every top-level key below is required. Objects must remain objects and lists must remain arrays:",
    documentShape(officialDocumentationEnabled),
    "Return only the final raw JSON object. Do not use Markdown fences.",
    `Synthesis input: ${JSON.stringify(prompt)}`,
  ].join("\n");
}

function flowPrompt(
  prompt: FeatureFlowPrompt,
  images: Array<{
    evidenceId: string;
    stepIndex: number;
    imageIndex: number;
    stepLabel: string;
    interaction?: string;
    path: string;
  }>,
  officialDocumentationEnabled: boolean,
  officialDomains: readonly string[],
  readTool = "fs_read",
): string {
  const maximumRequirements = Math.max(
    1,
    Math.min(6, Math.floor(prompt.allowedEvidenceIds.length / 2)),
  );
  const interactionCount = prompt.evidenceManifest.filter(
    ({ interaction }) => Boolean(interaction?.trim()),
  ).length;
  const claimBudget = featureDocumentClaimBudget(prompt.allowedEvidenceIds.length);
  const maximumEvidenceClaims = Math.max(
    3,
    claimBudget - 18 - maximumRequirements,
  );
  const documentedContext = officialDocumentationEnabled
    ? [
      ...(officialDomains.length
        ? [`Official documentation sources must use these domains or their subdomains: ${officialDomains.join(", ")}.`]
        : ["Discover only first-party official documentation and verify publisher ownership."]),
      "If no relevant official source is found, set documentedContext to {\"status\":\"not-found\",\"sources\":[],\"claims\":[]}.",
      "documentedContext uses the same shape defined by the Feature Document schema.",
    ]
    : [];
  return [
    // A retry only helps when the model sees why the last attempt was rejected, so state
    // it up front rather than leaving it buried in the serialized Flow input below.
    ...(prompt.validationError
      ? [
        `The previous attempt was rejected for this exact reason: ${prompt.validationError}`,
        "Correct that specific problem in this attempt and change nothing else.",
      ]
      : []),
    "Analyze this entire Flow from all ordered screenshots in one pass.",
    `Read every absolute image path below with ${readTool} before producing the result.`,
    "The array order is authoritative. Compare screenshots directly to identify visible states and differences.",
    "Image order alone does not prove a user action or transition. Treat an action result as observed only when explicit interaction metadata or visible before-and-after evidence supports it.",
    ...(interactionCount === 0
      ? ["This Flow has no explicit interaction annotations. Every transition and action outcome must be classified as inferred, while directly visible states may be observed."]
      : []),
    FEATURE_SYNTHESIS_SYSTEM_PROMPT,
    ...documentedContext,
    `Return exactly one compact screen entry for every evidenceId, in the supplied order, and at most ${maximumRequirements} capability-level requirements.`,
    "Do not generate IDs, priority values, preconditions, or accessibility recommendations. The application adds identifiers and defaults deterministically.",
    "CompactClaim is exactly {\"kind\":\"observed\"|\"inferred\"|\"proposed\"|\"unknown\",\"text\":string,\"evidenceIds\":string[],\"confidence\"?:number}.",
    "CompactScreen is exactly {\"evidenceId\":string,\"visibleState\":string,\"visibleText\":string[],\"availableActions\":string[],\"visibleFeedback\":string[],\"uncertainty\":string[],\"confidence\":number}.",
    "CompactCriterion is exactly {\"kind\":\"observed\"|\"inferred\",\"given\":string,\"when\":string,\"then\":string,\"evidenceIds\":string[]}.",
    "CompactRequirement is exactly {\"kind\":\"observed\"|\"inferred\",\"text\":string,\"evidenceIds\":string[],\"userStory\":string,\"criteria\":CompactCriterion[]}.",
    "ImplementationBrief is exactly {\"targetUser\":string,\"goal\":string,\"nonGoal\":string,\"behavior\":string,\"journey\":string,\"edgeCases\":string,\"dependency\":string,\"risk\":string,\"analyticsEvent\":{\"name\":string,\"trigger\":string,\"properties\":string[]},\"successMetric\":{\"name\":string,\"definition\":string},\"guardrailMetric\":{\"name\":string,\"definition\":string}}. Every string must be concise and non-empty.",
    "The flow object is exactly {\"assessment\":{\"captureType\":\"complete-journey\"|\"partial-journey\"|\"static-screen\"|\"state-gallery\"|\"content-scroll\",\"completeness\":\"complete\"|\"partial\",\"rationale\":string},\"summary\":{\"purpose\":CompactClaim,\"userValue\":CompactClaim,\"recommendation\":CompactClaim},\"goal\":CompactClaim,\"entryPoint\":CompactClaim,\"completionPoint\":CompactClaim,\"states\":CompactClaim[],\"transitions\":CompactClaim[],\"friction\":CompactClaim[],\"missingStates\":CompactClaim[],\"openQuestions\":CompactClaim[],\"replicationProblem\":string,\"implementation\":ImplementationBrief,\"requirements\":CompactRequirement[]}.",
    "Every observed or inferred compact claim, requirement, and criterion must cite supplied evidence IDs. Proposed and unknown claims use empty evidenceIds.",
    `Keep states, transitions, friction, missingStates, and openQuestions to at most ${maximumEvidenceClaims} combined entries so the expanded document remains within its ${claimBudget}-claim budget.`,
    "Every supplied evidence ID must appear in a requirement or criterion when it supports replication behavior; the application marks remaining screenshots as unscoped.",
    "Requirements describe capabilities, not inventories of every visible label or control. Merge overlapping states that serve the same user goal.",
    "For multi-state evidence, each user story must contain at least two evidence-cited criteria. Group its happy path with supported validation, alternate, or failure outcomes; do not create a separate one-criterion requirement for states in the same journey.",
    "Each acceptance criterion describes one visible state or one inferred transition. Do not combine several screenshots into one long Then statement.",
    "ImplementationBrief is a proposed implementation contract, never an observation. Base it on the evidence and requirements, but do not claim that screenshots prove it.",
    "Do not invent vendor names, API names, database schemas, compliance status, or numerical targets. State dependencies at a capability boundary.",
    "The analytics event is a proposed product event with a stable snake_case name, an exact user-visible trigger, and only decision-useful properties available from the proposed flow.",
    "The success metric must define a measurable product outcome using a numerator and denominator or a duration boundary. The guardrail metric must define a measurable product-harm, failure, abandonment, unavailable-outcome, or incorrect-outcome rate. Do not use screenshot coverage, rendering fidelity, replica review, documentation quality, or evidence completeness as product metrics.",
    "Never answer that analytics or metrics are absent, unspecified, unsupported, or not evidenced. These fields are explicitly review-required proposals, not observations.",
    "The behavior and journey must define the minimum happy path. Edge cases must state the highest-priority failure or recovery behavior. The risk must name the most important unresolved implementation decision.",
    "Return only one raw JSON object with this exact wrapper shape:",
    "{\"screens\":[CompactScreen],\"flow\":flow"
      + (officialDocumentationEnabled ? ",\"documentedContext\":object" : "")
      + "}",
    "Do not use Markdown fences.",
    `Ordered screenshots: ${JSON.stringify(images)}`,
    `Flow input: ${JSON.stringify(prompt)}`,
  ].join("\n");
}

type CompactObject = Record<string, unknown>;

function compactObject(value: unknown): CompactObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as CompactObject
    : {};
}

function compactList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compactText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid response: ${label} must be a non-empty string`);
  }
  return value.trim();
}

function compactStrings(value: unknown, label: string): string[] {
  const values = compactList(value).map((item, index) =>
    compactText(item, `${label}[${index}]`)
  );
  if (!values.length) throw new Error(`invalid response: ${label} must not be empty`);
  return values;
}

function expandCompactFlowResult(value: unknown, prompt: FeatureFlowPrompt): unknown {
  const root = compactObject(value);
  const flow = compactObject(root.flow);
  const summary = compactObject(flow.summary);
  const implementation = compactObject(flow.implementation);
  let claimIndex = 0;
  let requirementIndex = 0;
  let criterionIndex = 0;
  const nextClaim = (
    value: unknown,
    forced?: { kind: "observed" | "inferred" | "proposed" | "unknown"; evidenceIds?: string[] },
  ) => {
    const item = compactObject(value);
    claimIndex += 1;
    return {
      id: `CLM-${String(claimIndex).padStart(3, "0")}`,
      kind: forced?.kind ?? item.kind,
      text: item.text,
      evidenceIds: forced?.evidenceIds ?? (Array.isArray(item.evidenceIds) ? item.evidenceIds : []),
      ...(typeof item.confidence === "number" ? { confidence: item.confidence } : {}),
    };
  };
  const claimList = (
    value: unknown,
    forcedKind?: "observed" | "inferred" | "proposed" | "unknown",
  ) => compactList(value).map((item) =>
    nextClaim(item, forcedKind ? { kind: forcedKind } : undefined)
  );
  const implementationClaim = (
    key: string,
    kind: "proposed" | "unknown" = "proposed",
  ) => nextClaim({
    text: `${kind === "unknown" ? "Decision required" : "Review required"}: ${
      compactText(implementation[key], `implementation.${key}`)
    }`,
  }, {
    kind,
    evidenceIds: [],
  });
  const implementationObject = (key: string): CompactObject => {
    const item = compactObject(implementation[key]);
    if (!Object.keys(item).length) throw new Error(`invalid response: implementation.${key} must be an object`);
    return item;
  };
  const analyticsEvent = implementationObject("analyticsEvent");
  const successMetric = implementationObject("successMetric");
  const guardrailMetric = implementationObject("guardrailMetric");
  const analyticsName = compactText(analyticsEvent.name, "implementation.analyticsEvent.name");
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(analyticsName)) {
    throw new Error("invalid response: implementation.analyticsEvent.name must be snake_case");
  }
  const analyticsTrigger = compactText(
    analyticsEvent.trigger,
    "implementation.analyticsEvent.trigger",
  );
  const analyticsProperties = compactStrings(
    analyticsEvent.properties,
    "implementation.analyticsEvent.properties",
  );
  const successMetricName = compactText(successMetric.name, "implementation.successMetric.name");
  const successMetricDefinition = compactText(
    successMetric.definition,
    "implementation.successMetric.definition",
  );
  if (!/\b(divided by|numerator|denominator|duration|elapsed|time (?:from|to)|rate)\b/i.test(successMetricDefinition)) {
    throw new Error("invalid response: implementation.successMetric.definition must define a rate or duration");
  }
  const guardrailMetricName = compactText(
    guardrailMetric.name,
    "implementation.guardrailMetric.name",
  );
  const guardrailMetricDefinition = compactText(
    guardrailMetric.definition,
    "implementation.guardrailMetric.definition",
  );
  const guardrailIsPlaceholder =
    /\b(?:no|not)\s+(?:guardrail\s+)?metric\s+(?:is\s+)?(?:defined|specified|established|proposed)\b/i
      .test(guardrailMetricDefinition);
  const guardrailIsMeasurable =
    /\b(divided by|numerator|denominator|duration|elapsed|time (?:from|to)|rate)\b/i
      .test(guardrailMetricDefinition);
  if (guardrailIsPlaceholder || !guardrailIsMeasurable) {
    throw new Error("invalid response: implementation.guardrailMetric.definition must define a measurable product-harm rate or duration");
  }
  const analyticsClaim = () => nextClaim({
    text: `Review required: Track ${analyticsName} when ${analyticsTrigger}; properties: ${
      analyticsProperties.join(", ")
    }.`,
  }, { kind: "proposed", evidenceIds: [] });
  const successMetricClaim = () => nextClaim({
    text: `Review required: Measure ${successMetricName}: ${successMetricDefinition}`,
  }, { kind: "proposed", evidenceIds: [] });
  const guardrailMetricClaim = () => nextClaim({
    text: `Review required: Measure ${guardrailMetricName}: ${guardrailMetricDefinition}`,
  }, { kind: "proposed", evidenceIds: [] });
  const interactionsExist = prompt.evidenceManifest.some(
    ({ interaction }) => Boolean(interaction?.trim()),
  );
  const requirements = compactList(flow.requirements).map((value) => {
    const item = compactObject(value);
    requirementIndex += 1;
    return {
      id: `REQ-${String(requirementIndex).padStart(3, "0")}`,
      kind: item.kind,
      text: item.text,
      evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
      userStory: item.userStory,
      priority: "unranked",
      preconditions: [],
      acceptanceCriteria: compactList(item.criteria).map((value) => {
        const criterion = compactObject(value);
        criterionIndex += 1;
        return {
          id: `AC-${String(criterionIndex).padStart(3, "0")}`,
          kind: criterion.kind,
          given: criterion.given,
          when: criterion.when,
          then: criterion.then,
          evidenceIds: Array.isArray(criterion.evidenceIds) ? criterion.evidenceIds : [],
        };
      }),
    };
  });
  // Expansion always adds 18 deterministic claims (summary, flow singles, risk,
  // proposed feature, metrics, dependencies) on top of the requirements, so the
  // evidence-backed lists get whatever the claim budget leaves. Models do not reliably
  // honour the prompt's cap, so trim here instead of failing validation downstream.
  const evidenceLists = {
    openQuestions: compactList(flow.openQuestions),
    missingStates: compactList(flow.missingStates),
    friction: compactList(flow.friction),
    transitions: compactList(flow.transitions),
    states: compactList(flow.states),
  };
  const evidenceAllowance = Math.max(
    0,
    featureDocumentClaimBudget(prompt.allowedEvidenceIds.length)
      - 18
      - requirements.length,
  );
  let overflow = Object.values(evidenceLists)
    .reduce((total, list) => total + list.length, 0) - evidenceAllowance;
  while (overflow > 0) {
    // Drop from the longest list first; ties fall to the lowest-priority key.
    const [longest] = Object.values(evidenceLists)
      .filter((list) => list.length > 0)
      .sort((left, right) => right.length - left.length);
    if (!longest) break;
    longest.pop();
    overflow -= 1;
  }
  const scopedEvidenceIds = new Set(requirements.flatMap((requirement) => [
    ...requirement.evidenceIds,
    ...requirement.acceptanceCriteria.flatMap((criterion) => criterion.evidenceIds),
  ]));
  const unscopedEvidence = prompt.evidenceManifest
    .filter(({ evidenceId }) => !scopedEvidenceIds.has(evidenceId))
    .map(({ evidenceId }) => ({
      evidenceId,
      reason: "This screenshot provides contextual evidence but does not support a separate replication requirement.",
    }));
  const goal = compactObject(flow.goal);
  const screens = compactList(root.screens).map((value) => {
    const screen = compactObject(value);
    return {
      evidenceId: screen.evidenceId,
      visibleUi: typeof screen.visibleState === "string" ? [screen.visibleState] : [],
      visibleText: Array.isArray(screen.visibleText) ? screen.visibleText : [],
      likelyIntent: typeof goal.text === "string" ? goal.text : "",
      availableActions: Array.isArray(screen.availableActions) ? screen.availableActions : [],
      systemFeedback: Array.isArray(screen.visibleFeedback) ? screen.visibleFeedback : [],
      friction: [],
      missingOrUncertainStates: Array.isArray(screen.uncertainty) ? screen.uncertainty : [],
      accessibility: [],
      confidence: screen.confidence,
    };
  });
  const assessment = compactObject(flow.assessment);
  const document = {
    sourceAssessment: {
      captureType: assessment.captureType,
      completeness: interactionsExist ? assessment.completeness : "partial",
      rationale: assessment.rationale,
      evidenceIds: [...prompt.allowedEvidenceIds],
    },
    unscopedEvidence,
    ...(root.documentedContext !== undefined
      ? { documentedContext: root.documentedContext }
      : {}),
    executiveSummary: {
      purpose: nextClaim(summary.purpose),
      userValue: nextClaim(summary.userValue),
      recommendation: nextClaim(summary.recommendation, {
        kind: "proposed",
        evidenceIds: [],
      }),
    },
    observedFlow: {
      userGoal: nextClaim(flow.goal),
      entryPoint: nextClaim(flow.entryPoint),
      completionPoint: nextClaim(flow.completionPoint),
      journey: claimList(evidenceLists.transitions, interactionsExist ? undefined : "inferred"),
      actors: [],
      visibleStates: claimList(evidenceLists.states),
    },
    flowAnalysis: {
      effectivePatterns: [],
      friction: claimList(evidenceLists.friction),
      missingStates: claimList(evidenceLists.missingStates),
      inconsistencies: [],
      risksAndAssumptions: [implementationClaim("risk", "unknown")],
    },
    proposedFeature: {
      problem: nextClaim({
        kind: "proposed",
        text: flow.replicationProblem,
        evidenceIds: [],
      }),
      targetUsers: [implementationClaim("targetUser")],
      goals: [implementationClaim("goal")],
      nonGoals: [implementationClaim("nonGoal")],
      behavior: [implementationClaim("behavior")],
      journey: [implementationClaim("journey")],
    },
    requirements,
    edgeCases: [implementationClaim("edgeCases")],
    successMetrics: [successMetricClaim()],
    guardrailMetrics: [guardrailMetricClaim()],
    analyticsEvents: [analyticsClaim()],
    dependencies: [implementationClaim("dependency")],
    openQuestions: claimList(evidenceLists.openQuestions),
  };
  return { analyses: screens, document };
}

export interface CliFeatureDocumentCapabilities {
  readImages: boolean;
  webSearch: boolean;
}

export interface CliFeatureDocumentEngine {
  providerModel: string;
  binary: string;
  cwd: string;
  maxOutputBytes: number;
  officialDocumentationEnabled: boolean;
  officialDocumentationDomains: string[];
  readTool: string;
  label: string;
  argumentsFor: (prompt: string, capabilities: CliFeatureDocumentCapabilities) => string[];
}

export function createCliFeatureDocumentProvider(
  engine: CliFeatureDocumentEngine,
  runner: KiroCliRunner = runKiroCli,
): FeatureDocumentProvider {
  const invoke = (
    prompt: string,
    capabilities: CliFeatureDocumentCapabilities,
    signal: AbortSignal,
  ): Promise<string> => runner({
    binary: engine.binary,
    args: engine.argumentsFor(prompt, capabilities),
    cwd: engine.cwd,
    signal,
    maxOutputBytes: engine.maxOutputBytes,
    label: engine.label,
  });
  return {
    model: engine.providerModel,
    officialDocumentationEnabled: engine.officialDocumentationEnabled,
    officialDocumentationDomains: engine.officialDocumentationDomains,
    async analyzeFlow(prompt, images, signal) {
      if (images.length < 1) throw new Error("Feature Flow analysis requires images");
      if (images.some(({ image }) => image.bytes.byteLength < 1)) {
        throw new Error("Feature Flow analysis image is empty");
      }
      const directory = await mkdtemp(join(tmpdir(), "astryx-cli-flow-"));
      try {
        const orderedImages = await Promise.all(images.map(async ({ evidence, image }, index) => {
          const normalized = await kiroFlowImage(image);
          const imagePath = join(
            directory,
            `${String(index + 1).padStart(3, "0")}.${normalized.extension}`,
          );
          await writeFile(imagePath, normalized.bytes, { mode: 0o600 });
          return {
            evidenceId: evidence.evidenceId,
            stepIndex: evidence.stepIndex,
            imageIndex: evidence.imageIndex,
            stepLabel: evidence.stepLabel,
            ...(evidence.interaction ? { interaction: evidence.interaction } : {}),
            path: imagePath,
          };
        }));
        const output = await invoke(
          flowPrompt(
            prompt,
            orderedImages,
            engine.officialDocumentationEnabled,
            engine.officialDocumentationDomains,
            engine.readTool,
          ),
          { readImages: true, webSearch: engine.officialDocumentationEnabled },
          signal,
        );
        const compact = extractKiroCliJson(output, (candidate) =>
          Array.isArray(candidate.screens)
          && candidate.flow !== null
          && typeof candidate.flow === "object"
          && !Array.isArray(candidate.flow), engine.label);
        return expandCompactFlowResult(compact, prompt);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    async analyzeImage(prompt, image, signal) {
      if (image.bytes.byteLength < 1) throw new Error("Feature analysis image is empty");
      const directory = await mkdtemp(join(tmpdir(), "astryx-cli-feature-"));
      const imagePath = join(directory, `evidence.${IMAGE_EXTENSIONS[image.contentType]}`);
      try {
        await writeFile(imagePath, image.bytes, { mode: 0o600 });
        const output = await invoke(
          stepPrompt(prompt, imagePath),
          { readImages: true, webSearch: false },
          signal,
        );
        return extractKiroCliJson(output, (candidate) =>
          candidate.evidenceId === prompt.evidenceId
          && Array.isArray(candidate.visibleUi)
          && Array.isArray(candidate.visibleText), engine.label);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    async synthesize(prompt, signal) {
      const output = await invoke(
        synthesisPrompt(
          prompt,
          engine.officialDocumentationEnabled,
          engine.officialDocumentationDomains,
        ),
        { readImages: false, webSearch: engine.officialDocumentationEnabled },
        signal,
      );
      return extractKiroCliJson(output, (candidate) =>
        candidate.executiveSummary !== undefined
        && candidate.observedFlow !== undefined
        && Array.isArray(candidate.requirements), engine.label);
    },
  };
}

export function createKiroCliFeatureDocumentProvider(
  environment: NodeJS.ProcessEnv = process.env,
  runner: KiroCliRunner = runKiroCli,
): FeatureDocumentProvider | undefined {
  const config = kiroCliFeatureDocumentConfigFromEnvironment(environment);
  if (!config) return undefined;
  return createCliFeatureDocumentProvider({
    providerModel: config.providerModel,
    binary: config.binary,
    cwd: config.cwd,
    maxOutputBytes: config.maxOutputBytes,
    officialDocumentationEnabled: config.officialDocumentationEnabled,
    officialDocumentationDomains: config.officialDocumentationDomains,
    readTool: "fs_read",
    label: "Kiro CLI",
    argumentsFor: (prompt, capabilities) => argumentsFor(config, prompt, [
      ...(capabilities.readImages ? ["fs_read"] : []),
      ...(capabilities.webSearch ? ["web_search"] : []),
    ]),
  }, runner);
}
