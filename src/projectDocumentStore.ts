import type { QueryResult } from "pg";

import { query as databaseQuery } from "./db.ts";
import {
  normalizeProjectDocumentProperties,
  type ProjectDocumentProperty,
  type ProjectDocument,
  type ProjectDocumentAccess,
  type ProjectDocumentCollaborator,
  type ProjectDocumentCollaboratorRole,
  type ProjectDocumentComment,
  type ProjectDocumentCollectionMode,
  type ProjectDocumentCollectionRule,
  type ProjectDocumentFolder,
  type ProjectDocumentIcon,
  type ProjectDocumentLink,
  type ProjectDocumentMode,
  type ProjectDocumentPageWidth,
  type ProjectDocumentSearchResult,
  type ProjectDocumentShare,
  type ProjectDocumentSmartCollection,
  type ProjectDocumentTag,
  type ProjectDocumentTagColor,
  type ProjectDocumentVersion,
} from "./projectDocument.ts";

export type ProjectDocumentQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

export interface ProjectDocumentStore {
  accessForUser?(
    userId: number,
    projectId: number,
  ): Promise<ProjectDocumentAccess | undefined>;
  listCollaborators?(
    ownerUserId: number,
    projectId: number,
  ): Promise<ProjectDocumentCollaborator[]>;
  addCollaboratorByEmail?(
    ownerUserId: number,
    projectId: number,
    invitedByUserId: number,
    email: string,
    role: ProjectDocumentCollaboratorRole,
  ): Promise<ProjectDocumentCollaborator | undefined>;
  removeCollaborator?(
    ownerUserId: number,
    projectId: number,
    userId: number,
  ): Promise<boolean>;
  listOwned(userId: number, projectId: number): Promise<ProjectDocument[]>;
  searchOwned?(
    userId: number,
    projectId: number,
    query: string,
  ): Promise<ProjectDocumentSearchResult[]>;
  updateSearchText?(
    userId: number,
    projectId: number,
    documentId: number,
    text: string,
  ): Promise<boolean>;
  listTrashed(userId: number, projectId: number): Promise<ProjectDocument[]>;
  findByKey(
    userId: number,
    projectId: number,
    documentKey: string,
  ): Promise<ProjectDocument | undefined>;
  createForOwnedProject(
    userId: number,
    projectId: number,
    input: {
      documentKey: string;
      title: string;
      octobaseDocumentId: string;
      integrationVersion: string;
      journalDate?: string | null;
      createdByUserId?: number;
    },
  ): Promise<ProjectDocument | undefined>;
  findOwned(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined>;
  findTrashed(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined>;
  updateMode(
    userId: number,
    projectId: number,
    documentId: number,
    mode: ProjectDocumentMode,
    actorUserId?: number,
  ): Promise<ProjectDocument | undefined>;
  updateMetadata(
    userId: number,
    projectId: number,
    documentId: number,
    metadata: {
      title: string;
      icon: ProjectDocumentIcon;
      isFavorite: boolean;
      pageWidth: ProjectDocumentPageWidth;
      properties: ProjectDocumentProperty[];
    },
    actorUserId?: number,
  ): Promise<ProjectDocument | undefined>;
  updateTemplate?(
    userId: number,
    projectId: number,
    documentId: number,
    snapshot?: Uint8Array,
    actorUserId?: number,
  ): Promise<ProjectDocument | undefined>;
  getTemplateSnapshot?(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<Uint8Array | undefined>;
  touchLastEdited?(
    userId: number,
    projectId: number,
    documentId: number,
    actorUserId: number,
  ): Promise<boolean>;
  replaceWorkspace?(
    userId: number,
    projectId: number,
    documentId: number,
    expectedWorkspaceId: string,
    nextWorkspaceId: string,
    actorUserId?: number,
  ): Promise<ProjectDocument | undefined>;
  trashOwned(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined>;
  restoreOwned(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocument | undefined>;
  deleteTrashed(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<boolean>;
  listFolders?(
    userId: number,
    projectId: number,
  ): Promise<ProjectDocumentFolder[]>;
  createFolder?(
    userId: number,
    projectId: number,
    input: { name: string; parentFolderId: number | null },
  ): Promise<ProjectDocumentFolder | undefined>;
  updateFolder?(
    userId: number,
    projectId: number,
    folderId: number,
    input: { name: string; isFavorite: boolean },
  ): Promise<ProjectDocumentFolder | undefined>;
  deleteFolder?(
    userId: number,
    projectId: number,
    folderId: number,
  ): Promise<boolean>;
  setFolderDocuments?(
    userId: number,
    projectId: number,
    folderId: number,
    documentIds: readonly number[],
  ): Promise<boolean>;
  listTags?(userId: number, projectId: number): Promise<ProjectDocumentTag[]>;
  createTag?(
    userId: number,
    projectId: number,
    input: { name: string; color: ProjectDocumentTagColor },
  ): Promise<ProjectDocumentTag | undefined>;
  updateTag?(
    userId: number,
    projectId: number,
    tagId: number,
    input: { name: string; color: ProjectDocumentTagColor },
  ): Promise<ProjectDocumentTag | undefined>;
  deleteTag?(
    userId: number,
    projectId: number,
    tagId: number,
  ): Promise<boolean>;
  setDocumentTags?(
    userId: number,
    projectId: number,
    documentId: number,
    tagIds: readonly number[],
  ): Promise<boolean>;
  listCollections?(
    userId: number,
    projectId: number,
  ): Promise<ProjectDocumentSmartCollection[]>;
  createCollection?(
    userId: number,
    projectId: number,
    input: { name: string },
  ): Promise<ProjectDocumentSmartCollection | undefined>;
  updateCollection?(
    userId: number,
    projectId: number,
    collectionId: number,
    input: {
      name: string;
      isFavorite: boolean;
      mode: ProjectDocumentCollectionMode;
      rules: readonly ProjectDocumentCollectionRule[];
    },
  ): Promise<ProjectDocumentSmartCollection | undefined>;
  deleteCollection?(
    userId: number,
    projectId: number,
    collectionId: number,
  ): Promise<boolean>;
  setCollectionDocuments?(
    userId: number,
    projectId: number,
    collectionId: number,
    documentIds: readonly number[],
  ): Promise<boolean>;
  listLinks?(userId: number, projectId: number): Promise<ProjectDocumentLink[]>;
  setDocumentLinks?(
    userId: number,
    projectId: number,
    documentId: number,
    targetDocumentIds: readonly number[],
  ): Promise<boolean>;
  listComments?(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocumentComment[]>;
  createComment?(
    ownerUserId: number,
    projectId: number,
    documentId: number,
    body: string,
    authorUserId?: number,
    anchor?: {
      blockId: string;
      quote: string | null;
    },
  ): Promise<ProjectDocumentComment | undefined>;
  resolveComment?(
    userId: number,
    projectId: number,
    documentId: number,
    commentId: number,
    resolved: boolean,
  ): Promise<ProjectDocumentComment | undefined>;
  listVersions?(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocumentVersion[]>;
  createVersion?(
    ownerUserId: number,
    projectId: number,
    documentId: number,
    createdByUserId: number,
    label: string,
    snapshot: Uint8Array,
  ): Promise<ProjectDocumentVersion | undefined>;
  getVersion?(
    userId: number,
    projectId: number,
    documentId: number,
    versionId: number,
  ): Promise<
    | {
        version: ProjectDocumentVersion;
        snapshot: Uint8Array;
      }
    | undefined
  >;
  listShares?(
    userId: number,
    projectId: number,
    documentId: number,
  ): Promise<ProjectDocumentShare[]>;
  createShare?(
    userId: number,
    projectId: number,
    documentId: number,
    tokenSha256: string,
  ): Promise<ProjectDocumentShare | undefined>;
  revokeShare?(
    userId: number,
    projectId: number,
    documentId: number,
    shareId: number,
  ): Promise<boolean>;
  publicShare?(tokenSha256: string): Promise<
    | {
        document: ProjectDocument;
        sharedAt: string;
      }
    | undefined
  >;
}

const liveQuery: ProjectDocumentQuery = (sql, values) =>
  databaseQuery(sql, values ? [...values] : undefined);

function projectDocumentFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocument | undefined {
  if (!row) return undefined;
  const journalDate =
    row.journal_date instanceof Date
      ? [
          row.journal_date.getFullYear(),
          String(row.journal_date.getMonth() + 1).padStart(2, "0"),
          String(row.journal_date.getDate()).padStart(2, "0"),
        ].join("-")
      : row.journal_date === null || row.journal_date === undefined
        ? null
        : String(row.journal_date).slice(0, 10);
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    ownerUserId: Number(row.owner_user_id),
    documentKey: String(row.document_key),
    title: String(row.title),
    icon: row.icon as ProjectDocumentIcon,
    isFavorite: Boolean(row.is_favorite),
    isTemplate: Boolean(row.is_template),
    pageWidth: row.page_width as ProjectDocumentPageWidth,
    properties: normalizeProjectDocumentProperties(row.properties) ?? [],
    octobaseDocumentId: String(row.octobase_document_id),
    lastEditorMode: row.last_editor_mode as ProjectDocumentMode,
    integrationVersion: String(row.integration_version),
    createdByUserId: Number(row.created_by_user_id),
    createdByEmail: String(row.created_by_email),
    lastEditedByUserId: Number(row.last_edited_by_user_id),
    lastEditedByEmail: String(row.last_edited_by_email),
    journalDate,
    trashedAt:
      row.trashed_at === null || row.trashed_at === undefined
        ? null
        : new Date(String(row.trashed_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function numericIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = Number(item);
    return Number.isSafeInteger(id) && id > 0 ? [id] : [];
  });
}

function projectDocumentFolderFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentFolder | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    ownerUserId: Number(row.owner_user_id),
    parentFolderId:
      row.parent_folder_id === null || row.parent_folder_id === undefined
        ? null
        : Number(row.parent_folder_id),
    name: String(row.name),
    isFavorite: Boolean(row.is_favorite),
    documentIds: numericIds(row.document_ids),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function projectDocumentTagFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentTag | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    ownerUserId: Number(row.owner_user_id),
    name: String(row.name),
    color: row.color as ProjectDocumentTagColor,
    documentIds: numericIds(row.document_ids),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function projectDocumentCollectionRules(
  value: unknown,
): ProjectDocumentCollectionRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rule) => {
    if (!rule || typeof rule !== "object") return [];
    const candidate = rule as Record<string, unknown>;
    if (
      (candidate.field === "favorite" || candidate.field === "journal") &&
      typeof candidate.value === "boolean"
    ) {
      return [
        {
          field: candidate.field,
          value: candidate.value,
        } as ProjectDocumentCollectionRule,
      ];
    }
    if (
      candidate.field === "tag" &&
      Number.isSafeInteger(candidate.value) &&
      Number(candidate.value) > 0
    ) {
      return [{ field: "tag", value: Number(candidate.value) }];
    }
    if (
      (candidate.field === "createdAfter" ||
        candidate.field === "updatedAfter") &&
      typeof candidate.value === "string"
    ) {
      return [
        {
          field: candidate.field,
          value: candidate.value,
        } as ProjectDocumentCollectionRule,
      ];
    }
    if (
      candidate.field === "mode" &&
      (candidate.value === "page" || candidate.value === "edgeless")
    ) {
      return [{ field: "mode", value: candidate.value }];
    }
    if (
      candidate.field === "pageWidth" &&
      (candidate.value === "standard" || candidate.value === "full")
    ) {
      return [{ field: "pageWidth", value: candidate.value }];
    }
    return [];
  });
}

function projectDocumentCollectionFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentSmartCollection | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    ownerUserId: Number(row.owner_user_id),
    name: String(row.name),
    isFavorite: Boolean(row.is_favorite),
    mode: row.mode as ProjectDocumentCollectionMode,
    rules: projectDocumentCollectionRules(row.rules),
    documentIds: numericIds(row.document_ids),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function projectDocumentLinkFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentLink | undefined {
  if (!row) return undefined;
  return {
    projectId: Number(row.project_id),
    ownerUserId: Number(row.owner_user_id),
    sourceDocumentId: Number(row.source_document_id),
    targetDocumentId: Number(row.target_document_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function projectDocumentCommentFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentComment | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    documentId: Number(row.document_id),
    authorUserId: Number(row.author_user_id),
    authorEmail: String(row.author_email),
    body: String(row.body),
    blockId:
      row.block_id === null || row.block_id === undefined
        ? null
        : String(row.block_id),
    quote:
      row.quote === null || row.quote === undefined ? null : String(row.quote),
    resolvedAt:
      row.resolved_at === null || row.resolved_at === undefined
        ? null
        : new Date(String(row.resolved_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function projectDocumentShareFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentShare | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    documentId: Number(row.document_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    ...(row.revoked_at === null || row.revoked_at === undefined
      ? {}
      : { revokedAt: new Date(String(row.revoked_at)).toISOString() }),
  };
}

function projectDocumentVersionFromRow(
  row: Record<string, unknown> | undefined,
): ProjectDocumentVersion | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    documentId: Number(row.document_id),
    createdByUserId: Number(row.created_by_user_id),
    createdByEmail: String(row.created_by_email),
    label: String(row.label),
    byteSize: Number(row.byte_size),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

const RETURNING_COLUMNS = `
  id, project_id, owner_user_id, document_key, title, icon,
  is_favorite, is_template, page_width, properties,
  octobase_document_id, last_editor_mode, integration_version,
  created_by_user_id, created_by_email,
  last_edited_by_user_id, last_edited_by_email,
  journal_date, trashed_at, created_at, updated_at`;

const FOLDER_COLUMNS = `
  f.id, f.project_id, f.owner_user_id, f.parent_folder_id, f.name,
  f.is_favorite, f.created_at, f.updated_at,
  COALESCE(
    array_agg(m.document_id ORDER BY m.document_id)
      FILTER (WHERE m.document_id IS NOT NULL),
    '{}'::bigint[]
  ) AS document_ids`;

const TAG_COLUMNS = `
  t.id, t.project_id, t.owner_user_id, t.name, t.color,
  t.created_at, t.updated_at,
  COALESCE(
    array_agg(a.document_id ORDER BY a.document_id)
      FILTER (WHERE a.document_id IS NOT NULL),
    '{}'::bigint[]
  ) AS document_ids`;

const COLLECTION_COLUMNS = `
  c.id, c.project_id, c.owner_user_id, c.name, c.is_favorite,
  c.mode, c.rules, c.created_at, c.updated_at,
  COALESCE(
    array_agg(m.document_id ORDER BY m.document_id)
      FILTER (WHERE m.document_id IS NOT NULL),
    '{}'::bigint[]
  ) AS document_ids`;

export function createProjectDocumentStore(
  runQuery: ProjectDocumentQuery = liveQuery,
): ProjectDocumentStore {
  return {
    async accessForUser(userId, projectId) {
      const result = await runQuery(
        `SELECT
           rp.user_id AS owner_user_id,
           CASE WHEN rp.user_id = $2 THEN 'owner' ELSE c.role END AS role
         FROM research_projects rp
         LEFT JOIN project_document_collaborators c
           ON c.project_id = rp.id AND c.user_id = $2
         WHERE rp.id = $1
           AND (rp.user_id = $2 OR c.user_id IS NOT NULL)`,
        [projectId, userId],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      return {
        ownerUserId: Number(row.owner_user_id),
        role: String(row.role) as ProjectDocumentAccess["role"],
      };
    },

    async listCollaborators(ownerUserId, projectId) {
      const result = await runQuery(
        `SELECT c.user_id, u.email, c.role, c.created_at
         FROM project_document_collaborators c
         JOIN users u ON u.id = c.user_id
         JOIN research_projects rp ON rp.id = c.project_id
         WHERE c.project_id = $1 AND rp.user_id = $2
         ORDER BY lower(u.email), c.user_id`,
        [projectId, ownerUserId],
      );
      return result.rows.map((row) => ({
        userId: Number(row.user_id),
        email: String(row.email),
        role: String(row.role) as ProjectDocumentCollaboratorRole,
        createdAt: new Date(String(row.created_at)).toISOString(),
      }));
    },

    async addCollaboratorByEmail(
      ownerUserId,
      projectId,
      invitedByUserId,
      email,
      role,
    ) {
      const result = await runQuery(
        `INSERT INTO project_document_collaborators (
           project_id, user_id, role, invited_by_user_id
         )
         SELECT rp.id, u.id, $5, $3
         FROM research_projects rp
         JOIN users u ON lower(u.email) = lower($4)
         WHERE rp.id = $1 AND rp.user_id = $2 AND u.id <> rp.user_id
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, invited_by_user_id = EXCLUDED.invited_by_user_id
         RETURNING user_id, role, created_at`,
        [projectId, ownerUserId, invitedByUserId, email, role],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      return {
        userId: Number(row.user_id),
        email,
        role: String(row.role) as ProjectDocumentCollaboratorRole,
        createdAt: new Date(String(row.created_at)).toISOString(),
      };
    },

    async removeCollaborator(ownerUserId, projectId, userId) {
      const result = await runQuery(
        `DELETE FROM project_document_collaborators c
         USING research_projects rp
         WHERE c.project_id = $1 AND c.user_id = $2
           AND rp.id = c.project_id AND rp.user_id = $3`,
        [projectId, userId, ownerUserId],
      );
      return result.rowCount === 1;
    },

    async listOwned(userId, projectId) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS}
         FROM project_documents
         WHERE project_id = $1 AND owner_user_id = $2 AND trashed_at IS NULL
         ORDER BY is_favorite DESC, updated_at DESC, id DESC`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const document = projectDocumentFromRow(row);
        return document ? [document] : [];
      });
    },

    async searchOwned(userId, projectId, query) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS},
                CASE
                  WHEN position(lower($3) in lower(search_text)) > 0
                  THEN substring(
                    search_text
                    FROM greatest(
                      position(lower($3) in lower(search_text)) - 28,
                      1
                    )
                    FOR 160
                  )
                  ELSE left(search_text, 160)
                END AS search_snippet
         FROM project_documents
         WHERE project_id = $1
           AND owner_user_id = $2
           AND trashed_at IS NULL
           AND (
             title ILIKE '%' || $3 || '%'
             OR search_text ILIKE '%' || $3 || '%'
             OR to_tsvector(
               'simple',
               coalesce(title, '') || ' ' || coalesce(search_text, '')
             ) @@ websearch_to_tsquery('simple', $3)
           )
         ORDER BY
           CASE WHEN title ILIKE '%' || $3 || '%' THEN 0 ELSE 1 END,
           ts_rank(
             to_tsvector(
               'simple',
               coalesce(title, '') || ' ' || coalesce(search_text, '')
             ),
             websearch_to_tsquery('simple', $3)
           ) DESC,
           updated_at DESC,
           id DESC
         LIMIT 30`,
        [projectId, userId, query],
      );
      return result.rows.flatMap((row) => {
        const document = projectDocumentFromRow(row);
        if (!document) return [];
        const { octobaseDocumentId: _octobaseDocumentId, ...publicDocument } =
          document;
        return [
          {
            document: publicDocument,
            snippet: String(row.search_snippet ?? "")
              .replace(/\s+/g, " ")
              .trim(),
          },
        ];
      });
    },

    async updateSearchText(userId, projectId, documentId, text) {
      const result = await runQuery(
        `UPDATE project_documents
         SET search_text = $4
         WHERE id = $1
           AND project_id = $2
           AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING id`,
        [documentId, projectId, userId, text],
      );
      return Boolean(result.rows[0]);
    },

    async listTrashed(userId, projectId) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS}
         FROM project_documents
         WHERE project_id = $1 AND owner_user_id = $2
           AND trashed_at IS NOT NULL
         ORDER BY trashed_at DESC, id DESC`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const document = projectDocumentFromRow(row);
        return document ? [document] : [];
      });
    },

    async findByKey(userId, projectId, documentKey) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS}
         FROM project_documents
         WHERE project_id = $1 AND owner_user_id = $2 AND document_key = $3
           AND trashed_at IS NULL`,
        [projectId, userId, documentKey],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async createForOwnedProject(userId, projectId, input) {
      const result = await runQuery(
        `INSERT INTO project_documents (
           project_id,
           owner_user_id,
           document_key,
           title,
           octobase_document_id,
           integration_version,
           journal_date,
           created_by_user_id,
           created_by_email,
           last_edited_by_user_id,
           last_edited_by_email
         )
         SELECT
           rp.id, rp.user_id, $3, $4, $5, $6, $7::date,
           creator.id, creator.email, creator.id, creator.email
         FROM research_projects rp
         JOIN users creator ON creator.id = $8
         WHERE rp.id = $1 AND rp.user_id = $2
         ON CONFLICT (project_id, document_key) DO NOTHING
         RETURNING ${RETURNING_COLUMNS}`,
        [
          projectId,
          userId,
          input.documentKey,
          input.title,
          input.octobaseDocumentId,
          input.integrationVersion,
          input.journalDate ?? null,
          input.createdByUserId ?? userId,
        ],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async findOwned(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS}
         FROM project_documents
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL`,
        [documentId, projectId, userId],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async findTrashed(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT ${RETURNING_COLUMNS}
         FROM project_documents
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NOT NULL`,
        [documentId, projectId, userId],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async trashOwned(userId, projectId, documentId) {
      const result = await runQuery(
        `UPDATE project_documents
         SET trashed_at = now(), updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [documentId, projectId, userId],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async restoreOwned(userId, projectId, documentId) {
      const result = await runQuery(
        `UPDATE project_documents
         SET trashed_at = NULL, updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NOT NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [documentId, projectId, userId],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async deleteTrashed(userId, projectId, documentId) {
      const result = await runQuery(
        `DELETE FROM project_documents
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NOT NULL
         RETURNING id`,
        [documentId, projectId, userId],
      );
      return Boolean(result.rows[0]);
    },

    async updateMode(userId, projectId, documentId, mode, actorUserId) {
      const result = await runQuery(
        `UPDATE project_documents
         SET last_editor_mode = $4,
             last_edited_by_user_id = $5::bigint,
             last_edited_by_email = (SELECT email FROM users WHERE id = $5::bigint),
             updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [documentId, projectId, userId, mode, actorUserId ?? userId],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async updateMetadata(userId, projectId, documentId, metadata, actorUserId) {
      const result = await runQuery(
        `UPDATE project_documents
         SET title = $4,
             icon = $5,
             is_favorite = $6,
             page_width = $7,
             properties = $8::jsonb,
             last_edited_by_user_id = $9::bigint,
             last_edited_by_email = (SELECT email FROM users WHERE id = $9::bigint),
             updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [
          documentId,
          projectId,
          userId,
          metadata.title,
          metadata.icon,
          metadata.isFavorite,
          metadata.pageWidth,
          JSON.stringify(metadata.properties),
          actorUserId ?? userId,
        ],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async updateTemplate(
      userId,
      projectId,
      documentId,
      snapshot,
      actorUserId,
    ) {
      const result = await runQuery(
        `UPDATE project_documents
         SET is_template = $4,
             template_snapshot = $5,
             last_edited_by_user_id = $6::bigint,
             last_edited_by_email = (SELECT email FROM users WHERE id = $6::bigint),
             updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [
          documentId,
          projectId,
          userId,
          snapshot !== undefined,
          snapshot ? Buffer.from(snapshot) : null,
          actorUserId ?? userId,
        ],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async getTemplateSnapshot(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT template_snapshot
         FROM project_documents
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND is_template = true
           AND trashed_at IS NULL`,
        [documentId, projectId, userId],
      );
      const snapshot = result.rows[0]?.template_snapshot;
      return snapshot instanceof Uint8Array
        ? new Uint8Array(snapshot)
        : undefined;
    },

    async touchLastEdited(userId, projectId, documentId, actorUserId) {
      const result = await runQuery(
        `UPDATE project_documents
         SET last_edited_by_user_id = $4::bigint,
             last_edited_by_email = (SELECT email FROM users WHERE id = $4::bigint),
             updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND trashed_at IS NULL
         RETURNING id`,
        [documentId, projectId, userId, actorUserId],
      );
      return Boolean(result.rows[0]);
    },

    async replaceWorkspace(
      userId,
      projectId,
      documentId,
      expectedWorkspaceId,
      nextWorkspaceId,
      actorUserId,
    ) {
      const result = await runQuery(
        `UPDATE project_documents
         SET octobase_document_id = $5,
             last_edited_by_user_id = $6::bigint,
             last_edited_by_email = (SELECT email FROM users WHERE id = $6::bigint),
             updated_at = now()
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           AND octobase_document_id = $4
           AND trashed_at IS NULL
         RETURNING ${RETURNING_COLUMNS}`,
        [
          documentId,
          projectId,
          userId,
          expectedWorkspaceId,
          nextWorkspaceId,
          actorUserId ?? userId,
        ],
      );
      return projectDocumentFromRow(result.rows[0]);
    },

    async listFolders(userId, projectId) {
      const result = await runQuery(
        `SELECT ${FOLDER_COLUMNS}
         FROM project_document_folders f
         LEFT JOIN project_document_folder_memberships m ON m.folder_id = f.id
         WHERE f.project_id = $1 AND f.owner_user_id = $2
         GROUP BY f.id
         ORDER BY f.is_favorite DESC, f.created_at, f.id`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const folder = projectDocumentFolderFromRow(row);
        return folder ? [folder] : [];
      });
    },

    async createFolder(userId, projectId, input) {
      const result = await runQuery(
        `WITH inserted AS (
           INSERT INTO project_document_folders (
             project_id, owner_user_id, parent_folder_id, name
           )
           SELECT rp.id, rp.user_id, parent.id, $4
           FROM research_projects rp
           LEFT JOIN project_document_folders parent
             ON parent.id = $3
            AND parent.project_id = rp.id
            AND parent.owner_user_id = rp.user_id
           WHERE rp.id = $1
             AND rp.user_id = $2
             AND ($3::bigint IS NULL OR parent.id IS NOT NULL)
           RETURNING *
         )
         SELECT
           inserted.id, inserted.project_id, inserted.owner_user_id,
           inserted.parent_folder_id, inserted.name, inserted.is_favorite,
           inserted.created_at, inserted.updated_at,
           '{}'::bigint[] AS document_ids
         FROM inserted`,
        [projectId, userId, input.parentFolderId, input.name],
      );
      return projectDocumentFolderFromRow(result.rows[0]);
    },

    async updateFolder(userId, projectId, folderId, input) {
      const result = await runQuery(
        `WITH updated AS (
           UPDATE project_document_folders
           SET name = $4, is_favorite = $5, updated_at = now()
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           RETURNING *
         )
         SELECT
           updated.id, updated.project_id, updated.owner_user_id,
           updated.parent_folder_id, updated.name, updated.is_favorite,
           updated.created_at, updated.updated_at,
           COALESCE(
             array_agg(m.document_id ORDER BY m.document_id)
               FILTER (WHERE m.document_id IS NOT NULL),
             '{}'::bigint[]
           ) AS document_ids
         FROM updated
         LEFT JOIN project_document_folder_memberships m
           ON m.folder_id = updated.id
         GROUP BY
           updated.id, updated.project_id, updated.owner_user_id,
           updated.parent_folder_id, updated.name, updated.is_favorite,
           updated.created_at, updated.updated_at`,
        [folderId, projectId, userId, input.name, input.isFavorite],
      );
      return projectDocumentFolderFromRow(result.rows[0]);
    },

    async deleteFolder(userId, projectId, folderId) {
      const result = await runQuery(
        `DELETE FROM project_document_folders
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         RETURNING id`,
        [folderId, projectId, userId],
      );
      return Boolean(result.rows[0]);
    },

    async setFolderDocuments(userId, projectId, folderId, documentIds) {
      const result = await runQuery(
        `WITH target AS (
           SELECT id
           FROM project_document_folders
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         ),
         requested AS (
           SELECT DISTINCT unnest($4::bigint[]) AS id
         ),
         valid AS (
           SELECT d.id
           FROM requested r
           JOIN project_documents d ON d.id = r.id
           WHERE d.project_id = $2 AND d.owner_user_id = $3
         ),
         guard AS (
           SELECT
             EXISTS (SELECT 1 FROM target)
             AND (SELECT count(*) FROM requested) =
                 (SELECT count(*) FROM valid) AS ok
         ),
         deleted AS (
           DELETE FROM project_document_folder_memberships m
           WHERE m.folder_id = (SELECT id FROM target)
             AND (SELECT ok FROM guard)
           RETURNING m.document_id
         ),
         inserted AS (
           INSERT INTO project_document_folder_memberships (folder_id, document_id)
           SELECT target.id, valid.id
           FROM target CROSS JOIN valid
           WHERE (SELECT ok FROM guard)
           ON CONFLICT DO NOTHING
           RETURNING document_id
         )
         SELECT ok FROM guard`,
        [folderId, projectId, userId, [...documentIds]],
      );
      return Boolean(result.rows[0]?.ok);
    },

    async listTags(userId, projectId) {
      const result = await runQuery(
        `SELECT ${TAG_COLUMNS}
         FROM project_document_tags t
         LEFT JOIN project_document_tag_assignments a ON a.tag_id = t.id
         WHERE t.project_id = $1 AND t.owner_user_id = $2
         GROUP BY t.id
         ORDER BY lower(t.name), t.id`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const tag = projectDocumentTagFromRow(row);
        return tag ? [tag] : [];
      });
    },

    async createTag(userId, projectId, input) {
      const result = await runQuery(
        `WITH inserted AS (
           INSERT INTO project_document_tags (
             project_id, owner_user_id, name, color
           )
           SELECT rp.id, rp.user_id, $3, $4
           FROM research_projects rp
           WHERE rp.id = $1 AND rp.user_id = $2
           ON CONFLICT DO NOTHING
           RETURNING *
         )
         SELECT
           inserted.id, inserted.project_id, inserted.owner_user_id,
           inserted.name, inserted.color, inserted.created_at,
           inserted.updated_at, '{}'::bigint[] AS document_ids
         FROM inserted`,
        [projectId, userId, input.name, input.color],
      );
      return projectDocumentTagFromRow(result.rows[0]);
    },

    async updateTag(userId, projectId, tagId, input) {
      const result = await runQuery(
        `WITH updated AS (
           UPDATE project_document_tags
           SET name = $4, color = $5, updated_at = now()
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           RETURNING *
         )
         SELECT
           updated.id, updated.project_id, updated.owner_user_id,
           updated.name, updated.color, updated.created_at,
           updated.updated_at,
           COALESCE(
             array_agg(a.document_id ORDER BY a.document_id)
               FILTER (WHERE a.document_id IS NOT NULL),
             '{}'::bigint[]
           ) AS document_ids
         FROM updated
         LEFT JOIN project_document_tag_assignments a
           ON a.tag_id = updated.id
         GROUP BY
           updated.id, updated.project_id, updated.owner_user_id,
           updated.name, updated.color, updated.created_at,
           updated.updated_at`,
        [tagId, projectId, userId, input.name, input.color],
      );
      return projectDocumentTagFromRow(result.rows[0]);
    },

    async deleteTag(userId, projectId, tagId) {
      const result = await runQuery(
        `DELETE FROM project_document_tags
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         RETURNING id`,
        [tagId, projectId, userId],
      );
      return Boolean(result.rows[0]);
    },

    async setDocumentTags(userId, projectId, documentId, tagIds) {
      const result = await runQuery(
        `WITH target AS (
           SELECT id
           FROM project_documents
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         ),
         requested AS (
           SELECT DISTINCT unnest($4::bigint[]) AS id
         ),
         valid AS (
           SELECT t.id
           FROM requested r
           JOIN project_document_tags t ON t.id = r.id
           WHERE t.project_id = $2 AND t.owner_user_id = $3
         ),
         guard AS (
           SELECT
             EXISTS (SELECT 1 FROM target)
             AND (SELECT count(*) FROM requested) =
                 (SELECT count(*) FROM valid) AS ok
         ),
         deleted AS (
           DELETE FROM project_document_tag_assignments a
           WHERE a.document_id = (SELECT id FROM target)
             AND (SELECT ok FROM guard)
           RETURNING a.tag_id
         ),
         inserted AS (
           INSERT INTO project_document_tag_assignments (tag_id, document_id)
           SELECT valid.id, target.id
           FROM target CROSS JOIN valid
           WHERE (SELECT ok FROM guard)
           ON CONFLICT DO NOTHING
           RETURNING tag_id
         )
         SELECT ok FROM guard`,
        [documentId, projectId, userId, [...tagIds]],
      );
      return Boolean(result.rows[0]?.ok);
    },

    async listCollections(userId, projectId) {
      const result = await runQuery(
        `SELECT ${COLLECTION_COLUMNS}
         FROM project_document_collections c
         LEFT JOIN project_document_collection_memberships m
           ON m.collection_id = c.id
         WHERE c.project_id = $1 AND c.owner_user_id = $2
         GROUP BY c.id
         ORDER BY c.is_favorite DESC, lower(c.name), c.id`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const collection = projectDocumentCollectionFromRow(row);
        return collection ? [collection] : [];
      });
    },

    async createCollection(userId, projectId, input) {
      const result = await runQuery(
        `WITH inserted AS (
           INSERT INTO project_document_collections (
             project_id, owner_user_id, name
           )
           SELECT rp.id, rp.user_id, $3
           FROM research_projects rp
           WHERE rp.id = $1 AND rp.user_id = $2
           ON CONFLICT DO NOTHING
           RETURNING *
         )
         SELECT
           inserted.id, inserted.project_id, inserted.owner_user_id,
           inserted.name, inserted.is_favorite, inserted.mode,
           inserted.rules, inserted.created_at, inserted.updated_at,
           '{}'::bigint[] AS document_ids
         FROM inserted`,
        [projectId, userId, input.name],
      );
      return projectDocumentCollectionFromRow(result.rows[0]);
    },

    async updateCollection(userId, projectId, collectionId, input) {
      const result = await runQuery(
        `WITH updated AS (
           UPDATE project_document_collections
           SET name = $4,
               is_favorite = $5,
               mode = $6,
               rules = $7::jsonb,
               updated_at = now()
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
           RETURNING *
         )
         SELECT
           updated.id, updated.project_id, updated.owner_user_id,
           updated.name, updated.is_favorite, updated.mode,
           updated.rules, updated.created_at, updated.updated_at,
           COALESCE(
             array_agg(m.document_id ORDER BY m.document_id)
               FILTER (WHERE m.document_id IS NOT NULL),
             '{}'::bigint[]
           ) AS document_ids
         FROM updated
         LEFT JOIN project_document_collection_memberships m
           ON m.collection_id = updated.id
         GROUP BY
           updated.id, updated.project_id, updated.owner_user_id,
           updated.name, updated.is_favorite, updated.mode,
           updated.rules, updated.created_at, updated.updated_at`,
        [
          collectionId,
          projectId,
          userId,
          input.name,
          input.isFavorite,
          input.mode,
          JSON.stringify(input.rules),
        ],
      );
      return projectDocumentCollectionFromRow(result.rows[0]);
    },

    async deleteCollection(userId, projectId, collectionId) {
      const result = await runQuery(
        `DELETE FROM project_document_collections
         WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         RETURNING id`,
        [collectionId, projectId, userId],
      );
      return Boolean(result.rows[0]);
    },

    async setCollectionDocuments(userId, projectId, collectionId, documentIds) {
      const result = await runQuery(
        `WITH target AS (
           SELECT id
           FROM project_document_collections
           WHERE id = $1 AND project_id = $2 AND owner_user_id = $3
         ),
         requested AS (
           SELECT DISTINCT unnest($4::bigint[]) AS id
         ),
         valid AS (
           SELECT d.id
           FROM requested r
           JOIN project_documents d ON d.id = r.id
           WHERE d.project_id = $2 AND d.owner_user_id = $3
         ),
         guard AS (
           SELECT
             EXISTS (SELECT 1 FROM target)
             AND (SELECT count(*) FROM requested) =
                 (SELECT count(*) FROM valid) AS ok
         ),
         deleted AS (
           DELETE FROM project_document_collection_memberships m
           WHERE m.collection_id = (SELECT id FROM target)
             AND (SELECT ok FROM guard)
           RETURNING m.document_id
         ),
         inserted AS (
           INSERT INTO project_document_collection_memberships (
             collection_id, document_id
           )
           SELECT target.id, valid.id
           FROM target CROSS JOIN valid
           WHERE (SELECT ok FROM guard)
           ON CONFLICT DO NOTHING
           RETURNING document_id
         )
         SELECT ok FROM guard`,
        [collectionId, projectId, userId, [...documentIds]],
      );
      return Boolean(result.rows[0]?.ok);
    },

    async listLinks(userId, projectId) {
      const result = await runQuery(
        `SELECT
           project_id, owner_user_id, source_document_id,
           target_document_id, created_at
         FROM project_document_links
         WHERE project_id = $1 AND owner_user_id = $2
         ORDER BY created_at, source_document_id, target_document_id`,
        [projectId, userId],
      );
      return result.rows.flatMap((row) => {
        const link = projectDocumentLinkFromRow(row);
        return link ? [link] : [];
      });
    },

    async listComments(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT
           c.id, c.project_id, c.document_id, c.author_user_id,
           u.email AS author_email, c.body, c.block_id, c.quote, c.resolved_at,
           c.created_at, c.updated_at
         FROM project_document_comments c
         JOIN project_documents d ON d.id = c.document_id
         JOIN users u ON u.id = c.author_user_id
         WHERE c.project_id = $1
           AND c.document_id = $2
           AND d.owner_user_id = $3
           AND d.trashed_at IS NULL
         ORDER BY c.resolved_at NULLS FIRST, c.created_at, c.id`,
        [projectId, documentId, userId],
      );
      return result.rows.flatMap((row) => {
        const comment = projectDocumentCommentFromRow(row);
        return comment ? [comment] : [];
      });
    },

    async createComment(
      ownerUserId,
      projectId,
      documentId,
      body,
      authorUserId = ownerUserId,
      anchor,
    ) {
      const result = await runQuery(
        `WITH inserted AS (
           INSERT INTO project_document_comments (
             project_id, document_id, author_user_id, body, block_id, quote
           )
           SELECT d.project_id, d.id, $5, $4, $6, $7
           FROM project_documents d
           WHERE d.id = $1
             AND d.project_id = $2
             AND d.owner_user_id = $3
             AND d.trashed_at IS NULL
           RETURNING *
         )
         SELECT
           inserted.id, inserted.project_id, inserted.document_id,
           inserted.author_user_id, u.email AS author_email,
           inserted.body, inserted.block_id, inserted.quote,
           inserted.resolved_at,
           inserted.created_at, inserted.updated_at
         FROM inserted
         JOIN users u ON u.id = inserted.author_user_id`,
        [
          documentId,
          projectId,
          ownerUserId,
          body,
          authorUserId,
          anchor?.blockId ?? null,
          anchor?.quote ?? null,
        ],
      );
      return projectDocumentCommentFromRow(result.rows[0]);
    },

    async resolveComment(userId, projectId, documentId, commentId, resolved) {
      const result = await runQuery(
        `WITH updated AS (
           UPDATE project_document_comments c
           SET resolved_at = CASE WHEN $5 THEN now() ELSE NULL END,
               updated_at = now()
           FROM project_documents d
           WHERE c.id = $1
             AND c.document_id = $2
             AND c.project_id = $3
             AND d.id = c.document_id
             AND d.owner_user_id = $4
             AND d.trashed_at IS NULL
           RETURNING c.*
         )
         SELECT
           updated.id, updated.project_id, updated.document_id,
           updated.author_user_id, u.email AS author_email,
           updated.body, updated.block_id, updated.quote,
           updated.resolved_at,
           updated.created_at, updated.updated_at
         FROM updated
         JOIN users u ON u.id = updated.author_user_id`,
        [commentId, documentId, projectId, userId, resolved],
      );
      return projectDocumentCommentFromRow(result.rows[0]);
    },

    async listVersions(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT
           v.id, v.project_id, v.document_id, v.created_by_user_id,
           u.email AS created_by_email, v.label, v.byte_size, v.created_at
         FROM project_document_versions v
         JOIN project_documents d ON d.id = v.document_id
         JOIN users u ON u.id = v.created_by_user_id
         WHERE v.project_id = $1
           AND v.document_id = $2
           AND d.owner_user_id = $3
           AND d.trashed_at IS NULL
         ORDER BY v.created_at DESC, v.id DESC`,
        [projectId, documentId, userId],
      );
      return result.rows.flatMap((row) => {
        const version = projectDocumentVersionFromRow(row);
        return version ? [version] : [];
      });
    },

    async createVersion(
      ownerUserId,
      projectId,
      documentId,
      createdByUserId,
      label,
      snapshot,
    ) {
      const result = await runQuery(
        `WITH inserted AS (
           INSERT INTO project_document_versions (
             project_id, document_id, created_by_user_id,
             label, snapshot, byte_size
           )
           SELECT d.project_id, d.id, $4, $5, $6, $7
           FROM project_documents d
           WHERE d.id = $1
             AND d.project_id = $2
             AND d.owner_user_id = $3
             AND d.trashed_at IS NULL
           RETURNING *
         )
         SELECT
           inserted.id, inserted.project_id, inserted.document_id,
           inserted.created_by_user_id, u.email AS created_by_email,
           inserted.label, inserted.byte_size, inserted.created_at
         FROM inserted
         JOIN users u ON u.id = inserted.created_by_user_id`,
        [
          documentId,
          projectId,
          ownerUserId,
          createdByUserId,
          label,
          Buffer.from(snapshot),
          snapshot.byteLength,
        ],
      );
      return projectDocumentVersionFromRow(result.rows[0]);
    },

    async getVersion(userId, projectId, documentId, versionId) {
      const result = await runQuery(
        `SELECT
           v.id, v.project_id, v.document_id, v.created_by_user_id,
           u.email AS created_by_email, v.label, v.byte_size, v.created_at,
           v.snapshot
         FROM project_document_versions v
         JOIN project_documents d ON d.id = v.document_id
         JOIN users u ON u.id = v.created_by_user_id
         WHERE v.id = $1
           AND v.document_id = $2
           AND v.project_id = $3
           AND d.owner_user_id = $4
           AND d.trashed_at IS NULL`,
        [versionId, documentId, projectId, userId],
      );
      const version = projectDocumentVersionFromRow(result.rows[0]);
      const snapshot = result.rows[0]?.snapshot;
      if (!version || !(snapshot instanceof Uint8Array)) {
        return undefined;
      }
      return {
        version,
        snapshot: new Uint8Array(snapshot),
      };
    },

    async listShares(userId, projectId, documentId) {
      const result = await runQuery(
        `SELECT
           s.id, s.project_id, s.document_id, s.created_at, s.revoked_at
         FROM project_document_shares s
         JOIN project_documents d ON d.id = s.document_id
         WHERE s.project_id = $1
           AND s.document_id = $2
           AND d.owner_user_id = $3
           AND d.trashed_at IS NULL
           AND s.revoked_at IS NULL
         ORDER BY s.created_at DESC, s.id DESC`,
        [projectId, documentId, userId],
      );
      return result.rows.flatMap((row) => {
        const share = projectDocumentShareFromRow(row);
        return share ? [share] : [];
      });
    },

    async createShare(userId, projectId, documentId, tokenSha256) {
      const result = await runQuery(
        `INSERT INTO project_document_shares (
           project_id, document_id, owner_user_id, token_sha256
         )
         SELECT d.project_id, d.id, d.owner_user_id, $4
         FROM project_documents d
         WHERE d.id = $1
           AND d.project_id = $2
           AND d.owner_user_id = $3
           AND d.trashed_at IS NULL
         RETURNING id, project_id, document_id, created_at, revoked_at`,
        [documentId, projectId, userId, tokenSha256],
      );
      return projectDocumentShareFromRow(result.rows[0]);
    },

    async revokeShare(userId, projectId, documentId, shareId) {
      const result = await runQuery(
        `UPDATE project_document_shares s
         SET revoked_at = now()
         FROM project_documents d
         WHERE s.id = $1
           AND s.document_id = $2
           AND s.project_id = $3
           AND d.id = s.document_id
           AND d.owner_user_id = $4
           AND s.revoked_at IS NULL`,
        [shareId, documentId, projectId, userId],
      );
      return result.rowCount === 1;
    },

    async publicShare(tokenSha256) {
      const result = await runQuery(
        `WITH active_share AS (
           UPDATE project_document_shares
           SET last_accessed_at = now()
           WHERE token_sha256 = $1
             AND revoked_at IS NULL
           RETURNING document_id, created_at
         )
         SELECT
           d.id, d.project_id, d.owner_user_id, d.document_key, d.title,
           d.icon, d.is_favorite, d.page_width, d.octobase_document_id,
           d.last_editor_mode, d.integration_version, d.journal_date,
           d.trashed_at, d.created_at, d.updated_at,
           active_share.created_at AS shared_at
         FROM active_share
         JOIN project_documents d ON d.id = active_share.document_id
         WHERE d.trashed_at IS NULL`,
        [tokenSha256],
      );
      const document = projectDocumentFromRow(result.rows[0]);
      return document
        ? {
            document,
            sharedAt: new Date(String(result.rows[0]?.shared_at)).toISOString(),
          }
        : undefined;
    },

    async setDocumentLinks(userId, projectId, documentId, targetDocumentIds) {
      const result = await runQuery(
        `WITH source AS (
           SELECT id
           FROM project_documents
           WHERE id = $1
             AND project_id = $2
             AND owner_user_id = $3
             AND trashed_at IS NULL
         ),
         requested AS (
           SELECT DISTINCT id
           FROM unnest($4::bigint[]) AS requested(id)
           WHERE id <> $1
         ),
         valid AS (
           SELECT d.id
           FROM requested r
           JOIN project_documents d ON d.id = r.id
           WHERE d.project_id = $2
             AND d.owner_user_id = $3
             AND d.trashed_at IS NULL
         ),
         guard AS (
           SELECT
             EXISTS (SELECT 1 FROM source)
             AND (SELECT count(*) FROM requested) =
                 (SELECT count(*) FROM valid) AS ok
         ),
         deleted AS (
           DELETE FROM project_document_links l
           WHERE l.source_document_id = (SELECT id FROM source)
             AND l.project_id = $2
             AND l.owner_user_id = $3
             AND (SELECT ok FROM guard)
           RETURNING l.target_document_id
         ),
         inserted AS (
           INSERT INTO project_document_links (
             project_id,
             owner_user_id,
             source_document_id,
             target_document_id
           )
           SELECT $2, $3, source.id, valid.id
           FROM source CROSS JOIN valid
           WHERE (SELECT ok FROM guard)
           ON CONFLICT DO NOTHING
           RETURNING target_document_id
         )
         SELECT ok FROM guard`,
        [documentId, projectId, userId, [...targetDocumentIds]],
      );
      return Boolean(result.rows[0]?.ok);
    },
  };
}
