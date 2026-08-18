import type { QueryResult } from "pg";

export type FlowClassificationStatus = "needs_review" | "approved";
export type FlowClassificationSource = "manual" | "rule";

export interface FlowType {
  id: number;
  slug: string;
  name: string;
  position: number;
}

export interface FlowCategory {
  id: number;
  slug: string;
  name: string;
  position: number;
  approvedFlowCount: number;
  types: FlowType[];
}

export interface FlowClassification {
  flowId: number;
  type: FlowType & { category: Pick<FlowCategory, "id" | "slug" | "name" | "position"> };
  status: FlowClassificationStatus;
  confidence: number | null;
  source: FlowClassificationSource;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
}

export interface FlowClassificationReviewItem {
  flowId: number;
  title: string;
  currentCategory: string | null;
  appFlowCount: number;
  appCount: number;
  classification: FlowClassification | null;
}

export type FlowTaxonomyQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

export class FlowTaxonomyValidationError extends Error {}
export class FlowTaxonomyNotFoundError extends Error {}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new FlowTaxonomyValidationError(`invalid ${label}`);
  }
  return Number(value);
}

function confidence(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new FlowTaxonomyValidationError("invalid confidence");
  }
  return Math.round(value * 100) / 100;
}

function status(value: unknown): FlowClassificationStatus {
  if (value === "needs_review" || value === "approved") return value;
  throw new FlowTaxonomyValidationError("invalid classification status");
}

function source(value: unknown): FlowClassificationSource {
  if (value === "manual" || value === "rule") return value;
  throw new FlowTaxonomyValidationError("invalid classification source");
}

function typeFromRow(row: Record<string, unknown>): FlowType {
  return {
    id: Number(row.type_id ?? row.id),
    slug: String(row.type_slug ?? row.slug),
    name: String(row.type_name ?? row.name),
    position: Number(row.type_position ?? row.position),
  };
}

function classificationFromRow(row: Record<string, unknown>): FlowClassification {
  return {
    flowId: Number(row.flow_id),
    type: {
      ...typeFromRow(row),
      category: {
        id: Number(row.category_id),
        slug: String(row.category_slug),
        name: String(row.category_name),
        position: Number(row.category_position),
      },
    },
    status: status(row.status),
    confidence: row.confidence === null || row.confidence === undefined
      ? null
      : Number(row.confidence),
    source: source(row.source),
    reviewedByUserId: row.reviewed_by_user_id === null || row.reviewed_by_user_id === undefined
      ? null
      : Number(row.reviewed_by_user_id),
    reviewedAt: row.reviewed_at === null || row.reviewed_at === undefined
      ? null
      : String(row.reviewed_at),
  };
}

export function parseFlowClassificationInput(value: unknown): {
  flowTypeId: number;
  status: FlowClassificationStatus;
  confidence: number | null;
} {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    flowTypeId: positiveInteger(input.flowTypeId, "flow type id"),
    status: status(input.status),
    confidence: confidence(input.confidence),
  };
}

function limit(value: unknown): number {
  if (value === undefined) return 100;
  const parsed = positiveInteger(value, "review queue limit");
  if (parsed > 200) throw new FlowTaxonomyValidationError("invalid review queue limit");
  return parsed;
}

export function createFlowTaxonomyStore(runQuery: FlowTaxonomyQuery) {
  return {
    async listPublished(): Promise<FlowCategory[]> {
      const [categories, types] = await Promise.all([
        runQuery(
          `SELECT category.id, category.slug, category.name, category.position,
             COUNT(classification.flow_id)::integer AS approved_flow_count
           FROM flow_categories category
           LEFT JOIN flow_types type ON type.category_id = category.id
           LEFT JOIN flow_classifications classification
             ON classification.flow_type_id = type.id
            AND classification.status = 'approved'
           GROUP BY category.id, category.slug, category.name, category.position
           ORDER BY category.position, category.id`,
        ),
        runQuery(
          `SELECT type.id AS type_id, type.category_id, type.slug AS type_slug,
             type.name AS type_name, type.position AS type_position
           FROM flow_types type
           ORDER BY type.category_id, type.position, type.id`,
        ),
      ]);
      const typesByCategory = new Map<number, FlowType[]>();
      for (const row of types.rows) {
        const categoryId = Number(row.category_id);
        const values = typesByCategory.get(categoryId) ?? [];
        values.push(typeFromRow(row));
        typesByCategory.set(categoryId, values);
      }
      return categories.rows.map((row) => ({
        id: Number(row.id),
        slug: String(row.slug),
        name: String(row.name),
        position: Number(row.position),
        approvedFlowCount: Number(row.approved_flow_count),
        types: typesByCategory.get(Number(row.id)) ?? [],
      }));
    },

    async listReviewQueue(rawLimit?: number): Promise<FlowClassificationReviewItem[]> {
      const response = await runQuery(
        `SELECT canonical.id AS flow_id,
           canonical.name AS title,
           parent.name AS current_category,
           COUNT(DISTINCT mapping.app_flow_id)::integer AS app_flow_count,
           COUNT(DISTINCT app_flow.app_id)::integer AS app_count,
           classification.flow_id AS classified_flow_id,
           classification.status,
           classification.confidence,
           classification.source,
           classification.reviewed_by_user_id,
           classification.reviewed_at,
           type.id AS type_id,
           type.slug AS type_slug,
           type.name AS type_name,
           type.position AS type_position,
           category.id AS category_id,
           category.slug AS category_slug,
           category.name AS category_name,
           category.position AS category_position
         FROM flows canonical
         LEFT JOIN flows parent ON parent.id = canonical.parent_id
         LEFT JOIN app_flow_mappings mapping ON mapping.flow_id = canonical.id
         LEFT JOIN app_flows app_flow ON app_flow.id = mapping.app_flow_id
         LEFT JOIN flow_classifications classification ON classification.flow_id = canonical.id
         LEFT JOIN flow_types type ON type.id = classification.flow_type_id
         LEFT JOIN flow_categories category ON category.id = type.category_id
         WHERE classification.flow_id IS NULL OR classification.status = 'needs_review'
         GROUP BY canonical.id, canonical.name, parent.name,
           classification.flow_id, classification.status, classification.confidence,
           classification.source, classification.reviewed_by_user_id, classification.reviewed_at,
           type.id, type.slug, type.name, type.position,
           category.id, category.slug, category.name, category.position
         ORDER BY COUNT(DISTINCT mapping.app_flow_id) DESC, lower(canonical.name), canonical.id
         LIMIT $1`,
        [limit(rawLimit)],
      );
      return response.rows.map((row) => ({
        flowId: Number(row.flow_id),
        title: String(row.title),
        currentCategory: row.current_category === null ? null : String(row.current_category),
        appFlowCount: Number(row.app_flow_count),
        appCount: Number(row.app_count),
        classification: row.classified_flow_id === null || row.classified_flow_id === undefined
          ? null
          : classificationFromRow(row),
      }));
    },

    async saveClassification(input: {
      flowId: number;
      flowTypeId: number;
      status: FlowClassificationStatus;
      confidence?: number | null;
      source: FlowClassificationSource;
      reviewedByUserId?: number;
    }): Promise<FlowClassification> {
      const flowId = positiveInteger(input.flowId, "flow id");
      const flowTypeId = positiveInteger(input.flowTypeId, "flow type id");
      const reviewStatus = status(input.status);
      const reviewerId = input.reviewedByUserId === undefined
        ? null
        : positiveInteger(input.reviewedByUserId, "reviewer user id");
      const result = await runQuery(
        `INSERT INTO flow_classifications (
           flow_id, flow_type_id, status, confidence, source,
           reviewed_by_user_id, reviewed_at
         ) SELECT
           target.flow_id, target.flow_type_id, $3, $4, $5, $6,
           CASE WHEN $3 = 'approved' THEN now() ELSE NULL END
         FROM (
           SELECT flow.id AS flow_id, type.id AS flow_type_id
           FROM flows flow
           JOIN flow_types type ON type.id = $2
           WHERE flow.id = $1
         ) target
         ON CONFLICT (flow_id) DO UPDATE SET
           flow_type_id = EXCLUDED.flow_type_id,
           status = EXCLUDED.status,
           confidence = EXCLUDED.confidence,
           source = EXCLUDED.source,
           reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
           reviewed_at = CASE WHEN EXCLUDED.status = 'approved' THEN now() ELSE NULL END,
           updated_at = now()
         RETURNING flow_id, status, confidence, source, reviewed_by_user_id, reviewed_at,
           (SELECT id FROM flow_types WHERE id = flow_classifications.flow_type_id) AS type_id,
           (SELECT slug FROM flow_types WHERE id = flow_classifications.flow_type_id) AS type_slug,
           (SELECT name FROM flow_types WHERE id = flow_classifications.flow_type_id) AS type_name,
           (SELECT position FROM flow_types WHERE id = flow_classifications.flow_type_id) AS type_position,
           (SELECT category.id FROM flow_categories category
              JOIN flow_types type ON type.category_id = category.id
             WHERE type.id = flow_classifications.flow_type_id) AS category_id,
           (SELECT category.slug FROM flow_categories category
              JOIN flow_types type ON type.category_id = category.id
             WHERE type.id = flow_classifications.flow_type_id) AS category_slug,
           (SELECT category.name FROM flow_categories category
              JOIN flow_types type ON type.category_id = category.id
             WHERE type.id = flow_classifications.flow_type_id) AS category_name,
           (SELECT category.position FROM flow_categories category
              JOIN flow_types type ON type.category_id = category.id
             WHERE type.id = flow_classifications.flow_type_id) AS category_position`,
        [flowId, flowTypeId, reviewStatus, confidence(input.confidence), source(input.source), reviewerId],
      );
      if (!result.rows[0]) throw new FlowTaxonomyNotFoundError("flow or flow type not found");
      return classificationFromRow(result.rows[0]);
    },
  };
}
