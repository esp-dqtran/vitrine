import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databasePoolOptions } from "../../src/dbPoolConfig.ts";
import { redactMigrationError } from "../../src/migrations.ts";
import {
  validateKiroReconciliation,
  type PersistedKiroReconciliation,
  type ResearchPacket,
  type VisualArtifact,
} from "./kiro-reconciliation.ts";

const PROMPT_VERSION = 1;

type ReconciliationProgress = {
  status: "running" | "done" | "error";
  failed: number;
};

export type PreparedReconciliationImport = {
  packet: ResearchPacket;
  saved: PersistedKiroReconciliation;
  visualAnalysisSha256: string;
  researchContextSha256: string;
  resultSha256: string;
  sourceFingerprint: string;
};

export type ReconciliationImportResult = {
  action: "created" | "skipped";
  file: string;
  flowId: string;
  platform: string;
  reconciliationId?: number;
  revisionNumber?: number;
  reason?: "unchanged";
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function prepareReconciliationImport(
  savedValue: unknown,
  packetText: string,
  visualText: string,
): PreparedReconciliationImport {
  const packet = JSON.parse(packetText) as ResearchPacket;
  const visual = JSON.parse(visualText) as VisualArtifact;
  const envelope = object(savedValue, "reconciliation");
  if (envelope.schemaVersion !== 1) throw new Error("reconciliation.schemaVersion must be 1");
  if (envelope.provider !== "kiro-cli") {
    throw new Error("reconciliation.provider must be kiro-cli");
  }
  const model = nonEmpty(envelope.model, "reconciliation.model");
  const effort = nonEmpty(envelope.effort, "reconciliation.effort");
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) {
    throw new Error("reconciliation.effort is invalid");
  }
  const generatedAt = nonEmpty(envelope.generatedAt, "reconciliation.generatedAt");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("reconciliation.generatedAt must be an ISO timestamp");
  }
  const source = object(envelope.source, "reconciliation.source");
  const packetReference = nonEmpty(
    source.researchPacket,
    "reconciliation.source.researchPacket",
  );
  const visualReference = nonEmpty(
    source.visualArtifact,
    "reconciliation.source.visualArtifact",
  );
  if (!basename(packetReference).endsWith(".json")) {
    throw new Error("reconciliation research packet reference is invalid");
  }
  if (basename(visualReference) !== basename(packet.visualAnalysis.artifact)) {
    throw new Error("reconciliation visual artifact reference does not match the packet");
  }
  const usage = object(envelope.usage, "reconciliation.usage");
  if (
    usage.credits !== undefined
    && (typeof usage.credits !== "number" || !Number.isFinite(usage.credits) || usage.credits < 0)
  ) {
    throw new Error("reconciliation.usage.credits must be non-negative");
  }
  if (usage.elapsed !== undefined && typeof usage.elapsed !== "string") {
    throw new Error("reconciliation.usage.elapsed must be a string");
  }
  const review = object(
    envelope.reviewRecommendation,
    "reconciliation.reviewRecommendation",
  );
  if (typeof review.solReview !== "boolean") {
    throw new Error("reconciliation.reviewRecommendation.solReview must be boolean");
  }
  if (
    !Array.isArray(review.reasons)
    || review.reasons.some((reason) => typeof reason !== "string")
  ) {
    throw new Error("reconciliation.reviewRecommendation.reasons must be a string array");
  }

  validateKiroReconciliation(envelope.result, packet, visual);
  const saved = savedValue as PersistedKiroReconciliation;
  const visualAnalysisSha256 = sha256(visualText);
  const researchContextSha256 = sha256(packetText);
  const resultSha256 = sha256(JSON.stringify(saved.result));
  const sourceFingerprint = sha256([
    `prompt:${PROMPT_VERSION}`,
    `model:${model}`,
    `effort:${effort}`,
    `visual:${visualAnalysisSha256}`,
    `research:${researchContextSha256}`,
    `result:${resultSha256}`,
  ].join("\n"));
  return {
    packet,
    saved,
    visualAnalysisSha256,
    researchContextSha256,
    resultSha256,
    sourceFingerprint,
  };
}

async function importPrepared(
  client: pg.PoolClient,
  product: string,
  file: string,
  prepared: PreparedReconciliationImport,
  apply: boolean,
): Promise<ReconciliationImportResult> {
  const { packet, saved } = prepared;
  const identity = await client.query<{ app_id: number; app_flow_id: number }>(
    `SELECT a.id AS app_id, af.id AS app_flow_id
     FROM apps a
     JOIN app_flows af ON af.app_id = a.id
     WHERE a.name = $1 AND af.platform = $2 AND af.source_flow_id = $3`,
    [product, packet.flow.platform, packet.flow.flowId],
  );
  const row = identity.rows[0];
  if (!row) {
    throw new Error(
      `Database Flow not found: ${product}/${packet.flow.platform}/${packet.flow.flowId}`,
    );
  }
  const existing = await client.query<{ id: number; revision_number: number }>(
    `SELECT id, revision_number
     FROM app_flow_reconciliations
     WHERE app_id = $1 AND platform = $2 AND source_flow_id = $3
       AND source_fingerprint = $4`,
    [
      row.app_id,
      packet.flow.platform,
      packet.flow.flowId,
      prepared.sourceFingerprint,
    ],
  );
  if (existing.rows[0]) {
    return {
      action: "skipped",
      file,
      flowId: packet.flow.flowId,
      platform: packet.flow.platform,
      reconciliationId: Number(existing.rows[0].id),
      revisionNumber: Number(existing.rows[0].revision_number),
      reason: "unchanged",
    };
  }
  if (!apply) {
    return {
      action: "created",
      file,
      flowId: packet.flow.flowId,
      platform: packet.flow.platform,
    };
  }

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
    [`flow-reconciliation:${row.app_id}:${packet.flow.platform}:${packet.flow.flowId}`],
  );
  const duplicate = await client.query<{ id: number; revision_number: number }>(
    `SELECT id, revision_number
     FROM app_flow_reconciliations
     WHERE app_id = $1 AND platform = $2 AND source_flow_id = $3
       AND source_fingerprint = $4`,
    [
      row.app_id,
      packet.flow.platform,
      packet.flow.flowId,
      prepared.sourceFingerprint,
    ],
  );
  if (duplicate.rows[0]) {
    return {
      action: "skipped",
      file,
      flowId: packet.flow.flowId,
      platform: packet.flow.platform,
      reconciliationId: Number(duplicate.rows[0].id),
      revisionNumber: Number(duplicate.rows[0].revision_number),
      reason: "unchanged",
    };
  }
  const inserted = await client.query<{ id: number; revision_number: number }>(
    `INSERT INTO app_flow_reconciliations (
       app_id, platform, source_flow_id, app_flow_id, revision_number,
       source_fingerprint, visual_analysis_sha256, research_context_sha256,
       result_sha256, provider_model, effort, prompt_version, result, usage,
       review_recommendation, generated_at
     )
     SELECT $1, $2, $3, $4, COALESCE(MAX(revision_number), 0) + 1,
       $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15
     FROM app_flow_reconciliations
     WHERE app_id = $1 AND platform = $2 AND source_flow_id = $3
     RETURNING id, revision_number`,
    [
      row.app_id,
      packet.flow.platform,
      packet.flow.flowId,
      row.app_flow_id,
      prepared.sourceFingerprint,
      prepared.visualAnalysisSha256,
      prepared.researchContextSha256,
      prepared.resultSha256,
      `${saved.provider}:${saved.model}`,
      saved.effort,
      PROMPT_VERSION,
      JSON.stringify(saved.result),
      JSON.stringify(saved.usage),
      JSON.stringify(saved.reviewRecommendation),
      saved.generatedAt,
    ],
  );
  return {
    action: "created",
    file,
    flowId: packet.flow.flowId,
    platform: packet.flow.platform,
    reconciliationId: Number(inserted.rows[0].id),
    revisionNumber: Number(inserted.rows[0].revision_number),
  };
}

export async function runReconciliationImport(options: {
  root: string;
  product: string;
  databaseUrl: string;
  apply: boolean;
  allowRunning?: boolean;
}): Promise<ReconciliationImportResult[]> {
  const outputRoot = join(options.root, "research-reconciliation");
  const packetRoot = join(options.root, "research-context");
  const progress = JSON.parse(
    await readFile(join(outputRoot, "progress.json"), "utf8"),
  ) as ReconciliationProgress;
  if (options.apply && !options.allowRunning) {
    if (progress.status !== "done") {
      throw new Error(`Reconciliation run is not complete: ${progress.status}`);
    }
    if (progress.failed !== 0) {
      throw new Error(`Reconciliation run has ${progress.failed} failed Flow(s)`);
    }
  }
  const files = (await readdir(outputRoot))
    .filter((file) =>
      file.endsWith(".json")
      && file !== "progress.json"
      && file !== "sol-review-queue.json"
    )
    .sort();
  const prepared = await Promise.all(files.map(async (file) => {
    const savedValue = JSON.parse(await readFile(join(outputRoot, file), "utf8")) as unknown;
    const packetText = await readFile(join(packetRoot, file), "utf8");
    const packet = JSON.parse(packetText) as ResearchPacket;
    const visualPath = resolve(packetRoot, packet.visualAnalysis.artifact);
    const visualText = await readFile(visualPath, "utf8");
    return { file, value: prepareReconciliationImport(savedValue, packetText, visualText) };
  }));
  const pool = new pg.Pool({
    connectionString: options.databaseUrl,
    ...databasePoolOptions(process.env),
  });
  const client = await pool.connect();
  try {
    if (options.apply) await client.query("BEGIN");
    const results: ReconciliationImportResult[] = [];
    try {
      for (const item of prepared) {
        results.push(
          await importPrepared(client, options.product, item.file, item.value, options.apply),
        );
      }
      if (options.apply) await client.query("COMMIT");
      return results;
    } catch (error) {
      if (options.apply) await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const app = argument("--app") ?? "amazon-shopping";
  const product = argument("--product") ?? app;
  const root = resolve(
    argument("--root") ?? join(process.cwd(), "data", "feature-descriptions", app),
  );
  const apply = process.argv.includes("--apply");
  try {
    const results = await runReconciliationImport({
      root,
      product,
      databaseUrl,
      apply,
      allowRunning: process.argv.includes("--allow-running"),
    });
    const summary = results.reduce<Record<string, number>>(
      (counts, result) => ({
        ...counts,
        [result.action]: (counts[result.action] ?? 0) + 1,
      }),
      {},
    );
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      app,
      product,
      total: results.length,
      summary,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      status: "error",
      error: redactMigrationError(error, databaseUrl),
    }));
    process.exitCode = 1;
  }
}
