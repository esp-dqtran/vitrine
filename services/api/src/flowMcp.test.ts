import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import {
  getAccessibleApp,
  getAccessibleFlow,
  getAccessibleScreenshot,
  searchAccessibleApps,
  searchAccessibleFlows,
  type FlowMcpDependencies,
} from "./flowMcp.ts";
import { createApiApp } from "./app.ts";

const proUser: AuthUser = { id: 7, email: "pro@example.com", role: "user" };
const freeUser: AuthUser = { id: 8, email: "free@example.com", role: "user" };
const adminUser: AuthUser = { id: 1, email: "admin@example.com", role: "admin" };

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
    publishedCatalogPage: async () => ({
      apps: [{
        app_id: 1,
        app: "linear",
        display_name: "Linear",
        description: "Issue tracking for product teams.",
        categories: [{ id: 1, name: "Project management", slug: "project-management" }],
        website_url: "https://linear.app",
        icon_url: null,
        preview_object_key: null,
        accent_color: "#5E6AD2",
        total_screens: 12,
        analyzed_screens: 10,
        available_platforms: ["web"],
        last_captured_at: "2026-08-12T00:00:00.000Z",
      }],
      previews: [],
      nextCursor: null,
    }),
    getVersionFlows: async () => [onboarding],
    flowEvidenceImages: async () => [capture],
    appMetadata: async () => ({
      app: "linear",
      icon_url: null,
      categories: [{ id: 1, name: "Project management", slug: "project-management" }],
      display_name: "Linear",
      description: "Issue tracking for product teams.",
      website_url: "https://linear.app",
      accent_color: "#5E6AD2",
      preview_version_id: null,
      total_screens: 12,
      total_ui_elements: 18,
      total_flows: 3,
      analyzed_screens: 10,
      last_captured_at: "2026-08-12T00:00:00.000Z",
      available_platforms: ["web"],
    }),
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
  const apps = await searchAccessibleApps(proUser, dependencies(), {
    query: "project management",
    platform: "web",
    limit: 5,
  });
  assert.deepEqual(apps, [{
    app: "linear",
    title: "Linear",
    description: "Issue tracking for product teams.",
    categories: ["Project management"],
    platforms: ["web"],
    totalScreens: 12,
    url: "https://vitrines.ai/apps/linear",
  }]);
  assert.deepEqual(await searchAccessibleApps(freeUser, dependencies(), {
    query: "project management",
    platform: "web",
    limit: 5,
  }), []);

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

test("Flow MCP continues catalog pagination until it finds accessible results", async () => {
  const deps = dependencies();
  const firstAppPage = await deps.publishedCatalogPage({
    query: "workspace",
    limit: 24,
    sort: "latest",
    includeFacets: false,
  });
  const firstFlowPage = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "workspace",
    limit: 1,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const appCursors: Array<string | undefined> = [];
  const flowCursors: Array<string | undefined> = [];
  const notionApp = {
    ...firstAppPage.apps[0]!,
    app_id: 2,
    app: "notion",
    display_name: "Notion",
  };
  const notionFlow = {
    ...firstFlowPage.items[0]!,
    preview: {
      ...firstFlowPage.items[0]!.preview,
      appId: "notion",
      appName: "Notion",
      flow: {
        ...firstFlowPage.items[0]!.preview.flow,
        id: "notion-workspace",
      },
    },
  };
  const pagedDeps: FlowMcpDependencies = {
    ...deps,
    publishedCatalogPage: async (input) => {
      const cursor = (input as typeof input & { cursor?: string }).cursor;
      appCursors.push(cursor);
      return cursor
        ? { ...firstAppPage, apps: [notionApp], nextCursor: null }
        : { ...firstAppPage, nextCursor: "apps-next" };
    },
    publishedFlowCatalogPage: async (input) => {
      flowCursors.push(input.cursor);
      return input.cursor
        ? { ...firstFlowPage, items: [notionFlow], nextCursor: null }
        : { ...firstFlowPage, nextCursor: "flows-next" };
    },
  };

  const apps = await searchAccessibleApps(freeUser, pagedDeps, {
    query: "workspace",
    platform: "web",
    limit: 1,
  });
  assert.deepEqual(apps.map(({ app }) => app), ["notion"]);
  assert.deepEqual(appCursors, [undefined, "apps-next"]);

  const flows = await searchAccessibleFlows(freeUser, pagedDeps, {
    query: "workspace",
    platform: "web",
    limit: 1,
  });
  assert.deepEqual(flows.map(({ app, flowId }) => ({ app, flowId })), [{
    app: "notion",
    flowId: "notion-workspace",
  }]);
  assert.deepEqual(flowCursors, [undefined, "flows-next"]);
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

test("Flow MCP exposes accessible published app metadata and one requested screenshot", async () => {
  assert.deepEqual(await getAccessibleApp(proUser, dependencies(), "linear"), {
    id: "linear",
    app: "Linear",
    categories: [{ id: 1, name: "Project management", slug: "project-management" }],
    accent: "#5E6AD2",
    totalScreens: 12,
    totalUiElements: 18,
    totalFlows: 3,
    platforms: ["web"],
    analyzedScreens: 10,
    lastCapturedAt: "2026-08-12T00:00:00.000Z",
    websiteUrl: "https://linear.app",
    iconUrl: null,
    description: "Issue tracking for product teams.",
    previewVideoUrl: null,
    url: "https://vitrines.ai/apps/linear",
    flowsUrl: "https://vitrines.ai/apps/linear/flows",
  });
  assert.equal(await getAccessibleApp(freeUser, dependencies(), "linear"), undefined);
  assert.equal((await getAccessibleScreenshot(proUser, dependencies(), {
    app: "linear", platform: "web", screenshotId: 12,
  }))?.id, 12);
  assert.equal(await getAccessibleScreenshot(freeUser, dependencies(), {
    app: "linear", platform: "web", screenshotId: 12,
  }), undefined);
});

test("Flow MCP exposes the standard Streamable HTTP tools behind Vitrines bearer authentication", async (t) => {
  const deps = dependencies();
  const body = Buffer.from("test-capture");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const accessEvents: Array<Record<string, unknown>> = [];
  const { base, server } = await serve(createApiApp({
    verifyMcpAccessToken: async (token: string) => token === "vtr_mcp_test-token" ? proUser : undefined,
    adminImageObject: async () => ({
      key: "thumbnails/12/test.jpg",
      sha256,
      byteSize: body.byteLength,
      contentType: "image/jpeg",
      accessClass: "public-preview",
    }),
    objectStore: {
      get: async () => ({
        metadata: {
          key: "thumbnails/12/test.jpg",
          sha256,
          byteSize: body.byteLength,
          contentType: "image/jpeg",
          accessClass: "public-preview",
        },
        body,
      }),
    },
    recordAccessEvent: async (event: Record<string, unknown>) => { accessEvents.push(event); },
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
  assert.deepEqual(result.result.content.slice(1), []);
  const appSearch = await request({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "search_apps", arguments: { query: "project management", platform: "web" } },
  });
  assert.equal(appSearch.status, 200);
  const appSearchResult = await mcpMessage(appSearch) as { result: { content: Array<{ text?: string }> } };
  assert.match(appSearchResult.result.content[0]?.text ?? "", /Issue tracking for product teams/);

  const detail = await request({
    jsonrpc: "2.0",
    id: 4,
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
  assert.deepEqual(detailResult.result.content.slice(1), []);
  const app = await request({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "get_app", arguments: { app: "linear" } },
  });
  assert.equal(app.status, 200);
  const appResult = await mcpMessage(app) as { result: { content: Array<{ text?: string }> } };
  assert.match(appResult.result.content[0]?.text ?? "", /Issue tracking for product teams/);
  const screenshot = await request({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "get_screenshot",
      arguments: { app: "linear", platform: "web", screenshotId: 12 },
    },
  });
  assert.equal(screenshot.status, 200);
  const screenshotResult = await mcpMessage(screenshot) as {
    result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  };
  assert.match(screenshotResult.result.content[0]?.text ?? "", /Role selection screen/);
  assert.deepEqual(screenshotResult.result.content.slice(1), [
    { type: "text", text: "Screen capture: linear — Role selection screen" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);
  assert.deepEqual(accessEvents.map(({ action, outcome }) => ({ action, outcome })), [
    { action: "mcp-search_flows", outcome: "success" },
    { action: "mcp-search_apps", outcome: "success" },
    { action: "mcp-get_flow", outcome: "success" },
    { action: "mcp-get_app", outcome: "success" },
    { action: "mcp-get_screenshot", outcome: "success" },
  ]);
  assert.equal((await fetch(`${base}/mcp`, { method: "POST" })).status, 401);
});

test("Flow MCP rate limits admin access tokens", async (t) => {
  const { base, server } = await serve(createApiApp({
    generalRateLimit: 1,
    verifyMcpAccessToken: async (token: string) => token === "vtr_mcp_admin-token" ? adminUser : undefined,
    recordAccessEvent: async () => undefined,
    ...dependencies(),
  } as never));
  t.after(() => server.close());
  const request = (id: number) => fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: "Bearer vtr_mcp_admin-token",
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    }),
  });
  assert.equal((await request(1)).status, 200);
  assert.equal((await request(2)).status, 429);
});

test("Flow MCP rate limits each authenticated user independently behind one proxy", async (t) => {
  const users = new Map([
    ["vtr_mcp_first-token", { id: 71, email: "first@example.com", role: "user" as const }],
    ["vtr_mcp_second-token", { id: 72, email: "second@example.com", role: "user" as const }],
  ]);
  const { base, server } = await serve(createApiApp({
    generalRateLimit: 1,
    verifyMcpAccessToken: async (token: string) => users.get(token),
    recordAccessEvent: async () => undefined,
    ...dependencies(),
  } as never));
  t.after(() => server.close());
  const request = (token: string, id: number, origin?: string) => fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    }),
  });

  assert.equal((await request("vtr_mcp_first-token", 1)).status, 200);
  assert.equal((await request("vtr_mcp_second-token", 2)).status, 200);
  assert.equal((await request("vtr_mcp_first-token", 3)).status, 429);
});

test("Flow MCP rejects browser requests from untrusted origins", async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyMcpAccessToken: async (token: string) => token === "vtr_mcp_test-token" ? proUser : undefined,
    recordAccessEvent: async () => undefined,
    ...dependencies(),
  } as never));
  t.after(() => server.close());
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: "Bearer vtr_mcp_test-token",
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    }),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Untrusted MCP origin" });
});

test("Flow MCP omits thumbnails above the inline screenshot limit", async (t) => {
  const body = Buffer.alloc(1_000_001, 7);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const metadata = {
    key: "thumbnails/12/large.jpg",
    sha256,
    byteSize: body.byteLength,
    contentType: "image/jpeg" as const,
    accessClass: "public-preview" as const,
  };
  const { base, server } = await serve(createApiApp({
    verifyMcpAccessToken: async (token: string) => token === "vtr_mcp_test-token" ? proUser : undefined,
    adminImageObject: async () => metadata,
    objectStore: { get: async () => ({ metadata, body }) },
    recordAccessEvent: async () => undefined,
    ...dependencies(),
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
  await request({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } },
  });
  const response = await request({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "get_screenshot", arguments: { app: "linear", platform: "web", screenshotId: 12 } },
  });
  assert.equal(response.status, 200);
  const result = await mcpMessage(response) as { result: { isError?: boolean; content: Array<{ type: string }> } };
  assert.equal(result.result.isError, true);
  assert.deepEqual(result.result.content.map(({ type }) => type), ["text", "text"]);
});
