import {
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasSnapshot,
} from "../designerCanvas.ts";
import { getAuthToken } from './apiFetch.ts';

export type DesignerCanvasCollaborationStatus = "connecting" | "live" | "offline";

const scenePublishDebounceMs = 120;
const cursorPublishIntervalMs = 33;

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
  const files = Object.fromEntries(Object.entries(snapshot.files).filter(([, value]) => {
    const file = record(value);
    return typeof file?.dataURL !== "string" || !file.dataURL.startsWith("data:");
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
  let cursorTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingCursor: {
    pointer: { x: number; y: number } | null;
    button: "up" | "down";
    selectedElementIds?: readonly string[];
  } | undefined;
  let lastCursorPublishedAt = 0;
  let sequence = 0;
  let clientId: string | undefined;

  const report = (status: DesignerCanvasCollaborationStatus) => options.onStatus?.(status);

  const sendPendingScene = () => {
    publishTimer = undefined;
    if (!pendingScene || socket?.readyState !== 1) return;
    const snapshot = pendingScene;
    pendingScene = undefined;
    socket.send(JSON.stringify({ type: "scene", sequence: ++sequence, snapshot }));
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
        if (snapshot) options.onScene(snapshot);
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
      publishTimer = setTimeout(sendPendingScene, scenePublishDebounceMs);
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
