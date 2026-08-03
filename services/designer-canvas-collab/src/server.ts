import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { normalizeResearchProjectId } from "../../../src/researchProject.ts";
import {
  DESIGNER_CANVAS_COLLAB_MAX_BYTES,
  DESIGNER_CANVAS_COLLAB_PATH,
  parseDesignerCanvasClientMessage,
  type DesignerCanvasIdentity,
  type DesignerCanvasServerMessage,
} from "./protocol.ts";

interface RoomClient {
  id: string;
  identity: DesignerCanvasIdentity;
  projectId: string;
  roomId: string;
  sequence: number;
  socket: WebSocket;
}

export interface DesignerCanvasCollaborationDependencies {
  authenticate(request: IncomingMessage): Promise<DesignerCanvasIdentity | undefined>;
  canAccessProject(
    identity: DesignerCanvasIdentity,
    projectId: string,
  ): Promise<boolean>;
  allowedOrigins?: ReadonlySet<string>;
  maxMessageBytes?: number;
  maxRoomConnections?: number;
}

export interface DesignerCanvasCollaborationService {
  server: Server;
  close(): Promise<void>;
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\n`
      + "Connection: close\r\n"
      + "Content-Type: text/plain; charset=utf-8\r\n"
      + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`
      + body,
  );
}

function send(socket: WebSocket, message: DesignerCanvasServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function createDesignerCanvasCollaborationService(
  dependencies: DesignerCanvasCollaborationDependencies,
): DesignerCanvasCollaborationService {
  const rooms = new Map<string, Set<RoomClient>>();
  const clients = new Set<RoomClient>();
  const maxRoomConnections = dependencies.maxRoomConnections ?? 32;
  const webSockets = new WebSocketServer({
    noServer: true,
    maxPayload: dependencies.maxMessageBytes ?? DESIGNER_CANVAS_COLLAB_MAX_BYTES,
  });
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", rooms: rooms.size, clients: clients.size }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });

  const collaboratorIds = (roomId: string): string[] => [
    ...(rooms.get(roomId) ?? []),
  ].map((client) => client.id);

  const broadcast = (
    roomId: string,
    message: DesignerCanvasServerMessage,
    sender?: RoomClient,
    volatile = false,
  ) => {
    for (const client of rooms.get(roomId) ?? []) {
      if (client === sender || client.socket.readyState !== WebSocket.OPEN) continue;
      if (volatile && client.socket.bufferedAmount > 64 * 1024) continue;
      send(client.socket, message);
    }
  };

  const broadcastPresence = (roomId: string) => broadcast(roomId, {
    type: "presence",
    collaboratorIds: collaboratorIds(roomId),
  });

  const removeClient = (client: RoomClient) => {
    if (!clients.delete(client)) return;
    const room = rooms.get(client.roomId);
    room?.delete(client);
    if (!room?.size) rooms.delete(client.roomId);
    else broadcastPresence(client.roomId);
  };

  const bindClient = (
    socket: WebSocket,
    identity: DesignerCanvasIdentity,
    projectId: string,
    roomId: string,
  ) => {
    const client: RoomClient = {
      id: randomUUID(),
      identity,
      projectId,
      roomId,
      sequence: 0,
      socket,
    };
    const room = rooms.get(roomId) ?? new Set<RoomClient>();
    room.add(client);
    rooms.set(roomId, room);
    clients.add(client);

    send(socket, {
      type: "ready",
      projectId,
      clientId: client.id,
      collaboratorIds: collaboratorIds(roomId),
    });
    broadcastPresence(roomId);

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "Text messages required");
        return;
      }
      const message = parseDesignerCanvasClientMessage(data.toString());
      if (!message) {
        socket.close(1008, "Invalid collaboration message");
        return;
      }
      if (message.type === "scene") {
        if (message.sequence <= client.sequence) return;
        client.sequence = message.sequence;
        broadcast(roomId, {
          type: "scene",
          clientId: client.id,
          sequence: message.sequence,
          snapshot: message.snapshot,
        }, client);
        return;
      }
      broadcast(roomId, {
        type: "cursor",
        clientId: client.id,
        pointer: message.pointer,
        button: message.button,
        selectedElementIds: message.selectedElementIds,
      }, client, true);
    });
    socket.once("close", () => removeClient(client));
    socket.once("error", () => removeClient(client));
  };

  server.on("upgrade", (request, socket, head) => {
    void (async () => {
      const base = `http://${request.headers.host ?? "localhost"}`;
      const url = new URL(request.url ?? "/", base);
      if (url.pathname !== DESIGNER_CANVAS_COLLAB_PATH) {
        rejectUpgrade(socket, 404, "Not Found");
        return;
      }
      const projectId = normalizeResearchProjectId(url.searchParams.get("projectId"));
      if (!projectId) {
        rejectUpgrade(socket, 400, "Invalid project id");
        return;
      }
      const canvasId = url.searchParams.get("canvasId");
      if (canvasId && !/^[0-9a-f-]{36}$/i.test(canvasId)) {
        rejectUpgrade(socket, 400, "Invalid canvas id");
        return;
      }
      const roomId = canvasId ? `${projectId}:${canvasId}` : projectId;
      const origin = request.headers.origin;
      if (dependencies.allowedOrigins?.size
        && (!origin || !dependencies.allowedOrigins.has(origin))) {
        rejectUpgrade(socket, 403, "Origin not allowed");
        return;
      }
      const identity = await dependencies.authenticate(request);
      if (!identity) {
        rejectUpgrade(socket, 401, "Authentication required");
        return;
      }
      if (!(await dependencies.canAccessProject(identity, projectId))) {
        rejectUpgrade(socket, 403, "Project access denied");
        return;
      }
      if ((rooms.get(roomId)?.size ?? 0) >= maxRoomConnections) {
        rejectUpgrade(socket, 429, "Room capacity reached");
        return;
      }
      webSockets.handleUpgrade(request, socket, head, (webSocket) => {
        bindClient(webSocket, identity, projectId, roomId);
      });
    })().catch(() => rejectUpgrade(socket, 500, "Collaboration unavailable"));
  });

  return {
    server,
    async close() {
      for (const client of clients) client.socket.terminate();
      await new Promise<void>((resolve) => webSockets.close(() => resolve()));
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}
