import type {
  AddResearchItemInput,
  CreateResearchProjectInput,
  ProjectPatch,
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
const projectPath = (projectId: number) => `/api/research-projects/${projectId}`;

export const listResearchProjects = (): Promise<ResearchProjectSummary[]> =>
  request('/api/research-projects');

export const createResearchProject = (input: CreateResearchProjectInput): Promise<ResearchProjectWorkspace> =>
  request('/api/research-projects', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(input),
  });

export const getResearchProject = (projectId: number): Promise<ResearchProjectWorkspace> =>
  request(projectPath(projectId));

export const updateResearchProject = (
  projectId: number,
  expectedRevision: number,
  patch: ProjectPatch,
): Promise<ResearchProjectWorkspace> => request(projectPath(projectId), {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, ...patch }),
});

export const duplicateResearchProject = (projectId: number): Promise<ResearchProjectWorkspace> =>
  request(`${projectPath(projectId)}/duplicate`, { method: 'POST' });

export const deleteResearchProject = (projectId: number): Promise<void> =>
  request(projectPath(projectId), { method: 'DELETE' });

export const createResearchLane = (
  projectId: number,
  expectedRevision: number,
  title: string,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/lanes`, {
  method: 'POST', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, title }),
});

export const updateResearchLane = (
  projectId: number,
  laneId: number,
  expectedRevision: number,
  patch: { title?: string; conclusion?: string },
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/lanes/${laneId}`, {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ expectedRevision, ...patch }),
});

export const deleteResearchLane = (
  projectId: number,
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

export const updateResearchItem = (
  input: UpdateResearchItemInput,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(input.projectId)}/items/${input.itemId}`, {
  method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input),
});

export const moveResearchItem = (
  projectId: number,
  itemId: number,
  expectedRevision: number,
  targetLaneId: number,
  targetPosition: number,
): Promise<ResearchProjectWorkspace> => request(`${projectPath(projectId)}/items/${itemId}/move`, {
  method: 'POST', headers: jsonHeaders,
  body: JSON.stringify({ expectedRevision, targetLaneId, targetPosition }),
});

export const removeResearchItem = (
  projectId: number,
  itemId: number,
  expectedRevision: number,
): Promise<ResearchProjectWorkspace> => request(
  `${projectPath(projectId)}/items/${itemId}?revision=${expectedRevision}`,
  { method: 'DELETE' },
);

export const listResearchSuggestions = (projectId: number, query = ''): Promise<ResearchSuggestion[]> =>
  request(`${projectPath(projectId)}/suggestions${query ? `?q=${encodeURIComponent(query)}` : ''}`);

export function uploadResearchScreenshot(
  projectId: number,
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

export const synthesizeResearch = (projectId: number): Promise<ResearchSynthesisView> =>
  request(`${projectPath(projectId)}/synthesize`, { method: 'POST' });

export async function downloadResearchMarkdown(projectId: number): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${projectPath(projectId)}/export.md`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
    throw new ResearchProjectApiError(body.error ?? `Export returned ${response.status}`, response.status, body.code);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'DESIGN.md';
  return { blob: await response.blob(), filename };
}
