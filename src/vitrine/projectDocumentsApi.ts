export interface ProjectDocumentView {
  id: number;
  projectId: string;
  title: string;
  icon: ProjectDocumentIcon;
  isFavorite: boolean;
  pageWidth: ProjectDocumentPageWidth;
  collaborationDocumentId: string;
  role: "editor" | "viewer";
  createdAt: string;
  updatedAt: string;
}

export type ProjectDocumentIcon = "none" | "document" | "idea" | "task" | "schedule" | "build";
export type ProjectDocumentPageWidth = "standard" | "full";

export interface ProjectDocumentPatch {
  title?: string;
  icon?: ProjectDocumentIcon;
  isFavorite?: boolean;
  pageWidth?: ProjectDocumentPageWidth;
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

export class ProjectDocumentApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
  }
}

export async function ensureProjectDocument(
  projectId: string,
): Promise<ProjectDocumentView> {
  const response = await fetch(
    `/api/research-projects/${encodeURIComponent(projectId)}/document`,
    { method: "POST" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectDocumentApiError(
      body.error ?? "Project document could not be opened",
      response.status,
    );
  }
  return response.json() as Promise<ProjectDocumentView>;
}

const documentsPath = (projectId: string) =>
  `/api/research-projects/${encodeURIComponent(projectId)}/documents`;
const documentPath = (projectId: string, documentId: number) =>
  `${documentsPath(projectId)}/${documentId}`;

export function listProjectDocuments(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDocumentView[]> {
  return projectDocumentRequest(documentsPath(projectId), { signal });
}

export function createProjectDocument(
  projectId: string,
  title: string,
): Promise<ProjectDocumentView> {
  return projectDocumentRequest(documentsPath(projectId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function getProjectDocument(
  projectId: string,
  documentId: number,
): Promise<ProjectDocumentView> {
  return projectDocumentRequest(documentPath(projectId, documentId));
}

export function updateProjectDocumentById(
  projectId: string,
  documentId: number,
  patch: ProjectDocumentPatch,
): Promise<ProjectDocumentView> {
  return projectDocumentRequest(documentPath(projectId, documentId), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function listProjectDocumentCommentsById(
  projectId: string,
  documentId: number,
): Promise<ProjectDocumentCommentView[]> {
  return projectDocumentRequest(`${documentPath(projectId, documentId)}/comments`);
}

export function addProjectDocumentCommentById(
  projectId: string,
  documentId: number,
  body: string,
  context: {
    blockId?: string;
    quote?: string;
    parentCommentId?: number;
  } = {},
): Promise<ProjectDocumentCommentView> {
  return projectDocumentRequest(`${documentPath(projectId, documentId)}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body, ...context }),
  });
}

export async function deleteProjectDocumentCommentById(
  projectId: string,
  documentId: number,
  commentId: number,
): Promise<void> {
  const response = await fetch(
    `${documentPath(projectId, documentId)}/comments/${commentId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectDocumentApiError(
      body.error ?? "Project document request failed",
      response.status,
    );
  }
}

export function resolveProjectDocumentCommentById(
  projectId: string,
  documentId: number,
  commentId: number,
  resolved: boolean,
): Promise<ProjectDocumentCommentView> {
  return projectDocumentRequest(`${documentPath(projectId, documentId)}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resolved }),
  });
}

async function projectDocumentRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectDocumentApiError(
      body.error ?? "Project document request failed",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function updateProjectDocument(
  projectId: string,
  patch: ProjectDocumentPatch,
): Promise<ProjectDocumentView> {
  return projectDocumentRequest(
    `/api/research-projects/${encodeURIComponent(projectId)}/document`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

export function listProjectDocumentComments(
  projectId: string,
): Promise<ProjectDocumentCommentView[]> {
  return projectDocumentRequest(
    `/api/research-projects/${encodeURIComponent(projectId)}/document/comments`,
  );
}

export function addProjectDocumentComment(
  projectId: string,
  body: string,
): Promise<ProjectDocumentCommentView> {
  return projectDocumentRequest(
    `/api/research-projects/${encodeURIComponent(projectId)}/document/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export function resolveProjectDocumentComment(
  projectId: string,
  commentId: number,
  resolved: boolean,
): Promise<ProjectDocumentCommentView> {
  return projectDocumentRequest(
    `/api/research-projects/${encodeURIComponent(projectId)}/document/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved }),
    },
  );
}
