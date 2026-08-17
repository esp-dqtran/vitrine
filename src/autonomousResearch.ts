import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildCorpus,
  collectResearchPages,
  extractJson,
  fetchAndVerifyResearchSources,
  type ResearchPage,
} from "./appResearch.ts";
import {
  parseAppDossier,
  type AppDossier,
  type AppResearchProfile,
  type CandidateFlow,
  type CredentialCapability,
  type DossierClaim,
  type DossierSource,
} from "./autonomousCrawler.ts";
import { flowResearchMarkdownPath } from "./flowPreparation.ts";
import {
  extractKiroCliJson,
  runKiroCli,
  type KiroCliRunner,
} from "./kiroCliFeatureDocumentProvider.ts";
import type { ChatSession } from "./llmChat.ts";

export interface ResearchDossierInput {
  app: string;
  homepageUrl: string;
}

export interface ResearchReport {
  sourceCandidates: string[];
  claims: DossierClaim[];
  candidateFlows: CandidateFlow[];
  roles: string[];
  capabilities: string[];
  openQuestions: string[];
  profile?: AppResearchProfile;
  credentialCapabilities?: CredentialCapability[];
}

export interface VerifiedResearchSource extends DossierSource {
  text: string;
}

export interface ResearchDossierDependencies {
  sessions: ChatSession[];
  collectResearchPages(homepageUrl: string): Promise<ResearchPage[]>;
  fetchAndVerifySources(urls: string[], homepageUrl: string): Promise<VerifiedResearchSource[]>;
}

export interface KiroResearchDossierDependencies {
  collectResearchPages(homepageUrl: string): Promise<ResearchPage[]>;
  fetchAndVerifySources(urls: string[], homepageUrl: string): Promise<VerifiedResearchSource[]>;
  runKiro: KiroCliRunner;
  environment: NodeJS.ProcessEnv;
}

export const researchAssignments = () => [
  { key: "product", question: "Purpose, audience, terminology and primary navigation" },
  { key: "workflows", question: "Documented end-to-end user goals and prerequisites" },
  { key: "roles-auth", question: "Roles, permissions, sign-in and onboarding" },
  { key: "pricing-risk", question: "Billing, account mutation and destructive workflows" },
  { key: "changes", question: "Recent release notes and newly documented capabilities" },
] as const;

type ResearchAssignment = ReturnType<typeof researchAssignments>[number];

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  return array(value, label).map((item) => {
    if (typeof item !== "string" || !item.trim()) throw new Error(`${label} must contain non-empty strings`);
    return item.trim();
  });
}

export function buildDossierPrompt(
  input: ResearchDossierInput,
  assignment: ResearchAssignment,
  owned: ResearchPage[],
): string {
  return `Research one bounded aspect of ${input.app} using only cited public sources.
Question: ${assignment.question}
Homepage: ${input.homepageUrl}

Return raw JSON with exactly these fields:
{"sourceCandidates":["https://..."],"profile":{"name":"...","canonicalUrl":"https://...","category":"...","description":"...","sourceUrls":["https://..."],"iconUrl":"https://..."},"claims":[{"text":"...","sourceUrls":["https://..."],"confidence":0.9}],"candidateFlows":[{"id":"...","title":"...","goal":"...","productArea":"...","mode":"read","prerequisites":[],"sourceUrls":["https://..."],"access":"public|sign_in_required|test_account_required|unknown","readiness":"ready|needs_review|blocked","confidence":0.9,"credentialCapability":"optional.alias","candidateSteps":[{"title":"...","sourceUrls":["https://..."],"evidence":"documented|inferred"}]}],"credentialCapabilities":[{"alias":"...","purpose":"...","role":"...","allowedOrigins":["https://app.example"],"flowIds":["flow-id"],"sourceUrls":["https://..."]}],"roles":[],"capabilities":[],"openQuestions":[]}

Every claim and candidate flow must cite its sourceCandidates. Never include credentials, cookies, tokens, or private data.

Owned research pages:
${buildCorpus(owned)}`;
}

/**
 * This is deliberately a research-only prompt. Kiro may search to discover
 * first-party public documentation, but our process fetches every returned URL
 * before it becomes a dossier citation.
 */
export function buildKiroDossierPrompt(input: ResearchDossierInput, owned: ResearchPage[]): string {
  return `Build a Stage 1 research handoff for ${input.app}. This handoff is for a later browser-capture agent; it is not evidence of observed product behavior.

Homepage: ${input.homepageUrl}

You may use web search only to discover public first-party pages for this product. Do not sign in, use credentials, access private pages, or use any non-public source. Use the supplied public-page corpus as your primary evidence.

Return raw JSON only, with exactly these fields:
{"sourceCandidates":["https://..."],"profile":{"name":"...","canonicalUrl":"https://...","category":"...","description":"...","sourceUrls":["https://..."],"iconUrl":"https://..."},"claims":[{"text":"...","sourceUrls":["https://..."],"confidence":0.9}],"candidateFlows":[{"id":"...","title":"...","goal":"...","productArea":"...","mode":"read|mutate","prerequisites":[],"sourceUrls":["https://..."],"access":"public|sign_in_required|test_account_required|unknown","readiness":"ready|needs_review|blocked","confidence":0.9,"credentialCapability":"optional.alias","candidateSteps":[{"title":"...","sourceUrls":["https://..."],"evidence":"documented|inferred"}]}],"credentialCapabilities":[{"alias":"...","purpose":"...","role":"...","allowedOrigins":["https://..."],"flowIds":["flow-id"],"sourceUrls":["https://..."]}],"roles":[],"capabilities":[],"openQuestions":[]}

Rules:
- sourceCandidates is the complete set of every URL cited anywhere else in the response. Cite only public first-party sources.
- Each sourceCandidate must be a public HTML or text page that can be fetched directly. Never cite image assets, video, JavaScript, CSS, feeds, social posts, or login pages.
- iconUrl and credentialCapability are optional. Omit either field when it is unknown; never use an empty string, null, or a sentinel such as "none".
- Produce 3 to 8 strong candidate flows when evidence supports them. For a content site, use public reader journeys rather than inventing an authenticated product workflow.
- Mark a candidate step documented only when the source directly supports it; otherwise use inferred. Do not make unsupported UI claims.
- Never include credential values, cookies, tokens, or personal data. A credential capability is an alias only and is allowed only when supported by a source.
- A later Stage 2 agent will validate these candidates in the real product and capture observed states.

Owned public-page corpus:
${buildCorpus(owned)}`;
}

export function parseResearchReport(reply: string): ResearchReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(reply));
  } catch (error) {
    throw new Error(`Research report is invalid: ${(error as Error).message}`);
  }
  const raw = object(parsed, "Research report");
  const allowed = new Set(["sourceCandidates", "profile", "claims", "candidateFlows", "credentialCapabilities", "roles", "capabilities", "openQuestions"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new Error("Research report contains an unexpected field");
  const rawProfile = raw.profile === undefined ? undefined : object(raw.profile, "Research profile");
  const profile = rawProfile === undefined
    ? undefined
    : (() => {
      const { iconUrl, ...fields } = rawProfile;
      return {
        ...fields,
        ...(typeof iconUrl === "string" && iconUrl.trim() ? { iconUrl: iconUrl.trim() } : {}),
      } as AppResearchProfile;
    })();
  return {
    sourceCandidates: strings(raw.sourceCandidates, "Research source candidates"),
    claims: array(raw.claims, "Research claims").map((value) => object(value, "Research claim") as unknown as DossierClaim),
    candidateFlows: array(raw.candidateFlows, "Research candidate flows").map((value) => {
      const flow = object(value, "Research candidate flow");
      const { credentialCapability, ...fields } = flow;
      return {
        ...fields,
        ...(typeof credentialCapability === "string"
          && credentialCapability.trim()
          && !["none", "n/a", "not applicable"].includes(credentialCapability.trim().toLowerCase())
          ? { credentialCapability: credentialCapability.trim() }
          : {}),
      } as CandidateFlow;
    }),
    roles: strings(raw.roles, "Research roles"),
    capabilities: strings(raw.capabilities, "Research capabilities"),
    openQuestions: strings(raw.openQuestions, "Research open questions"),
    ...(profile ? { profile } : {}),
    credentialCapabilities: raw.credentialCapabilities === undefined
      ? []
      : array(raw.credentialCapabilities, "Research credential capabilities")
        .map((value) => object(value, "Research credential capability") as unknown as CredentialCapability),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function markdownSources(
  dossier: AppDossier,
  sourceUrls: readonly string[],
  indent = "",
): string[] {
  const sourceByUrl = new Map(dossier.sources.map((source) => [source.url, source]));
  return sourceUrls.map((url) => {
    const source = sourceByUrl.get(url);
    return `${indent}- [${source?.title ?? url}](${url})${source?.kind ? ` — ${source.kind}` : ""}`;
  });
}

/**
 * Writes one source-backed Stage 1 candidate flow for local review. This is
 * deliberately filesystem-only: it does not create a run, touch a database,
 * or resolve any credential values.
 */
export function writeLocalFlowResearchMarkdown(
  input: AppDossier,
  flowId: string,
  dataDir = "data",
): string {
  const dossier = parseAppDossier(input);
  const flow = dossier.candidateFlows.find(({ id }) => id === flowId);
  if (!flow) throw new Error(`Research flow ${flowId} was not found`);
  const credential = flow.credentialCapability
    ? dossier.credentialCapabilities?.find(({ alias }) => alias === flow.credentialCapability)
    : undefined;
  const path = flowResearchMarkdownPath(dossier.app, flow.id, dataDir);
  const steps = flow.candidateSteps?.length
    ? flow.candidateSteps.flatMap((step, index) => [
      `${index + 1}. ${step.title} — ${step.evidence}`,
      ...markdownSources(dossier, step.sourceUrls, "   "),
    ])
    : ["- No candidate steps were established; retain this flow for research review only."];
  const lines = [
    `# ${flow.title}`,
    "",
    "## Research handoff",
    "",
    `- **App:** ${dossier.profile?.name ?? dossier.app}`,
    `- **Flow ID:** ${flow.id}`,
    `- **Product area:** ${flow.productArea}`,
    `- **Goal:** ${flow.goal}`,
    `- **Mode:** ${flow.mode}`,
    `- **Access:** ${flow.access ?? "unknown"}`,
    `- **Readiness:** ${flow.readiness ?? "needs_review"}`,
    `- **Confidence:** ${flow.confidence ?? "not scored"}`,
    "",
    "## Candidate steps",
    "",
    ...steps,
    "",
    "## Supporting sources",
    "",
    ...markdownSources(dossier, flow.sourceUrls),
    "",
    "## Credential capability",
    "",
    ...(credential ? [
      `- **Alias:** ${credential.alias}`,
      `- **Purpose:** ${credential.purpose}`,
      `- **Role:** ${credential.role}`,
      `- **Allowed origins:** ${credential.allowedOrigins.join(", ")}`,
      "",
      "This file intentionally contains no credential values, tokens, cookies, or session data.",
    ] : ["- No credential capability is required or has been established."]),
    "",
    "## Execution boundary",
    "",
    "Stage 2 must validate this flow in the real product and record only observed states as capture evidence.",
    "",
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

export function mergeResearchReports(
  app: string,
  reports: ResearchReport[],
  fetchedSources: VerifiedResearchSource[],
): AppDossier {
  const sourceByUrl = new Map(fetchedSources.map((source) => [source.url, source]));
  const claims = reports.flatMap(({ claims }) => claims);
  const candidateFlows = [...new Map(
    reports.flatMap(({ candidateFlows }) => candidateFlows).map((flow) => [flow.id, flow]),
  ).values()];
  const profile = reports.map(({ profile }) => profile).find(Boolean);
  const credentialCapabilities = [...new Map(
    reports.flatMap(({ credentialCapabilities }) => credentialCapabilities ?? []).map((capability) => [capability.alias, capability]),
  ).values()];
  for (const citations of [
    ...claims.map(({ sourceUrls }) => sourceUrls),
    ...candidateFlows.map(({ sourceUrls }) => sourceUrls),
  ]) {
    if (citations.length === 0 || citations.some((url) => !sourceByUrl.has(url))) {
      throw new Error("Research report citation was not fetched successfully");
    }
  }
  const sources = [...sourceByUrl.values()]
    .sort((left, right) => left.url.localeCompare(right.url))
    .map(({ text: _text, ...source }) => source);
  return parseAppDossier({
    app,
    purpose: claims[0]?.text ?? `Research-backed product dossier for ${app}`,
    sources,
    claims,
    roles: unique(reports.flatMap(({ roles }) => roles)),
    capabilities: unique(reports.flatMap(({ capabilities }) => capabilities)),
    candidateFlows,
    openQuestions: unique(reports.flatMap(({ openQuestions }) => openQuestions)),
    ...(profile ? { profile } : {}),
    ...(credentialCapabilities.length ? { credentialCapabilities } : {}),
  });
}

export async function researchDossier(
  input: ResearchDossierInput,
  dependencies: ResearchDossierDependencies,
): Promise<AppDossier> {
  const assignments = researchAssignments();
  if (dependencies.sessions.length < assignments.length) throw new Error("Five research sessions are required");
  const owned = await dependencies.collectResearchPages(input.homepageUrl);
  const reports = await Promise.all(assignments.map((assignment, index) =>
    dependencies.sessions[index].ask(buildDossierPrompt(input, assignment, owned)).then(parseResearchReport)
  ));
  const sourceCandidates = unique(reports.flatMap(({ sourceCandidates }) => sourceCandidates));
  const sources = await dependencies.fetchAndVerifySources(sourceCandidates, input.homepageUrl);
  return mergeResearchReports(input.app, reports, sources);
}

function kiroResearchConfig(environment: NodeJS.ProcessEnv): { binary: string; model: string; effort: string } {
  const model = environment.KIRO_CLI_RESEARCH_MODEL?.trim() || "gpt-5.6-terra";
  const effort = environment.KIRO_CLI_RESEARCH_EFFORT?.trim().toLowerCase() || "high";
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(model)) throw new Error("Invalid Kiro research model");
  if (!/^(low|medium|high|xhigh|max)$/.test(effort)) throw new Error("Invalid Kiro research effort");
  return { binary: environment.KIRO_CLI_BIN?.trim() || "kiro-cli", model, effort };
}

const kiroResearchDefaults: KiroResearchDossierDependencies = {
  collectResearchPages,
  fetchAndVerifySources: fetchAndVerifyResearchSources,
  runKiro: runKiroCli,
  environment: process.env,
};

/**
 * Database-free Stage 1 research through the project's Kiro CLI provider.
 * Citations are independently fetched before a report is accepted.
 */
export async function researchDossierWithKiro(
  input: ResearchDossierInput,
  overrides: Partial<KiroResearchDossierDependencies> = {},
): Promise<AppDossier> {
  const dependencies = { ...kiroResearchDefaults, ...overrides };
  const owned = await dependencies.collectResearchPages(input.homepageUrl);
  if (owned.length === 0) throw new Error(`Could not read any public pages from ${input.homepageUrl}`);
  const config = kiroResearchConfig(dependencies.environment);
  const prompt = buildKiroDossierPrompt(input, owned);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await dependencies.runKiro({
      binary: config.binary,
      args: [
        "chat",
        "--model", config.model,
        "--effort", config.effort,
        "--no-interactive",
        "--trust-tools=web_search",
        "--wrap", "never",
        attempt === 0
          ? prompt
          : `${prompt}\n\nYour previous response cited a source that could not be independently fetched as public HTML/text. Return a corrected response with only directly fetchable public HTML/text sourceCandidates.`,
      ],
      cwd: process.cwd(),
      signal: AbortSignal.timeout(180_000),
      maxOutputBytes: 1_000_000,
      label: "Stage 1 Kiro research",
    });
    const parsed = extractKiroCliJson(
      output,
      (candidate) => {
        try {
          parseResearchReport(JSON.stringify(candidate));
          return true;
        } catch {
          return false;
        }
      },
      "Stage 1 Kiro research",
    );
    const report = parseResearchReport(JSON.stringify(parsed));
    try {
      const sources = await dependencies.fetchAndVerifySources(report.sourceCandidates, input.homepageUrl);
      return mergeResearchReports(input.app, [report], sources);
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Stage 1 Kiro research did not return a verified report");
}
