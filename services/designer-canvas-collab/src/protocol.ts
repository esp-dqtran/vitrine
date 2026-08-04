import {
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasSnapshot,
} from "../../../src/designerCanvas.ts";

export const DESIGNER_CANVAS_COLLAB_PATH = "/api/designer-canvas-collaboration";
export const DESIGNER_CANVAS_COLLAB_MAX_BYTES = 5 * 1024 * 1024;

export interface DesignerCanvasIdentity {
  userId: number;
  name: string;
}

export interface DesignerCanvasCollaborator {
  clientId: string;
  userId: number;
  name: string;
}

export type DesignerCanvasClientMessage =
  | {
    type: "scene";
    sequence: number;
    snapshot: DesignerCanvasSnapshot;
  }
  | {
    type: "cursor";
    pointer: { x: number; y: number } | null;
    button: "up" | "down";
    selectedElementIds?: readonly string[];
  };

export type DesignerCanvasServerMessage =
  | {
    type: "ready";
    projectId: string;
    clientId: string;
    collaboratorIds: readonly string[];
    collaborators: readonly DesignerCanvasCollaborator[];
  }
  | {
    type: "presence";
    collaboratorIds: readonly string[];
    collaborators: readonly DesignerCanvasCollaborator[];
  }
  | {
    type: "scene";
    clientId: string;
    sequence: number;
    snapshot: DesignerCanvasSnapshot;
  }
  | {
    type: "cursor";
    clientId: string;
    pointer: { x: number; y: number } | null;
    button: "up" | "down";
    selectedElementIds?: readonly string[];
  };

const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object"
  && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;

const finiteCoordinate = (value: unknown): number | undefined => typeof value === "number"
  && Number.isFinite(value)
  && Math.abs(value) <= 10_000_000
  ? value
  : undefined;

export function parseDesignerCanvasClientMessage(
  raw: string,
): DesignerCanvasClientMessage | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const message = record(parsed);
  if (!message) return undefined;

  if (message.type === "scene") {
    const snapshot = normalizeDesignerCanvasSnapshot(message.snapshot);
    const sequence = message.sequence;
    return snapshot
      && typeof sequence === "number"
      && Number.isSafeInteger(sequence)
      && sequence > 0
      ? { type: "scene", sequence, snapshot }
      : undefined;
  }

  if (message.type !== "cursor") return undefined;
  const pointerRecord = message.pointer === null ? null : record(message.pointer);
  const x = pointerRecord ? finiteCoordinate(pointerRecord.x) : undefined;
  const y = pointerRecord ? finiteCoordinate(pointerRecord.y) : undefined;
  if (message.pointer !== null && (x === undefined || y === undefined)) return undefined;
  if (message.button !== "up" && message.button !== "down") return undefined;
  const selectedElementIds = message.selectedElementIds === undefined
    ? undefined
    : Array.isArray(message.selectedElementIds)
      && message.selectedElementIds.length <= 100
      && message.selectedElementIds.every((id) => typeof id === "string" && id.length <= 120)
      ? message.selectedElementIds as string[]
      : undefined;
  if (message.selectedElementIds !== undefined && !selectedElementIds) return undefined;
  return {
    type: "cursor",
    pointer: message.pointer === null ? null : { x: x!, y: y! },
    button: message.button,
    selectedElementIds,
  };
}
