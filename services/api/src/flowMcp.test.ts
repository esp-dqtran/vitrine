import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import {
  getAccessibleFlow,
  searchAccessibleFlows,
  type FlowMcpDependencies,
} from "./flowMcp.ts";
import { createApiApp } from "./app.ts";

const proUser: AuthUser = { id: 7, email: "pro@example.com", role: "user" };
const freeUser: AuthUser = { id: 8, email: "free@example.com", role: "user" };

const onboarding: DesignFlow = {
  id: "invite-admins",
  title: "Invite workspace administrators",
  category: "Onboarding",
  description: "Set up the first workspace administrators.",
  tags: ["onboarding", "permissions"],
  steps: [{
    label: "Choose administrator permissions",
    interaction: "Select the administrator role",
    evidence: [12],
    observation: {
      source: "crawl_observed",
      action: "click",
      sourceUrl: "https://example.test/setup",
      finalUrl: "https://example.test/setup",
      visibleUi: ["Role selector"],
      visibleText: ["Workspace administrator", "Can manage members"],
      likelyIntent: "Choose who can manage the workspace",
      availableActions: ["Select a role", "Continue"],
      systemFeedback: [],
      friction: [],
      missingOrUncertainStates: [],
      accessibility: [],
      confidence: 0.9,
    },
  }],
};

const capture: CrawledImage = {
  id: 12,
  app: "linear",
  platform: "web",
  image_url: "capture:0123456789abcdef",
  description: "Role selection screen",
  analysis: {
    description: "Role picker during workspace setup.",
    purpose: "Assign administrator permissions.",
    pageType: "form",
    productArea: "onboarding",
    theme: "light",
    visibleStates: [],
    componentNames: [],
    visibleText: ["Workspace administrator", "Manage members"],
  },
  captured_at: "2026-08-12T00:00:00.000Z",
};

function dependencies(): FlowMcpDependencies {
  return {
    appUrl: "https://vitrines.ai",
    flowCatalogSecret: "test-flow-catalog-secret-1234567890",
    canAccessApp: async (user, app) => user.id === proUser.id || app === "notion",
    publishedFlowCatalogPage: async (): Promise<import("../../../src/flowCatalogStore.ts").FlowCatalogPage> => ({
      items: [{
        category: "Onboarding",
        title: onboarding.title,
        preview: {
          appId: "linear",
          appName: "Linear",
          appIconUrl: null,
          versionId: 1,
          version: 1,
          sourceFlowId: onboarding.id,
          screenCount: 1,
          flow: {
            ...onboarding,
            insights: undefined,
            steps: onboarding.steps.map((step) => ({
              ...step,
              evidence: [{
                imageId: 12,
                imageUrl: "/api/media/linear/0123456789abcdef",
                description: "Role selection screen",
              }],
            })),
          },
        },
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [],
    }),
    getVersionFlows: async () => [onboarding],
    flowEvidenceImages: async () => [capture],
    readInlineImage: async () => ({ data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" }),
  };
}

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not listen");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

async function mcpMessage(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  const payload = body.split("\n").find((line) => line.startsWith("data: "))?.slice("data: ".length) ?? body;
  return JSON.parse(payload) as Record<string, unknown>;
}

test("Flow MCP searches the published catalog and filters inaccessible apps", async () => {
  const result = await searchAccessibleFlows(proUser, dependencies(), {
    query: "onboarding permissions",
    platform: "web",
    limit: 5,
  });
  assert.deepEqual(result.map(({ app, flowId }) => ({ app, flowId })), [{ app: "linear", flowId: "invite-admins" }]);
  assert.equal(result[0]?.previewScreenshotId, 12);
  assert.equal(result[0]?.previewScreenshotUrl, "https://vitrines.ai/api/media/linear/0123456789abcdef");

  const unavailable = await searchAccessibleFlows(freeUser, dependencies(), {
    query: "onboarding permissions",
    platform: "web",
    limit: 5,
  });
  assert.deepEqual(unavailable, []);
});

test("Flow MCP returns ordered steps with screenshot URLs only for accessible published flows", async () => {
  const result = await getAccessibleFlow(proUser, dependencies(), {
    app: "linear",
    platform: "web",
    flowId: "invite-admins",
  });
  assert.deepEqual(result, {
    app: "linear",
    platform: "web",
    flowId: "invite-admins",
    title: "Invite workspace administrators",
    category: "Onboarding",
    description: "Set up the first workspace administrators.",
    tags: ["onboarding", "permissions"],
    url: "https://vitrines.ai/apps/linear/flows?platform=web&flow=invite-admins",
    steps: [{
      number: 1,
      label: "Choose administrator permissions",
      interaction: "Select the administrator role",
      observed: {
        likelyIntent: "Choose who can manage the workspace",
        visibleUi: ["Role selector"],
        visibleText: ["Workspace administrator", "Can manage members"],
        availableActions: ["Select a role", "Continue"],
        systemFeedback: [],
        friction: [],
      },
      screenshots: [{
        id: 12,
        url: "https://vitrines.ai/api/media/linear/0123456789abcdef",
        thumbnailUrl: "https://vitrines.ai/api/media/linear/0123456789abcdef?variant=thumb",
        description: "Role selection screen",
        purpose: "Assign administrator permissions.",
        productArea: "onboarding",
        visibleText: ["Workspace administrator", "Manage members"],
        capturedAt: "2026-08-12T00:00:00.000Z",
      }],
    }],
  });
  assert.equal(await getAccessibleFlow(freeUser, dependencies(), {
    app: "linear", platform: "web", flowId: "invite-admins",
  }), undefined);
});

test("Flow MCP returns every screenshot in a selected flow", async () => {
  const screenshots = Array.from({ length: 11 }, (_, index) => ({
    ...capture,
    id: index + 1,
    image_url: `capture:${String(index + 1).padStart(16, "0")}`,
  }));
  const result = await getAccessibleFlow(proUser, {
    ...dependencies(),
    getVersionFlows: async () => [{
      ...onboarding,
      steps: screenshots.map((image, index) => ({
        ...onboarding.steps[0]!,
        label: `Onboarding step ${index + 1}`,
        evidence: [image.id],
      })),
    }],
    flowEvidenceImages: async () => screenshots,
  }, {
    app: "linear",
    platform: "web",
    flowId: "invite-admins",
  });
  const steps = result?.steps as Array<{ screenshots: Array<{ id: number }> }>;
  assert.equal(steps.flatMap((step) => step.screenshots).length, 11);
});

test("Flow MCP exposes the standard Streamable HTTP tools behind Vitrines bearer authentication", async (t) => {
  const deps = dependencies();
  const { base, server } = await serve(createApiApp({
    verifyMcpAccessToken: async (token: string) => token === "vtr_mcp_test-token" ? proUser : undefined,
    adminImageObject: async () => ({
      key: "thumbnails/12/test.jpg",
      sha256: "0".repeat(64),
      byteSize: 12,
      contentType: "image/jpeg",
      accessClass: "public-preview",
    }),
    objectStore: {
      get: async () => ({
        metadata: {
          key: "thumbnails/12/test.jpg",
          sha256: "0".repeat(64),
          byteSize: 12,
          contentType: "image/jpeg",
          accessClass: "public-preview",
        },
        body: Buffer.from("test-capture"),
      }),
    },
    ...deps,
  } as never));
  t.after(() => server.close());
  const request = (body: unknown) => fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: "Bearer vtr_mcp_test-token",
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const initialize = await request({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  assert.equal(initialize.status, 200);
  const initialized = await mcpMessage(initialize) as { result: { capabilities: { tools?: unknown } } };
  assert.ok(initialized.result.capabilities.tools);

  const search = await request({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "search_flows", arguments: { query: "onboarding permissions", platform: "web" } },
  });
  assert.equal(search.status, 200);
  const result = await mcpMessage(search) as {
    result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  };
  assert.match(result.result.content[0]?.text ?? "", /invite-admins/);
  assert.deepEqual(result.result.content.slice(1), [
    { type: "text", text: "Screen capture: linear — Invite workspace administrators" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);

  const detail = await request({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_flow",
      arguments: { app: "linear", platform: "web", flowId: "invite-admins" },
    },
  });
  assert.equal(detail.status, 200);
  const detailResult = await mcpMessage(detail) as {
    result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  };
  assert.match(detailResult.result.content[0]?.text ?? "", /Choose administrator permissions/);
  assert.deepEqual(detailResult.result.content.slice(1), [
    { type: "text", text: "Screen capture: linear — Role selection screen" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);
  assert.equal((await fetch(`${base}/mcp`, { method: "POST" })).status, 401);
});
