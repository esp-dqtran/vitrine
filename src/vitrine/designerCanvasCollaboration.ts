import {
  normalizeDesignerCanvasComments,
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasSnapshot,
} from "../designerCanvas.ts";
import { getAuthToken } from './apiFetch.ts';
import type { DesignerCanvasScenePatch } from "../services/designer-canvas-collab/src/protocol.ts";

export type DesignerCanvasCollaborationStatus = "connecting" | "live" | "offline";

const scenePublishIntervalMs = 33;
// Cursors are ephemeral and only move a few bytes, so keep them at the
// display cadence. Object changes remain commit-based and coalesced.
const cursorPublishIntervalMs = 1_000 / 60;
const maxBufferedRealtimeBytes = 64 * 1024;

export interface DesignerCanvasCollaborator {
  clientId: string;
  userId: number;
  name: string;
}

export interface DesignerCanvasRemoteCursor {
  clientId: string;
  pointer: { x: number; y: number } | null;
  button: "up" | "down";
  selectedElementIds?: readonly string[];
}

interface CollaborationSocket {
  readyState: number;
  bufferedAmount?: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface DesignerCanvasCollaborationSession {
  publishScene(snapshot: unknown): void;
  publishCursor(input: {
    pointer: { x: number; y: number } | null;
    button: "up" | "down";
    selectedElementIds?: readonly string[];
  }): void;
  close(): void;
}

export interface DesignerCanvasCollaborationOptions {
  projectId: string;
  canvasId?: string;
  onScene(snapshot: DesignerCanvasSnapshot): void;
  onPatch?(patch: DesignerCanvasScenePatch): void;
  onStatus?(status: DesignerCanvasCollaborationStatus): void;
  onPresence?(collaborators: readonly DesignerCanvasCollaborator[]): void;
  onCursor?(cursor: DesignerCanvasRemoteCursor): void;
  createSocket?(url: string): CollaborationSocket;
  location?: Pick<Location, "host" | "protocol">;
  reconnect?: boolean;
}

const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object"
  && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;

const jsonEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const canvasElementEqual = (
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown>,
) => {
  if (left === right) return true;
  const leftVersion = left?.version;
  const rightVersion = right.version;
  return typeof leftVersion === "number" && typeof rightVersion === "number"
    ? leftVersion === rightVersion
    : jsonEqual(left, right);
};

/** Creates a compact, element-level update from two durable canvas snapshots. */
export function designerCanvasScenePatch(
  previous: DesignerCanvasSnapshot,
  next: DesignerCanvasSnapshot,
): DesignerCanvasScenePatch {
  const previousElements = new Map(
    previous.elements.flatMap((candidate) => {
      const element = record(candidate);
      return typeof element?.id === "string" ? [[element.id, element] as const] : [];
    }),
  );
  const nextElements = new Map(
    next.elements.flatMap((candidate) => {
      const element = record(candidate);
      return typeof element?.id === "string" ? [[element.id, element] as const] : [];
    }),
  );
  const elements = next.elements.flatMap((candidate) => {
    const element = record(candidate);
    return typeof element?.id === "string" && !canvasElementEqual(previousElements.get(element.id), element)
      ? [element]
      : [];
  });
  // `serializeAsJSON` may omit deleted elements. A patch must still carry a
  // tombstone or peers keep rendering the old object forever.
  for (const [id, element] of previousElements) {
    if (nextElements.has(id)) continue;
    const version = typeof element.version === "number" ? element.version + 1 : 1;
    elements.push({ ...element, isDeleted: true, version });
  }
  const files = Object.fromEntries(
    Object.entries(next.files).filter(([id, file]) => !jsonEqual(previous.files[id], file)),
  );
  return {
    elements,
    files,
    ...(!jsonEqual(previous.comments, next.comments)
      ? { comments: normalizeDesignerCanvasComments(next.comments) }
      : {}),
  };
}

export function applyDesignerCanvasScenePatch(
  snapshot: DesignerCanvasSnapshot,
  patch: DesignerCanvasScenePatch,
): DesignerCanvasSnapshot {
  const updates = new Map(patch.elements.map((element) => [element.id, element]));
  const seen = new Set<string>();
  const elements = snapshot.elements.map((candidate) => {
    const element = record(candidate);
    if (!element || typeof element.id !== "string") return candidate;
    seen.add(element.id);
    return updates.get(element.id) ?? candidate;
  });
  for (const element of patch.elements) {
    if (!seen.has(element.id)) elements.push(element);
  }
  return {
    ...snapshot,
    elements,
    files: { ...snapshot.files, ...patch.files },
    ...(patch.comments === undefined ? {} : { comments: patch.comments }),
  };
}

function normalizeScenePatch(value: unknown): DesignerCanvasScenePatch | undefined {
  const patch = record(value);
  if (!patch || !Array.isArray(patch.elements)) return undefined;
  const elements = patch.elements.flatMap((candidate) => {
    const element = record(candidate);
    return typeof element?.id === "string" ? [element] : [];
  });
  if (elements.length !== patch.elements.length) return undefined;
  const files = patch.files === undefined ? {} : record(patch.files);
  if (!files) return undefined;
  return {
    elements,
    files,
    ...(Object.prototype.hasOwnProperty.call(patch, "comments")
      ? { comments: normalizeDesignerCanvasComments(patch.comments) }
      : {}),
  };
}

const finiteCoordinate = (value: unknown): number | undefined => typeof value === "number"
  && Number.isFinite(value)
  && Math.abs(value) <= 10_000_000
  ? value
  : undefined;

function normalizeCollaborators(value: unknown): DesignerCanvasCollaborator[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const collaborator = record(entry);
    if (!collaborator
      || typeof collaborator.clientId !== "string"
      || !collaborator.clientId
      || typeof collaborator.userId !== "number"
      || !Number.isSafeInteger(collaborator.userId)
      || typeof collaborator.name !== "string"
      || !collaborator.name.trim()) return [];
    return [{
      clientId: collaborator.clientId,
      userId: collaborator.userId,
      name: collaborator.name.trim().slice(0, 160),
    }];
  });
}

function normalizeRemoteCursor(value: unknown): DesignerCanvasRemoteCursor | undefined {
  const message = record(value);
  if (!message || message.type !== "cursor" || typeof message.clientId !== "string") {
    return undefined;
  }
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
    clientId: message.clientId,
    pointer: message.pointer === null ? null : { x: x!, y: y! },
    button: message.button,
    selectedElementIds,
  };
}

export function designerCanvasCollaborationUrl(
  projectId: string,
  location: Pick<Location, "host" | "protocol"> = window.location,
  canvasId?: string,
): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const canvas = canvasId ? `&canvasId=${encodeURIComponent(canvasId)}` : "";
  return `${protocol}//${location.host}/api/designer-canvas-collaboration?projectId=${encodeURIComponent(projectId)}${canvas}`;
}

export function collaborationSafeSnapshot(value: unknown): DesignerCanvasSnapshot | undefined {
  const snapshot = normalizeDesignerCanvasSnapshot(value);
  if (!snapshot) return undefined;
  // Static canvas stamps are small UI assets, not user-uploaded media. Keep
  // their bytes in the realtime payload so an image stamp renders immediately
  // for every collaborator. All other embedded images remain out of band.
  const stampFileIds = new Set(
    snapshot.elements.flatMap((candidate) => {
      const element = record(candidate);
      const reference = record(element?.customData)?.astryxReference;
      const stamp = record(reference);
      return element?.type === "image"
        && typeof element.fileId === "string"
        && stamp?.kind === "stamp"
        ? [element.fileId]
        : [];
    }),
  );
  const files = Object.fromEntries(Object.entries(snapshot.files).filter(([id, value]) => {
    const file = record(value);
    return stampFileIds.has(id)
      || typeof file?.dataURL !== "string"
      || !file.dataURL.startsWith("data:");
  }));
  return { ...snapshot, files };
}

export function openDesignerCanvasCollaboration(
  options: DesignerCanvasCollaborationOptions,
): DesignerCanvasCollaborationSession {
  const socketFactory = options.createSocket
    ?? ((url: string) => {
      const token = getAuthToken();
      return new WebSocket(url, token ? ["vitrines-bearer", token] : undefined) as unknown as CollaborationSocket;
    });
  const location = options.location
    ?? (typeof window === "undefined" ? undefined : window.location);
  let socket: CollaborationSocket | undefined;
  let disposed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingScene: DesignerCanvasSnapshot | undefined;
  let lastPublishedScene: DesignerCanvasSnapshot | undefined;
  let cursorTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingCursor: {
    pointer: { x: number; y: number } | null;
    button: "up" | "down";
    selectedElementIds?: readonly string[];
  } | undefined;
  let lastCursorPublishedAt = 0;
  let sequence = 0;
  let clientId: string | undefined;
  let lastServerRevision = 0;

  const report = (status: DesignerCanvasCollaborationStatus) => options.onStatus?.(status);

  const sendPendingScene = () => {
    publishTimer = undefined;
    if (!pendingScene || socket?.readyState !== 1) return;
    if ((socket.bufferedAmount ?? 0) > maxBufferedRealtimeBytes) {
      publishTimer = setTimeout(sendPendingScene, scenePublishIntervalMs);
      return;
    }
    const snapshot = pendingScene;
    pendingScene = undefined;
    if (!lastPublishedScene) {
      socket.send(JSON.stringify({ type: "scene", sequence: ++sequence, snapshot }));
      lastPublishedScene = snapshot;
      return;
    }
    const patch = designerCanvasScenePatch(lastPublishedScene, snapshot);
    lastPublishedScene = snapshot;
    if (!patch.elements.length && !Object.keys(patch.files).length && patch.comments === undefined) {
      return;
    }
    socket.send(JSON.stringify({ type: "patch", sequence: ++sequence, patch }));
  };

  const sendPendingCursor = () => {
    cursorTimer = undefined;
    if (!pendingCursor || socket?.readyState !== 1) return;
    const cursor = pendingCursor;
    pendingCursor = undefined;
    lastCursorPublishedAt = Date.now();
    socket.send(JSON.stringify({ type: "cursor", ...cursor }));
  };

  const scheduleReconnect = () => {
    if (disposed || options.reconnect === false || reconnectTimer) return;
    const delay = Math.min(10_000, 500 * 2 ** reconnectAttempt++);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  const connect = () => {
    if (disposed || !location) return;
    report("connecting");
    try {
      socket = socketFactory(designerCanvasCollaborationUrl(
        options.projectId, location, options.canvasId,
      ));
    } catch {
      report("offline");
      scheduleReconnect();
      return;
    }
    socket.onopen = () => {
      reconnectAttempt = 0;
      report("live");
      sendPendingScene();
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const message = record(parsed);
      if (message?.type === "ready") {
        clientId = typeof message.clientId === "string" ? message.clientId : undefined;
        const snapshot = normalizeDesignerCanvasSnapshot(message.snapshot);
        const revision = message.revision;
        if (snapshot && typeof revision === "number" && Number.isSafeInteger(revision)) {
          lastServerRevision = revision;
          lastPublishedScene = snapshot;
          options.onScene(snapshot);
        }
        options.onPresence?.(
          normalizeCollaborators(message.collaborators)
            .filter((collaborator) => collaborator.clientId !== clientId),
        );
        return;
      }
      if (message?.type === "presence") {
        options.onPresence?.(
          normalizeCollaborators(message.collaborators)
            .filter((collaborator) => collaborator.clientId !== clientId),
        );
        return;
      }
      if (message?.type === "cursor") {
        const cursor = normalizeRemoteCursor(message);
        if (cursor && cursor.clientId !== clientId) options.onCursor?.(cursor);
        return;
      }
      if (message?.type === "scene") {
        const snapshot = normalizeDesignerCanvasSnapshot(message.snapshot);
        const revision = message.revision;
        if (typeof revision === "number") {
          if (!Number.isSafeInteger(revision) || revision <= lastServerRevision) return;
          lastServerRevision = revision;
        }
        // The gateway echoes reliable scene updates to their sender so every
        // client advances through the same revisions. The local editor already
        // owns this scene, though; applying its echo with updateScene() while a
        // freedraw pointer is down aborts that in-progress stroke.
        if (message.clientId === clientId) return;
        if (snapshot) {
          lastPublishedScene = snapshot;
          options.onScene(snapshot);
        }
        return;
      }
      if (message?.type === "patch") {
        const patch = normalizeScenePatch(message.patch);
        const revision = message.revision;
        if (!patch || typeof revision !== "number" || !Number.isSafeInteger(revision)
          || revision <= lastServerRevision) return;
        lastServerRevision = revision;
        // See the scene acknowledgement above. Keep the revision, but never
        // replace the sender's live Excalidraw scene during a pointer gesture.
        if (message.clientId === clientId) return;
        if (lastPublishedScene) {
          lastPublishedScene = applyDesignerCanvasScenePatch(lastPublishedScene, patch);
        }
        options.onPatch?.(patch);
      }
    };
    socket.onerror = () => {
      report("offline");
      options.onPresence?.([]);
    };
    socket.onclose = () => {
      if (disposed) return;
      report("offline");
      options.onPresence?.([]);
      scheduleReconnect();
    };
  };

  connect();

  return {
    publishScene(value) {
      const snapshot = collaborationSafeSnapshot(value);
      if (!snapshot) return;
      pendingScene = snapshot;
      if (publishTimer) return;
      publishTimer = setTimeout(sendPendingScene, scenePublishIntervalMs);
    },
    publishCursor(input) {
      if (socket?.readyState !== 1) return;
      pendingCursor = input;
      if (input.button === "up") {
        if (cursorTimer) clearTimeout(cursorTimer);
        sendPendingCursor();
        return;
      }
      if (cursorTimer) return;
      const delay = Math.max(
        0,
        cursorPublishIntervalMs - (Date.now() - lastCursorPublishedAt),
      );
      cursorTimer = setTimeout(sendPendingCursor, delay);
    },
    close() {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (publishTimer) clearTimeout(publishTimer);
      if (cursorTimer) clearTimeout(cursorTimer);
      reconnectTimer = undefined;
      publishTimer = undefined;
      cursorTimer = undefined;
      pendingCursor = undefined;
      options.onPresence?.([]);
      socket?.close(1000, "Canvas closed");
    },
  };
}
