import { apiFetch } from './apiFetch.ts';
import type {
  DesignerCanvasDocument,
  DesignerCanvasFile,
  DesignerCanvasFileSummary,
} from "../designerCanvas.ts";

export class DesignerCanvasApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
    };
    throw new DesignerCanvasApiError(
      body.error ?? `${url} returned ${response.status}`,
      response.status,
      body.code,
    );
  }
  return response.json() as Promise<T>;
}

const canvasPath = (projectId: string) => `/api/designer-canvases/${projectId}`;
const canvasFilesPath = (projectId: string) =>
  `/api/research-projects/${encodeURIComponent(projectId)}/canvases`;
const canvasFilePath = (projectId: string, canvasId: string) =>
  `${canvasFilesPath(projectId)}/${encodeURIComponent(canvasId)}`;

export const listDesignerCanvases = (
  projectId: string,
  signal?: AbortSignal,
): Promise<DesignerCanvasFileSummary[]> => request(canvasFilesPath(projectId), { signal });

export const createDesignerCanvas = (
  projectId: string,
  title: string,
  snapshot: object,
): Promise<DesignerCanvasFile> => request(canvasFilesPath(projectId), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title, snapshot }),
});

export const getDesignerCanvasFile = (
  projectId: string,
  canvasId: string,
  signal?: AbortSignal,
): Promise<DesignerCanvasFile> => request(canvasFilePath(projectId, canvasId), { signal });

export const saveDesignerCanvasFile = (
  projectId: string,
  canvasId: string,
  snapshot: object,
): Promise<DesignerCanvasFile> => request(canvasFilePath(projectId, canvasId), {
  method: "PUT",
  headers: { "content-type": "application/vnd.astryx.excalidraw+json" },
  body: JSON.stringify({ snapshot }),
});

export const getDesignerCanvas = (
  projectId: string,
  signal?: AbortSignal,
): Promise<DesignerCanvasDocument> => request(canvasPath(projectId), { signal });

export const saveDesignerCanvas = (
  projectId: string,
  snapshot: object,
): Promise<DesignerCanvasDocument> => request(canvasPath(projectId), {
  method: "PUT",
  headers: { "content-type": "application/vnd.astryx.excalidraw+json" },
  body: JSON.stringify({ snapshot }),
});
