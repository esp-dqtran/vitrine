import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { WebSocket } from "ws";
import { createDesignerCanvasCollaborationService } from "./server.ts";
import type { DesignerCanvasServerMessage } from "./protocol.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://app.test";

interface TestClient {
  socket: WebSocket;
  next(type: DesignerCanvasServerMessage["type"]): Promise<DesignerCanvasServerMessage>;
}

async function connect(url: string): Promise<TestClient> {
  const socket = new WebSocket(url, {
    headers: {
      cookie: "astryx_session=valid",
      origin: ORIGIN,
    },
  });
  const messages: DesignerCanvasServerMessage[] = [];
  const waiters: Array<(message: DesignerCanvasServerMessage) => void> = [];
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as DesignerCanvasServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  await once(socket, "open");
  return {
    socket,
    async next(type) {
      while (true) {
        const message = messages.shift()
          ?? await new Promise<DesignerCanvasServerMessage>((resolve) => waiters.push(resolve));
        if (message.type === type) return message;
      }
    },
  };
}

async function rejectedStatus(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
      socket.terminate();
    });
    socket.once("open", () => reject(new Error("Expected WebSocket upgrade rejection")));
    socket.once("error", () => undefined);
  });
}

test("authenticates project rooms and relays reliable and volatile updates", async (t) => {
  const service = createDesignerCanvasCollaborationService({
    allowedOrigins: new Set([ORIGIN]),
    async authenticate(request) {
      return request.headers.cookie === "astryx_session=valid"
        ? { userId: 7, name: "designer@vitrines.test" }
        : undefined;
    },
    async canAccessProject(identity, projectId) {
      assert.equal(identity.userId, 7);
      return projectId === PROJECT_ID;
    },
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  t.after(() => service.close());
  const address = service.server.address();
  if (!address || typeof address === "string") throw new Error("Missing collaboration port");
  const httpBase = `http://127.0.0.1:${address.port}`;
  const wsBase = `ws://127.0.0.1:${address.port}`;
  const roomUrl = `${wsBase}/api/designer-canvas-collaboration?projectId=${PROJECT_ID}`;

  const first = await connect(roomUrl);
  const firstReady = await first.next("ready");
  assert.equal(firstReady.type, "ready");
  assert.equal(firstReady.projectId, PROJECT_ID);
  const initialPresence = await first.next("presence");
  assert.equal(initialPresence.type, "presence");
  assert.equal(initialPresence.collaboratorIds.length, 1);
  assert.deepEqual(initialPresence.collaborators, [{
    clientId: firstReady.clientId,
    userId: 7,
    name: "designer@vitrines.test",
  }]);

  const second = await connect(roomUrl);
  const secondReady = await second.next("ready");
  assert.equal(secondReady.type, "ready");
  assert.equal(secondReady.collaboratorIds.length, 2);
  assert.equal(secondReady.collaborators.length, 2);
  const presence = await first.next("presence");
  assert.equal(presence.type, "presence");
  assert.equal(presence.collaboratorIds.length, 2);

  first.socket.send(JSON.stringify({
    type: "scene",
    sequence: 1,
    snapshot: {
      type: "excalidraw",
      version: 2,
      elements: [{ id: "shape-1", type: "rectangle" }],
      appState: {},
      files: {},
    },
  }));
  const scene = await second.next("scene");
  assert.equal(scene.type, "scene");
  assert.equal(scene.sequence, 1);
  assert.equal(scene.clientId, firstReady.clientId);

  second.socket.send(JSON.stringify({
    type: "cursor",
    pointer: { x: 40, y: 20 },
    button: "up",
  }));
  const cursor = await first.next("cursor");
  assert.deepEqual(cursor, {
    type: "cursor",
    clientId: secondReady.clientId,
    pointer: { x: 40, y: 20 },
    button: "up",
  });

  const health = await fetch(`${httpBase}/healthz`).then((response) => response.json());
  assert.deepEqual(health, { status: "ok", rooms: 1, clients: 2 });
});

test("rejects unauthenticated, unauthorized, cross-origin, and invalid project upgrades", async (t) => {
  const service = createDesignerCanvasCollaborationService({
    allowedOrigins: new Set([ORIGIN]),
    async authenticate(request) {
      return request.headers.cookie === "astryx_session=valid"
        ? { userId: 7, name: "designer@vitrines.test" }
        : undefined;
    },
    async canAccessProject(_identity, projectId) {
      return projectId === PROJECT_ID;
    },
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  t.after(() => service.close());
  const address = service.server.address();
  if (!address || typeof address === "string") throw new Error("Missing collaboration port");
  const base = `ws://127.0.0.1:${address.port}/api/designer-canvas-collaboration`;

  assert.equal(await rejectedStatus(`${base}?projectId=${PROJECT_ID}`, { origin: ORIGIN }), 401);
  assert.equal(await rejectedStatus(`${base}?projectId=${OTHER_PROJECT_ID}`, {
    origin: ORIGIN,
    cookie: "astryx_session=valid",
  }), 403);
  assert.equal(await rejectedStatus(`${base}?projectId=${PROJECT_ID}`, {
    origin: "http://attacker.test",
    cookie: "astryx_session=valid",
  }), 403);
  assert.equal(await rejectedStatus(`${base}?projectId=not-a-uuid`, {
    origin: ORIGIN,
    cookie: "astryx_session=valid",
  }), 400);
});

test("closes clients that send invalid collaboration messages", async (t) => {
  const service = createDesignerCanvasCollaborationService({
    authenticate: async () => ({ userId: 7, name: "designer@vitrines.test" }),
    canAccessProject: async () => true,
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  t.after(() => service.close());
  const address = service.server.address();
  if (!address || typeof address === "string") throw new Error("Missing collaboration port");
  const client = await connect(
    `ws://127.0.0.1:${address.port}/api/designer-canvas-collaboration?projectId=${PROJECT_ID}`,
  );
  await client.next("ready");
  client.socket.send(JSON.stringify({ type: "scene", sequence: 0, snapshot: {} }));
  const [code] = await once(client.socket, "close");
  assert.equal(code, 1008);
});
