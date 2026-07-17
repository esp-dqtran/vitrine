import type { QueryResult } from "pg";
import { query as databaseQuery, withTransaction } from "./db.ts";
import { validateObjectMetadata, type ObjectMetadata } from "./objectStore.ts";
import {
  RESEARCH_LIMITS,
  assertExpectedRevision,
  defaultResearchLanes,
  normalizeResearchTags,
  type AddResearchItemInput,
  type CreateLaneInput,
  type CreateResearchProjectInput,
  type DeleteLaneInput,
  type MoveResearchItemInput,
  type ProjectPatch,
  type RecordedSynthesis,
  type RemoveResearchItemInput,
  type ResearchProjectItem,
  type ResearchProjectLane,
  type ResearchProjectSummary,
  type ResearchProjectWorkspace,
  type ResearchSynthesisResult,
  type ResearchSynthesisView,
  type UpdateLaneInput,
  type UpdateResearchItemInput,
} from "./researchProject.ts";

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface ResearchProjectStore {
  listProjects(userId: number): Promise<ResearchProjectSummary[]>;
  createProject(userId: number, input: CreateResearchProjectInput): Promise<ResearchProjectWorkspace>;
  getProject(userId: number, projectId: number): Promise<ResearchProjectWorkspace | undefined>;
  getPrivateObject(userId: number, projectId: number, itemId: number): Promise<ObjectMetadata | undefined>;
  updateProject(userId: number, projectId: number, expectedRevision: number, patch: ProjectPatch): Promise<ResearchProjectWorkspace | undefined>;
  duplicateProject(userId: number, projectId: number): Promise<ResearchProjectWorkspace | undefined>;
  deleteProject(userId: number, projectId: number): Promise<{ deleted: boolean; privateObjectKeys: string[] }>;
  createLane(userId: number, input: CreateLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  updateLane(userId: number, input: UpdateLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  deleteEmptyLane(userId: number, input: DeleteLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  addItem(userId: number, input: AddResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  addPrivateItem(userId: number, input: AddResearchItemInput, metadata: ObjectMetadata): Promise<ResearchProjectWorkspace | undefined>;
  updateItem(userId: number, input: UpdateResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  moveItem(userId: number, input: MoveResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  removeItem(userId: number, input: RemoveResearchItemInput): Promise<{ project?: ResearchProjectWorkspace; unreferencedPrivateObjectKey?: string }>;
  recordSynthesis(userId: number, input: RecordedSynthesis): Promise<ResearchSynthesisView | undefined>;
}

const text = (value: unknown): string => value == null ? "" : String(value);
const number = (value: unknown): number => Number(value);

function itemFromRow(row: Record<string, unknown>): ResearchProjectItem {
  const sourceKind = row.source_kind as ResearchProjectItem["sourceKind"];
  const id = number(row.id);
  const projectId = number(row.project_id);
  const snapshot = (row.source_snapshot ?? {}) as ResearchProjectItem["snapshot"];
  return {
    id,
    projectId,
    laneId: number(row.lane_id),
    position: number(row.position),
    sourceKind,
    stepLabel: text(row.step_label),
    note: text(row.note),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    important: row.important === true,
    snapshot: sourceKind === "private_upload"
      ? { ...snapshot, sourcePath: `/api/research-projects/${projectId}/private-media/${id}` }
      : snapshot,
    mediaUrl: sourceKind === "private_upload"
      ? `/api/research-projects/${projectId}/private-media/${id}`
      : row.media_url ? text(row.media_url) : undefined,
  };
}

function synthesisFromRow(row: Record<string, unknown> | undefined, revision: number): ResearchSynthesisView | undefined {
  if (!row || row.status !== "complete" || !row.result) return undefined;
  return {
    id: number(row.id),
    projectRevision: number(row.project_revision),
    stale: number(row.project_revision) !== revision,
    result: row.result as ResearchSynthesisResult,
    createdAt: new Date(text(row.created_at)).toISOString(),
  };
}

async function loadWorkspace(
  runQuery: DatabaseQuery,
  userId: number,
  projectId: number,
): Promise<ResearchProjectWorkspace | undefined> {
  const projectResult = await runQuery(
    `SELECT rp.id, rp.title, rp.question, rp.platform_filter, rp.constraints,
            rp.decision, rp.rationale, rp.open_questions, rp.revision,
            rp.created_at, rp.updated_at
     FROM research_projects rp
     WHERE rp.id = $1 AND rp.user_id = $2`,
    [projectId, userId],
  );
  const project = projectResult.rows[0];
  if (!project) return undefined;

  const [laneResult, itemResult, synthesisResult] = await Promise.all([
    runQuery(
      `SELECT l.id, l.title, l.position, l.conclusion
       FROM research_project_lanes l
       JOIN research_projects rp ON rp.id = l.project_id
       WHERE l.project_id = $1 AND rp.user_id = $2
       ORDER BY l.position`,
      [projectId, userId],
    ),
    runQuery(
      `SELECT i.id, i.project_id, i.lane_id, i.position, i.source_kind,
              i.step_label, i.note, i.tags, i.important, i.source_snapshot
       FROM research_project_items i
       JOIN research_projects rp ON rp.id = i.project_id
       WHERE i.project_id = $1 AND rp.user_id = $2
       ORDER BY i.lane_id, i.position`,
      [projectId, userId],
    ),
    runQuery(
      `SELECT s.id, s.project_revision, s.status, s.result, s.created_at
       FROM research_project_syntheses s
       JOIN research_projects rp ON rp.id = s.project_id
       WHERE s.project_id = $1 AND rp.user_id = $2
       ORDER BY s.created_at DESC, s.id DESC LIMIT 1`,
      [projectId, userId],
    ),
  ]);

  const items = itemResult.rows.map(itemFromRow);
  const lanes: ResearchProjectLane[] = laneResult.rows.map((row) => ({
    id: number(row.id),
    title: text(row.title),
    position: number(row.position),
    conclusion: text(row.conclusion),
    items: items.filter((item) => item.laneId === number(row.id)),
  }));
  const revision = number(project.revision);
  return {
    id: number(project.id),
    title: text(project.title),
    question: text(project.question),
    platformFilter: project.platform_filter as ResearchProjectWorkspace["platformFilter"],
    constraints: text(project.constraints),
    decision: text(project.decision),
    rationale: text(project.rationale),
    openQuestions: text(project.open_questions),
    revision,
    lanes,
    synthesis: synthesisFromRow(synthesisResult.rows[0], revision),
    createdAt: new Date(text(project.created_at)).toISOString(),
    updatedAt: new Date(text(project.updated_at)).toISOString(),
  };
}

async function lockOwnedProject(
  runQuery: DatabaseQuery,
  userId: number,
  projectId: number,
  expectedRevision?: number,
): Promise<number | undefined> {
  const locked = await runQuery(
    `SELECT revision FROM research_projects
     WHERE id = $1 AND user_id = $2
     FOR UPDATE`,
    [projectId, userId],
  );
  const row = locked.rows[0];
  if (!row) return undefined;
  const revision = number(row.revision);
  if (expectedRevision !== undefined) assertExpectedRevision(revision, expectedRevision);
  return revision;
}

async function bumpRevision(runQuery: DatabaseQuery, projectId: number): Promise<void> {
  await runQuery(
    `UPDATE research_projects
     SET revision = revision + 1, updated_at = now()
     WHERE id = $1`,
    [projectId],
  );
}

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery !== liveQuery) return async (work) => work(runQuery);
  return async (work) => withTransaction((client) => work(
    (sql, values) => client.query(sql, values ? [...values] : undefined),
  ));
}

const liveQuery: DatabaseQuery = (sql, values) => databaseQuery(sql, values ? [...values] : undefined);

export function createResearchProjectStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): ResearchProjectStore {
  return {
    async listProjects(userId) {
      const result = await runQuery(
        `SELECT rp.id, rp.title, rp.question, rp.platform_filter, rp.revision, rp.updated_at,
                count(DISTINCT i.id)::integer AS evidence_count,
                max(s.project_revision)::integer AS synthesis_revision
         FROM research_projects rp
         LEFT JOIN research_project_items i ON i.project_id = rp.id
         LEFT JOIN research_project_syntheses s ON s.project_id = rp.id AND s.status = 'complete'
         WHERE rp.user_id = $1
         GROUP BY rp.id ORDER BY rp.updated_at DESC`,
        [userId],
      );
      return result.rows.map((row) => {
        const synthesisRevision = row.synthesis_revision == null ? undefined : number(row.synthesis_revision);
        return {
          id: number(row.id),
          title: text(row.title),
          question: text(row.question),
          platformFilter: row.platform_filter as ResearchProjectSummary["platformFilter"],
          evidenceCount: number(row.evidence_count ?? 0),
          synthesisState: synthesisRevision === undefined
            ? "none"
            : synthesisRevision === number(row.revision) ? "current" : "stale",
          updatedAt: new Date(text(row.updated_at)).toISOString(),
        };
      });
    },

    async createProject(userId, input) {
      return runTransaction(async (tx) => {
        const created = await tx(
          `INSERT INTO research_projects (user_id, title, question, platform_filter)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, question, platform_filter, constraints, decision,
                     rationale, open_questions, revision, created_at, updated_at`,
          [userId, input.title.trim(), input.question.trim(), input.platformFilter],
        );
        const projectId = number(created.rows[0].id);
        const lanes = defaultResearchLanes();
        await tx(
          `INSERT INTO research_project_lanes (project_id, title, position)
           VALUES ($1, $2, $3), ($1, $4, $5)`,
          [projectId, lanes[0].title, lanes[0].position, lanes[1].title, lanes[1].position],
        );
        return (await loadWorkspace(tx, userId, projectId))!;
      });
    },

    getProject(userId, projectId) {
      return loadWorkspace(runQuery, userId, projectId);
    },

    async getPrivateObject(userId, projectId, itemId) {
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM research_project_items i
         JOIN research_projects rp ON rp.id = i.project_id
         JOIN stored_objects so ON so.object_key = i.private_object_key
         WHERE rp.user_id = $1 AND rp.id = $2 AND i.id = $3
           AND i.source_kind = 'private_upload'`,
        [userId, projectId, itemId],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const metadata: ObjectMetadata = {
        key: text(row.object_key),
        sha256: text(row.sha256),
        byteSize: number(row.byte_size),
        contentType: row.content_type as ObjectMetadata["contentType"],
        accessClass: row.access_class as ObjectMetadata["accessClass"],
      };
      validateObjectMetadata(metadata);
      return metadata;
    },

    async updateProject(userId, projectId, expectedRevision, patch) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, projectId, expectedRevision) === undefined) return undefined;
        const columns: string[] = [];
        const values: unknown[] = [projectId];
        const names: Array<[keyof ProjectPatch, string]> = [
          ["title", "title"],
          ["question", "question"],
          ["platformFilter", "platform_filter"],
          ["constraints", "constraints"],
          ["decision", "decision"],
          ["rationale", "rationale"],
          ["openQuestions", "open_questions"],
        ];
        for (const [key, column] of names) {
          if (patch[key] === undefined) continue;
          values.push(typeof patch[key] === "string" ? patch[key].trim() : patch[key]);
          columns.push(`${column} = $${values.length}`);
        }
        if (columns.length) {
          await tx(
            `UPDATE research_projects SET ${columns.join(", ")},
               revision = revision + 1, updated_at = now() WHERE id = $1`,
            values,
          );
        }
        return loadWorkspace(tx, userId, projectId);
      });
    },

    async duplicateProject(userId, projectId) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, projectId) === undefined) return undefined;
        const source = await loadWorkspace(tx, userId, projectId);
        if (!source) return undefined;
        const created = await tx(
          `INSERT INTO research_projects
             (user_id, title, question, platform_filter, constraints, decision, rationale, open_questions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [userId, `${source.title} copy`, source.question, source.platformFilter, source.constraints,
            source.decision, source.rationale, source.openQuestions],
        );
        const duplicateId = number(created.rows[0].id);
        for (const lane of source.lanes) {
          const laneResult = await tx(
            `INSERT INTO research_project_lanes (project_id, title, position, conclusion)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [duplicateId, lane.title, lane.position, lane.conclusion],
          );
          const laneId = number(laneResult.rows[0].id);
          for (const item of lane.items) {
            await tx(
              `INSERT INTO research_project_items
                 (project_id, lane_id, position, source_kind, catalog_app, catalog_version_id,
                  catalog_image_id, catalog_flow_id, catalog_step_index, private_object_key,
                  step_label, note, tags, important, source_snapshot)
               SELECT $1, $2, $3, source_kind, catalog_app, catalog_version_id,
                      catalog_image_id, catalog_flow_id, catalog_step_index, private_object_key,
                      step_label, note, tags, important, source_snapshot
               FROM research_project_items WHERE id = $4`,
              [duplicateId, laneId, item.position, item.id],
            );
          }
        }
        return loadWorkspace(tx, userId, duplicateId);
      });
    },

    async deleteProject(userId, projectId) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, projectId) === undefined) {
          return { deleted: false, privateObjectKeys: [] };
        }
        const keys = await tx(
          `SELECT DISTINCT i.private_object_key
           FROM research_project_items i
           WHERE i.project_id = $1 AND i.private_object_key IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM research_project_items other
               WHERE other.private_object_key = i.private_object_key AND other.project_id <> $1
             )`,
          [projectId],
        );
        await tx("DELETE FROM research_projects WHERE id = $1", [projectId]);
        return { deleted: true, privateObjectKeys: keys.rows.map((row) => text(row.private_object_key)) };
      });
    },

    async createLane(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const count = await tx(
          "SELECT count(*)::integer AS count FROM research_project_lanes WHERE project_id = $1",
          [input.projectId],
        );
        if (number(count.rows[0].count) >= RESEARCH_LIMITS.lanesMax) throw new Error("Research lane limit reached");
        await tx(
          `INSERT INTO research_project_lanes (project_id, title, position)
           SELECT $1, $2, COALESCE(max(position), -1) + 1
           FROM research_project_lanes WHERE project_id = $1`,
          [input.projectId, input.title.trim()],
        );
        await bumpRevision(tx, input.projectId);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async updateLane(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const values: unknown[] = [input.laneId, input.projectId];
        const updates: string[] = [];
        if (input.title !== undefined) { values.push(input.title.trim()); updates.push(`title = $${values.length}`); }
        if (input.conclusion !== undefined) { values.push(input.conclusion.trim()); updates.push(`conclusion = $${values.length}`); }
        if (input.position !== undefined) { values.push(input.position); updates.push(`position = $${values.length}`); }
        if (updates.length) {
          const updated = await tx(
            `UPDATE research_project_lanes SET ${updates.join(", ")}
             WHERE id = $1 AND project_id = $2 RETURNING id`,
            values,
          );
          if (!updated.rowCount) return undefined;
          await bumpRevision(tx, input.projectId);
        }
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async deleteEmptyLane(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const lanes = await tx(
          "SELECT count(*)::integer AS count FROM research_project_lanes WHERE project_id = $1",
          [input.projectId],
        );
        if (number(lanes.rows[0].count) <= RESEARCH_LIMITS.lanesMin) throw new Error("At least two lanes are required");
        const deleted = await tx(
          `DELETE FROM research_project_lanes l
           WHERE l.id = $1 AND l.project_id = $2
             AND NOT EXISTS (SELECT 1 FROM research_project_items i WHERE i.lane_id = l.id)
           RETURNING l.position`,
          [input.laneId, input.projectId],
        );
        if (!deleted.rowCount) throw new Error("Only empty lanes can be deleted");
        await tx(
          "UPDATE research_project_lanes SET position = position - 1 WHERE project_id = $1 AND position > $2",
          [input.projectId, deleted.rows[0].position],
        );
        await bumpRevision(tx, input.projectId);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async addItem(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const counts = await tx(
          `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE source_kind = 'private_upload')::integer AS private_count
           FROM research_project_items WHERE project_id = $1`,
          [input.projectId],
        );
        if (number(counts.rows[0].total) >= RESEARCH_LIMITS.itemsMax) throw new Error("Research evidence limit reached");
        if (input.sourceKind === "private_upload"
          && number(counts.rows[0].private_count) >= RESEARCH_LIMITS.privateUploadsMax) {
          throw new Error("Private upload limit reached");
        }
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.laneId, input.projectId],
        );
        if (!lane.rowCount) return undefined;
        await tx(
          `INSERT INTO research_project_items
             (project_id, lane_id, position, source_kind, catalog_app, catalog_version_id,
              catalog_image_id, catalog_flow_id, catalog_step_index, private_object_key, source_snapshot)
           SELECT $1, $2, COALESCE(max(position), -1) + 1, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
           FROM research_project_items WHERE lane_id = $2`,
          [input.projectId, input.laneId, input.sourceKind, input.catalog?.app ?? null,
            input.catalog?.versionId ?? null, input.catalog?.imageId ?? null,
            input.catalog?.flowId ?? null, input.catalog?.stepIndex ?? null,
            input.privateObjectKey ?? null, JSON.stringify(input.snapshot)],
        );
        await bumpRevision(tx, input.projectId);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async addPrivateItem(userId, input, metadata) {
      validateObjectMetadata(metadata);
      if (input.sourceKind !== "private_upload" || input.privateObjectKey !== metadata.key) {
        throw new Error("Invalid private research item");
      }
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const counts = await tx(
          `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE source_kind = 'private_upload')::integer AS private_count
           FROM research_project_items WHERE project_id = $1`,
          [input.projectId],
        );
        if (number(counts.rows[0].total) >= RESEARCH_LIMITS.itemsMax) throw new Error("Research evidence limit reached");
        if (number(counts.rows[0].private_count) >= RESEARCH_LIMITS.privateUploadsMax) throw new Error("Private upload limit reached");
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.laneId, input.projectId],
        );
        if (!lane.rowCount) return undefined;
        const stored = await tx(
          `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
           WHERE stored_objects.sha256 = EXCLUDED.sha256
             AND stored_objects.byte_size = EXCLUDED.byte_size
             AND stored_objects.content_type = EXCLUDED.content_type
             AND stored_objects.access_class = EXCLUDED.access_class
           RETURNING object_key`,
          [metadata.key, metadata.sha256, metadata.byteSize, metadata.contentType, metadata.accessClass],
        );
        if (!stored.rowCount) throw new Error("Object key already exists with different metadata");
        await tx(
          `INSERT INTO research_project_items
             (project_id, lane_id, position, source_kind, private_object_key, source_snapshot)
           SELECT $1, $2, COALESCE(max(position), -1) + 1, 'private_upload', $3, $4::jsonb
           FROM research_project_items WHERE lane_id = $2`,
          [input.projectId, input.laneId, metadata.key, JSON.stringify(input.snapshot)],
        );
        await bumpRevision(tx, input.projectId);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async updateItem(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const values: unknown[] = [input.itemId, input.projectId];
        const updates: string[] = [];
        if (input.stepLabel !== undefined) { values.push(input.stepLabel.trim()); updates.push(`step_label = $${values.length}`); }
        if (input.note !== undefined) { values.push(input.note.trim()); updates.push(`note = $${values.length}`); }
        if (input.tags !== undefined) { values.push(JSON.stringify(normalizeResearchTags(input.tags))); updates.push(`tags = $${values.length}::jsonb`); }
        if (input.important !== undefined) { values.push(input.important); updates.push(`important = $${values.length}`); }
        if (updates.length) {
          const updated = await tx(
            `UPDATE research_project_items SET ${updates.join(", ")}, updated_at = now()
             WHERE id = $1 AND project_id = $2 RETURNING id`,
            values,
          );
          if (!updated.rowCount) return undefined;
          await bumpRevision(tx, input.projectId);
        }
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async moveItem(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return undefined;
        const itemResult = await tx(
          "SELECT lane_id, position FROM research_project_items WHERE id = $1 AND project_id = $2 FOR UPDATE",
          [input.itemId, input.projectId],
        );
        const item = itemResult.rows[0];
        if (!item) return undefined;
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.targetLaneId, input.projectId],
        );
        if (!lane.rowCount) return undefined;
        const sourceLaneId = number(item.lane_id);
        const sourcePosition = number(item.position);
        const targetCount = await tx(
          "SELECT count(*)::integer AS count FROM research_project_items WHERE lane_id = $1",
          [input.targetLaneId],
        );
        const sameLane = sourceLaneId === input.targetLaneId;
        const lastPosition = Math.max(0, number(targetCount.rows[0].count) - (sameLane ? 1 : 0));
        const targetPosition = Math.max(0, Math.min(input.targetPosition, lastPosition));
        await tx("SET CONSTRAINTS research_project_items_lane_position_unique DEFERRED");
        if (sameLane && targetPosition > sourcePosition) {
          await tx(
            `UPDATE research_project_items SET position = position - 1
             WHERE lane_id = $1 AND position > $2 AND position <= $3`,
            [sourceLaneId, sourcePosition, targetPosition],
          );
        } else if (sameLane && targetPosition < sourcePosition) {
          await tx(
            `UPDATE research_project_items SET position = position + 1
             WHERE lane_id = $1 AND position >= $2 AND position < $3`,
            [sourceLaneId, targetPosition, sourcePosition],
          );
        } else if (!sameLane) {
          await tx(
            "UPDATE research_project_items SET position = position - 1 WHERE lane_id = $1 AND position > $2",
            [sourceLaneId, sourcePosition],
          );
          await tx(
            `UPDATE research_project_items SET position = position + 1
             WHERE lane_id = $1 AND position >= $2`,
            [input.targetLaneId, targetPosition],
          );
        }
        await tx(
          "UPDATE research_project_items SET lane_id = $2, position = $3, updated_at = now() WHERE id = $1",
          [input.itemId, input.targetLaneId, targetPosition],
        );
        await bumpRevision(tx, input.projectId);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async removeItem(userId, input) {
      return runTransaction(async (tx) => {
        if (await lockOwnedProject(tx, userId, input.projectId, input.expectedRevision) === undefined) return {};
        const removed = await tx(
          `DELETE FROM research_project_items
           WHERE id = $1 AND project_id = $2
           RETURNING lane_id, position, private_object_key`,
          [input.itemId, input.projectId],
        );
        const row = removed.rows[0];
        if (!row) return {};
        await tx(
          "UPDATE research_project_items SET position = position - 1 WHERE lane_id = $1 AND position > $2",
          [row.lane_id, row.position],
        );
        let unreferencedPrivateObjectKey: string | undefined;
        if (row.private_object_key) {
          const refs = await tx(
            "SELECT 1 FROM research_project_items WHERE private_object_key = $1 LIMIT 1",
            [row.private_object_key],
          );
          if (!refs.rowCount) unreferencedPrivateObjectKey = text(row.private_object_key);
        }
        await bumpRevision(tx, input.projectId);
        return {
          project: await loadWorkspace(tx, userId, input.projectId),
          unreferencedPrivateObjectKey,
        };
      });
    },

    async recordSynthesis(userId, input) {
      return runTransaction(async (tx) => {
        const revision = await lockOwnedProject(tx, userId, input.projectId);
        if (revision === undefined || revision !== input.projectRevision) return undefined;
        const recorded = await tx(
          `INSERT INTO research_project_syntheses
             (project_id, project_revision, status, result, error_code, model, schema_version)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           RETURNING id, project_revision, status, result, created_at`,
          [input.projectId, input.projectRevision, input.status,
            input.result ? JSON.stringify(input.result) : null, input.errorCode ?? null,
            input.model, input.schemaVersion],
        );
        return synthesisFromRow(recorded.rows[0], input.projectRevision);
      });
    },
  };
}
