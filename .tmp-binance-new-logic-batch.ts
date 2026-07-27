import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import pg from "pg";
import {
  featureEvidenceManifestSha256,
  parseFeatureDocumentContent,
  type FeatureDocumentContent,
  type FeatureEvidenceManifestItem,
  type FeatureRequirement,
  type FeatureSourceFlow,
} from "./src/featureDocument.ts";

const APP = "binance";
const PROVIDER_MODEL = "chatgpt-cli-one-pass-new-logic";
const PROMPT_VERSION = 2;
const FOCUS_INSTRUCTION =
  "Generate concise capability-level requirements. For each requirement, create 2 to 5 distinct BDD acceptance criteria covering only observed or evidence-supported behavior. Keep unsupported error behavior as open questions. Ensure every criterion cites relevant image-step evidence.";
const CHATGPT_PYTHON =
  "/Users/kai/works/side-project/chatgpt-cli/.venv/bin/python";
const ARTIFACT_DIRECTORY = "data/feature-descriptions/binance/json";
const PILOT_PATH = ".tmp-binance-new-logic-pilots.json";
const BATCH_SIZE = positiveEnvironmentInteger("CHATGPT_BATCH_SIZE", 5);
const MAX_BATCHES = positiveEnvironmentInteger(
  "MAX_BATCHES",
  Number.MAX_SAFE_INTEGER,
);
const PENDING_OFFSET = nonNegativeEnvironmentInteger("PENDING_OFFSET", 0);
const CALL_TIMEOUT_MS = positiveEnvironmentInteger(
  "CHATGPT_CALL_TIMEOUT_MS",
  240_000,
);

type Platform = "web" | "ios" | "android";

interface SourceArtifact {
  source: {
    app: string;
    platform: Platform;
    flowId: string;
    title: string;
    evidence: Array<{ evidenceId: string }>;
  };
  feature: {
    title: string;
    featureDescription: string;
    userGoal: string;
    entryPoint: string;
    completionState: string;
    orderedSteps: unknown[];
    observedBehavior: unknown[];
    inferredRules: unknown[];
    unknowns: string[];
  };
}

interface CurrentDocument {
  documentId: number;
  currentRevisionId: number;
  platform: Platform;
  flowId: string;
  authorType: string;
  providerModel: string;
  content: FeatureDocumentContent;
  sourceVersionId: number;
  source: FeatureSourceFlow;
  evidenceManifest: FeatureEvidenceManifestItem[];
}

interface FlowRequirements {
  platform: Platform;
  flowId: string;
  requirements: FeatureRequirement[];
}

function positiveEnvironmentInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function nonNegativeEnvironmentInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function key(platform: Platform, flowId: string): string {
  return `${platform}:${flowId}`;
}

function log(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function normalizeJsonText(raw: string): unknown {
  const stripped = raw
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let repaired = "";
  let insideString = false;
  let escaped = false;
  for (let index = 0; index < stripped.length; index += 1) {
    const character = stripped[index];
    if (!insideString) {
      repaired += character;
      if (character === "\"") insideString = true;
      continue;
    }
    if (escaped) {
      repaired += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      repaired += character;
      escaped = true;
      continue;
    }
    if (character === "\"") {
      const nextNonWhitespace = stripped.slice(index + 1).match(/\S/)?.[0];
      const closesString =
        nextNonWhitespace === undefined ||
        nextNonWhitespace === ":" ||
        nextNonWhitespace === "," ||
        nextNonWhitespace === "}" ||
        nextNonWhitespace === "]";
      if (closesString) {
        repaired += character;
        insideString = false;
      } else {
        repaired += "\\\"";
      }
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (!repaired.endsWith(" ")) repaired += " ";
      continue;
    }
    repaired += character;
  }
  try {
    return canonicalize(JSON.parse(repaired));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = Number(message.match(/position (\d+)/)?.[1] ?? 0);
    const snippet = repaired.slice(
      Math.max(0, position - 180),
      Math.min(repaired.length, position + 180),
    );
    throw new Error(
      `json_parse_failed:${message}:snippet=${JSON.stringify(snippet)}`,
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey.replace(/\s+/g, ""),
        canonicalize(entryValue),
      ]),
    );
  }
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : value;
}

function compactArtifact(artifact: SourceArtifact): unknown {
  return {
    source: {
      platform: artifact.source.platform,
      flowId: artifact.source.flowId,
      title: artifact.source.title,
      evidenceIds: artifact.source.evidence.map(({ evidenceId }) => evidenceId),
    },
    feature: artifact.feature,
  };
}

function synthesisPrompt(artifacts: SourceArtifact[]): string {
  return [
    "Analyze every supplied evidence-backed Binance flow independently.",
    "Return JSON only with exact top-level shape: {\"flows\":[{\"platform\":\"web|ios|android\",\"flowId\":\"...\",\"requirements\":[...]}]}.",
    "Return exactly one flows item for every supplied flowId, in the same order.",
    "Produce the smallest useful set of capability-level requirements supported by each flow.",
    "Each requirement has id, kind, text, evidenceIds, userStory, priority, preconditions, acceptanceCriteria.",
    "Requirement kind must be exactly one of: observed, inferred, proposed, unknown.",
    "Requirement priority must be exactly one of: must, should, could.",
    "Each acceptance criterion has id, given, when, then, evidenceIds.",
    "Every requirement must contain 2 to 5 distinct acceptance criteria.",
    "For short flows, separate distinct visible states, actions, transitions, or outcomes; never duplicate a criterion merely to reach the minimum.",
    "Do not invent validation, error, retry, recovery, or alternate behavior. Unsupported behavior remains outside requirements.",
    "Every observed or inferred requirement and criterion must cite only evidence IDs supplied for that same flow.",
    "Every Then must be externally observable and testable.",
    "Use grammatical user stories in the form: As a <user>, I want <capability> so that <value>.",
    "Use specific preconditions instead of repeating a generic app entry point.",
    "Use unique deterministic IDs REQ-01 and AC-01-01 style within each flow.",
    "Do not place raw double-quote characters inside any string value; use single quotes or omit quotation marks around visible labels.",
    "Do not mix facts or evidence IDs between flows.",
    "Input flows:",
    JSON.stringify(artifacts.map(compactArtifact)),
  ].join("\n");
}

async function askChatGpt(prompt: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      CHATGPT_PYTHON,
      [
        "-m",
        "chatgpt_cli.cli",
        "--new",
        "--raw",
        "--quiet",
        "--headless",
        prompt,
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`chatgpt_timeout_${CALL_TIMEOUT_MS}`));
    }, CALL_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`chatgpt_exit_${code}:${stderr.slice(-500)}`));
        return;
      }
      if (!stdout.trim()) {
        reject(new Error("chatgpt_empty_output"));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function cleanIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is missing`);
  const cleaned = value.replace(/\s+/g, "");
  if (!cleaned) throw new Error(`${label} is empty`);
  return cleaned;
}

function cleanKind(value: unknown): string {
  if (typeof value !== "string") throw new Error("requirement_kind_missing");
  const cleaned = value.replace(/\s+/g, "").toLowerCase();
  if (
    cleaned === "observed" ||
    cleaned === "inferred" ||
    cleaned === "proposed" ||
    cleaned === "unknown"
  ) {
    return cleaned;
  }
  if (cleaned === "functional") return "inferred";
  throw new Error(`requirement_kind_invalid_${cleaned}`);
}

function cleanPriority(value: unknown): string {
  if (typeof value !== "string") throw new Error("requirement_priority_missing");
  const cleaned = value.replace(/\s+/g, "").toLowerCase();
  if (cleaned === "must" || cleaned === "should" || cleaned === "could") {
    return cleaned;
  }
  if (cleaned === "high") return "must";
  if (cleaned === "medium") return "should";
  if (cleaned === "low") return "could";
  throw new Error(`requirement_priority_invalid_${cleaned}`);
}

function cleanRequirements(
  raw: unknown,
  document: CurrentDocument,
): FeatureRequirement[] {
  if (!Array.isArray(raw)) throw new Error("requirements must be an array");
  if (raw.length < 1 || raw.length > 8) {
    throw new Error(`requirement_count_${raw.length}`);
  }
  const allowedEvidence = new Set(
    document.evidenceManifest.map(({ evidenceId }) => evidenceId),
  );
  const cleaned = raw.map((requirement, requirementIndex) => {
    if (!requirement || typeof requirement !== "object") {
      throw new Error(`requirement_${requirementIndex + 1}_invalid`);
    }
    const candidate = structuredClone(requirement) as Record<string, unknown>;
    candidate.id = cleanIdentifier(
      candidate.id,
      `requirement_${requirementIndex + 1}_id`,
    );
    candidate.kind = cleanKind(candidate.kind);
    candidate.priority = cleanPriority(candidate.priority);
    if (Array.isArray(candidate.evidenceIds)) {
      candidate.evidenceIds = candidate.evidenceIds.map((evidenceId) =>
        cleanIdentifier(evidenceId, "requirement_evidence_id")
      );
    }
    if (!Array.isArray(candidate.acceptanceCriteria)) {
      throw new Error(`${candidate.id}_criteria_missing`);
    }
    if (
      candidate.acceptanceCriteria.length < 2 ||
      candidate.acceptanceCriteria.length > 5
    ) {
      throw new Error(
        `${candidate.id}_criteria_count_${candidate.acceptanceCriteria.length}`,
      );
    }
    candidate.acceptanceCriteria = candidate.acceptanceCriteria.map(
      (criterion, criterionIndex) => {
        if (!criterion || typeof criterion !== "object") {
          throw new Error(`${candidate.id}_criterion_${criterionIndex + 1}_invalid`);
        }
        const cleanedCriterion = structuredClone(criterion) as Record<string, unknown>;
        cleanedCriterion.id = cleanIdentifier(
          cleanedCriterion.id,
          `${candidate.id}_criterion_${criterionIndex + 1}_id`,
        );
        if (Array.isArray(cleanedCriterion.evidenceIds)) {
          cleanedCriterion.evidenceIds = cleanedCriterion.evidenceIds.map(
            (evidenceId) => cleanIdentifier(evidenceId, "criterion_evidence_id"),
          );
        }
        return cleanedCriterion;
      },
    );
    return candidate;
  });
  const requirementIds = cleaned.map(({ id }) => String(id));
  const criterionIds = cleaned.flatMap(({ acceptanceCriteria }) =>
    (acceptanceCriteria as Array<{ id: string }>).map(({ id }) => id)
  );
  if (new Set(requirementIds).size !== requirementIds.length) {
    throw new Error("duplicate_requirement_ids");
  }
  if (new Set(criterionIds).size !== criterionIds.length) {
    throw new Error("duplicate_acceptance_criterion_ids");
  }
  for (const requirement of cleaned) {
    const evidenceIds = requirement.evidenceIds as string[] | undefined;
    if (!evidenceIds?.length) {
      throw new Error(`${requirement.id}_evidence_missing`);
    }
    for (const evidenceId of evidenceIds) {
      if (!allowedEvidence.has(evidenceId)) {
        throw new Error(`${requirement.id}_unknown_evidence_${evidenceId}`);
      }
    }
    const userStory = requirement.userStory;
    if (
      typeof userStory !== "string" ||
      !/^As (?:a|an) .+?, I want .+ so that .+\.$/i.test(userStory)
    ) {
      throw new Error(`${requirement.id}_user_story_invalid`);
    }
    for (
      const criterion of requirement.acceptanceCriteria as Array<
        Record<string, unknown>
      >
    ) {
      const evidenceIds = criterion.evidenceIds as string[] | undefined;
      if (!evidenceIds?.length) {
        throw new Error(`${criterion.id}_evidence_missing`);
      }
      for (const evidenceId of evidenceIds) {
        if (!allowedEvidence.has(evidenceId)) {
          throw new Error(`${criterion.id}_unknown_evidence_${evidenceId}`);
        }
      }
      for (const clause of ["given", "when", "then"] as const) {
        if (
          typeof criterion[clause] !== "string" ||
          !criterion[clause].trim()
        ) {
          throw new Error(`${criterion.id}_${clause}_missing`);
        }
      }
    }
  }
  const content = parseFeatureDocumentContent(
    {
      ...document.content,
      requirements: cleaned,
    },
    allowedEvidence,
  );
  return content.requirements;
}

async function loadArtifacts(): Promise<Map<string, SourceArtifact>> {
  const files = (await readdir(ARTIFACT_DIRECTORY))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const artifacts = new Map<string, SourceArtifact>();
  for (const file of files) {
    const artifact = JSON.parse(
      await readFile(join(ARTIFACT_DIRECTORY, file), "utf8"),
    ) as SourceArtifact;
    if (artifact.source.app !== APP) continue;
    artifacts.set(key(artifact.source.platform, artifact.source.flowId), artifact);
  }
  return artifacts;
}

async function loadDocuments(
  pool: pg.Pool,
): Promise<Map<string, CurrentDocument>> {
  const result = await pool.query(
    `SELECT d.id AS document_id, d.current_revision_id, p.name AS platform,
            d.source_flow_id, r.author_type, r.provider_model, r.content,
            r.source_version_id, r.source_flow, r.evidence_manifest
     FROM feature_documents d
     JOIN apps a ON a.id = d.app_id
     JOIN platforms p ON p.id = d.platform_id
     JOIN feature_document_revisions r ON r.id = d.current_revision_id
     WHERE a.name = $1 AND d.visibility = 'catalog'
     ORDER BY p.name, d.source_flow_id`,
    [APP],
  );
  return new Map(
    result.rows.map((row) => [
      key(row.platform, row.source_flow_id),
      {
        documentId: Number(row.document_id),
        currentRevisionId: Number(row.current_revision_id),
        platform: row.platform,
        flowId: row.source_flow_id,
        authorType: row.author_type,
        providerModel: row.provider_model,
        content: row.content,
        sourceVersionId: Number(row.source_version_id),
        source: row.source_flow,
        evidenceManifest: row.evidence_manifest,
      } satisfies CurrentDocument,
    ]),
  );
}

async function publish(
  pool: pg.Pool,
  document: CurrentDocument,
  requirements: FeatureRequirement[],
): Promise<{ revisionId: number; revisionNumber: number }> {
  const allowedEvidence = new Set(
    document.evidenceManifest.map(({ evidenceId }) => evidenceId),
  );
  const content = parseFeatureDocumentContent(
    { ...document.content, requirements },
    allowedEvidence,
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT d.current_revision_id, r.author_type, r.provider_model
       FROM feature_documents d
       JOIN feature_document_revisions r ON r.id = d.current_revision_id
       WHERE d.id = $1
       FOR UPDATE OF d`,
      [document.documentId],
    );
    const current = locked.rows[0];
    if (!current) throw new Error("document_missing");
    if (current.author_type !== "generated") {
      throw new Error("human_revision_guard");
    }
    if (current.provider_model === PROVIDER_MODEL) {
      await client.query("ROLLBACK");
      return {
        revisionId: Number(current.current_revision_id),
        revisionNumber: -1,
      };
    }
    if (Number(current.current_revision_id) !== document.currentRevisionId) {
      throw new Error(
        `revision_changed_${current.current_revision_id}_${document.currentRevisionId}`,
      );
    }
    const inserted = await client.query(
      `INSERT INTO feature_document_revisions
         (document_id, revision_number, author_type, review_status, content,
          source_version_id, source_flow, evidence_manifest,
          evidence_manifest_sha256, focus_instruction, prompt_version,
          provider_model)
       SELECT $1, COALESCE(MAX(revision_number), 0) + 1, 'generated', 'draft',
              $2::jsonb, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9
       FROM feature_document_revisions
       WHERE document_id = $1
       RETURNING id, revision_number`,
      [
        document.documentId,
        JSON.stringify(content),
        document.sourceVersionId,
        JSON.stringify(document.source),
        JSON.stringify(document.evidenceManifest),
        featureEvidenceManifestSha256(document.evidenceManifest),
        FOCUS_INSTRUCTION,
        PROMPT_VERSION,
        PROVIDER_MODEL,
      ],
    );
    const revision = inserted.rows[0];
    if (!revision) throw new Error("revision_insert_missing");
    await client.query(
      `UPDATE feature_documents
       SET current_revision_id = $2, updated_at = now()
       WHERE id = $1`,
      [document.documentId, revision.id],
    );
    await client.query("COMMIT");
    return {
      revisionId: Number(revision.id),
      revisionNumber: Number(revision.revision_number),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function parseBatchOutput(
  raw: string,
  batch: SourceArtifact[],
  documents: Map<string, CurrentDocument>,
): FlowRequirements[] {
  const parsed = normalizeJsonText(raw) as {
    flows?: Array<{
      platform?: string;
      flowId?: string;
      requirements?: unknown;
    }>;
  };
  if (!Array.isArray(parsed.flows)) throw new Error("flows_array_missing");
  if (parsed.flows.length !== batch.length) {
    throw new Error(
      `flow_result_count_${parsed.flows.length}_expected_${batch.length}`,
    );
  }
  return parsed.flows.map((flow, index) => {
    const platform = cleanIdentifier(flow.platform, "platform") as Platform;
    const flowId = cleanIdentifier(flow.flowId, "flowId");
    const expected = batch[index];
    if (
      platform !== expected.source.platform ||
      flowId !== expected.source.flowId
    ) {
      throw new Error(
        `flow_identity_mismatch_${platform}_${flowId}_expected_${expected.source.platform}_${expected.source.flowId}`,
      );
    }
    const document = documents.get(key(platform, flowId));
    if (!document) throw new Error(`document_missing_${platform}_${flowId}`);
    return {
      platform,
      flowId,
      requirements: cleanRequirements(flow.requirements, document),
    };
  });
}

async function publishPilots(
  pool: pg.Pool,
  documents: Map<string, CurrentDocument>,
): Promise<void> {
  const pilots = JSON.parse(await readFile(PILOT_PATH, "utf8")) as FlowRequirements[];
  for (const pilot of pilots) {
    const document = documents.get(key(pilot.platform, pilot.flowId));
    if (!document) throw new Error(`pilot_document_missing_${pilot.flowId}`);
    if (document.providerModel === PROVIDER_MODEL) continue;
    const requirements = cleanRequirements(pilot.requirements, document);
    const revision = await publish(pool, document, requirements);
    document.providerModel = PROVIDER_MODEL;
    log({
      type: "pilot_published",
      platform: pilot.platform,
      flowId: pilot.flowId,
      documentId: document.documentId,
      revision,
      requirements: requirements.length,
      criteria: requirements.reduce(
        (total, requirement) => total + requirement.acceptanceCriteria.length,
        0,
      ),
    });
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const [artifacts, documents] = await Promise.all([
      loadArtifacts(),
      loadDocuments(pool),
    ]);
    if (artifacts.size !== 703 || documents.size !== 703) {
      throw new Error(
        `catalog_inventory_mismatch_artifacts_${artifacts.size}_documents_${documents.size}`,
      );
    }
    for (const document of documents.values()) {
      if (document.authorType !== "generated") {
        throw new Error(
          `human_revision_guard_${document.platform}_${document.flowId}`,
        );
      }
    }
    await publishPilots(pool, documents);
    const pending = [...documents.values()]
      .filter(({ providerModel }) => providerModel !== PROVIDER_MODEL)
      .map((document) => {
        const artifact = artifacts.get(key(document.platform, document.flowId));
        if (!artifact) {
          throw new Error(
            `artifact_missing_${document.platform}_${document.flowId}`,
          );
        }
        return artifact;
      })
      .slice(PENDING_OFFSET);
    log({
      type: "start",
      total: documents.size,
      pending: pending.length,
      batchSize: BATCH_SIZE,
      maxBatches: MAX_BATCHES,
      pendingOffset: PENDING_OFFSET,
    });
    let publishedCount = 0;
    let batchCount = 0;
    for (
      let offset = 0;
      offset < pending.length && batchCount < MAX_BATCHES;
      offset += BATCH_SIZE
    ) {
      const batch = pending.slice(offset, offset + BATCH_SIZE);
      batchCount += 1;
      const startedAt = Date.now();
      log({
        type: "batch_started",
        batch: batchCount,
        size: batch.length,
        flows: batch.map(({ source }) => ({
          platform: source.platform,
          flowId: source.flowId,
          title: source.title,
          evidence: source.evidence.length,
        })),
      });
      try {
        const raw = await askChatGpt(synthesisPrompt(batch));
        const results = parseBatchOutput(raw, batch, documents);
        for (const result of results) {
          const document = documents.get(key(result.platform, result.flowId))!;
          const revision = await publish(pool, document, result.requirements);
          document.providerModel = PROVIDER_MODEL;
          publishedCount += 1;
          log({
            type: "flow_published",
            batch: batchCount,
            platform: result.platform,
            flowId: result.flowId,
            documentId: document.documentId,
            revision,
            requirements: result.requirements.length,
            criteria: result.requirements.reduce(
              (total, requirement) =>
                total + requirement.acceptanceCriteria.length,
              0,
            ),
          });
        }
        log({
          type: "batch_completed",
          batch: batchCount,
          published: results.length,
          durationSeconds: Math.round((Date.now() - startedAt) / 1_000),
        });
      } catch (error) {
        log({
          type: "batch_failed",
          batch: batchCount,
          durationSeconds: Math.round((Date.now() - startedAt) / 1_000),
          error: error instanceof Error ? error.message : String(error),
          flows: batch.map(({ source }) => ({
            platform: source.platform,
            flowId: source.flowId,
            title: source.title,
          })),
        });
      }
    }
    const final = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE r.provider_model = $2) AS completed,
              COUNT(*) FILTER (WHERE r.provider_model <> $2) AS remaining
       FROM feature_documents d
       JOIN apps a ON a.id = d.app_id
       JOIN feature_document_revisions r ON r.id = d.current_revision_id
       WHERE a.name = $1`,
      [APP, PROVIDER_MODEL],
    );
    log({
      type: "complete",
      batches: batchCount,
      publishedThisRun: publishedCount,
      completed: Number(final.rows[0].completed),
      remaining: Number(final.rows[0].remaining),
    });
  } finally {
    await pool.end();
  }
}

await main();
