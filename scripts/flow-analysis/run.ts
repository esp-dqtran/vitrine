import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import sharp, { type OverlayOptions } from "sharp";
import {
  ChatRateLimitError,
  startChatPool,
  type ChatAttachment,
  type ChatSession,
} from "../../src/llmChat.ts";
import { parseBrowserJsonObject } from "../../src/appKnowledgeBrowserProvider.ts";
import { ANTIGRAVITY_BROWSER_MODEL_LABEL } from "../../src/appKnowledgeBrowserProvider.ts";
import { startAntigravitySession } from "../../src/antigravityChat.ts";
import { createObjectStore, objectStoreConfigFromEnvironment } from "../../src/objectStoreConfig.ts";
import type { ObjectMetadata, ObjectStore } from "../../src/objectStore.ts";
import { readCurrentFlows } from "../../src/normalizedFlowStore.ts";
import {
  createSerialQueue,
  isInfrastructureFailure,
  isRateLimitFailure,
  runWithRateLimitCooldown,
  runWithWorkers,
} from "./concurrent-runner.ts";
import { qualityGateFeature } from "./feature-quality.ts";
import { repairJsonStringQuotes } from "./json-repair.ts";
import {
  distributeFlowWork,
  runProviderLanes,
} from "./provider-distributor.ts";
import {
  flowRunConfig,
  type FlowAnalysisProvider,
} from "./runner-config.ts";

type Platform = "android" | "ios" | "web";

interface FlowStep {
  label: string;
  interaction?: string;
  evidence: number[];
}

interface Flow {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  steps: FlowStep[];
}

interface FlowRecord {
  platform: Platform;
  flow: Flow;
}

interface ImageRecord extends ObjectMetadata {
  id: number;
}

interface FeatureDescription {
  title: string;
  featureDescription: string;
  userGoal: string;
  entryPoint: string;
  completionState: string;
  orderedSteps: Array<{
    evidenceId: string;
    name: string;
    description: string;
    userAction: string;
    systemResponse: string;
    confidence: number;
  }>;
  observedBehavior: Array<{ text: string; evidenceIds: string[] }>;
  inferredRules: Array<{ text: string; evidenceIds: string[]; confidence: number }>;
  requirements: Array<{
    id: string;
    text: string;
    priority: "must" | "should" | "could";
    evidenceIds: string[];
  }>;
  edgeCases: Array<{
    scenario: string;
    expectedBehavior: string;
    basis: "observed" | "inferred" | "proposed";
    evidenceIds: string[];
  }>;
  acceptanceCriteria: Array<{
    id: string;
    given: string;
    when: string;
    then: string;
    evidenceIds: string[];
  }>;
  unknowns: string[];
}

interface Progress {
  status: "running" | "done" | "error" | "rate_limited";
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  current?: string;
  updatedAt: string;
  error?: string;
  cooldownAttempt?: number;
  cooldownUntil?: string;
  providers: Partial<Record<FlowAnalysisProvider, {
    assigned: number;
    completed: number;
    failed: number;
  }>>;
}

const {
  app: APP,
  product: PRODUCT,
  root: ROOT,
  applicationName: APPLICATION_NAME,
  providers: ANALYSIS_PROVIDERS,
  reanalyzeProviders: REANALYZE_PROVIDERS,
} = flowRunConfig(process.env, process.cwd());
const CONTACT_SHEETS = join(ROOT, "contact-sheets");
const JSON_DIR = join(ROOT, "json");
const MARKDOWN_DIR = join(ROOT, "markdown");
const RAW_DIR = join(ROOT, "raw");
const PROGRESS_PATH = join(ROOT, "progress.json");
const LOG_PATH = join(ROOT, "run.log");
const FLOW_LIMIT = Number(process.env.FLOW_LIMIT ?? "0");
const PLATFORM = process.env.PLATFORM?.trim() as Platform | undefined;
const FLOW_TITLE = process.env.FLOW_TITLE?.trim();
const RETRIES = Number(process.env.FLOW_RETRIES ?? "2");
const CHATGPT_CONCURRENCY = Number(process.env.CHATGPT_CONCURRENCY ?? "2");
const GEMINI_CONCURRENCY = Number(process.env.GEMINI_CONCURRENCY ?? "1");
const serializeLog = createSerialQueue();

function now(): string {
  return new Date().toISOString();
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function slug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || "flow";
}

function identity(record: FlowRecord): string {
  const shortId = createHash("sha256").update(record.flow.id).digest("hex").slice(0, 10);
  return `${record.platform}-${slug(record.flow.title)}-${shortId}`;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function providerModel(provider: FlowAnalysisProvider): string {
  if (provider === "antigravity") return ANTIGRAVITY_BROWSER_MODEL_LABEL;
  if (provider === "gemini") return "gemini-web";
  return "chatgpt-web";
}

function providerConcurrency(provider: FlowAnalysisProvider): number {
  if (provider === "antigravity") return 1;
  const concurrency = provider === "chatgpt" ? CHATGPT_CONCURRENCY : GEMINI_CONCURRENCY;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid ${provider.toUpperCase()}_CONCURRENCY`);
  }
  return concurrency;
}

async function startProviderPool(
  provider: FlowAnalysisProvider,
): Promise<{ sessions: ChatSession[]; closeAll: () => Promise<void> }> {
  if (provider === "antigravity") {
    const session = await startAntigravitySession(ANTIGRAVITY_BROWSER_MODEL_LABEL);
    return { sessions: [session], closeAll: () => session.close() };
  }
  return await startChatPool(provider, providerConcurrency(provider));
}

async function appendLog(message: string): Promise<void> {
  await serializeLog(async () => {
    const line = `${now()} ${message}\n`;
    let existing = "";
    try { existing = await readFile(LOG_PATH, "utf8"); } catch {}
    await writeFile(LOG_PATH, existing + line, "utf8");
    console.log(message);
  });
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function allEvidence(record: FlowRecord): Array<{
  imageId: number;
  evidenceId: string;
  stepIndex: number;
  imageIndex: number;
  stepLabel: string;
  interaction?: string;
}> {
  const result: ReturnType<typeof allEvidence> = [];
  let ordinal = 0;
  for (const [stepIndex, step] of record.flow.steps.entries()) {
    for (const [imageIndex, imageId] of step.evidence.entries()) {
      ordinal += 1;
      result.push({
        imageId,
        evidenceId: `S${String(ordinal).padStart(2, "0")}`,
        stepIndex,
        imageIndex,
        stepLabel: step.label,
        ...(step.interaction ? { interaction: step.interaction } : {}),
      });
    }
  }
  return result;
}

async function loadInventory(client: pg.Client): Promise<FlowRecord[]> {
  const scopes = await client.query<{ app_id: number; platform: Platform }>(
    `SELECT a.id AS app_id, p.name AS platform
     FROM apps a
     JOIN platforms p ON p.app_id = a.id
     WHERE a.name = $1
       AND p.name IN ('web', 'ios', 'android')
       AND EXISTS (
         SELECT 1 FROM app_flows af
         WHERE af.app_id = a.id AND af.platform = p.name
       )
     ORDER BY CASE p.name WHEN 'web' THEN 1 WHEN 'ios' THEN 2 ELSE 3 END`,
    [APP],
  );
  let records: FlowRecord[] = [];
  for (const { app_id: appId, platform } of scopes.rows) {
    const flows = await readCurrentFlows(client, { appId: Number(appId), platform });
    records.push(...flows.map((flow) => ({ platform, flow })));
  }
  if (PLATFORM) records = records.filter((record) => record.platform === PLATFORM);
  if (FLOW_TITLE) records = records.filter((record) => record.flow.title === FLOW_TITLE);
  if (FLOW_LIMIT > 0) records = records.slice(0, FLOW_LIMIT);
  return records;
}

async function loadImages(client: pg.Client, records: FlowRecord[]): Promise<Map<number, ImageRecord>> {
  const ids = [...new Set(records.flatMap((record) => allEvidence(record).map(({ imageId }) => imageId)))];
  const result = await client.query<{
    id: number;
    object_key: string;
    sha256: string;
    byte_size: number;
    content_type: ObjectMetadata["contentType"];
    access_class: ObjectMetadata["accessClass"];
  }>(
    `SELECT i.id, so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
     FROM images i
     JOIN stored_objects so ON so.object_key = i.object_key
     WHERE i.id = ANY($1::integer[])`,
    [ids],
  );
  return new Map(result.rows.map((row) => [Number(row.id), {
    id: Number(row.id),
    key: row.object_key,
    sha256: row.sha256,
    byteSize: Number(row.byte_size),
    contentType: row.content_type,
    accessClass: row.access_class,
  }]));
}

function sheetLayout(platform: Platform): { cellWidth: number; cellHeight: number; columns: number; gap: number } {
  return platform === "web"
    ? { cellWidth: 480, cellHeight: 300, columns: 3, gap: 12 }
    : { cellWidth: 280, cellHeight: 560, columns: 5, gap: 12 };
}

async function contactSheet(
  record: FlowRecord,
  images: Map<number, ImageRecord>,
  store: ObjectStore,
): Promise<{ path: string; buffer: Buffer; evidence: ReturnType<typeof allEvidence> }> {
  const evidence = allEvidence(record);
  const outputPath = join(CONTACT_SHEETS, `${identity(record)}.jpg`);
  try {
    return { path: outputPath, buffer: await readFile(outputPath), evidence };
  } catch {}

  const layout = sheetLayout(record.platform);
  const rows = Math.ceil(evidence.length / layout.columns);
  const width = layout.columns * layout.cellWidth + (layout.columns - 1) * layout.gap;
  const height = rows * layout.cellHeight + Math.max(0, rows - 1) * layout.gap;
  const composites: OverlayOptions[] = [];

  for (const [index, item] of evidence.entries()) {
    const metadata = images.get(item.imageId);
    if (!metadata) throw new Error(`Missing metadata for image ${item.imageId}`);
    const object = await store.get(metadata.key);
    const thumbnail = await sharp(object.body)
      .rotate()
      .resize({
        width: layout.cellWidth,
        height: layout.cellHeight,
        fit: "contain",
        background: { r: 246, g: 247, b: 249, alpha: 1 },
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    composites.push({
      input: thumbnail,
      left: column * (layout.cellWidth + layout.gap),
      top: row * (layout.cellHeight + layout.gap),
    });
  }

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 229, g: 231, b: 235 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  await writeFile(outputPath, buffer);
  return { path: outputPath, buffer, evidence };
}

function prompt(record: FlowRecord, evidence: ReturnType<typeof allEvidence>): string {
  const evidenceMap = evidence.map((item) => ({
    evidenceId: item.evidenceId,
    contactSheetPosition: "left-to-right, then top-to-bottom",
    stepNumber: item.stepIndex + 1,
    imageWithinStep: item.imageIndex + 1,
    stepLabel: item.stepLabel,
    interaction: item.interaction ?? null,
    imageId: item.imageId,
  }));
  return [
    "Return JSON only. Do not use Markdown fences.",
    "Analyze the attached contact sheet as one complete product flow.",
    "It contains every ordered screenshot for this flow, arranged left-to-right and then top-to-bottom.",
    "Inspect each screenshot. Do not omit a screenshot, invent hidden behavior, or claim unseen error/permission states.",
    "Use only evidence IDs supplied below. Observed claims require evidence. Clearly separate observation, inference, proposal, and unknowns.",
    "",
    `Product: ${PRODUCT}`,
    `Platform: ${record.platform}`,
    `Flow title: ${record.flow.title}`,
    `Flow description: ${record.flow.description ?? ""}`,
    `Category: ${record.flow.category ?? ""}`,
    `Tags: ${(record.flow.tags ?? []).join(", ")}`,
    `Evidence map: ${JSON.stringify(evidenceMap)}`,
    "",
    "Return exactly this top-level JSON shape:",
    JSON.stringify({
      title: "string",
      featureDescription: "A concise PM-ready description of what the feature enables and why.",
      userGoal: "string",
      entryPoint: "string; say unknown if not visible",
      completionState: "string; say unknown if not visible",
      orderedSteps: [{
        evidenceId: "S01",
        name: "short step name",
        description: "what is visibly happening",
        userAction: "visible or strongly implied action; otherwise unknown",
        systemResponse: "visible response; otherwise unknown",
        confidence: 0.0,
      }],
      observedBehavior: [{ text: "string", evidenceIds: ["S01"] }],
      inferredRules: [{ text: "string", evidenceIds: ["S01"], confidence: 0.0 }],
      requirements: [{ id: "REQ-01", text: "string", priority: "must", evidenceIds: ["S01"] }],
      edgeCases: [{ scenario: "string", expectedBehavior: "string", basis: "proposed", evidenceIds: [] }],
      acceptanceCriteria: [{
        id: "AC-01",
        given: "string",
        when: "string",
        then: "string",
        evidenceIds: ["S01"],
      }],
      unknowns: ["string"],
    }),
    "",
    `orderedSteps must contain exactly ${evidence.length} entries, one for every supplied evidenceId in order.`,
    "Requirements and acceptance criteria may be proposed, but their evidenceIds must be empty unless the screenshots directly support them.",
  ].join("\n");
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateFeature(
  value: Record<string, unknown>,
  evidenceIds: string[],
): {
  feature: FeatureDescription;
  quality: { score: number; warnings: string[] };
} {
  for (const key of ["title", "featureDescription", "userGoal", "entryPoint", "completionState"] as const) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`Invalid ${key}`);
  }
  if (!strings(value.unknowns)) throw new Error("Invalid unknowns");
  const quality = qualityGateFeature(value, evidenceIds);
  return {
    feature: quality.value as unknown as FeatureDescription,
    quality: {
      score: quality.score,
      warnings: quality.warnings,
    },
  };
}

function parseChatObject(raw: string): Record<string, unknown> {
  try {
    return parseBrowserJsonObject(raw);
  } catch (originalError) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1]?.trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const embedded = firstBrace >= 0 && lastBrace > firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : undefined;
    for (const candidate of [raw, fenced, embedded]) {
      if (!candidate) continue;
      for (const attempt of [candidate, repairJsonStringQuotes(candidate)]) {
        try {
          const value = JSON.parse(attempt);
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return value as Record<string, unknown>;
          }
        } catch {}
      }
    }
    throw originalError;
  }
}

function renderMarkdown(
  record: FlowRecord,
  feature: FeatureDescription,
  sheetPath: string,
  analysis: {
    provider: FlowAnalysisProvider;
    model: string;
    qualityScore: number;
    qualityWarnings: string[];
  },
): string {
  const lines = [
    `# ${feature.title}`,
    "",
    `- Product: ${PRODUCT}`,
    `- Platform: ${record.platform}`,
    `- Source flow: ${record.flow.title}`,
    `- Source flow ID: ${record.flow.id}`,
    `- Evidence images: ${allEvidence(record).length}`,
    `- Analysis provider: ${analysis.provider}`,
    `- Provider model: ${analysis.model}`,
    `- Quality score: ${analysis.qualityScore}`,
    `- Contact sheet: [${sheetPath.split("/").at(-1)}](../contact-sheets/${sheetPath.split("/").at(-1)})`,
    ...(analysis.qualityWarnings.length
      ? [`- Quality warnings: ${analysis.qualityWarnings.join("; ")}`]
      : []),
    "",
    "## Feature description",
    "",
    feature.featureDescription,
    "",
    "## User goal",
    "",
    feature.userGoal,
    "",
    "## Entry and completion",
    "",
    `- Entry point: ${feature.entryPoint}`,
    `- Completion state: ${feature.completionState}`,
    "",
    "## Ordered flow",
    "",
    ...feature.orderedSteps.flatMap((step, index) => [
      `### ${index + 1}. ${step.name} (${step.evidenceId})`,
      "",
      step.description,
      "",
      `- User action: ${step.userAction}`,
      `- System response: ${step.systemResponse}`,
      `- Confidence: ${step.confidence}`,
      "",
    ]),
    "## Observed behavior",
    "",
    ...feature.observedBehavior.map((item) => `- ${item.text} (${item.evidenceIds.join(", ")})`),
    "",
    "## Inferred rules",
    "",
    ...feature.inferredRules.map((item) => `- ${item.text} (${item.evidenceIds.join(", ")}; confidence ${item.confidence})`),
    "",
    "## Requirements",
    "",
    ...feature.requirements.map((item) => `- **${item.id} · ${item.priority.toUpperCase()}** — ${item.text}${item.evidenceIds.length ? ` (${item.evidenceIds.join(", ")})` : ""}`),
    "",
    "## Edge cases",
    "",
    ...feature.edgeCases.map((item) => `- **${item.scenario}** — ${item.expectedBehavior} _[${item.basis}]_${item.evidenceIds.length ? ` (${item.evidenceIds.join(", ")})` : ""}`),
    "",
    "## Acceptance criteria",
    "",
    ...feature.acceptanceCriteria.flatMap((item) => [
      `### ${item.id}`,
      "",
      `- Given ${item.given}`,
      `- When ${item.when}`,
      `- Then ${item.then}`,
      ...(item.evidenceIds.length ? [`- Evidence: ${item.evidenceIds.join(", ")}`] : []),
      "",
    ]),
    "## Unknowns",
    "",
    ...(feature.unknowns.length ? feature.unknowns.map((item) => `- ${item}`) : ["- None stated."]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function alreadyComplete(record: FlowRecord): Promise<boolean> {
  const base = identity(record);
  try {
    const value = JSON.parse(await readFile(join(JSON_DIR, `${base}.json`), "utf8")) as {
      analysis?: { provider?: string };
      source?: { flowId?: string };
      feature?: { featureDescription?: string };
    };
    return value.source?.flowId === record.flow.id
      && Boolean(value.feature?.featureDescription)
      && !REANALYZE_PROVIDERS.includes(
        value.analysis?.provider as FlowAnalysisProvider,
      );
  } catch {
    return false;
  }
}

async function analyze(
  session: ChatSession,
  provider: FlowAnalysisProvider,
  record: FlowRecord,
  images: Map<number, ImageRecord>,
  store: ObjectStore,
): Promise<{ score: number; warnings: string[] }> {
  const sheet = await contactSheet(record, images, store);
  const attachment: ChatAttachment = {
    name: `${identity(record)}.jpg`,
    mimeType: "image/jpeg",
    buffer: sheet.buffer,
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES + 1; attempt += 1) {
    try {
      const raw = await session.ask(prompt(record, sheet.evidence), attachment);
      await writeFile(
        join(RAW_DIR, `${identity(record)}-${provider}-attempt-${attempt}.txt`),
        raw,
        "utf8",
      );
      const parsed = parseChatObject(raw);
      const { feature, quality } = validateFeature(
        parsed,
        sheet.evidence.map(({ evidenceId }) => evidenceId),
      );
      const base = identity(record);
      const analysis = {
        provider,
        model: providerModel(provider),
        qualityScore: quality.score,
        qualityWarnings: quality.warnings,
      };
      await atomicJson(join(JSON_DIR, `${base}.json`), {
        generatedAt: now(),
        analysis,
        source: {
          app: APP,
          platform: record.platform,
          flowId: record.flow.id,
          title: record.flow.title,
          description: record.flow.description ?? "",
          category: record.flow.category ?? "",
          tags: record.flow.tags ?? [],
          evidence: sheet.evidence,
        },
        feature,
      });
      await writeFile(
        join(MARKDOWN_DIR, `${base}.md`),
        renderMarkdown(record, feature, sheet.path, analysis),
        "utf8",
      );
      return quality;
    } catch (error) {
      lastError = error;
      if (
        error instanceof ChatRateLimitError
        || isRateLimitFailure(error)
        || isInfrastructureFailure(error)
      ) {
        throw error;
      }
      await appendLog(
        `${provider} · ${identity(record)} attempt ${attempt} failed: ${stringifyError(error)}`,
      );
    }
  }
  throw lastError;
}

async function writeIndex(records: FlowRecord[]): Promise<void> {
  const rows: string[] = [];
  for (const record of records) {
    if (await alreadyComplete(record)) {
      const base = identity(record);
      rows.push(`- [${record.platform} · ${record.flow.title}](markdown/${base}.md)`);
    }
  }
  await writeFile(
    join(ROOT, "README.md"),
    [
      `# ${PRODUCT} flow feature descriptions`,
      "",
      `Generated from the complete ordered screenshot evidence for each flow.`,
      "",
      `Completed: ${rows.length}/${records.length}`,
      "",
      ...rows,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main(): Promise<void> {
  await Promise.all([
    mkdir(CONTACT_SHEETS, { recursive: true }),
    mkdir(JSON_DIR, { recursive: true }),
    mkdir(MARKDOWN_DIR, { recursive: true }),
    mkdir(RAW_DIR, { recursive: true }),
  ]);
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    statement_timeout: 60_000,
    query_timeout: 60_000,
    application_name: APPLICATION_NAME,
  });
  await client.connect();
  const records = await loadInventory(client);
  if (!records.length) throw new Error(`No matching ${PRODUCT} flows`);
  const images = await loadImages(client, records);
  await client.end();
  const expectedIds = new Set(records.flatMap((record) => allEvidence(record).map(({ imageId }) => imageId)));
  if (images.size !== expectedIds.size) {
    throw new Error(`Image completeness failed: ${images.size}/${expectedIds.size}`);
  }

  const store = createObjectStore(objectStoreConfigFromEnvironment(process.env));
  const progress: Progress = {
    status: "running",
    total: records.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    updatedAt: now(),
    providers: {},
  };
  const incomplete: FlowRecord[] = [];
  for (const record of records) {
    if (await alreadyComplete(record)) {
      progress.completed += 1;
      progress.skipped += 1;
    } else {
      incomplete.push(record);
    }
  }
  for (const lane of distributeFlowWork(incomplete, ANALYSIS_PROVIDERS, identity)) {
    progress.providers[lane.provider] = {
      assigned: lane.items.length,
      completed: 0,
      failed: 0,
    };
  }
  await atomicJson(PROGRESS_PATH, progress);
  await writeIndex(records);
  await appendLog(
    `Starting ${records.length} flow(s); ${progress.skipped} already complete; `
    + `providers ${ANALYSIS_PROVIDERS.join(", ")}`,
  );
  if (progress.completed === progress.total) {
    progress.status = "done";
    progress.updatedAt = now();
    await atomicJson(PROGRESS_PATH, progress);
    return;
  }

  const serializeState = createSerialQueue();
  const active = new Set<string>();
  await runWithRateLimitCooldown({
    isRateLimit: (error) => error instanceof ChatRateLimitError || isRateLimitFailure(error),
    sleep,
    onCooldown: async (cooldown, error) => {
      await serializeState(async () => {
        progress.status = "rate_limited";
        progress.error = stringifyError(error);
        progress.cooldownAttempt = cooldown.attempt;
        progress.cooldownUntil = cooldown.until;
        delete progress.current;
        progress.updatedAt = now();
        await atomicJson(PROGRESS_PATH, progress);
        await appendLog(
          `Rate limited; cooldown ${cooldown.attempt} until ${cooldown.until} `
          + `(${Math.round(cooldown.delayMs / 60_000)} minutes)`,
        );
      });
    },
    onResume: async () => {
      await serializeState(async () => {
        progress.status = "running";
        delete progress.error;
        delete progress.cooldownAttempt;
        delete progress.cooldownUntil;
        progress.updatedAt = now();
        await atomicJson(PROGRESS_PATH, progress);
        await appendLog("Cooldown complete; resuming incomplete flows");
      });
    },
    run: async (resetCooldown) => {
      const pending: FlowRecord[] = [];
      for (const record of records) {
        if (!(await alreadyComplete(record))) pending.push(record);
      }
      if (!pending.length) return;

      await runProviderLanes(
        distributeFlowWork(pending, ANALYSIS_PROVIDERS, identity)
          .filter(({ items }) => items.length > 0),
        async ({ provider, items }) => {
            const { sessions, closeAll } = await startProviderPool(provider);
            await appendLog(
              `Provider ${provider} starting ${items.length} flow(s) with `
              + `${sessions.length} worker(s)`,
            );
            try {
              await runWithWorkers(items, sessions, async (session, record) => {
                const flowLabel = `${record.platform} · ${record.flow.title}`;
                const label = `${provider} · ${flowLabel}`;
                await serializeState(async () => {
                  active.add(label);
                  progress.current = [...active].join(" | ");
                  progress.updatedAt = now();
                  await atomicJson(PROGRESS_PATH, progress);
                  await appendLog(
                    `Analyzing ${label} (${allEvidence(record).length} images)`,
                  );
                });

                let failure: unknown;
                let quality: { score: number; warnings: string[] } | undefined;
                try {
                  quality = await analyze(session, provider, record, images, store);
                } catch (error) {
                  failure = error;
                }

                await serializeState(async () => {
                  active.delete(label);
                  const providerProgress = progress.providers[provider]!;
                  if (failure === undefined) {
                    progress.completed += 1;
                    providerProgress.completed += 1;
                    resetCooldown();
                    delete progress.error;
                    await appendLog(
                      `Completed ${label}; quality ${quality!.score}`
                      + (quality!.warnings.length
                        ? `; warnings ${quality!.warnings.join("; ")}`
                        : ""),
                    );
                  } else {
                    progress.error = stringifyError(failure);
                    if (failure instanceof ChatRateLimitError || isRateLimitFailure(failure)) {
                      progress.status = "rate_limited";
                      await appendLog(
                        `Rate limited while analyzing ${label}; flow will be retried`,
                      );
                    } else {
                      progress.failed += 1;
                      providerProgress.failed += 1;
                      await appendLog(`Failed ${label}: ${progress.error}`);
                    }
                  }
                  if (active.size) progress.current = [...active].join(" | ");
                  else delete progress.current;
                  progress.updatedAt = now();
                  await atomicJson(PROGRESS_PATH, progress);
                  await writeIndex(records);
                });

                if (
                  failure instanceof ChatRateLimitError
                  || isRateLimitFailure(failure)
                  || isInfrastructureFailure(failure)
                ) {
                  throw failure;
                }
              });
            } finally {
              await closeAll();
            }
        },
      );
    },
  });

  await serializeState(async () => {
    progress.status = progress.failed ? "error" : "done";
    delete progress.current;
    delete progress.error;
    delete progress.cooldownAttempt;
    delete progress.cooldownUntil;
    progress.updatedAt = now();
    await atomicJson(PROGRESS_PATH, progress);
    await writeIndex(records);
  });
}

main().catch(async (error) => {
  await appendLog(`Run stopped: ${stringifyError(error)}`).catch(() => {});
  process.exitCode = 1;
});
