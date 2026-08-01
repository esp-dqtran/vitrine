import { createServer } from "node:http";

import type express from "express";

import type { ProjectDocumentSyncGateway } from "./projectDocumentSync.ts";

export function createApiServer(
  app: express.Express,
  gateway: ProjectDocumentSyncGateway,
) {
  const server = createServer(app);
  let closed = false;

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
      request.url ?? "/",
      "http://127.0.0.1",
    ).pathname;
    if (
      !pathname.startsWith("/project-document-sync/") &&
      !pathname.startsWith("/project-document-share-sync/")
    ) {
      socket.destroy();
      return;
    }
    gateway.handleUpgrade(request, socket, head).catch(() => socket.destroy());
  });

  return {
    server,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      gateway.close();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    },
  };
}
