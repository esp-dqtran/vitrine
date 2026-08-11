import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collaborationSafeSnapshot,
  designerCanvasCollaborationUrl,
  openDesignerCanvasCollaboration,
} from "./designerCanvasCollaboration.ts";

class FakeSocket {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent);
  }
}

const snapshot = {
  type: "excalidraw",
  version: 2,
  elements: [{ id: "shape-1" }],
  appState: {},
  files: {
    embedded: { dataURL: "data:image/png;base64,abc" },
    stored: { dataURL: "/api/designer-canvases/project/assets/asset%3Aimage" },
  },
};

test("builds same-origin WebSocket URLs for local and secure deployments", () => {
  assert.equal(
    designerCanvasCollaborationUrl("project id", { protocol: "http:", host: "localhost:5174" }),
    "ws://localhost:5174/api/designer-canvas-collaboration?projectId=project%20id",
  );
  assert.equal(
    designerCanvasCollaborationUrl("project", { protocol: "https:", host: "astryx.design" }),
    "wss://astryx.design/api/designer-canvas-collaboration?projectId=project",
  );
});

test("keeps persisted asset URLs out of band and never broadcasts embedded image bytes", () => {
  assert.deepEqual(Object.keys(collaborationSafeSnapshot(snapshot)!.files), ["stored"]);
});

test("coalesces local scenes and applies remote scenes without owning persistence", async () => {
  const socket = new FakeSocket();
  const received: unknown[] = [];
  const statuses: string[] = [];
  const presence: unknown[] = [];
  const cursors: unknown[] = [];
  const session = openDesignerCanvasCollaboration({
    projectId: "11111111-1111-4111-8111-111111111111",
    location: { protocol: "http:", host: "localhost:5174" },
    reconnect: false,
    createSocket: () => socket,
    onScene: (scene) => received.push(scene),
    onStatus: (status) => statuses.push(status),
    onPresence: (collaborators) => presence.push(collaborators),
    onCursor: (cursor) => cursors.push(cursor),
  });
  socket.open();
  socket.receive({
    type: "ready",
    clientId: "local-client",
    collaborators: [
      { clientId: "local-client", userId: 7, name: "local@vitrines.test" },
      { clientId: "remote-client", userId: 8, name: "remote@vitrines.test" },
    ],
  });
  session.publishScene(snapshot);
  session.publishScene({ ...snapshot, elements: [{ id: "shape-2" }] });
  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.equal(socket.sent.length, 1);
  const sent = JSON.parse(socket.sent[0]) as { sequence: number; snapshot: typeof snapshot };
  assert.equal(sent.sequence, 1);
  assert.deepEqual(sent.snapshot.elements, [{ id: "shape-2" }]);
  assert.deepEqual(Object.keys(sent.snapshot.files), ["stored"]);

  socket.receive({
    type: "scene",
    clientId: "remote-client",
    sequence: 4,
    snapshot: { ...snapshot, files: {} },
  });
  assert.equal(received.length, 1);
  assert.deepEqual(presence, [[{
    clientId: "remote-client",
    userId: 8,
    name: "remote@vitrines.test",
  }]]);

  socket.receive({
    type: "cursor",
    clientId: "remote-client",
    pointer: { x: 24, y: 36 },
    button: "down",
    selectedElementIds: ["shape-1"],
  });
  assert.deepEqual(cursors, [{
    clientId: "remote-client",
    pointer: { x: 24, y: 36 },
    button: "down",
    selectedElementIds: ["shape-1"],
  }]);

  session.publishCursor({
    pointer: { x: 12, y: 18 },
    button: "up",
    selectedElementIds: ["shape-2"],
  });
  assert.deepEqual(JSON.parse(socket.sent.at(-1)!), {
    type: "cursor",
    pointer: { x: 12, y: 18 },
    button: "up",
    selectedElementIds: ["shape-2"],
  });
  assert.deepEqual(statuses, ["connecting", "live"]);
  session.close();
  assert.equal(socket.closed, true);
  assert.deepEqual(presence.at(-1), []);
});

test("coalesces cursor moves while delivering the final pointer state", async () => {
  const socket = new FakeSocket();
  const session = openDesignerCanvasCollaboration({
    projectId: "11111111-1111-4111-8111-111111111111",
    location: { protocol: "http:", host: "localhost:5174" },
    reconnect: false,
    createSocket: () => socket,
  });
  socket.open();

  session.publishCursor({
    pointer: { x: 12, y: 18 },
    button: "down",
    selectedElementIds: ["shape-1"],
  });
  session.publishCursor({
    pointer: { x: 48, y: 64 },
    button: "down",
    selectedElementIds: ["shape-2"],
  });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(JSON.parse(socket.sent[0]), {
    type: "cursor",
    pointer: { x: 48, y: 64 },
    button: "down",
    selectedElementIds: ["shape-2"],
  });

  session.publishCursor({
    pointer: { x: 72, y: 96 },
    button: "up",
    selectedElementIds: [],
  });
  assert.deepEqual(JSON.parse(socket.sent[1]), {
    type: "cursor",
    pointer: { x: 72, y: 96 },
    button: "up",
    selectedElementIds: [],
  });
  session.close();
});
