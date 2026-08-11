import {
  normalizeDesignerCanvasComments,
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasCommentThread,
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

/**
 * The realtime path carries only elements and assets that changed since the
 * sender's preceding update. A full `scene` remains available to establish a
 * room baseline, but must never be the steady-state path.
 */
export interface DesignerCanvasScenePatch {
  elements: readonly Record<string, unknown>[];
  files: Record<string, unknown>;
  comments?: readonly DesignerCanvasCommentThread[];
}

export type DesignerCanvasClientMessage =
  | {
    type: "scene";
    sequence: number;
    snapshot: DesignerCanvasSnapshot;
  }
  | {
    type: "patch";
    sequence: number;
    patch: DesignerCanvasScenePatch;
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
    revision: number;
    collaboratorIds: readonly string[];
    collaborators: readonly DesignerCanvasCollaborator[];
    snapshot?: DesignerCanvasSnapshot;
  }
  | {
    type: "presence";
    collaboratorIds: readonly string[];
    collaborators: readonly DesignerCanvasCollaborator[];
  }
  | {
    type: "scene";
    clientId: string;
    revision: number;
    sequence: number;
    snapshot: DesignerCanvasSnapshot;
  }
  | {
    type: "patch";
    clientId: string;
    revision: number;
    sequence: number;
    patch: DesignerCanvasScenePatch;
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

function normalizeScenePatch(value: unknown): DesignerCanvasScenePatch | undefined {
  const patch = record(value);
  if (!patch || !Array.isArray(patch.elements) || patch.elements.length > 5_000) {
    return undefined;
  }
  const elements = patch.elements.flatMap((candidate) => {
    const element = record(candidate);
    return element && typeof element.id === "string" && element.id.length <= 120
      ? [element]
      : [];
  });
  if (elements.length !== patch.elements.length) return undefined;
  const files = patch.files === undefined ? {} : record(patch.files);
  if (!files) return undefined;
  const hasComments = Object.prototype.hasOwnProperty.call(patch, "comments");
  return {
    elements,
    files,
    ...(hasComments ? { comments: normalizeDesignerCanvasComments(patch.comments) } : {}),
  };
}

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

  if (message.type === "patch") {
    const patch = normalizeScenePatch(message.patch);
    const sequence = message.sequence;
    return patch
      && typeof sequence === "number"
      && Number.isSafeInteger(sequence)
      && sequence > 0
      ? { type: "patch", sequence, patch }
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
