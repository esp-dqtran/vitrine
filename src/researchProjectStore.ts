import type { QueryResult } from "pg";
import type {
  DesignerCanvasFile,
  DesignerCanvasFileSummary,
} from "./designerCanvas.ts";
import { query as databaseQuery, withTransaction } from "./db.ts";
import { publicImageUrl } from "./imageSource.ts";
import { validateObjectMetadata, type ObjectMetadata } from "./objectStore.ts";
import {
  RESEARCH_LIMITS,
  assertExpectedRevision,
  defaultResearchLanes,
  normalizeResearchTags,
  normalizeResearchProjectIcon,
  type AddResearchItemInput,
  type AttachResearchFlowInput,
  type CreateLaneInput,
  type CreateResearchProjectInput,
  type DeleteLaneInput,
  type MoveResearchItemInput,
  type ProjectPatch,
  type RecordedSynthesis,
  type RemoveResearchItemInput,
  type ResearchProjectItem,
  type ResearchProjectId,
  type ResearchProjectMemberRole,
  type ResearchProjectMembersView,
  type ResearchProjectCanvas,
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

type TransactionRunner = <T>(
  work: (query: DatabaseQuery) => Promise<T>,
) => Promise<T>;

export interface ResearchProjectStore {
  listProjects(userId: number): Promise<ResearchProjectSummary[]>;
  createProject(
    userId: number,
    input: CreateResearchProjectInput,
  ): Promise<ResearchProjectWorkspace>;
  getProject(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<ResearchProjectWorkspace | undefined>;
  getCanvas(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<ResearchProjectCanvas | undefined>;
  saveCanvas(
    userId: number,
    projectId: ResearchProjectId,
    snapshot: Record<string, unknown>,
  ): Promise<ResearchProjectCanvas | undefined>;
  listCanvasFiles(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<DesignerCanvasFileSummary[] | undefined>;
  createCanvasFile(
    userId: number,
    projectId: ResearchProjectId,
    title: string,
    snapshot: Record<string, unknown>,
  ): Promise<DesignerCanvasFile | undefined>;
  getCanvasFile(
    userId: number,
    projectId: ResearchProjectId,
    canvasId: string,
  ): Promise<DesignerCanvasFile | undefined>;
  saveCanvasFile(
    userId: number,
    projectId: ResearchProjectId,
    canvasId: string,
    snapshot: Record<string, unknown>,
  ): Promise<DesignerCanvasFile | undefined>;
  attachCanvasAsset(
    userId: number,
    projectId: ResearchProjectId,
    assetId: string,
    metadata: ObjectMetadata,
  ): Promise<ObjectMetadata | undefined>;
  getCanvasAsset(
    userId: number,
    projectId: ResearchProjectId,
    assetId: string,
  ): Promise<ObjectMetadata | undefined>;
  getPrivateObject(
    userId: number,
    projectId: ResearchProjectId,
    itemId: number,
  ): Promise<ObjectMetadata | undefined>;
  updateProject(
    userId: number,
    projectId: ResearchProjectId,
    expectedRevision: number,
    patch: ProjectPatch,
  ): Promise<ResearchProjectWorkspace | undefined>;
  duplicateProject(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<ResearchProjectWorkspace | undefined>;
  deleteProject(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<{ deleted: boolean; privateObjectKeys: string[] }>;
  listMembers(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<ResearchProjectMembersView | undefined>;
  addMemberByEmail(
    userId: number,
    projectId: ResearchProjectId,
    email: string,
    role: ResearchProjectMemberRole,
  ): Promise<"added" | "forbidden" | "user_not_found">;
  removeMember(
    userId: number,
    projectId: ResearchProjectId,
    targetUserId: number,
  ): Promise<boolean>;
  createLane(
    userId: number,
    input: CreateLaneInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  updateLane(
    userId: number,
    input: UpdateLaneInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  deleteEmptyLane(
    userId: number,
    input: DeleteLaneInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  addItem(
    userId: number,
    input: AddResearchItemInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  attachFlow(
    userId: number,
    input: AttachResearchFlowInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  addPrivateItem(
    userId: number,
    input: AddResearchItemInput,
    metadata: ObjectMetadata,
  ): Promise<ResearchProjectWorkspace | undefined>;
  updateItem(
    userId: number,
    input: UpdateResearchItemInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  moveItem(
    userId: number,
    input: MoveResearchItemInput,
  ): Promise<ResearchProjectWorkspace | undefined>;
  removeItem(
    userId: number,
    input: RemoveResearchItemInput,
  ): Promise<{
    project?: ResearchProjectWorkspace;
    unreferencedPrivateObjectKey?: string;
  }>;
  recordSynthesis(
    userId: number,
    input: RecordedSynthesis,
  ): Promise<ResearchSynthesisView | undefined>;
}

const text = (value: unknown): string => (value == null ? "" : String(value));
const number = (value: unknown): number => Number(value);

function itemFromRow(row: Record<string, unknown>): ResearchProjectItem {
  const sourceKind = row.source_kind as ResearchProjectItem["sourceKind"];
  const id = number(row.id);
  const projectId = text(row.project_public_id);
  const snapshot = (row.source_snapshot ??
    {}) as ResearchProjectItem["snapshot"];
  const catalogMediaUrl =
    row.catalog_app && row.catalog_image_url
      ? publicImageUrl(text(row.catalog_app), text(row.catalog_image_url))
      : undefined;
  return {
    id,
    ...(row.catalog_app ? { appId: text(row.catalog_app) } : {}),
    ...(row.catalog_app_icon_url
      ? { appIconUrl: text(row.catalog_app_icon_url) }
      : {}),
    projectId,
    laneId: number(row.lane_id),
    position: number(row.position),
    sourceKind,
    stepLabel: text(row.step_label),
    note: text(row.note),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    important: row.important === true,
    snapshot:
      sourceKind === "private_upload"
        ? {
            ...snapshot,
            sourcePath: `/api/research-projects/${projectId}/private-media/${id}`,
          }
        : snapshot,
    mediaUrl:
      sourceKind === "private_upload"
        ? `/api/research-projects/${projectId}/private-media/${id}`
        : catalogMediaUrl || undefined,
  };
}

function synthesisFromRow(
  row: Record<string, unknown> | undefined,
  revision: number,
): ResearchSynthesisView | undefined {
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
  projectId: ResearchProjectId,
): Promise<ResearchProjectWorkspace | undefined> {
  const projectResult = await runQuery(
    `SELECT rp.public_id, rp.title, rp.icon, rp.question, rp.platform_filter, rp.pinned, rp.constraints,
            rp.decision, rp.rationale, rp.open_questions, rp.revision,
            rp.created_at, rp.updated_at,
            organization.id AS organization_id,
            organization.name AS organization_name,
            membership.role AS organization_role,
            project_member.role AS project_member_role,
            CASE
              WHEN rp.organization_id IS NULL AND rp.user_id = $2 THEN 'owner'
              WHEN membership.role IN ('owner', 'admin') THEN 'owner'
              WHEN project_member.role IS NOT NULL THEN project_member.role
              ELSE 'editor'
            END AS access_role,
            CASE
              WHEN rp.organization_id IS NULL AND rp.user_id = $2 THEN 'personal'
              WHEN project_member.role IS NOT NULL THEN 'direct'
              ELSE 'team'
            END AS access_source,
            (rp.organization_id IS NULL AND rp.user_id = $2)
              OR membership.role IN ('owner', 'admin') AS can_manage
     FROM research_projects rp
     LEFT JOIN organizations organization ON organization.id = rp.organization_id
     LEFT JOIN organization_members membership
       ON membership.organization_id = rp.organization_id AND membership.user_id = $2
     LEFT JOIN project_document_collaborators project_member
       ON project_member.project_id = rp.id AND project_member.user_id = $2
     WHERE rp.public_id = $1
       AND ((rp.organization_id IS NULL AND rp.user_id = $2)
         OR membership.user_id = $2 OR project_member.user_id = $2)`,
    [projectId, userId],
  );
  const project = projectResult.rows[0];
  if (!project) return undefined;

  const [laneResult, itemResult, synthesisResult] = await Promise.all([
    runQuery(
      `SELECT l.id, l.title, l.position, l.conclusion
       FROM research_project_lanes l
       JOIN research_projects rp ON rp.id = l.project_id
       WHERE rp.public_id = $1
         AND ((rp.organization_id IS NULL AND rp.user_id = $2) OR EXISTS (
           SELECT 1 FROM organization_members membership
           WHERE membership.organization_id = rp.organization_id AND membership.user_id = $2
         ) OR EXISTS (
           SELECT 1 FROM project_document_collaborators project_member
           WHERE project_member.project_id = rp.id AND project_member.user_id = $2
         ))
       ORDER BY l.position`,
      [projectId, userId],
    ),
    runQuery(
      `SELECT i.id, rp.public_id AS project_public_id,
              i.lane_id, i.position, i.source_kind,
              i.step_label, i.note, i.tags, i.important, i.source_snapshot,
              i.catalog_app, catalog_source.icon_url AS catalog_app_icon_url,
              image.image_url AS catalog_image_url
       FROM research_project_items i
       JOIN research_projects rp ON rp.id = i.project_id
       LEFT JOIN apps catalog_source ON catalog_source.name = i.catalog_app
       LEFT JOIN images image ON image.id = i.catalog_image_id
       WHERE rp.public_id = $1
         AND ((rp.organization_id IS NULL AND rp.user_id = $2) OR EXISTS (
           SELECT 1 FROM organization_members membership
           WHERE membership.organization_id = rp.organization_id AND membership.user_id = $2
         ) OR EXISTS (
           SELECT 1 FROM project_document_collaborators project_member
           WHERE project_member.project_id = rp.id AND project_member.user_id = $2
         ))
       ORDER BY i.lane_id, i.position`,
      [projectId, userId],
    ),
    runQuery(
      `SELECT s.id, s.project_revision, s.status, s.result, s.created_at
       FROM research_project_syntheses s
       JOIN research_projects rp ON rp.id = s.project_id
       WHERE rp.public_id = $1
         AND ((rp.organization_id IS NULL AND rp.user_id = $2) OR EXISTS (
           SELECT 1 FROM organization_members membership
           WHERE membership.organization_id = rp.organization_id AND membership.user_id = $2
         ) OR EXISTS (
           SELECT 1 FROM project_document_collaborators project_member
           WHERE project_member.project_id = rp.id AND project_member.user_id = $2
         ))
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
    id: text(project.public_id),
    title: text(project.title),
    icon: normalizeResearchProjectIcon(project.icon),
    question: text(project.question),
    platformFilter:
      project.platform_filter as ResearchProjectWorkspace["platformFilter"],
    pinned: project.pinned === true,
    constraints: text(project.constraints),
    decision: text(project.decision),
    rationale: text(project.rationale),
    openQuestions: text(project.open_questions),
    revision,
    lanes,
    synthesis: synthesisFromRow(synthesisResult.rows[0], revision),
    createdAt: new Date(text(project.created_at)).toISOString(),
    updatedAt: new Date(text(project.updated_at)).toISOString(),
    access: {
      role: project.access_role as "owner" | "editor" | "viewer",
      source: project.access_source as "personal" | "team" | "direct",
      canManage: project.can_manage === true,
    },
    ...(project.organization_id == null
      ? {}
      : {
          organization: {
            id: number(project.organization_id),
            name: text(project.organization_name),
            role: project.organization_role as "owner" | "admin" | "member",
          },
        }),
  };
}

async function lockOwnedProject(
  runQuery: DatabaseQuery,
  userId: number,
  projectId: ResearchProjectId,
  expectedRevision?: number,
  managementOnly = false,
): Promise<{ id: number; revision: number } | undefined> {
  const locked = await runQuery(
    `SELECT id, revision FROM research_projects
     WHERE public_id = $1
       AND ((organization_id IS NULL AND user_id = $2) OR EXISTS (
         SELECT 1 FROM organization_members membership
         WHERE membership.organization_id = research_projects.organization_id
           AND membership.user_id = $2
           AND (
             membership.role IN ('owner', 'admin')
             OR (NOT $3::boolean AND membership.role = 'member' AND NOT EXISTS (
               SELECT 1 FROM project_document_collaborators project_member
               WHERE project_member.project_id = research_projects.id
                 AND project_member.user_id = $2
                 AND project_member.role = 'viewer'
             ))
           )
       ) OR (NOT $3::boolean AND EXISTS (
         SELECT 1 FROM project_document_collaborators project_member
         WHERE project_member.project_id = research_projects.id
           AND project_member.user_id = $2
           AND project_member.role = 'editor'
       )))
     FOR UPDATE`,
    [projectId, userId, managementOnly],
  );
  const row = locked.rows[0];
  if (!row) return undefined;
  const revision = number(row.revision);
  if (expectedRevision !== undefined)
    assertExpectedRevision(revision, expectedRevision);
  return { id: number(row.id), revision };
}

async function bumpRevision(
  runQuery: DatabaseQuery,
  projectId: number,
): Promise<void> {
  await runQuery(
    `UPDATE research_projects
     SET revision = revision + 1, updated_at = now()
     WHERE id = $1`,
    [projectId],
  );
}

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery !== liveQuery) return async (work) => work(runQuery);
  return async (work) =>
    withTransaction((client) =>
      work((sql, values) =>
        client.query(sql, values ? [...values] : undefined),
      ),
    );
}

const liveQuery: DatabaseQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

export function createResearchProjectStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): ResearchProjectStore {
  return {
    async listProjects(userId) {
      const result = await runQuery(
        `SELECT rp.public_id, rp.title, rp.icon, rp.question, rp.platform_filter, rp.pinned, rp.revision, rp.updated_at,
                organization.id AS organization_id,
                organization.name AS organization_name,
                membership.role AS organization_role,
                project_member.role AS project_member_role,
                CASE
                  WHEN rp.organization_id IS NULL AND rp.user_id = $1 THEN 'owner'
                  WHEN membership.role IN ('owner', 'admin') THEN 'owner'
                  WHEN project_member.role IS NOT NULL THEN project_member.role
                  ELSE 'editor'
                END AS access_role,
                CASE
                  WHEN rp.organization_id IS NULL AND rp.user_id = $1 THEN 'personal'
                  WHEN project_member.role IS NOT NULL THEN 'direct'
                  ELSE 'team'
                END AS access_source,
                (rp.organization_id IS NULL AND rp.user_id = $1)
                  OR membership.role IN ('owner', 'admin') AS can_manage,
                count(DISTINCT i.id)::integer AS evidence_count,
                max(s.project_revision)::integer AS synthesis_revision
         FROM research_projects rp
         LEFT JOIN organizations organization ON organization.id = rp.organization_id
         LEFT JOIN organization_members membership
           ON membership.organization_id = rp.organization_id AND membership.user_id = $1
         LEFT JOIN project_document_collaborators project_member
           ON project_member.project_id = rp.id AND project_member.user_id = $1
         LEFT JOIN research_project_items i ON i.project_id = rp.id
         LEFT JOIN research_project_syntheses s ON s.project_id = rp.id AND s.status = 'complete'
         WHERE (rp.organization_id IS NULL AND rp.user_id = $1)
            OR membership.user_id = $1 OR project_member.user_id = $1
         GROUP BY rp.id, organization.id, organization.name, membership.role, project_member.role
         ORDER BY rp.updated_at DESC`,
        [userId],
      );
      return result.rows.map((row) => {
        const synthesisRevision =
          row.synthesis_revision == null
            ? undefined
            : number(row.synthesis_revision);
        return {
          id: text(row.public_id),
          title: text(row.title),
          icon: normalizeResearchProjectIcon(row.icon),
          question: text(row.question),
          platformFilter:
            row.platform_filter as ResearchProjectSummary["platformFilter"],
          pinned: row.pinned === true,
          revision: number(row.revision),
          evidenceCount: number(row.evidence_count ?? 0),
          synthesisState:
            synthesisRevision === undefined
              ? "none"
              : synthesisRevision === number(row.revision)
                ? "current"
                : "stale",
          updatedAt: new Date(text(row.updated_at)).toISOString(),
          access: {
            role: row.access_role as "owner" | "editor" | "viewer",
            source: row.access_source as "personal" | "team" | "direct",
            canManage: row.can_manage === true,
          },
          ...(row.organization_id == null
            ? {}
            : {
                organization: {
                  id: number(row.organization_id),
                  name: text(row.organization_name),
                  role: row.organization_role as "owner" | "admin" | "member",
                },
              }),
        };
      });
    },

    async createProject(userId, input) {
      return runTransaction(async (tx) => {
        const created = await tx(
          `INSERT INTO research_projects (user_id, title, question, platform_filter, organization_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, public_id, title, question, platform_filter, constraints, decision,
                     rationale, open_questions, revision, created_at, updated_at`,
          [
            userId,
            input.title.trim(),
            input.question?.trim() ?? "",
            input.platformFilter ?? "all",
            input.organizationId ?? null,
          ],
        );
        const internalProjectId = number(created.rows[0].id);
        const projectId = text(created.rows[0].public_id);
        const lanes = defaultResearchLanes();
        await tx(
          `INSERT INTO research_project_lanes (project_id, title, position)
           VALUES ($1, $2, $3), ($1, $4, $5)`,
          [
            internalProjectId,
            lanes[0].title,
            lanes[0].position,
            lanes[1].title,
            lanes[1].position,
          ],
        );
        return (await loadWorkspace(tx, userId, projectId))!;
      });
    },

    getProject(userId, projectId) {
      return loadWorkspace(runQuery, userId, projectId);
    },

    async getCanvas(userId, projectId) {
      const result = await runQuery(
        `SELECT c.snapshot, c.revision AS canvas_revision, c.updated_at AS canvas_updated_at
         FROM research_projects rp
         LEFT JOIN research_project_canvases c ON c.project_id = rp.id
         WHERE rp.public_id = $1
           AND ((rp.organization_id IS NULL AND rp.user_id = $2) OR EXISTS (
             SELECT 1 FROM organization_members membership
             WHERE membership.organization_id = rp.organization_id AND membership.user_id = $2
           ) OR EXISTS (
             SELECT 1 FROM project_document_collaborators project_member
             WHERE project_member.project_id = rp.id AND project_member.user_id = $2
           ))`,
        [projectId, userId],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      return {
        snapshot:
          row.snapshot && typeof row.snapshot === "object"
            ? (row.snapshot as Record<string, unknown>)
            : null,
        revision: number(row.canvas_revision ?? 0),
        ...(row.canvas_updated_at
          ? { updatedAt: new Date(text(row.canvas_updated_at)).toISOString() }
          : {}),
      };
    },

    async saveCanvas(userId, projectId, snapshot) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(tx, userId, projectId);
        if (!locked) return undefined;
        const saved = await tx(
          `INSERT INTO research_project_canvases (project_id, snapshot)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (project_id) DO UPDATE
             SET snapshot = EXCLUDED.snapshot,
                 revision = research_project_canvases.revision + 1,
                 updated_at = now()
           RETURNING snapshot, revision, updated_at`,
          [locked.id, JSON.stringify(snapshot)],
        );
        const row = saved.rows[0];
        return {
          snapshot: row.snapshot as Record<string, unknown>,
          revision: number(row.revision),
          updatedAt: new Date(text(row.updated_at)).toISOString(),
        };
      });
    },

    async listCanvasFiles(userId, projectId) {
      const access = await loadWorkspace(runQuery, userId, projectId);
      if (!access) return undefined;
      const result = await runQuery(
        `SELECT canvas.id::text, project.public_id::text AS project_public_id,
                canvas.title, canvas.revision, canvas.created_at, canvas.updated_at
         FROM research_project_canvas_files canvas
         JOIN research_projects project ON project.id = canvas.project_id
         WHERE project.public_id = $1::uuid
         ORDER BY canvas.updated_at DESC, canvas.id`,
        [projectId],
      );
      return result.rows.map((row) => ({
        id: text(row.id),
        projectId: text(row.project_public_id),
        title: text(row.title),
        revision: number(row.revision),
        createdAt: new Date(text(row.created_at)).toISOString(),
        updatedAt: new Date(text(row.updated_at)).toISOString(),
      }));
    },

    async createCanvasFile(userId, projectId, title, snapshot) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(tx, userId, projectId);
        if (!locked) return undefined;
        const result = await tx(
          `INSERT INTO research_project_canvas_files (project_id, title, snapshot)
           VALUES ($1, $2, $3::jsonb)
           RETURNING id::text, title, snapshot, revision, created_at, updated_at`,
          [locked.id, title, JSON.stringify(snapshot)],
        );
        const row = result.rows[0];
        return {
          id: text(row.id),
          projectId,
          title: text(row.title),
          snapshot: row.snapshot as Record<string, unknown>,
          revision: number(row.revision),
          createdAt: new Date(text(row.created_at)).toISOString(),
          updatedAt: new Date(text(row.updated_at)).toISOString(),
        };
      });
    },

    async getCanvasFile(userId, projectId, canvasId) {
      const result = await runQuery(
        `SELECT canvas.id::text, project.public_id::text AS project_public_id,
                canvas.title, canvas.snapshot, canvas.revision,
                canvas.created_at, canvas.updated_at
         FROM research_project_canvas_files canvas
         JOIN research_projects project ON project.id = canvas.project_id
         LEFT JOIN organization_members membership
           ON membership.organization_id = project.organization_id AND membership.user_id = $3
         LEFT JOIN project_document_collaborators collaborator
           ON collaborator.project_id = project.id AND collaborator.user_id = $3
         WHERE project.public_id = $1::uuid AND canvas.id = $2::uuid
           AND ((project.organization_id IS NULL AND project.user_id = $3)
             OR membership.user_id = $3 OR collaborator.user_id = $3)
         LIMIT 1`,
        [projectId, canvasId, userId],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      return {
        id: text(row.id),
        projectId: text(row.project_public_id),
        title: text(row.title),
        snapshot: row.snapshot as Record<string, unknown>,
        revision: number(row.revision),
        createdAt: new Date(text(row.created_at)).toISOString(),
        updatedAt: new Date(text(row.updated_at)).toISOString(),
      };
    },

    async saveCanvasFile(userId, projectId, canvasId, snapshot) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(tx, userId, projectId);
        if (!locked) return undefined;
        const result = await tx(
          `UPDATE research_project_canvas_files
           SET snapshot = $3::jsonb, revision = revision + 1, updated_at = now()
           WHERE project_id = $1 AND id = $2::uuid
           RETURNING id::text, title, snapshot, revision, created_at, updated_at`,
          [locked.id, canvasId, JSON.stringify(snapshot)],
        );
        const row = result.rows[0];
        if (!row) return undefined;
        return {
          id: text(row.id),
          projectId,
          title: text(row.title),
          snapshot: row.snapshot as Record<string, unknown>,
          revision: number(row.revision),
          createdAt: new Date(text(row.created_at)).toISOString(),
          updatedAt: new Date(text(row.updated_at)).toISOString(),
        };
      });
    },

    async attachCanvasAsset(userId, projectId, assetId, metadata) {
      validateObjectMetadata(metadata);
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(tx, userId, projectId);
        if (!locked) return undefined;
        const stored = await tx(
          `INSERT INTO stored_objects (object_key, sha256, byte_size, content_type, access_class)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
           WHERE stored_objects.sha256 = EXCLUDED.sha256
             AND stored_objects.byte_size = EXCLUDED.byte_size
             AND stored_objects.content_type = EXCLUDED.content_type
             AND stored_objects.access_class = EXCLUDED.access_class
           RETURNING object_key`,
          [
            metadata.key,
            metadata.sha256,
            metadata.byteSize,
            metadata.contentType,
            metadata.accessClass,
          ],
        );
        if (!stored.rowCount)
          throw new Error("Object key already exists with different metadata");
        await tx(
          `INSERT INTO research_project_canvas_assets (project_id, asset_id, object_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_id, asset_id) DO UPDATE
             SET object_key = EXCLUDED.object_key`,
          [locked.id, assetId, metadata.key],
        );
        return metadata;
      });
    },

    async getCanvasAsset(userId, projectId, assetId) {
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM research_project_canvas_assets a
         JOIN research_projects rp ON rp.id = a.project_id
         JOIN stored_objects so ON so.object_key = a.object_key
         WHERE rp.public_id = $1
           AND ((rp.organization_id IS NULL AND rp.user_id = $2) OR EXISTS (
             SELECT 1 FROM organization_members membership
             WHERE membership.organization_id = rp.organization_id AND membership.user_id = $2
           ) OR EXISTS (
             SELECT 1 FROM project_document_collaborators project_member
             WHERE project_member.project_id = rp.id AND project_member.user_id = $2
           ))
           AND a.asset_id = $3`,
        [projectId, userId, assetId],
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

    async getPrivateObject(userId, projectId, itemId) {
      const result = await runQuery(
        `SELECT so.object_key, so.sha256, so.byte_size, so.content_type, so.access_class
         FROM research_project_items i
         JOIN research_projects rp ON rp.id = i.project_id
         JOIN stored_objects so ON so.object_key = i.private_object_key
         WHERE ((rp.organization_id IS NULL AND rp.user_id = $1) OR EXISTS (
                 SELECT 1 FROM organization_members membership
                 WHERE membership.organization_id = rp.organization_id AND membership.user_id = $1
               ) OR EXISTS (
                 SELECT 1 FROM project_document_collaborators project_member
                 WHERE project_member.project_id = rp.id AND project_member.user_id = $1
               ))
           AND rp.public_id = $2 AND i.id = $3
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
        const locked = await lockOwnedProject(
          tx,
          userId,
          projectId,
          expectedRevision,
        );
        if (!locked) return undefined;
        const columns: string[] = [];
        const values: unknown[] = [locked.id];
        let contentChanged = false;
        const names: Array<[keyof ProjectPatch, string]> = [
          ["title", "title"],
          ["icon", "icon"],
          ["question", "question"],
          ["platformFilter", "platform_filter"],
          ["pinned", "pinned"],
          ["constraints", "constraints"],
          ["decision", "decision"],
          ["rationale", "rationale"],
          ["openQuestions", "open_questions"],
        ];
        for (const [key, column] of names) {
          if (patch[key] === undefined) continue;
          values.push(
            typeof patch[key] === "string" ? patch[key].trim() : patch[key],
          );
          columns.push(`${column} = $${values.length}`);
          if (key !== "pinned") contentChanged = true;
        }
        if (columns.length) {
          await tx(
            `UPDATE research_projects SET ${columns.join(", ")}${
              contentChanged
                ? ", revision = revision + 1, updated_at = now()"
                : ""
            } WHERE id = $1`,
            values,
          );
        }
        return loadWorkspace(tx, userId, projectId);
      });
    },

    async duplicateProject(userId, projectId) {
      return runTransaction(async (tx) => {
        const sourceProject = await lockOwnedProject(tx, userId, projectId);
        if (!sourceProject) return undefined;
        const source = await loadWorkspace(tx, userId, projectId);
        if (!source) return undefined;
        const created = await tx(
          `INSERT INTO research_projects
             (user_id, title, icon, question, platform_filter, constraints, decision, rationale, open_questions, organization_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, public_id`,
          [
            userId,
            `${source.title} copy`,
            source.icon ?? "initial",
            source.question,
            source.platformFilter,
            source.constraints,
            source.decision,
            source.rationale,
            source.openQuestions,
            source.organization?.id ?? null,
          ],
        );
        const duplicateInternalId = number(created.rows[0].id);
        const duplicateId = text(created.rows[0].public_id);
        for (const lane of source.lanes) {
          const laneResult = await tx(
            `INSERT INTO research_project_lanes (project_id, title, position, conclusion)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [duplicateInternalId, lane.title, lane.position, lane.conclusion],
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
              [duplicateInternalId, laneId, item.position, item.id],
            );
          }
        }
        await tx(
          `INSERT INTO research_project_canvases (project_id, snapshot)
           SELECT $1, snapshot
           FROM research_project_canvases
           WHERE project_id = $2`,
          [duplicateInternalId, sourceProject.id],
        );
        await tx(
          `INSERT INTO research_project_canvas_assets (project_id, asset_id, object_key)
           SELECT $1, asset_id, object_key
           FROM research_project_canvas_assets
           WHERE project_id = $2`,
          [duplicateInternalId, sourceProject.id],
        );
        return loadWorkspace(tx, userId, duplicateId);
      });
    },

    async deleteProject(userId, projectId) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          projectId,
          undefined,
          true,
        );
        if (!locked) {
          return { deleted: false, privateObjectKeys: [] };
        }
        const keys = await tx(
          `SELECT DISTINCT candidate.object_key
           FROM (
             SELECT i.private_object_key AS object_key
             FROM research_project_items i
             WHERE i.project_id = $1 AND i.private_object_key IS NOT NULL
             UNION
             SELECT asset.object_key
             FROM research_project_canvas_assets asset
             WHERE asset.project_id = $1
           ) candidate
           WHERE NOT EXISTS (
             SELECT 1 FROM research_project_items other_item
             WHERE other_item.private_object_key = candidate.object_key
               AND other_item.project_id <> $1
           )
             AND NOT EXISTS (
               SELECT 1 FROM research_project_canvas_assets other_asset
               WHERE other_asset.object_key = candidate.object_key
                 AND other_asset.project_id <> $1
             )`,
          [locked.id],
        );
        await tx("DELETE FROM research_projects WHERE id = $1", [locked.id]);
        return {
          deleted: true,
          privateObjectKeys: keys.rows.map((row) => text(row.object_key)),
        };
      });
    },

    async listMembers(userId, projectId) {
      const result = await runQuery(
        `SELECT rp.id AS project_id,
                organization.id AS organization_id,
                organization.name AS organization_name,
                (rp.organization_id IS NULL AND rp.user_id = $2)
                  OR organization_membership.role IN ('owner', 'admin') AS can_manage,
                project_member.user_id,
                account.email,
                project_member.role,
                project_member.created_at
         FROM research_projects rp
         LEFT JOIN organizations organization ON organization.id = rp.organization_id
         LEFT JOIN organization_members organization_membership
           ON organization_membership.organization_id = rp.organization_id
          AND organization_membership.user_id = $2
         LEFT JOIN project_document_collaborators requester_membership
           ON requester_membership.project_id = rp.id
          AND requester_membership.user_id = $2
         LEFT JOIN project_document_collaborators project_member ON project_member.project_id = rp.id
         LEFT JOIN users account ON account.id = project_member.user_id
         WHERE rp.public_id = $1
           AND ((rp.organization_id IS NULL AND rp.user_id = $2)
             OR organization_membership.user_id = $2
             OR requester_membership.user_id = $2)
         ORDER BY project_member.created_at, project_member.user_id`,
        [projectId, userId],
      );
      if (!result.rows.length) return undefined;
      const first = result.rows[0];
      return {
        members: result.rows.flatMap((row) =>
          row.user_id == null
            ? []
            : [
                {
                  userId: number(row.user_id),
                  email: text(row.email),
                  role: row.role as ResearchProjectMemberRole,
                  createdAt: new Date(text(row.created_at)).toISOString(),
                },
              ],
        ),
        canManage: first.can_manage === true,
        ...(first.organization_id == null
          ? {}
          : {
              organization: {
                id: number(first.organization_id),
                name: text(first.organization_name),
              },
            }),
      };
    },

    async addMemberByEmail(userId, projectId, email, role) {
      if (role !== "editor" && role !== "viewer")
        throw new Error("Invalid project member role");
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          projectId,
          undefined,
          true,
        );
        if (!locked) return "forbidden";
        const normalized = email.trim().toLowerCase();
        const found = await tx("SELECT id FROM users WHERE email = $1", [
          normalized,
        ]);
        if (!found.rows[0]) return "user_not_found";
        await tx(
          `INSERT INTO project_document_collaborators (project_id, user_id, role, invited_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, user_id)
           DO UPDATE SET role = EXCLUDED.role, invited_by_user_id = EXCLUDED.invited_by_user_id`,
          [locked.id, number(found.rows[0].id), role, userId],
        );
        return "added";
      });
    },

    async removeMember(userId, projectId, targetUserId) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          projectId,
          undefined,
          true,
        );
        if (!locked) return false;
        const removed = await tx(
          `DELETE FROM project_document_collaborators
           WHERE project_id = $1 AND user_id = $2
           RETURNING user_id`,
          [locked.id, targetUserId],
        );
        return removed.rowCount === 1;
      });
    },

    async createLane(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const count = await tx(
          "SELECT count(*)::integer AS count FROM research_project_lanes WHERE project_id = $1",
          [locked.id],
        );
        if (number(count.rows[0].count) >= RESEARCH_LIMITS.lanesMax)
          throw new Error("Research lane limit reached");
        await tx(
          `INSERT INTO research_project_lanes (project_id, title, position)
           SELECT $1, $2, COALESCE(max(position), -1) + 1
           FROM research_project_lanes WHERE project_id = $1`,
          [locked.id, input.title.trim()],
        );
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async updateLane(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const values: unknown[] = [input.laneId, locked.id];
        const updates: string[] = [];
        if (input.title !== undefined) {
          values.push(input.title.trim());
          updates.push(`title = $${values.length}`);
        }
        if (input.conclusion !== undefined) {
          values.push(input.conclusion.trim());
          updates.push(`conclusion = $${values.length}`);
        }
        if (input.position !== undefined) {
          values.push(input.position);
          updates.push(`position = $${values.length}`);
        }
        if (updates.length) {
          const updated = await tx(
            `UPDATE research_project_lanes SET ${updates.join(", ")}
             WHERE id = $1 AND project_id = $2 RETURNING id`,
            values,
          );
          if (!updated.rowCount) return undefined;
          await bumpRevision(tx, locked.id);
        }
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async deleteEmptyLane(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const lanes = await tx(
          "SELECT count(*)::integer AS count FROM research_project_lanes WHERE project_id = $1",
          [locked.id],
        );
        if (number(lanes.rows[0].count) <= RESEARCH_LIMITS.lanesMin)
          throw new Error("At least two lanes are required");
        const deleted = await tx(
          `DELETE FROM research_project_lanes l
           WHERE l.id = $1 AND l.project_id = $2
             AND NOT EXISTS (SELECT 1 FROM research_project_items i WHERE i.lane_id = l.id)
           RETURNING l.position`,
          [input.laneId, locked.id],
        );
        if (!deleted.rowCount)
          throw new Error("Only empty lanes can be deleted");
        await tx(
          "UPDATE research_project_lanes SET position = position - 1 WHERE project_id = $1 AND position > $2",
          [locked.id, deleted.rows[0].position],
        );
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async addItem(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const counts = await tx(
          `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE source_kind = 'private_upload')::integer AS private_count
           FROM research_project_items WHERE project_id = $1`,
          [locked.id],
        );
        if (number(counts.rows[0].total) >= RESEARCH_LIMITS.itemsMax)
          throw new Error("Research evidence limit reached");
        if (
          input.sourceKind === "private_upload" &&
          number(counts.rows[0].private_count) >=
            RESEARCH_LIMITS.privateUploadsMax
        ) {
          throw new Error("Private upload limit reached");
        }
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.laneId, locked.id],
        );
        if (!lane.rowCount) return undefined;
        await tx(
          `INSERT INTO research_project_items
             (project_id, lane_id, position, source_kind, catalog_app, catalog_version_id,
              catalog_image_id, catalog_flow_id, catalog_step_index, private_object_key, source_snapshot)
           SELECT $1, $2, COALESCE(max(position), -1) + 1, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
           FROM research_project_items WHERE lane_id = $2`,
          [
            locked.id,
            input.laneId,
            input.sourceKind,
            input.catalog?.app ?? null,
            input.catalog?.versionId ?? null,
            input.catalog?.imageId ?? null,
            input.catalog?.flowId ?? null,
            input.catalog?.stepIndex ?? null,
            input.privateObjectKey ?? null,
            JSON.stringify(input.snapshot),
          ],
        );
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async attachFlow(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.laneId, locked.id],
        );
        if (!lane.rowCount) return undefined;

        const source = await tx(
          `SELECT COALESCE(a.display_name, initcap(replace(a.name, '-', ' '))) AS app_name,
                  afv.steps
           FROM app_flow_versions afv
           JOIN app_versions av ON av.id = afv.version_id
           JOIN apps a ON a.id = av.app_id
           WHERE a.name = $1 AND av.id = $2 AND av.platform = $3
             AND av.published_at IS NOT NULL AND afv.source_flow_id = $4`,
          [
            input.catalog.appId,
            input.catalog.versionId,
            input.catalog.platform,
            input.catalog.flowId,
          ],
        );
        const sourceRow = source.rows[0];
        if (!sourceRow || !Array.isArray(sourceRow.steps)) {
          throw new Error("Invalid catalog flow reference");
        }
        const steps = sourceRow.steps.flatMap((value, stepIndex) => {
          if (!value || typeof value !== "object" || Array.isArray(value))
            return [];
          const step = value as { label?: unknown; evidence?: unknown };
          if (!Array.isArray(step.evidence)) return [];
          const rawImage = step.evidence[0];
          const imageId = Number(
            rawImage && typeof rawImage === "object"
              ? (rawImage as { imageId?: unknown }).imageId
              : rawImage,
          );
          if (!Number.isSafeInteger(imageId) || imageId <= 0) return [];
          const label =
            typeof step.label === "string" && step.label.trim()
              ? step.label.trim().slice(0, 240)
              : `Step ${stepIndex + 1}`;
          return [{ imageId, stepIndex, label }];
        });
        if (!steps.length)
          throw new Error("Catalog flow has no attachable steps");

        const existing = await tx(
          `SELECT catalog_image_id, catalog_step_index
           FROM research_project_items
           WHERE project_id = $1 AND source_kind = 'catalog_flow_step'
             AND catalog_app = $2 AND catalog_version_id = $3 AND catalog_flow_id = $4`,
          [
            locked.id,
            input.catalog.appId,
            input.catalog.versionId,
            input.catalog.flowId,
          ],
        );
        const existingKeys = new Set(
          existing.rows.map(
            (row) =>
              `${number(row.catalog_image_id)}:${number(row.catalog_step_index)}`,
          ),
        );
        const uniqueKeys = new Set<string>();
        const missingSteps = steps.filter((step) => {
          const key = `${step.imageId}:${step.stepIndex}`;
          if (existingKeys.has(key) || uniqueKeys.has(key)) return false;
          uniqueKeys.add(key);
          return true;
        });
        if (!missingSteps.length)
          return loadWorkspace(tx, userId, input.projectId);

        const counts = await tx(
          "SELECT count(*)::integer AS total FROM research_project_items WHERE project_id = $1",
          [locked.id],
        );
        if (
          number(counts.rows[0].total) + missingSteps.length >
          RESEARCH_LIMITS.itemsMax
        ) {
          throw new Error("Research evidence limit reached");
        }
        const positionResult = await tx(
          "SELECT COALESCE(max(position), -1)::integer AS position FROM research_project_items WHERE lane_id = $1",
          [input.laneId],
        );
        const firstPosition = number(positionResult.rows[0].position) + 1;
        for (const [offset, step] of missingSteps.entries()) {
          const snapshot = {
            title: step.label,
            app: text(sourceRow.app_name),
            platform: input.catalog.platform,
            flow: input.catalog.title,
            step: step.label,
            sourcePath: `flow:${input.catalog.appId}:${input.catalog.flowId}`,
            description: input.catalog.description || "",
          };
          await tx(
            `INSERT INTO research_project_items
               (project_id, lane_id, position, source_kind, step_label, catalog_app,
                catalog_version_id, catalog_image_id, catalog_flow_id, catalog_step_index,
                source_snapshot)
             VALUES ($1, $2, $3, 'catalog_flow_step', $4, $5, $6, $7, $8, $9, $10::jsonb)`,
            [
              locked.id,
              input.laneId,
              firstPosition + offset,
              step.label,
              input.catalog.appId,
              input.catalog.versionId,
              step.imageId,
              input.catalog.flowId,
              step.stepIndex,
              JSON.stringify(snapshot),
            ],
          );
        }
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async addPrivateItem(userId, input, metadata) {
      validateObjectMetadata(metadata);
      if (
        input.sourceKind !== "private_upload" ||
        input.privateObjectKey !== metadata.key
      ) {
        throw new Error("Invalid private research item");
      }
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const counts = await tx(
          `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE source_kind = 'private_upload')::integer AS private_count
           FROM research_project_items WHERE project_id = $1`,
          [locked.id],
        );
        if (number(counts.rows[0].total) >= RESEARCH_LIMITS.itemsMax)
          throw new Error("Research evidence limit reached");
        if (
          number(counts.rows[0].private_count) >=
          RESEARCH_LIMITS.privateUploadsMax
        )
          throw new Error("Private upload limit reached");
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.laneId, locked.id],
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
          [
            metadata.key,
            metadata.sha256,
            metadata.byteSize,
            metadata.contentType,
            metadata.accessClass,
          ],
        );
        if (!stored.rowCount)
          throw new Error("Object key already exists with different metadata");
        await tx(
          `INSERT INTO research_project_items
             (project_id, lane_id, position, source_kind, private_object_key, source_snapshot)
           SELECT $1, $2, COALESCE(max(position), -1) + 1, 'private_upload', $3, $4::jsonb
           FROM research_project_items WHERE lane_id = $2`,
          [
            locked.id,
            input.laneId,
            metadata.key,
            JSON.stringify(input.snapshot),
          ],
        );
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async updateItem(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const values: unknown[] = [input.itemId, locked.id];
        const updates: string[] = [];
        if (input.stepLabel !== undefined) {
          values.push(input.stepLabel.trim());
          updates.push(`step_label = $${values.length}`);
        }
        if (input.note !== undefined) {
          values.push(input.note.trim());
          updates.push(`note = $${values.length}`);
        }
        if (input.tags !== undefined) {
          values.push(JSON.stringify(normalizeResearchTags(input.tags)));
          updates.push(`tags = $${values.length}::jsonb`);
        }
        if (input.important !== undefined) {
          values.push(input.important);
          updates.push(`important = $${values.length}`);
        }
        if (updates.length) {
          const updated = await tx(
            `UPDATE research_project_items SET ${updates.join(", ")}, updated_at = now()
             WHERE id = $1 AND project_id = $2 RETURNING id`,
            values,
          );
          if (!updated.rowCount) return undefined;
          await bumpRevision(tx, locked.id);
        }
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async moveItem(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return undefined;
        const itemResult = await tx(
          "SELECT lane_id, position FROM research_project_items WHERE id = $1 AND project_id = $2 FOR UPDATE",
          [input.itemId, locked.id],
        );
        const item = itemResult.rows[0];
        if (!item) return undefined;
        const lane = await tx(
          "SELECT id FROM research_project_lanes WHERE id = $1 AND project_id = $2",
          [input.targetLaneId, locked.id],
        );
        if (!lane.rowCount) return undefined;
        const sourceLaneId = number(item.lane_id);
        const sourcePosition = number(item.position);
        const targetCount = await tx(
          "SELECT count(*)::integer AS count FROM research_project_items WHERE lane_id = $1",
          [input.targetLaneId],
        );
        const sameLane = sourceLaneId === input.targetLaneId;
        const lastPosition = Math.max(
          0,
          number(targetCount.rows[0].count) - (sameLane ? 1 : 0),
        );
        const targetPosition = Math.max(
          0,
          Math.min(input.targetPosition, lastPosition),
        );
        await tx(
          "SET CONSTRAINTS research_project_items_lane_position_unique DEFERRED",
        );
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
        await bumpRevision(tx, locked.id);
        return loadWorkspace(tx, userId, input.projectId);
      });
    },

    async removeItem(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(
          tx,
          userId,
          input.projectId,
          input.expectedRevision,
        );
        if (!locked) return {};
        const removed = await tx(
          `DELETE FROM research_project_items
           WHERE id = $1 AND project_id = $2
           RETURNING lane_id, position, private_object_key`,
          [input.itemId, locked.id],
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
          if (!refs.rowCount)
            unreferencedPrivateObjectKey = text(row.private_object_key);
        }
        await bumpRevision(tx, locked.id);
        return {
          project: await loadWorkspace(tx, userId, input.projectId),
          unreferencedPrivateObjectKey,
        };
      });
    },

    async recordSynthesis(userId, input) {
      return runTransaction(async (tx) => {
        const locked = await lockOwnedProject(tx, userId, input.projectId);
        if (!locked || locked.revision !== input.projectRevision)
          return undefined;
        const recorded = await tx(
          `INSERT INTO research_project_syntheses
             (project_id, project_revision, status, result, error_code, model, schema_version)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           RETURNING id, project_revision, status, result, created_at`,
          [
            locked.id,
            input.projectRevision,
            input.status,
            input.result ? JSON.stringify(input.result) : null,
            input.errorCode ?? null,
            input.model,
            input.schemaVersion,
          ],
        );
        return synthesisFromRow(recorded.rows[0], input.projectRevision);
      });
    },
  };
}
