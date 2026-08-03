import type {
  AddResearchItemInput,
  AttachResearchFlowInput,
  CreateResearchProjectInput,
  ProjectPatch,
  ResearchProjectCanvas,
  ResearchProjectMemberRole,
  ResearchProjectMembersView,
  ResearchProjectSummary,
  ResearchProjectWorkspace,
  ResearchSynthesisView,
  UpdateResearchItemInput,
} from '../researchProject.ts';
import type { ResearchSuggestion } from '../researchSuggestions.ts';

export class ResearchProjectApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly project?: ResearchProjectWorkspace;

  constructor(message: string, status: number, code?: string, project?: ResearchProjectWorkspace) {
    super(message);
    this.status = status;
    this.code = code;
    this.project = project;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      project?: ResearchProjectWorkspace;
    };
    throw new ResearchProjectApiError(
      body.error ?? `${url} returned ${response.status}`,
      response.status,
      body.code,
      body.project,
    );
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const jsonHeaders = { 'content-type': 'application/json' };
const projectPath = (projectId: string) => `/api/research-projects/${projectId}`;

export const listResearchProjects = (): Promise<ResearchProjectSummary[]> =>
  request('/api/research-projects');

export const createResearchProject = (input: CreateResearchProjectInput): Promise<ResearchProjectWorkspace> =>
  request('/api/research-projects', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(input),
  });

export const getResearchProject = (projectId: string): Promise<ResearchProjectWorkspace> =>
  request(projectPath(projectId));

export const listResearchProjectMembers = (projectId: string): Promise<ResearchProjectMembersView> =>
  request(`${projectPath(projectId)}/members`);

export const addResearchProjectMember = (
  projectId: string,
  email: string,
  role: ResearchProjectMemberRole,
): Promise<ResearchProjectMembersView> => request(`${projectPath(projectId)}/members`, {
  method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email, role }),
});

export const removeResearchProjectMember = (projectId: string, userId: number): Promise<void> =>
  request(`${projectPath(projectId)}/members/${userId}`, { method: 'DELETE' });

export const getResearchProjectCanvas = (
  projectId: string,
  signal?: AbortSignal,
): Promise<ResearchProjectCanvas> => request(`${projectPath(projectId)}/canvas`, { signal });

export const saveResearchProjectCanvas = (
  projectId: string,
  snapshot: Record<string, unknown>,
): Promise<ResearchProjectCanvas> => request(`${projectPath(projectId)}/canvas`, {
  method: 'PUT',
  headers: { 'content-type': 'application/vnd.astryx.excalidraw+json' },
  body: JSON.stringify({ snapshot }),
});

export const updateResearchProject = (
  projectId: string,
  expectedRevision: number,
  patch: ProjectPatch,
): Promise<ResearchProjectWorkspace> => request(projectPath(projectId), {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, ...patch }),
});

export const duplicateResearchProject = (projectId: string): Promise<ResearchProjectWorkspace> =>
  request(`${projectPath(projectId)}/duplicate`, { method: 'POST' });

export const deleteResearchProject = (projectId: string): Promise<void> =>
  request(projectPath(projectId), { method: 'DELETE' });

export const createResearchLane = (
  projectId: string,
  expectedRevision: number,
  title: string,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/lanes`, {
  method: 'POST', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, title }),
});

export const updateResearchLane = (
  projectId: string,
  laneId: number,
  expectedRevision: number,
  patch: { title?: string; conclusion?: string },
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/lanes/${laneId}`, {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, ...patch }),
});

export const deleteResearchLane = (
  projectId: string,
  laneId: number,
  expectedRevision: number,
): Promise<ResearchProjectWorkspace> => request(
  `${projectPath(projectId)}/lanes/${laneId}?revision=${expectedRevision}`,
  { method: 'DELETE' },
);

export const addResearchItem = (
  input: AddResearchItemInput,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(input.projectId)}/items`, {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({
    laneId: input.laneId,
    expectedRevision: input.expectedRevision,
    sourceKind: input.sourceKind,
    snapshot: input.snapshot,
    catalog: input.catalog,
  }),
});

export const attachResearchFlow = (
  input: AttachResearchFlowInput,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(input.projectId)}/flows`, {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({
    laneId: input.laneId,
    expectedRevision: input.expectedRevision,
    catalog: input.catalog,
  }),
});

export const updateResearchItem = (
  input: UpdateResearchItemInput,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(input.projectId)}/items/${input.itemId}`, {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input),
});

export const moveResearchItem = (
  projectId: string,
  itemId: number,
  expectedRevision: number,
  targetLaneId: number,
  targetPosition: number,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/items/${itemId}/move`, {
  method: 'POST', headers: jsonHeaders,
  body: JSON.stringify({ expectedRevision, targetLaneId, targetPosition }),
});

export const removeResearchItem = (
  projectId: string,
  itemId: number,
  expectedRevision: number,
): Promise<ResearchProjectWorkspace> => request(
  `${projectPath(projectId)}/items/${itemId}?revision=${expectedRevision}`,
  { method: 'DELETE' },
);

export const listResearchSuggestions = (projectId: string, query = ''): Promise<ResearchSuggestion[]> =>
  request(`${projectPath(projectId)}/suggestions${query ? `?q=${encodeURIComponent(query)}` : ''}`);

export function uploadResearchScreenshot(
  projectId: string,
  laneId: number,
  expectedRevision: number,
  file: File,
): Promise<ResearchProjectWorkspace> {
  return request(`${projectPath(projectId)}/uploads?laneId=${laneId}&revision=${expectedRevision}`, {
    method: 'POST',
    headers: { 'content-type': file.type, 'x-upload-filename': file.name },
    body: file,
  });
}

export const synthesizeResearch = (projectId: string): Promise<ResearchSynthesisView> =>
  request(`${projectPath(projectId)}/synthesize`, { method: 'POST' });

export async function downloadResearchMarkdown(projectId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${projectPath(projectId)}/export.md`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
    throw new ResearchProjectApiError(body.error ?? `Export returned ${response.status}`, response.status, body.code);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'DESIGN.md';
  return { blob: await response.blob(), filename };
}
