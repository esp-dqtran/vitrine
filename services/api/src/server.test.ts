import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import express from "express";
import type { IncomingMessage } from "node:http";

import type { ProjectDocumentSyncGateway } from "./projectDocumentSync.ts";
import { createApiServer } from "./server.ts";

test("serves Express HTTP and delegates matching upgrades", async (t) => {
  const upgrades: string[] = [];
  let gatewayClosed = false;
  const gateway: ProjectDocumentSyncGateway = {
    async handleUpgrade(request) {
      upgrades.push(request.url ?? "");
    },
    close() {
      gatewayClosed = true;
    },
  };
  const app = express();
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  const api = createApiServer(app, gateway);
  api.server.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => api.server.once("listening", resolve));
  t.after(() => api.close());
  const address = api.server.address();
  if (!address || typeof address === "string") throw new Error("No test port");

  const health = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(health.status, 200);

  const socket = new PassThrough();
  api.server.emit(
    "upgrade",
    { url: "/project-document-sync/7/41" } as IncomingMessage,
    socket,
    Buffer.alloc(0),
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(upgrades, ["/project-document-sync/7/41"]);

  const publicSocket = new PassThrough();
  api.server.emit(
    "upgrade",
    {
      url:
        `/project-document-share-sync/${"a".repeat(43)}/41`,
    } as IncomingMessage,
    publicSocket,
    Buffer.alloc(0),
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(upgrades, [
    "/project-document-sync/7/41",
    `/project-document-share-sync/${"a".repeat(43)}/41`,
  ]);

  await api.close();
  assert.equal(gatewayClosed, true);
});

test("destroys unrelated upgrade sockets without invoking the gateway", async () => {
  let called = false;
  const gateway: ProjectDocumentSyncGateway = {
    async handleUpgrade() {
      called = true;
    },
    close() {},
  };
  const api = createApiServer(express(), gateway);
  const socket = new PassThrough();

  api.server.emit(
    "upgrade",
    { url: "/other" } as IncomingMessage,
    socket,
    Buffer.alloc(0),
  );
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(called, false);
  assert.equal(socket.destroyed, true);
  await api.close();
});
