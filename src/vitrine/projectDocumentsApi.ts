import type {
  ProjectDocumentBootstrap,
  ProjectDocumentCollaborator,
  ProjectDocumentCollaboratorRole,
  ProjectDocumentCollection,
  ProjectDocumentComment,
  ProjectDocumentCollectionMode,
  ProjectDocumentCollectionRule,
  ProjectDocumentIcon,
  ProjectDocumentMode,
  ProjectDocumentPageWidth,
  ProjectDocumentProperty,
  ProjectDocumentSearchResult,
  ProjectDocumentShare,
  ProjectDocumentTagColor,
  ProjectDocumentVersion,
  ProjectDocumentVersionRestore,
  PublicProjectDocumentShare,
} from "../projectDocument.ts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export function bootstrapProjectDocument(
  projectId: number,
  documentId?: number,
): Promise<ProjectDocumentBootstrap> {
  return documentId
    ? request(`/api/research-projects/${projectId}/document/${documentId}`)
    : request(`/api/research-projects/${projectId}/document`, {
        method: "POST",
      });
}

export function listProjectDocuments(
  projectId: number,
): Promise<ProjectDocumentCollection> {
  return request(`/api/research-projects/${projectId}/documents`);
}

export function searchProjectDocuments(
  projectId: number,
  query: string,
): Promise<ProjectDocumentSearchResult[]> {
  return request(
    `/api/research-projects/${projectId}/documents/search?q=${encodeURIComponent(query)}`,
  );
}

export function updateProjectDocumentSearchIndex(
  projectId: number,
  documentId: number,
  text: string,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/search-index`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
}

export function createProjectDocument(
  projectId: number,
  title = "Untitled",
): Promise<ProjectDocumentBootstrap> {
  return request(`/api/research-projects/${projectId}/documents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function createProjectDocumentFromTemplate(
  projectId: number,
  templateDocumentId: number,
): Promise<ProjectDocumentVersionRestore> {
  return request(
    `/api/research-projects/${projectId}` +
      `/documents/from-template/${templateDocumentId}`,
    { method: "POST" },
  );
}

export function updateProjectDocumentTemplate(
  projectId: number,
  documentId: number,
  snapshot?: Uint8Array,
): Promise<ProjectDocumentBootstrap["document"]> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/template`,
    snapshot
      ? {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: new Blob([new Uint8Array(snapshot)], {
            type: "application/octet-stream",
          }),
        }
      : { method: "DELETE" },
  );
}

export function updateProjectDocumentMode(
  projectId: number,
  documentId: number,
  mode: ProjectDocumentMode,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/mode`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    },
  );
}

export function updateProjectDocumentMetadata(
  projectId: number,
  documentId: number,
  metadata: {
    title: string;
    icon: ProjectDocumentIcon;
    isFavorite: boolean;
    pageWidth: ProjectDocumentPageWidth;
    properties: ProjectDocumentProperty[];
  },
): Promise<ProjectDocumentBootstrap["document"]> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/metadata`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(metadata),
    },
  );
}

export function createProjectDocumentFolder(
  projectId: number,
  input: { name: string; parentFolderId: number | null },
): Promise<ProjectDocumentCollection> {
  return request(`/api/research-projects/${projectId}/document-folders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateProjectDocumentFolder(
  projectId: number,
  folderId: number,
  input: { name: string; isFavorite: boolean },
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document-folders/${folderId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function deleteProjectDocumentFolder(
  projectId: number,
  folderId: number,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document-folders/${folderId}`,
    { method: "DELETE" },
  );
}

export function setProjectDocumentFolderDocuments(
  projectId: number,
  folderId: number,
  documentIds: readonly number[],
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document-folders/${folderId}/documents`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds }),
    },
  );
}

export function createProjectDocumentTag(
  projectId: number,
  input: { name: string; color?: ProjectDocumentTagColor },
): Promise<ProjectDocumentCollection> {
  return request(`/api/research-projects/${projectId}/document-tags`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateProjectDocumentTag(
  projectId: number,
  tagId: number,
  input: { name: string; color: ProjectDocumentTagColor },
): Promise<ProjectDocumentCollection> {
  return request(`/api/research-projects/${projectId}/document-tags/${tagId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteProjectDocumentTag(
  projectId: number,
  tagId: number,
): Promise<void> {
  return request(`/api/research-projects/${projectId}/document-tags/${tagId}`, {
    method: "DELETE",
  });
}

export function setProjectDocumentTags(
  projectId: number,
  documentId: number,
  tagIds: readonly number[],
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/tags`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds }),
    },
  );
}

export function setProjectDocumentLinks(
  projectId: number,
  documentId: number,
  documentIds: readonly number[],
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/links`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds }),
    },
  );
}

export function listProjectDocumentComments(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentComment[]> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/comments`,
  );
}

export function createProjectDocumentComment(
  projectId: number,
  documentId: number,
  body: string,
  anchor?: {
    blockId: string;
    quote: string | null;
  },
): Promise<ProjectDocumentComment> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, ...anchor }),
    },
  );
}

export function resolveProjectDocumentComment(
  projectId: number,
  documentId: number,
  commentId: number,
  resolved: boolean,
): Promise<ProjectDocumentComment> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved }),
    },
  );
}

export function listProjectDocumentVersions(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentVersion[]> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/versions`,
  );
}

export function createProjectDocumentVersion(
  projectId: number,
  documentId: number,
  label: string,
  snapshot: Uint8Array,
): Promise<ProjectDocumentVersion> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/versions` +
      `?label=${encodeURIComponent(label)}`,
    {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Blob([new Uint8Array(snapshot)], {
        type: "application/octet-stream",
      }),
    },
  );
}

export function restoreProjectDocumentVersion(
  projectId: number,
  documentId: number,
  versionId: number,
): Promise<ProjectDocumentVersionRestore> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}` +
      `/versions/${versionId}/restore`,
    { method: "POST" },
  );
}

export function listProjectDocumentShares(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentShare[]> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/shares`,
  );
}

export function createProjectDocumentShare(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentShare> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/shares`,
    { method: "POST" },
  );
}

export function revokeProjectDocumentShare(
  projectId: number,
  documentId: number,
  shareId: number,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/shares/${shareId}`,
    { method: "DELETE" },
  );
}

export function addProjectDocumentCollaborator(
  projectId: number,
  email: string,
  role: ProjectDocumentCollaboratorRole,
): Promise<ProjectDocumentCollaborator> {
  return request(`/api/research-projects/${projectId}/document-collaborators`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

export function removeProjectDocumentCollaborator(
  projectId: number,
  userId: number,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document-collaborators/${userId}`,
    { method: "DELETE" },
  );
}

export function getPublicProjectDocumentShare(
  token: string,
): Promise<PublicProjectDocumentShare> {
  return request(`/api/project-document-shares/${encodeURIComponent(token)}`);
}

export function createProjectDocumentCollection(
  projectId: number,
  input: { name: string },
): Promise<ProjectDocumentCollection> {
  return request(`/api/research-projects/${projectId}/document-collections`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateProjectDocumentCollection(
  projectId: number,
  collectionId: number,
  input: {
    name: string;
    isFavorite: boolean;
    mode: ProjectDocumentCollectionMode;
    rules: readonly ProjectDocumentCollectionRule[];
  },
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document-collections/${collectionId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function deleteProjectDocumentCollection(
  projectId: number,
  collectionId: number,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document-collections/${collectionId}`,
    { method: "DELETE" },
  );
}

export function setProjectDocumentCollectionDocuments(
  projectId: number,
  collectionId: number,
  documentIds: readonly number[],
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document-collections/${collectionId}/documents`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds }),
    },
  );
}

export function createProjectDocumentJournal(
  projectId: number,
  journalDate: string,
): Promise<ProjectDocumentBootstrap> {
  return request(
    `/api/research-projects/${projectId}/journals/${encodeURIComponent(journalDate)}`,
    { method: "POST" },
  );
}

export function trashProjectDocument(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/trash`,
    { method: "PATCH" },
  );
}

export function restoreProjectDocument(
  projectId: number,
  documentId: number,
): Promise<ProjectDocumentCollection> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/restore`,
    { method: "PATCH" },
  );
}

export function permanentlyDeleteProjectDocument(
  projectId: number,
  documentId: number,
): Promise<void> {
  return request(
    `/api/research-projects/${projectId}/document/${documentId}/permanent`,
    { method: "DELETE" },
  );
}
