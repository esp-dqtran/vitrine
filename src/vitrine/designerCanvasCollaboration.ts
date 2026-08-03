import {
  normalizeDesignerCanvasSnapshot,
  type DesignerCanvasSnapshot,
} from "../designerCanvas.ts";

export type DesignerCanvasCollaborationStatus = "connecting" | "live" | "offline";

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
  createSocket?(url: string): CollaborationSocket;
  location?: Pick<Location, "host" | "protocol">;
  reconnect?: boolean;
}

const record = (value: unknown): Record<string, unknown> | undefined => value
  && typeof value === "object"
  && !Array.isArray(value)
  ? value as Record<string, unknown>
  : undefined;

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
    ?? ((url: string) => new WebSocket(url) as unknown as CollaborationSocket);
  const location = options.location
    ?? (typeof window === "undefined" ? undefined : window.location);
  let socket: CollaborationSocket | undefined;
  let disposed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingScene: DesignerCanvasSnapshot | undefined;
  let sequence = 0;

  const report = (status: DesignerCanvasCollaborationStatus) => options.onStatus?.(status);

  const sendPendingScene = () => {
    publishTimer = undefined;
    if (!pendingScene || socket?.readyState !== 1) return;
    const snapshot = pendingScene;
    pendingScene = undefined;
    socket.send(JSON.stringify({ type: "scene", sequence: ++sequence, snapshot }));
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
      if (message?.type !== "scene") return;
      const snapshot = normalizeDesignerCanvasSnapshot(message.snapshot);
      if (snapshot) options.onScene(snapshot);
    };
    socket.onerror = () => report("offline");
    socket.onclose = () => {
      if (disposed) return;
      report("offline");
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
      publishTimer = setTimeout(sendPendingScene, 50);
    },
    publishCursor(input) {
      if (socket?.readyState !== 1) return;
      socket.send(JSON.stringify({ type: "cursor", ...input }));
    },
    close() {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (publishTimer) clearTimeout(publishTimer);
      reconnectTimer = undefined;
      publishTimer = undefined;
      socket?.close(1000, "Canvas closed");
    },
  };
}
