export type ProjectDocumentMode = "page" | "edgeless";

export type ProjectDocumentPageWidth = "standard" | "full";

export type ProjectDocumentIcon =
  | "none"
  | "document"
  | "idea"
  | "task"
  | "schedule"
  | "build";

export type ProjectDocumentTagColor =
  | "blue"
  | "purple"
  | "green"
  | "amber"
  | "rose"
  | "slate";

export type ProjectDocumentPropertyType =
  | "text"
  | "number"
  | "checkbox"
  | "date";

export interface ProjectDocumentProperty {
  id: string;
  name: string;
  type: ProjectDocumentPropertyType;
  value: string | number | boolean | null;
}

export function normalizeProjectDocumentProperties(
  value: unknown,
): ProjectDocumentProperty[] | undefined {
  if (!Array.isArray(value) || value.length > 50) return undefined;
  const ids = new Set<string>();
  const properties: ProjectDocumentProperty[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return undefined;
    const record = candidate as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const type = record.type as ProjectDocumentPropertyType | undefined;
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      ids.has(id) ||
      !name ||
      name.length > 80 ||
      !type ||
      !["text", "number", "checkbox", "date"].includes(type)
    ) {
      return undefined;
    }
    let propertyValue = record.value;
    if (type === "text") {
      if (typeof propertyValue !== "string" || propertyValue.length > 2000) {
        return undefined;
      }
    } else if (type === "number") {
      if (
        propertyValue !== null &&
        (typeof propertyValue !== "number" ||
          !Number.isFinite(propertyValue))
      ) {
        return undefined;
      }
    } else if (type === "checkbox") {
      if (typeof propertyValue !== "boolean") return undefined;
    } else {
      if (propertyValue !== null) {
        if (
          typeof propertyValue !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(propertyValue)
        ) {
          return undefined;
        }
        const parsedDate = new Date(`${propertyValue}T00:00:00Z`);
        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== propertyValue
        ) {
          return undefined;
        }
      }
    }
    ids.add(id);
    properties.push({ id, name, type, value: propertyValue });
  }
  return properties;
}

export interface ProjectDocument {
  id: number;
  projectId: number;
  ownerUserId: number;
  documentKey: string;
  title: string;
  icon: ProjectDocumentIcon;
  isFavorite: boolean;
  isTemplate: boolean;
  pageWidth: ProjectDocumentPageWidth;
  properties: ProjectDocumentProperty[];
  octobaseDocumentId: string;
  lastEditorMode: ProjectDocumentMode;
  integrationVersion: string;
  createdByUserId: number;
  createdByEmail: string;
  lastEditedByUserId: number;
  lastEditedByEmail: string;
  journalDate: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectDocumentPublic = Omit<ProjectDocument, "octobaseDocumentId">;

export interface ProjectDocumentSearchResult {
  document: ProjectDocumentPublic;
  snippet: string;
}

export interface ProjectDocumentFolder {
  id: number;
  projectId: number;
  ownerUserId: number;
  parentFolderId: number | null;
  name: string;
  isFavorite: boolean;
  documentIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentTag {
  id: number;
  projectId: number;
  ownerUserId: number;
  name: string;
  color: ProjectDocumentTagColor;
  documentIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentLink {
  projectId: number;
  ownerUserId: number;
  sourceDocumentId: number;
  targetDocumentId: number;
  createdAt: string;
}

export interface ProjectDocumentCommentAnchor {
  blockId: string;
  quote: string | null;
}

export interface ProjectDocumentComment {
  id: number;
  projectId: number;
  documentId: number;
  authorUserId: number;
  authorEmail: string;
  body: string;
  blockId: string | null;
  quote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentShare {
  id: number;
  projectId: number;
  documentId: number;
  createdAt: string;
  revokedAt?: string;
  url?: string;
}

export interface ProjectDocumentVersion {
  id: number;
  projectId: number;
  documentId: number;
  createdByUserId: number;
  createdByEmail: string;
  label: string;
  byteSize: number;
  createdAt: string;
}

export type ProjectDocumentCollaboratorRole = "editor" | "viewer";
export type ProjectDocumentAccessRole =
  | "owner"
  | ProjectDocumentCollaboratorRole;

export interface ProjectDocumentAccess {
  ownerUserId: number;
  role: ProjectDocumentAccessRole;
}

export interface ProjectDocumentCollaborator {
  userId: number;
  email: string;
  role: ProjectDocumentCollaboratorRole;
  createdAt: string;
}

export interface PublicProjectDocumentShare {
  document: ProjectDocumentPublic;
  syncBaseUrl: string;
  blobBaseUrl: string;
  syncInstanceId: string;
  sharedAt: string;
}

export type ProjectDocumentCollectionMode = "manual" | "rules";

export type ProjectDocumentCollectionRule =
  | { field: "favorite"; value: boolean }
  | { field: "tag"; value: number }
  | { field: "createdAfter"; value: string }
  | { field: "updatedAfter"; value: string }
  | { field: "mode"; value: ProjectDocumentMode }
  | { field: "pageWidth"; value: ProjectDocumentPageWidth }
  | { field: "journal"; value: boolean };

export interface ProjectDocumentSmartCollection {
  id: number;
  projectId: number;
  ownerUserId: number;
  name: string;
  isFavorite: boolean;
  mode: ProjectDocumentCollectionMode;
  rules: ProjectDocumentCollectionRule[];
  documentIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentBootstrap {
  document: ProjectDocumentPublic;
  created: boolean;
  syncBaseUrl: string;
  blobBaseUrl: string;
  syncInstanceId: string;
}

export interface ProjectDocumentVersionRestore {
  bootstrap: ProjectDocumentBootstrap;
  snapshotBase64: string;
}

export interface ProjectDocumentCollection {
  documents: ProjectDocumentPublic[];
  trash: ProjectDocumentPublic[];
  folders: ProjectDocumentFolder[];
  tags: ProjectDocumentTag[];
  collections: ProjectDocumentSmartCollection[];
  links?: ProjectDocumentLink[];
  access?: ProjectDocumentAccess;
  collaborators?: ProjectDocumentCollaborator[];
}
