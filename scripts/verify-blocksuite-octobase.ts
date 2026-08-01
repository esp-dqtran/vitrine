import { AffineSchemas } from "@blocksuite/blocks/schemas";
import { DocCollection, Schema, type Doc } from "@blocksuite/store";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";

import { createOctobaseYjsBridge } from "../services/api/src/octobaseYjsBridge.ts";

const INITIAL_SENTINEL = "Astryx OctoBase compatibility sentinel";
const UPDATED_SENTINEL = "Astryx OctoBase compatibility sentinel updated";
const TIMEOUT_MS = 15_000;
const originalConsoleError = console.error;
let yjsProtocolError: unknown;

console.error = (...args: unknown[]) => {
  if (args[0] === "Caught error while handling a Yjs update") {
    yjsProtocolError = args[1] ?? args[0];
  }
  originalConsoleError(...args);
};

type OctoBaseTokenResponse = {
  token?: string;
};

type OctoBaseWorkspaceResponse = {
  id?: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function requestToken(
  octobaseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const createPayload = {
    type: "DebugCreateUser",
    name: "Astryx Integration",
    avatar_url: null,
    email,
    password,
  };
  const loginPayload = {
    type: "DebugLoginUser",
    email,
    password,
  };

  let response = await fetch(`${octobaseUrl}/api/user/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createPayload),
  });
  if (!response.ok) {
    response = await fetch(`${octobaseUrl}/api/user/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(loginPayload),
    });
  }
  if (!response.ok) {
    throw new Error(`OctoBase authentication failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as OctoBaseTokenResponse;
  if (!body.token) {
    throw new Error("OctoBase authentication response did not include a token");
  }
  return body.token;
}

async function createWorkspace(
  octobaseUrl: string,
  token: string,
): Promise<string> {
  const response = await fetch(`${octobaseUrl}/api/workspace`, {
    method: "POST",
    headers: {
      authorization: token,
      "content-type": "application/octet-stream",
      "content-length": "0",
    },
    body: new Uint8Array(),
  });
  if (!response.ok) {
    throw new Error(`OctoBase workspace creation failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as OctoBaseWorkspaceResponse;
  if (!body.id) {
    throw new Error("OctoBase workspace response did not include an id");
  }
  return body.id;
}

function emptyBlockSuiteDoc(): Doc {
  const schema = new Schema().register(AffineSchemas);
  const collection = new DocCollection({ schema });
  collection.meta.initialize();
  const doc = collection.createDoc({ id: "main" });
  doc.load();
  return doc;
}

function initializeBlocks(doc: Doc, text: string): void {
  if (doc.root) {
    throw new Error("Compatibility workspace was not empty");
  }
  const pageId = doc.addBlock("affine:page", {});
  doc.addBlock("affine:surface", {}, pageId);
  const noteId = doc.addBlock("affine:note", {}, pageId);
  doc.addBlock(
    "affine:paragraph",
    { text: new doc.Text(text) },
    noteId,
  );
}

function paragraphText(doc: Doc): string {
  const paragraphs = doc.getBlocksByFlavour("affine:paragraph");
  if (paragraphs.length !== 1) {
    throw new Error(`Expected one paragraph, found ${paragraphs.length}`);
  }
  return String(paragraphs[0]?.model.text ?? "");
}

function assertRestored(doc: Doc, expectedText: string): void {
  const roots = doc.getBlocksByFlavour("affine:page");
  if (roots.length !== 1 || !doc.root) {
    throw new Error(`Expected one restored root block, found ${roots.length}`);
  }
  const actualText = paragraphText(doc);
  if (actualText !== expectedText) {
    throw new Error(
      `Expected restored paragraph "${expectedText}", received "${actualText}"`,
    );
  }
}

function connect(
  syncBaseUrl: string,
  workspaceId: string,
  token: string,
  doc: Doc,
): { provider: WebsocketProvider; synced: Promise<void> } {
  const provider = new WebsocketProvider(
    `${syncBaseUrl.replace(/^http/, "ws")}/api/sync`,
    workspaceId,
    doc.spaceDoc,
    {
      params: { token },
      protocols: ["AFFiNE"],
      WebSocketPolyfill: WebSocket,
      disableBc: true,
    },
  );

  const synced = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out after ${TIMEOUT_MS}ms waiting for OctoBase sync`));
    }, TIMEOUT_MS);
    provider.on("sync", (state: boolean) => {
      if (state) {
        clearTimeout(timeout);
        resolve();
      }
    });
    provider.on("connection-error", () => {
      clearTimeout(timeout);
      reject(new Error("OctoBase WebSocket provider connection failed"));
    });
  });
  return { provider, synced };
}

function closeClient(doc: Doc, provider: WebsocketProvider): void {
  provider.destroy();
  doc.collection.forceStop();
  doc.dispose();
  doc.spaceDoc.destroy();
  doc.collection.dispose();
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 750));
}

function assertNoYjsProtocolErrors(): void {
  if (yjsProtocolError) {
    throw new Error(
      `OctoBase emitted an update that Yjs could not decode: ${String(yjsProtocolError)}`,
    );
  }
}

async function waitForParagraphText(
  doc: Doc,
  expectedText: string,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (paragraphText(doc) === expectedText) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(
    "A live BlockSuite update did not propagate through unchanged OctoBase",
  );
}

async function startCompatibilityBridge(
  octobaseUrl: string,
): Promise<{ syncBaseUrl: string; close: () => Promise<void> }> {
  const bridge = createOctobaseYjsBridge(octobaseUrl);
  const server = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
    const token = url.searchParams.get("token");
    if (!match?.[1] || !token) {
      socket.destroy();
      return;
    }
    bridge.accept(request, socket, head, {
      workspaceId: decodeURIComponent(match[1]),
      token,
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Compatibility bridge did not bind a TCP port");
  }
  return {
    syncBaseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      bridge.close();
      await closeServer(server);
    },
  };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main(): Promise<void> {
  const octobaseUrl = (process.env.OCTOBASE_URL ?? "http://127.0.0.1:3020")
    .replace(/\/+$/, "");
  const email = requiredEnvironment("OCTOBASE_SERVICE_EMAIL");
  const password = requiredEnvironment("OCTOBASE_SERVICE_PASSWORD");
  const token = await requestToken(octobaseUrl, email, password);
  const workspaceId = await createWorkspace(octobaseUrl, token);
  const bridge = await startCompatibilityBridge(octobaseUrl);

  try {
    const firstDoc = emptyBlockSuiteDoc();
    const first = connect(bridge.syncBaseUrl, workspaceId, token, firstDoc);
    await first.synced;
    initializeBlocks(firstDoc, INITIAL_SENTINEL);
    await settle();

    const secondDoc = emptyBlockSuiteDoc();
    const second = connect(bridge.syncBaseUrl, workspaceId, token, secondDoc);
    await second.synced;
    assertRestored(secondDoc, INITIAL_SENTINEL);
    const firstParagraph = firstDoc.getBlocksByFlavour("affine:paragraph")[0];
    firstParagraph.model.text.replace(
      0,
      firstParagraph.model.text.length,
      UPDATED_SENTINEL,
    );
    await waitForParagraphText(secondDoc, UPDATED_SENTINEL);
    await settle();
    assertNoYjsProtocolErrors();
    closeClient(firstDoc, first.provider);
    closeClient(secondDoc, second.provider);

    const thirdDoc = emptyBlockSuiteDoc();
    const third = connect(bridge.syncBaseUrl, workspaceId, token, thirdDoc);
    await third.synced;
    assertRestored(thirdDoc, UPDATED_SENTINEL);
    closeClient(thirdDoc, third.provider);

    console.log(
      `BlockSuite 0.19.5 compatibility passed through translated OctoBase workspace ${workspaceId}`,
    );
  } finally {
    await bridge.close();
  }
}

main()
  .then(() => {
    console.error = originalConsoleError;
    process.exit(0);
  })
  .catch(error => {
    console.error = originalConsoleError;
    originalConsoleError(error instanceof Error ? error.message : error);
    process.exit(1);
  });
