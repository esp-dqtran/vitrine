import type { QueryResult } from "pg";
import { withTransaction } from "./db.ts";
import type { DesignSystemSnapshot, ReviewStatus } from "./designSystem.ts";

export interface DesignSystemWorkingCopyRecord {
  snapshot: DesignSystemSnapshot;
  captureVersionId: number | null;
  sourceAppKnowledgeRevisionId: number | null;
  origin: "observed" | "automatic" | "imported";
  generatedAt: string | null;
  updatedAt: string;
}

export type SeedDesignSystemResult =
  | "seeded"
  | "replaced"
  | "unchanged"
  | "conflict";

export type WorkingCopyQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

export type WorkingCopyTransaction = <T>(
  work: (query: WorkingCopyQuery) => Promise<T>,
) => Promise<T>;

export interface SeedDesignSystemWorkingCopyInput {
  app: string;
  platform: string;
  candidate: DesignSystemSnapshot;
  captureVersionId: number;
  sourceAppKnowledgeRevisionId: number;
  generatedAt: string;
  transaction?: WorkingCopyTransaction;
}

const ORIGINS = new Set<DesignSystemWorkingCopyRecord["origin"]>([
  "observed",
  "automatic",
  "imported",
]);

function positiveInteger(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`Invalid ${label}`);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new Error(`Invalid ${label}`);
  return result.toISOString();
}

function optionalTimestamp(value: unknown, label: string): string | null {
  return value == null ? null : timestamp(value, label);
}

function record(row: Record<string, unknown>): DesignSystemWorkingCopyRecord {
  const origin = row.origin as DesignSystemWorkingCopyRecord["origin"];
  if (!ORIGINS.has(origin)) throw new Error("Invalid Design System working-copy origin");
  return {
    snapshot: structuredClone(row.snapshot as DesignSystemSnapshot),
    captureVersionId: row.capture_version_id == null
      ? null
      : positiveInteger(row.capture_version_id, "capture version"),
    sourceAppKnowledgeRevisionId: row.source_app_knowledge_revision_id == null
      ? null
      : positiveInteger(row.source_app_knowledge_revision_id, "source revision"),
    origin,
    generatedAt: optionalTimestamp(row.generated_at, "generation timestamp"),
    updatedAt: timestamp(row.updated_at, "working-copy timestamp"),
  };
}

function structurallyEmpty(snapshot: DesignSystemSnapshot): boolean {
  return snapshot.tokens.length === 0
    && snapshot.components.length === 0
    && snapshot.flows.length === 0
    && (snapshot.rules?.length ?? 0) === 0;
}

function untouched(status: ReviewStatus | undefined, source: string | undefined): boolean {
  return status === "needs_review" && source === "llm_inferred";
}

function replaceableAutomatic(record: DesignSystemWorkingCopyRecord): boolean {
  if (record.origin !== "automatic" || structurallyEmpty(record.snapshot)) return false;
  if (record.snapshot.tokens.some((token) => !untouched(token.reviewStatus, token.source))) {
    return false;
  }
  if (record.snapshot.components.some((component) =>
    component.variants.some((variant) => !untouched(variant.reviewStatus, variant.source)))) {
    return false;
  }
  if ((record.snapshot.rules ?? []).some((rule) => !untouched(rule.reviewStatus, rule.source))) {
    return false;
  }
  if (record.snapshot.flows.some((flow) =>
    !flow.insights || !untouched(flow.insights.reviewStatus, flow.insights.source))) {
    return false;
  }
  return true;
}

function replacementDecision(
  current: DesignSystemWorkingCopyRecord,
  captureVersionId: number,
  sourceRevisionId: number,
): Exclude<SeedDesignSystemResult, "seeded"> {
  if (structurallyEmpty(current.snapshot)) return "replaced";
  if (!replaceableAutomatic(current)) return "conflict";
  if (
    current.captureVersionId === captureVersionId
    && current.sourceAppKnowledgeRevisionId === sourceRevisionId
  ) return "unchanged";
  if (current.captureVersionId == null || current.sourceAppKnowledgeRevisionId == null) {
    return "conflict";
  }
  if (captureVersionId > current.captureVersionId) return "replaced";
  if (
    captureVersionId === current.captureVersionId
    && sourceRevisionId > current.sourceAppKnowledgeRevisionId
  ) return "replaced";
  return "conflict";
}

const defaultTransaction: WorkingCopyTransaction = async (work) =>
  withTransaction((client) =>
    work((sql, values) => client.query(sql, values ? [...values] : undefined)));

export async function seedDesignSystemWorkingCopy(
  input: SeedDesignSystemWorkingCopyInput,
): Promise<SeedDesignSystemResult> {
  const app = input.app.trim();
  const platform = input.platform.trim();
  if (!app || !platform || input.candidate.app !== app) {
    throw new Error("Invalid Design System working-copy target");
  }
  const captureVersionId = positiveInteger(input.captureVersionId, "capture version");
  const sourceRevisionId = positiveInteger(
    input.sourceAppKnowledgeRevisionId,
    "source revision",
  );
  const generatedAt = timestamp(input.generatedAt, "generation timestamp");
  const transaction = input.transaction ?? defaultTransaction;
  return transaction(async (query) => {
    const appRow = await query(
      "SELECT id FROM apps WHERE name = $1 FOR UPDATE",
      [app],
    );
    if (!appRow.rows[0]) throw new Error("Design System app was not found");
    const appId = positiveInteger(appRow.rows[0].id, "app");
    const currentRow = await query(
      `SELECT snapshot, capture_version_id, source_app_knowledge_revision_id,
         origin, generated_at, updated_at
       FROM design_systems
       WHERE app_id = $1 AND platform = $2
       FOR UPDATE`,
      [appId, platform],
    );
    const current = currentRow.rows[0] ? record(currentRow.rows[0]) : undefined;
    const decision = current
      ? replacementDecision(current, captureVersionId, sourceRevisionId)
      : "seeded";
    if (decision === "unchanged" || decision === "conflict") return decision;
    if (decision === "seeded") {
      await query(
        `INSERT INTO design_systems
           (app_id, platform, snapshot, origin, capture_version_id,
            source_app_knowledge_revision_id, generated_at)
         VALUES ($1, $2, $3::jsonb, 'automatic', $4, $5, $6)`,
        [
          appId,
          platform,
          JSON.stringify(input.candidate),
          captureVersionId,
          sourceRevisionId,
          generatedAt,
        ],
      );
    } else {
      await query(
        `UPDATE design_systems SET snapshot = $3::jsonb, origin = 'automatic',
           capture_version_id = $4, source_app_knowledge_revision_id = $5,
           generated_at = $6, updated_at = now()
         WHERE app_id = $1 AND platform = $2`,
        [
          appId,
          platform,
          JSON.stringify(input.candidate),
          captureVersionId,
          sourceRevisionId,
          generatedAt,
        ],
      );
    }
    return decision;
  });
}
