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
