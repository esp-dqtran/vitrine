import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { EventEmitter } from "node:events";
import { after, before, test } from "node:test";
import express from "express";
import {
  mountFeatureDocumentRoutes,
  mountPublicFeatureDocumentRoutes,
  type FeatureDocumentRouteDependencies,
} from "./featureDocuments.ts";
import type { FeatureDocumentStore } from "../../../src/featureDocumentStore.ts";

const app = express();
app.use(express.json());

const published: unknown[] = [];
const created: Array<{ userId: number; input: Record<string, unknown> }> = [];
const missingObjects = new Set<number>();
let publicHash = "";

const job = {
  id: 31,
  documentId: 12,
  status: "running" as const,
  stage: "analyzing" as const,
  doneCount: 1,
  totalCount: 3,
  updatedAt: "2026-07-22T00:00:00.000Z",
};

const store = {
  async createGeneration(userId: number, input: Record<string, unknown>) {
    created.push({ userId, input });
    return {
      document: { id: 12, title: "Checkout", reviewStatus: "draft", sourceChanged: false, revisions: [] },
      job: { ...job, status: "queued", stage: "preparing", doneCount: 0 },
    };
  },
  async getDocument(userId: number) {
    return userId === 7
      ? { id: 12, title: "Checkout", reviewStatus: "draft", sourceChanged: false, revisions: [], currentJob: job }
      : undefined;
  },
  async getJob(userId: number) { return userId === 7 ? job : undefined; },
  async failJob() {},
  async publicShare(tokenSha256: string) {
    publicHash = tokenSha256;
    return {
      title: "Checkout",
      reviewStatus: "approved" as const,
      expiresAt: "2026-07-29T00:00:00.000Z",
      revision: {
        id: 5,
        documentId: 12,
        revisionNumber: 2,
        authorType: "user" as const,
        reviewStatus: "approved" as const,
        content: {},
        source: { app: "linear", platform: "web", flowId: "checkout", title: "Checkout", description: "", tags: [] },
        evidenceManifest: [], focusInstruction: "", promptVersion: 1, providerModel: "model",
        createdAt: "2026-07-22T00:00:00.000Z",
      },
    };
  },
  async publicShareImage(_tokenSha256: string, imageId: number) {
    return imageId === 42
      ? { key: "images/42.png", sha256: "a".repeat(64), byteSize: 3, contentType: "image/png" as const, accessClass: "protected" as const }
      : undefined;
  },
} as unknown as FeatureDocumentStore;

class NotificationClient extends EventEmitter {
  async query() { return { rows: [] }; }
  release() {}
}

const listener = new NotificationClient();
const dependencies = {
  store,
  canAccessApp: async () => true,
  listAppVersions: async () => [{ id: 5, version_number: 3, status: "published" }],
  getVersionFlows: async () => [{
    id: "checkout",
    title: "Checkout",
    description: "Complete checkout",
    tags: ["commerce"],
    steps: [
      { label: "Cart", evidence: [42, 43] },
      { label: "Payment", evidence: [44] },
    ],
  }],
  flowEvidenceImages: async () => [42, 43, 44].map((id) => ({
    id,
    description: `Image ${id}`,
    captured_at: "2026-07-22T00:00:00.000Z",
  })),
  imageObjectById: async (imageId: number) => missingObjects.has(imageId)
    ? undefined
    : { key: `images/${imageId}.png`, sha256: "a".repeat(64), byteSize: 3, contentType: "image/png", accessClass: "protected" },
  createJob: async () => 72,
  setJobStatus: async () => {},
  publishJob: async (value: unknown) => { published.push(value); },
  providerModel: "research-model",
  promptVersion: 1,
  appUrl: "http://localhost:5173",
  sendObject: async (_metadata: unknown, res: express.Response) => { res.type("png").send(Buffer.from("png")); },
  acquireNotificationClient: async () => listener,
} as unknown as FeatureDocumentRouteDependencies;

mountPublicFeatureDocumentRoutes(app, dependencies);
app.use((req, res, next) => {
  const userId = Number(req.header("x-user-id") ?? 7);
  res.locals.user = { id: userId, role: "user", email: `user-${userId}@example.com` };
  next();
});
mountFeatureDocumentRoutes(app, dependencies);

let server: Server;
let base = "";
before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server failed");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test("creates a durable generation only after every Flow image is object-backed", async () => {
  const response = await fetch(`${base}/feature-documents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app: "linear", platform: "web", version: 3, flowId: "checkout", focusInstruction: "Focus on recovery" }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { documentId: 12, jobId: 31 });
  assert.deepEqual(published[0], { type: "generate-feature-document", runId: "31", jobId: 72 });
  assert.equal((created[0].input.evidenceManifest as unknown[]).length, 3);
  assert.equal(created[0].input.transportJobId, 72);
});

test("rejects incomplete Flow evidence without publishing", async () => {
  missingObjects.add(44);
  const publishCount = published.length;
  const response = await fetch(`${base}/feature-documents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app: "linear", platform: "web", version: 3, flowId: "checkout", focusInstruction: "" }),
  });
  missingObjects.clear();
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Flow evidence is incomplete",
    code: "flow_evidence_incomplete",
    missing: ["FLOW-STEP-02-IMAGE-44"],
  });
  assert.equal(published.length, publishCount);
});

test("owner-scoped reads and SSE expose only the authorized durable job", async () => {
  assert.equal((await fetch(`${base}/feature-documents/12`, { headers: { "x-user-id": "8" } })).status, 404);
  const controller = new AbortController();
  const response = await fetch(`${base}/feature-document-jobs/31/events`, { signal: controller.signal });
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const first = await response.body!.getReader().read();
  controller.abort();
  assert.match(new TextDecoder().decode(first.value), /feature-document-progress/);
  assert.match(new TextDecoder().decode(first.value), /"stage":"analyzing"/);
});

test("public share is non-enumerating and exposes only allowlisted media", async () => {
  const token = "a".repeat(43);
  assert.equal((await fetch(`${base}/feature-document-shares/${token}`)).status, 200);
  assert.notEqual(publicHash, token);
  assert.match(publicHash, /^[0-9a-f]{64}$/);
  assert.equal((await fetch(`${base}/feature-document-shares/${token}/media/42`)).status, 200);
  assert.equal((await fetch(`${base}/feature-document-shares/${token}/media/999`)).status, 404);
  assert.equal((await fetch(`${base}/feature-document-shares/short`)).status, 404);
});
