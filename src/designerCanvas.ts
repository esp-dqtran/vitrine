import type { ObjectMetadata } from "./objectStore.ts";
import type { ResearchProjectId } from "./researchProject.ts";

export interface DesignerCanvasDocument {
  snapshot: Record<string, unknown> | null;
  revision: number;
  updatedAt?: string;
}

export interface DesignerCanvasFile extends DesignerCanvasDocument {
  id: string;
  projectId: ResearchProjectId;
  title: string;
  createdAt: string;
}

export interface DesignerCanvasFileSummary {
  id: string;
  projectId: ResearchProjectId;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignerCanvasCommentMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface DesignerCanvasCommentThread {
  id: string;
  x: number;
  y: number;
  resolved: boolean;
  createdAt: string;
  messages: readonly DesignerCanvasCommentMessage[];
}

export type DesignerCanvasSnapshot = Record<string, unknown> & {
  type: "excalidraw";
  version: number;
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  comments: readonly DesignerCanvasCommentThread[];
};

const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object"
  && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;

export function normalizeDesignerCanvasComments(
  value: unknown,
): readonly DesignerCanvasCommentThread[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const thread = record(candidate);
    if (
      !thread
      || typeof thread.id !== "string"
      || typeof thread.x !== "number"
      || typeof thread.y !== "number"
      || typeof thread.resolved !== "boolean"
      || typeof thread.createdAt !== "string"
      || !Array.isArray(thread.messages)
    ) return [];
    const messages = thread.messages.flatMap((candidateMessage) => {
      const message = record(candidateMessage);
      return message
        && typeof message.id === "string"
        && typeof message.authorId === "string"
        && typeof message.authorName === "string"
        && typeof message.body === "string"
        && typeof message.createdAt === "string"
        ? [message as unknown as DesignerCanvasCommentMessage]
        : [];
    });
    if (messages.length === 0) return [];
    return [{
      id: thread.id,
      x: thread.x,
      y: thread.y,
      resolved: thread.resolved,
      createdAt: thread.createdAt,
      messages,
    }];
  });
}

export function normalizeDesignerCanvasSnapshot(
  value: unknown,
): DesignerCanvasSnapshot | undefined {
  const snapshot = record(value);
  const appState = record(snapshot?.appState);
  const files = snapshot?.files === undefined ? {} : record(snapshot.files);
  return snapshot
    && snapshot.type === "excalidraw"
    && typeof snapshot.version === "number"
    && Array.isArray(snapshot.elements)
    && appState
    && files
    ? {
        ...snapshot,
        appState,
        files,
        comments: normalizeDesignerCanvasComments(snapshot.comments),
      } as DesignerCanvasSnapshot
    : undefined;
}

export interface DesignerCanvasStore {
  listCanvasFiles?(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<DesignerCanvasFileSummary[] | undefined>;
  createCanvasFile?(
    userId: number,
    projectId: ResearchProjectId,
    title: string,
    snapshot: Record<string, unknown>,
  ): Promise<DesignerCanvasFile | undefined>;
  getCanvasFile?(
    userId: number,
    projectId: ResearchProjectId,
    canvasId: string,
  ): Promise<DesignerCanvasFile | undefined>;
  saveCanvasFile?(
    userId: number,
    projectId: ResearchProjectId,
    canvasId: string,
    snapshot: Record<string, unknown>,
  ): Promise<DesignerCanvasFile | undefined>;
  getCanvas(
    userId: number,
    projectId: ResearchProjectId,
  ): Promise<DesignerCanvasDocument | undefined>;
  saveCanvas(
    userId: number,
    projectId: ResearchProjectId,
    snapshot: Record<string, unknown>,
  ): Promise<DesignerCanvasDocument | undefined>;
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
}
