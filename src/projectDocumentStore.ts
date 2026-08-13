import { randomUUID } from "node:crypto";
import type { QueryResult } from "pg";

import { query, withTransaction } from "./db.ts";
import type { ResearchProjectId } from "./researchProject.ts";

export const PROJECT_DOCUMENT_STATE_BYTES_MAX = 8 * 1024 * 1024;
export const PROJECT_DOCUMENT_KEY = "project-notes";
export const PROJECT_DOCUMENT_INTEGRATION_VERSION = "blocknote-yjs-v1";

export type ProjectDocumentRole = "editor" | "viewer";
export type ProjectDocumentIcon = "none" | "document" | "idea" | "task" | "schedule" | "build";
export type ProjectDocumentPageWidth = "standard" | "full";
export type ProjectDocumentReviewStatus = "draft" | "in_review" | "approved";

export interface ProjectDocumentPatch {
  title?: string;
  icon?: ProjectDocumentIcon;
  isFavorite?: boolean;
  pageWidth?: ProjectDocumentPageWidth;
  reviewStatus?: ProjectDocumentReviewStatus;
}

export interface ProjectDocumentView {
  id: number;
  projectId: ResearchProjectId;
  title: string;
  icon: ProjectDocumentIcon;
  isFavorite: boolean;
  pageWidth: ProjectDocumentPageWidth;
  reviewStatus: ProjectDocumentReviewStatus;
  reviewRequestedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  collaborationDocumentId: string;
  role: ProjectDocumentRole;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentCommentView {
  id: number;
  body: string;
  authorUserId: number;
  authorEmail: string;
  blockId: string | null;
  quote: string | null;
  parentCommentId: number | null;
  canDelete: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentCommentInput {
  body: string;
  blockId?: string;
  quote?: string;
  parentCommentId?: number;
}

export interface ProjectDocumentAccess {
  documentId: number;
  userId: number;
  role: ProjectDocumentRole;
}

export interface ProjectDocumentStore {
  listDocuments(userId: number, projectId: ResearchProjectId): Promise<ProjectDocumentView[] | undefined>;
  createDocument(userId: number, projectId: ResearchProjectId, title: string): Promise<ProjectDocumentView | undefined>;
  getDocumentById(userId: number, projectId: ResearchProjectId, documentId: number): Promise<ProjectDocumentView | undefined>;
  updateDocumentById(userId: number, projectId: ResearchProjectId, documentId: number, patch: ProjectDocumentPatch): Promise<ProjectDocumentView | undefined>;
  listCommentsById(userId: number, projectId: ResearchProjectId, documentId: number): Promise<ProjectDocumentCommentView[] | undefined>;
  addCommentById(userId: number, projectId: ResearchProjectId, documentId: number, input: ProjectDocumentCommentInput): Promise<ProjectDocumentCommentView | undefined>;
  resolveCommentById(userId: number, projectId: ResearchProjectId, documentId: number, commentId: number, resolved: boolean): Promise<ProjectDocumentCommentView | undefined>;
  deleteCommentById(userId: number, projectId: ResearchProjectId, documentId: number, commentId: number): Promise<boolean | undefined>;
  ensureDocument(userId: number, projectId: ResearchProjectId): Promise<ProjectDocumentView | undefined>;
  getDocument(userId: number, projectId: ResearchProjectId): Promise<ProjectDocumentView | undefined>;
  updateDocument(userId: number, projectId: ResearchProjectId, patch: ProjectDocumentPatch): Promise<ProjectDocumentView | undefined>;
  listComments(userId: number, projectId: ResearchProjectId): Promise<ProjectDocumentCommentView[] | undefined>;
  addComment(userId: number, projectId: ResearchProjectId, body: string): Promise<ProjectDocumentCommentView | undefined>;
  resolveComment(userId: number, projectId: ResearchProjectId, commentId: number, resolved: boolean): Promise<ProjectDocumentCommentView | undefined>;
  accessDocument(userId: number, collaborationDocumentId: string): Promise<ProjectDocumentAccess | undefined>;
  loadRealtimeState(collaborationDocumentId: string): Promise<Uint8Array | null>;
  storeRealtimeState(collaborationDocumentId: string, state: Uint8Array): Promise<void>;
}

export type ProjectDocumentQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type ProjectDocumentTransaction = <T>(
  work: (query: ProjectDocumentQuery) => Promise<T>,
) => Promise<T>;

interface DocumentRow extends Record<string, unknown> {
  id: number;
  project_public_id: string;
  title: string;
  icon: ProjectDocumentIcon;
  is_favorite: boolean;
  page_width: ProjectDocumentPageWidth;
  review_status?: ProjectDocumentReviewStatus;
  review_requested_at?: Date | string | null;
  approved_at?: Date | string | null;
  approved_by_email?: string | null;
  collaboration_document_id: string;
  role: ProjectDocumentRole;
  created_at: Date | string;
  updated_at: Date | string;
}

const dateString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const view = (row: DocumentRow): ProjectDocumentView => ({
  id: Number(row.id),
  projectId: row.project_public_id,
  title: row.title,
  icon: row.icon,
  isFavorite: row.is_favorite,
  pageWidth: row.page_width,
  reviewStatus: row.review_status ?? "draft",
  reviewRequestedAt: row.review_requested_at ? dateString(row.review_requested_at) : null,
  approvedAt: row.approved_at ? dateString(row.approved_at) : null,
  approvedByEmail: row.approved_by_email ?? null,
  collaborationDocumentId: row.collaboration_document_id,
  role: row.role,
  createdAt: dateString(row.created_at),
  updatedAt: dateString(row.updated_at),
});

interface CommentRow extends Record<string, unknown> {
  id: number;
  body: string;
  author_user_id: number;
  author_email: string;
  block_id?: string | null;
  quote?: string | null;
  parent_comment_id?: number | null;
  resolved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const commentView = (row: CommentRow, userId: number): ProjectDocumentCommentView => ({
  id: Number(row.id),
  body: row.body,
  authorUserId: Number(row.author_user_id),
  authorEmail: row.author_email,
  blockId: row.block_id ?? null,
  quote: row.quote ?? null,
  parentCommentId: row.parent_comment_id == null ? null : Number(row.parent_comment_id),
  canDelete: Number(row.author_user_id) === userId,
  resolvedAt: row.resolved_at ? dateString(row.resolved_at) : null,
  createdAt: dateString(row.created_at),
  updatedAt: dateString(row.updated_at),
});

const selectDocumentSql = `
  SELECT document.id,
         project.public_id::text AS project_public_id,
         document.title,
         document.icon,
         document.is_favorite,
         document.page_width,
         document.review_status,
         document.review_requested_at,
         document.approved_at,
         (SELECT email FROM users WHERE id = document.approved_by_user_id) AS approved_by_email,
         document.octobase_document_id AS collaboration_document_id,
         CASE
           WHEN project.organization_id IS NULL AND document.owner_user_id = $1 THEN 'editor'
           WHEN team_member.role IN ('owner', 'admin') THEN 'editor'
           WHEN collaborator.role IS NOT NULL THEN collaborator.role
           ELSE 'editor'
         END AS role,
         document.created_at,
         document.updated_at
  FROM project_documents document
  JOIN research_projects project ON project.id = document.project_id
  LEFT JOIN organization_members team_member
    ON team_member.organization_id = project.organization_id
   AND team_member.user_id = $1
  LEFT JOIN project_document_collaborators collaborator
    ON collaborator.project_id = document.project_id
   AND collaborator.user_id = $1
  WHERE project.public_id = $2::uuid
    AND document.document_key = $3
    AND document.trashed_at IS NULL
    AND (
      (project.organization_id IS NULL AND document.owner_user_id = $1)
      OR team_member.user_id = $1
      OR collaborator.role IN ('editor', 'viewer')
    )
  LIMIT 1`;

const selectDocumentsSql = selectDocumentSql
  .replace("AND document.document_key = $3", "AND ($3::bigint IS NULL OR document.id = $3::bigint)")
  .replace("  LIMIT 1", "  ORDER BY document.updated_at DESC, document.id DESC");

export function createProjectDocumentStore(
  databaseQuery: ProjectDocumentQuery = (sql, values) =>
    query(sql, values ? [...values] : undefined),
  transaction: ProjectDocumentTransaction = async (work) =>
    withTransaction(async (client) =>
      work((sql, values) => client.query(sql, values ? [...values] : undefined))),
): ProjectDocumentStore {
  const getDocument = async (
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<ProjectDocumentView | undefined> => {
    const result = await databaseQuery(selectDocumentSql, [userId, projectId, PROJECT_DOCUMENT_KEY]);
    return result.rows[0] ? view(result.rows[0] as DocumentRow) : undefined;
  };

  const getDocumentById = async (
    userId: number,
    projectId: ResearchProjectId,
    documentId: number,
  ): Promise<ProjectDocumentView | undefined> => {
    const result = await databaseQuery(selectDocumentsSql, [userId, projectId, documentId]);
    return result.rows[0] ? view(result.rows[0] as DocumentRow) : undefined;
  };

  const listCommentsForDocument = async (
    userId: number,
    projectId: ResearchProjectId,
    documentId: number,
  ): Promise<ProjectDocumentCommentView[] | undefined> => {
    const document = await getDocumentById(userId, projectId, documentId);
    if (!document) return undefined;
    const comments = await databaseQuery(
      `SELECT comment.id, comment.body, comment.author_user_id,
              author.email AS author_email, comment.resolved_at,
              comment.block_id, comment.quote, comment.parent_comment_id,
              comment.created_at, comment.updated_at
       FROM project_document_comments comment
       JOIN users author ON author.id = comment.author_user_id
       WHERE comment.document_id = $1
       ORDER BY COALESCE(comment.parent_comment_id, comment.id),
                comment.parent_comment_id NULLS FIRST, comment.created_at, comment.id`,
      [document.id],
    );
    const deletableUserId = document.role === "editor" ? userId : -1;
    return comments.rows.map((row) => commentView(row as CommentRow, deletableUserId));
  };

  return {
    getDocument,
    getDocumentById,

    async listDocuments(userId, projectId) {
      const result = await databaseQuery(selectDocumentsSql, [userId, projectId, null]);
      if (!result.rows.length) {
        const project = await databaseQuery(
          `SELECT 1 FROM research_projects project
           LEFT JOIN organization_members team_member
             ON team_member.organization_id = project.organization_id AND team_member.user_id = $1
           LEFT JOIN project_document_collaborators collaborator
             ON collaborator.project_id = project.id AND collaborator.user_id = $1
           WHERE project.public_id = $2::uuid AND (
             (project.organization_id IS NULL AND project.user_id = $1)
             OR team_member.user_id = $1 OR collaborator.user_id = $1
           ) LIMIT 1`,
          [userId, projectId],
        );
        if (!project.rowCount) return undefined;
      }
      return result.rows.map((row) => view(row as DocumentRow));
    },

    async createDocument(userId, projectId, title) {
      const collaborationId = randomUUID();
      const documentKey = `page:${randomUUID()}`;
      const inserted = await databaseQuery(
        `INSERT INTO project_documents (
           project_id, owner_user_id, document_key, title,
           octobase_document_id, last_editor_mode, integration_version,
           created_by_user_id, created_by_email,
           last_edited_by_user_id, last_edited_by_email
         )
         SELECT project.id, $1, $3, $4, $5, 'page', $6,
                account.id, account.email, account.id, account.email
         FROM research_projects project
         JOIN users account ON account.id = $1
         LEFT JOIN organization_members team_member
           ON team_member.organization_id = project.organization_id AND team_member.user_id = $1
         LEFT JOIN project_document_collaborators collaborator
           ON collaborator.project_id = project.id AND collaborator.user_id = $1
         WHERE project.public_id = $2::uuid AND (
           (project.organization_id IS NULL AND project.user_id = $1)
           OR team_member.role IN ('owner', 'admin', 'member')
           OR collaborator.role = 'editor'
         )
         RETURNING id`,
        [userId, projectId, documentKey, title, collaborationId, PROJECT_DOCUMENT_INTEGRATION_VERSION],
      );
      const id = Number(inserted.rows[0]?.id);
      return Number.isSafeInteger(id) ? getDocumentById(userId, projectId, id) : undefined;
    },

    async updateDocumentById(userId, projectId, documentId, patch) {
      const existing = await getDocumentById(userId, projectId, documentId);
      if (!existing || existing.role !== "editor") return undefined;
      await databaseQuery(
        `UPDATE project_documents SET
           title = COALESCE($2, title), icon = COALESCE($3, icon),
           is_favorite = COALESCE($4, is_favorite), page_width = COALESCE($5, page_width),
           review_status = COALESCE($6, review_status),
           review_requested_at = CASE
             WHEN $6 = 'in_review' THEN now()
             WHEN $6 = 'draft' THEN NULL
             ELSE review_requested_at
           END,
           approved_at = CASE
             WHEN $6 = 'approved' THEN now()
             WHEN $6 IS NOT NULL THEN NULL
             ELSE approved_at
           END,
           approved_by_user_id = CASE
             WHEN $6 = 'approved' THEN $7::bigint
             WHEN $6 IS NOT NULL THEN NULL
             ELSE approved_by_user_id
           END,
           updated_at = now(), last_edited_by_user_id = $7::bigint,
           last_edited_by_email = (SELECT email FROM users WHERE id = $7::bigint)
         WHERE id = $1`,
        [documentId, patch.title ?? null, patch.icon ?? null,
          patch.isFavorite ?? null, patch.pageWidth ?? null,
          patch.reviewStatus ?? null, userId],
      );
      return getDocumentById(userId, projectId, documentId);
    },

    listCommentsById: listCommentsForDocument,

    async addCommentById(userId, projectId, documentId, input) {
      const document = await getDocumentById(userId, projectId, documentId);
      if (!document || document.role !== "editor") return undefined;
      const inserted = await databaseQuery(
        `INSERT INTO project_document_comments (
           project_id, document_id, author_user_id, body,
           block_id, quote, parent_comment_id
         )
         SELECT document.project_id, document.id, $2, $3,
                COALESCE(parent.block_id, $4), COALESCE(parent.quote, $5), $6
         FROM project_documents document
         LEFT JOIN project_document_comments parent
           ON parent.id = $6
          AND parent.document_id = document.id
          AND parent.parent_comment_id IS NULL
         WHERE document.id = $1
           AND document.trashed_at IS NULL
           AND ($6::bigint IS NULL OR parent.id IS NOT NULL)
         RETURNING id, body, author_user_id,
           (SELECT email FROM users WHERE id = author_user_id) AS author_email,
           block_id, quote, parent_comment_id,
           resolved_at, created_at, updated_at`,
        [
          document.id,
          userId,
          input.body,
          input.blockId ?? null,
          input.quote ?? null,
          input.parentCommentId ?? null,
        ],
      );
      return inserted.rows[0] ? commentView(inserted.rows[0] as CommentRow, userId) : undefined;
    },

    async resolveCommentById(userId, projectId, documentId, commentId, resolved) {
      const document = await getDocumentById(userId, projectId, documentId);
      if (!document || document.role !== "editor") return undefined;
      const updated = await databaseQuery(
        `UPDATE project_document_comments comment
         SET resolved_at = CASE WHEN $3 THEN now() ELSE NULL END, updated_at = now()
         WHERE comment.id = $2 AND comment.document_id = $1
           AND comment.parent_comment_id IS NULL
         RETURNING id, body, author_user_id,
           (SELECT email FROM users WHERE id = author_user_id) AS author_email,
           block_id, quote, parent_comment_id,
           resolved_at, created_at, updated_at`,
        [document.id, commentId, resolved],
      );
      return updated.rows[0] ? commentView(updated.rows[0] as CommentRow, userId) : undefined;
    },

    async deleteCommentById(userId, projectId, documentId, commentId) {
      const document = await getDocumentById(userId, projectId, documentId);
      if (!document || document.role !== "editor") return undefined;
      const deleted = await databaseQuery(
        `DELETE FROM project_document_comments
         WHERE id = $2 AND document_id = $1 AND author_user_id = $3
         RETURNING id`,
        [document.id, commentId, userId],
      );
      return Boolean(deleted.rowCount);
    },

    async ensureDocument(userId, projectId) {
      return transaction(async (transactionQuery) => {
        const existing = await transactionQuery(selectDocumentSql, [userId, projectId, PROJECT_DOCUMENT_KEY]);
        if (existing.rows[0]) return view(existing.rows[0] as DocumentRow);

        const inserted = await transactionQuery(
          `INSERT INTO project_documents (
             project_id,
             owner_user_id,
             document_key,
             title,
             octobase_document_id,
             last_editor_mode,
             integration_version,
             created_by_user_id,
             created_by_email,
             last_edited_by_user_id,
             last_edited_by_email
           )
           SELECT project.id,
                  $1,
                  $3,
                  CASE
                    WHEN char_length(project.title) <= 108 THEN project.title || ' notes'
                    ELSE left(project.title, 108) || ' notes'
                  END,
                  $4,
                  'page',
                  $5,
                  account.id,
                  account.email,
                  account.id,
                  account.email
           FROM research_projects project
           JOIN users account ON account.id = $1
           WHERE project.public_id = $2::uuid
             AND (
               (project.organization_id IS NULL AND project.user_id = $1)
               OR EXISTS (
                 SELECT 1 FROM organization_members membership
                 WHERE membership.organization_id = project.organization_id
                   AND membership.user_id = $1
                   AND (
                     membership.role IN ('owner', 'admin')
                     OR NOT EXISTS (
                       SELECT 1 FROM project_document_collaborators project_member
                       WHERE project_member.project_id = project.id
                         AND project_member.user_id = $1
                         AND project_member.role = 'viewer'
                     )
                   )
               )
               OR EXISTS (
                 SELECT 1 FROM project_document_collaborators project_member
                 WHERE project_member.project_id = project.id
                   AND project_member.user_id = $1
                   AND project_member.role = 'editor'
               )
             )
           ON CONFLICT (project_id, document_key) DO NOTHING
           RETURNING id`,
          [
            userId,
            projectId,
            PROJECT_DOCUMENT_KEY,
            randomUUID(),
            PROJECT_DOCUMENT_INTEGRATION_VERSION,
          ],
        );
        if (!inserted.rowCount) {
          const conflicted = await transactionQuery(selectDocumentSql, [userId, projectId, PROJECT_DOCUMENT_KEY]);
          return conflicted.rows[0] ? view(conflicted.rows[0] as DocumentRow) : undefined;
        }
        const created = await transactionQuery(selectDocumentSql, [userId, projectId, PROJECT_DOCUMENT_KEY]);
        return created.rows[0] ? view(created.rows[0] as DocumentRow) : undefined;
      });
    },

    async updateDocument(userId, projectId, patch) {
      const existing = await getDocument(userId, projectId);
      if (!existing || existing.role !== "editor") return undefined;
      const updated = await databaseQuery(
        `UPDATE project_documents
         SET title = COALESCE($2, title),
             icon = COALESCE($3, icon),
             is_favorite = COALESCE($4, is_favorite),
             page_width = COALESCE($5, page_width),
             review_status = COALESCE($6, review_status),
             review_requested_at = CASE
               WHEN $6 = 'in_review' THEN now()
               WHEN $6 = 'draft' THEN NULL
               ELSE review_requested_at
             END,
             approved_at = CASE
               WHEN $6 = 'approved' THEN now()
               WHEN $6 IS NOT NULL THEN NULL
               ELSE approved_at
             END,
             approved_by_user_id = CASE
               WHEN $6 = 'approved' THEN $7::bigint
               WHEN $6 IS NOT NULL THEN NULL
               ELSE approved_by_user_id
             END,
             updated_at = now(),
             last_edited_by_user_id = $7::bigint,
             last_edited_by_email = (
               SELECT email FROM users WHERE id = $7::bigint
             )
         WHERE id = $1
         RETURNING id`,
        [
          existing.id,
          patch.title ?? null,
          patch.icon ?? null,
          patch.isFavorite ?? null,
          patch.pageWidth ?? null,
          patch.reviewStatus ?? null,
          userId,
        ],
      );
      if (!updated.rowCount) return undefined;
      return getDocument(userId, projectId);
    },

    async listComments(userId, projectId) {
      const document = await getDocument(userId, projectId);
      if (!document) return undefined;
      const comments = await databaseQuery(
        `SELECT comment.id,
                comment.body,
                comment.author_user_id,
                author.email AS author_email,
                comment.block_id,
                comment.quote,
                comment.parent_comment_id,
                comment.resolved_at,
                comment.created_at,
                comment.updated_at
         FROM project_document_comments comment
         JOIN users author ON author.id = comment.author_user_id
         WHERE comment.document_id = $1
         ORDER BY COALESCE(comment.parent_comment_id, comment.id),
                  comment.parent_comment_id NULLS FIRST, comment.created_at, comment.id`,
        [document.id],
      );
      const deletableUserId = document.role === "editor" ? userId : -1;
      return comments.rows.map((row) => commentView(row as CommentRow, deletableUserId));
    },

    async addComment(userId, projectId, body) {
      const document = await getDocument(userId, projectId);
      if (!document || document.role !== "editor") return undefined;
      const inserted = await databaseQuery(
        `INSERT INTO project_document_comments (
           project_id, document_id, author_user_id, body
         )
         SELECT project_id, id, $2, $3
         FROM project_documents
         WHERE id = $1 AND trashed_at IS NULL
         RETURNING id,
                   body,
                   author_user_id,
                   (SELECT email FROM users WHERE id = author_user_id) AS author_email,
                   resolved_at,
                   created_at,
                   updated_at`,
        [document.id, userId, body],
      );
      return inserted.rows[0]
        ? commentView(inserted.rows[0] as CommentRow, userId)
        : undefined;
    },

    async resolveComment(userId, projectId, commentId, resolved) {
      const document = await getDocument(userId, projectId);
      if (!document || document.role !== "editor") return undefined;
      const updated = await databaseQuery(
        `UPDATE project_document_comments comment
         SET resolved_at = CASE WHEN $3 THEN now() ELSE NULL END,
             updated_at = now()
         WHERE comment.id = $2 AND comment.document_id = $1
         RETURNING id,
                   body,
                   author_user_id,
                   (SELECT email FROM users WHERE id = author_user_id) AS author_email,
                   resolved_at,
                   created_at,
                   updated_at`,
        [document.id, commentId, resolved],
      );
      return updated.rows[0]
        ? commentView(updated.rows[0] as CommentRow, userId)
        : undefined;
    },

    async accessDocument(userId, collaborationDocumentId) {
      const result = await databaseQuery(
        `SELECT document.id AS document_id,
                CASE
                  WHEN project.organization_id IS NULL AND document.owner_user_id = $1 THEN 'editor'
                  WHEN team_member.role IN ('owner', 'admin') THEN 'editor'
                  WHEN collaborator.role IS NOT NULL THEN collaborator.role
                  ELSE 'editor'
                END AS role
         FROM project_documents document
         JOIN research_projects project ON project.id = document.project_id
         LEFT JOIN organization_members team_member
           ON team_member.organization_id = project.organization_id
          AND team_member.user_id = $1
         LEFT JOIN project_document_collaborators collaborator
           ON collaborator.project_id = document.project_id
          AND collaborator.user_id = $1
         WHERE document.octobase_document_id = $2
           AND document.trashed_at IS NULL
           AND (
             (project.organization_id IS NULL AND document.owner_user_id = $1)
             OR team_member.user_id = $1
             OR collaborator.role IN ('editor', 'viewer')
           )
         LIMIT 1`,
        [userId, collaborationDocumentId],
      );
      const row = result.rows[0] as { document_id?: unknown; role?: unknown } | undefined;
      if (!row || (row.role !== "editor" && row.role !== "viewer")) return undefined;
      return { documentId: Number(row.document_id), userId, role: row.role };
    },

    async loadRealtimeState(collaborationDocumentId) {
      const result = await databaseQuery(
        `SELECT state.state
         FROM project_documents document
         JOIN project_document_realtime_states state ON state.document_id = document.id
         WHERE document.octobase_document_id = $1
           AND document.trashed_at IS NULL
         LIMIT 1`,
        [collaborationDocumentId],
      );
      const stored = result.rows[0]?.state;
      return stored instanceof Uint8Array ? new Uint8Array(stored) : null;
    },

    async storeRealtimeState(collaborationDocumentId, state) {
      if (state.byteLength < 1 || state.byteLength > PROJECT_DOCUMENT_STATE_BYTES_MAX) {
        throw new Error("Project document realtime state exceeds the supported size");
      }
      await transaction(async (transactionQuery) => {
        const document = await transactionQuery(
          `SELECT id FROM project_documents
           WHERE octobase_document_id = $1 AND trashed_at IS NULL
           FOR UPDATE`,
          [collaborationDocumentId],
        );
        const documentId = Number(document.rows[0]?.id);
        if (!Number.isSafeInteger(documentId) || documentId < 1) {
          throw new Error("Project document not found");
        }
        const bytes = Buffer.from(state);
        await transactionQuery(
          `INSERT INTO project_document_realtime_states (document_id, state, byte_size, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (document_id) DO UPDATE SET
             state = EXCLUDED.state,
             byte_size = EXCLUDED.byte_size,
             updated_at = now()`,
          [documentId, bytes, bytes.byteLength],
        );
        await transactionQuery(
          "UPDATE project_documents SET updated_at = now() WHERE id = $1",
          [documentId],
        );
      });
    },
  };
}
