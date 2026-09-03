import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import type { AuthUser } from "../../../src/authStore.ts";
import type { CrawledImage } from "../../../src/db.ts";
import type { DesignFlow } from "../../../src/designSystem.ts";
import type { Platform } from "../../../src/platformFromUrl.ts";
import {
  getAccessibleApp,
  getAccessibleFlow,
  getAccessibleScreenshot,
  mergePlatformResultsByRelevance,
  normalizeFlowSearchQuery,
  searchAccessibleApps,
  searchAccessibleFlows,
  searchAccessibleScreens,
  type FlowMcpDependencies,
  type FlowMcpSearchResult,
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
    sourcePresentation: "unknown",
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
        type: "Invite member",
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
    publishedScreenSearch: async () => [{
      ...capture,
      app_name: "Linear",
      flow_id: onboarding.id,
      flow_title: onboarding.title,
      flow_step_index: 1,
      flow_step_label: onboarding.steps[0]!.label,
      matched_term_count: 3,
    }],
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
  assert.equal(result[0]?.appName, "Linear");
  assert.equal(result[0]?.type, "Invite member");
  assert.deepEqual(result[0]?.previewSteps, ["Choose administrator permissions"]);
  assert.deepEqual(result[0]?.previewScreenshots, [{
    screenshotId: 12,
    label: "Choose administrator permissions",
    url: "https://vitrines.ai/api/media/linear/0123456789abcdef",
  }]);
  assert.equal(result[0]?.previewScreenshotId, 12);
  assert.equal(result[0]?.previewScreenshotUrl, "https://vitrines.ai/api/media/linear/0123456789abcdef");

  const unavailable = await searchAccessibleFlows(freeUser, dependencies(), {
    query: "onboarding permissions",
    platform: "web",
    limit: 5,
  });
  assert.deepEqual(unavailable, []);
});

test("Flow MCP search result IDs can be passed directly to get_flow", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "onboarding permissions",
    limit: 1,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const searchableDeps: FlowMcpDependencies = {
    ...deps,
    publishedFlowCatalogPage: async () => ({
      ...page,
      items: page.items.map((item) => ({
        ...item,
        preview: {
          ...item.preview,
          sourceFlowId: onboarding.id,
          flow: { ...item.preview.flow, id: "linear:501" },
        },
      })),
    }),
  };

  const [searchResult] = await searchAccessibleFlows(proUser, searchableDeps, {
    query: "onboarding permissions",
    platform: "web",
    limit: 1,
  });
  assert.ok(searchResult);
  assert.equal(searchResult.flowId, onboarding.id);

  const flow = await getAccessibleFlow(proUser, searchableDeps, {
    app: searchResult.app,
    platform: searchResult.platform,
    flowId: searchResult.flowId,
  });
  assert.equal(flow?.flowId, onboarding.id);
});

test("Flow MCP returns separate app instances of the same canonical Flow", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "onboarding",
    limit: 4,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const items = ["slite", "superlist", "air", "mymind"].map((app, index) => ({
    ...page.items[0]!,
    title: "Onboarding",
    preview: {
      ...page.items[0]!.preview,
      appId: app,
      appName: app,
      sourceFlowId: `${app}-onboarding`,
      flow: {
        ...page.items[0]!.preview.flow,
        id: `${app}-onboarding`,
        title: "Onboarding",
      },
    },
  }));
  let groupedCatalogCalled = false;

  const flows = await searchAccessibleFlows(proUser, {
    ...deps,
    publishedFlowCatalogPage: async () => {
      groupedCatalogCalled = true;
      return page;
    },
    publishedFlowInstanceSearch: async () => items,
  }, { query: "onboarding flow", platform: "web", limit: 4 });

  assert.deepEqual(flows.map(({ app, title }) => ({ app, title })), [
    { app: "slite", title: "Onboarding" },
    { app: "superlist", title: "Onboarding" },
    { app: "air", title: "Onboarding" },
    { app: "mymind", title: "Onboarding" },
  ]);
  assert.equal(groupedCatalogCalled, false);
});

test("Flow MCP exposes a bounded ordered screenshot sequence for each search result", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "logging in",
    limit: 5,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const result = await searchAccessibleFlows(proUser, {
    ...deps,
    publishedFlowCatalogPage: async () => ({
      ...page,
      items: page.items.map((item) => ({
        ...item,
        preview: {
          ...item.preview,
          flow: {
            ...item.preview.flow,
            steps: Array.from({ length: 4 }, (_, index) => ({
              label: `Login step ${index + 1}`,
              evidence: [{
                imageId: 12 + index,
                imageUrl: `/api/media/linear/login-step-${index + 1}`,
                description: `Login step ${index + 1}`,
              }],
            })),
          },
        },
      })),
    }),
  }, { query: "login flow", platform: "web", limit: 5 });

  assert.deepEqual(result[0]?.previewScreenshots, [1, 2, 3].map((step, index) => ({
    screenshotId: 12 + index,
    label: `Login step ${step}`,
    url: `https://vitrines.ai/api/media/linear/login-step-${step}`,
  })));
});

test("Flow MCP searches published screen semantics without exposing the OCR corpus", async () => {
  const calls: Array<{ query: string; platform?: Platform; limit: number; mode?: "standard" | "deep" }> = [];
  const deps = {
    ...dependencies(),
    canAccessApp: async (_user: Pick<AuthUser, "id" | "role">, app: string) => app === "linear",
    publishedScreenSearch: async (input: { query: string; platform?: Platform; limit: number; mode?: "standard" | "deep" }) => {
      calls.push(input);
      return [
        {
          ...capture,
          app_name: "Linear",
          flow_id: onboarding.id,
          flow_title: onboarding.title,
          flow_step_index: 1,
          flow_step_label: "Choose administrator permissions",
          matched_term_count: 2,
        },
        {
          ...capture,
          id: 99,
          app: "locked-app",
          app_name: "Locked App",
          flow_id: null,
          flow_title: null,
          flow_step_index: null,
          flow_step_label: null,
          matched_term_count: 2,
        },
      ];
    },
  } satisfies FlowMcpDependencies;
  const results = await searchAccessibleScreens(proUser, deps, {
    query: "administrator permissions screen",
    platform: "web",
    limit: 5,
  });

  assert.equal(calls[0]?.limit, 60);
  assert.equal(calls[0]?.mode, "standard");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    app: "linear",
    appName: "Linear",
    platform: "web",
    screenshotId: 12,
    title: "Assign administrator permissions.",
    description: "Role selection screen",
    purpose: "Assign administrator permissions.",
    pageType: "form",
    productArea: "onboarding",
    matchedOn: ["purpose", "visible UI text"],
    url: "https://vitrines.ai/api/media/linear/0123456789abcdef",
    thumbnailUrl: "https://vitrines.ai/api/media/linear/0123456789abcdef?variant=thumb",
    flow: {
      flowId: "invite-admins",
      title: "Invite workspace administrators",
      stepNumber: 1,
      stepLabel: "Choose administrator permissions",
      url: "https://vitrines.ai/apps/linear/flows?platform=web&flow=invite-admins",
    },
  });
  assert.doesNotMatch(JSON.stringify(results), /Manage members/);
});

test("Flow MCP balances screen results across platforms when none is selected", async () => {
  const platforms: Platform[] = [];
  const results = await searchAccessibleScreens(adminUser, {
    ...dependencies(),
    publishedScreenSearch: async ({ platform }) => {
      assert.ok(platform);
      platforms.push(platform);
      const id = platform === "web" ? 1 : platform === "ios" ? 2 : 3;
      return [{
        ...capture,
        id,
        platform,
        image_url: `capture:${String(id).padStart(16, "0")}`,
        app_name: "Linear",
        flow_id: null,
        flow_title: null,
        flow_step_index: null,
        flow_step_label: null,
        matched_term_count: 1,
      }];
    },
  }, { query: "administrator", limit: 3 });

  assert.deepEqual(platforms, ["web", "ios", "android"]);
  assert.deepEqual(results.map(({ platform }) => platform), ["web", "ios", "android"]);
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
      sourceFlowId: "notion-workspace",
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

test("Flow MCP balances results across platforms when the caller does not choose one", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "invite members",
    limit: 6,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const calls: Array<{ platform: string; limit: number }> = [];
  const balancedDeps: FlowMcpDependencies = {
    ...deps,
    publishedFlowCatalogPage: async (input) => {
      calls.push({ platform: input.platform, limit: input.limit });
      return {
        ...page,
        items: Array.from({ length: 3 }, (_, index) => ({
          ...page.items[0]!,
          preview: {
            ...page.items[0]!.preview,
            appId: `${input.platform}-app-${index + 1}`,
            appName: `${input.platform.toUpperCase()} app ${index + 1}`,
            sourceFlowId: `${input.platform}-flow-${index + 1}`,
            flow: {
              ...page.items[0]!.preview.flow,
              id: `${input.platform}-flow-${index + 1}`,
              title: `Invite members on ${input.platform} ${index + 1}`,
            },
          },
        })),
        nextCursor: null,
      };
    },
  };

  const results = await searchAccessibleFlows(adminUser, balancedDeps, {
    query: "invite members",
    limit: 6,
  });
  assert.deepEqual(results.map(({ platform }) => platform), [
    "web", "ios", "android", "web", "ios", "android",
  ]);
  assert.deepEqual(calls.sort((left, right) => left.platform.localeCompare(right.platform)), [
    { platform: "android", limit: 3 },
    { platform: "ios", limit: 3 },
    { platform: "web", limit: 3 },
  ]);
});

test("Flow MCP ranks exact intent above a weak platform-diversity match", () => {
  const result = (platform: Platform, app: string, title: string): FlowMcpSearchResult => ({
    app,
    appName: app,
    platform,
    flowId: `${app}-flow`,
    title,
    description: "",
    tags: [],
    stepCount: 1,
    previewSteps: [],
    previewScreenshots: [],
    url: `https://vitrines.test/${app}`,
  });

  const merged = mergePlatformResultsByRelevance([
    [
      result("web", "web-one", "Uploading a profile photo"),
      result("web", "web-two", "Uploading a profile photo"),
    ],
    [
      result("ios", "ios-one", "Uploading a profile photo"),
      result("ios", "ios-two", "Uploading a profile photo"),
    ],
    [
      result("android", "android-one", "Uploading private photos"),
      result("android", "android-two", "Uploading product photos"),
    ],
  ], "uploading a profile photo", 4);

  assert.deepEqual(merged.map(({ app }) => app), [
    "web-one", "ios-one", "web-two", "ios-two",
  ]);
});

test("Flow MCP expands a productive platform when balanced results are sparse", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "checkout",
    limit: 6,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const calls: Array<{ platform: string; limit: number }> = [];
  const results = await searchAccessibleFlows(adminUser, {
    ...deps,
    publishedFlowCatalogPage: async (input) => {
      calls.push({ platform: input.platform, limit: input.limit });
      if (input.platform !== "web") return { ...page, items: [], nextCursor: null };
      return {
        ...page,
        items: Array.from({ length: input.limit }, (_, index) => ({
          ...page.items[0]!,
          preview: {
            ...page.items[0]!.preview,
            appId: `web-app-${index + 1}`,
            sourceFlowId: `web-flow-${index + 1}`,
            flow: {
              ...page.items[0]!.preview.flow,
              id: `web-flow-${index + 1}`,
              title: `Checkout on web ${index + 1}`,
            },
          },
        })),
        nextCursor: null,
      };
    },
  }, { query: "checkout", limit: 6 });

  assert.equal(results.length, 6);
  assert.deepEqual(results.map(({ platform }) => platform), Array(6).fill("web"));
  assert.deepEqual(calls, [
    { platform: "web", limit: 3 },
    { platform: "ios", limit: 3 },
    { platform: "android", limit: 3 },
    { platform: "web", limit: 6 },
  ]);
});

test("Flow MCP normalizes common flow-search wording to catalog intent", async () => {
  assert.equal(normalizeFlowSearchQuery("login flow"), "logging in");
  assert.equal(normalizeFlowSearchQuery("Sign-in user flow"), "logging in");
  assert.equal(normalizeFlowSearchQuery("login with email and password"), "logging in");
  assert.equal(normalizeFlowSearchQuery("logout flow"), "logging out");
  assert.equal(normalizeFlowSearchQuery("forgot password"), "resetting password");
  assert.equal(normalizeFlowSearchQuery("password recovery flow"), "resetting password");
  assert.equal(normalizeFlowSearchQuery("sign up flow"), "creating an account");
  assert.equal(normalizeFlowSearchQuery("create account"), "creating an account");
  assert.equal(normalizeFlowSearchQuery("change notification preferences"), "updating notification settings");
  assert.equal(normalizeFlowSearchQuery("notification settings"), "updating notification settings");
  assert.equal(normalizeFlowSearchQuery("add a payment method during checkout"), "adding a payment method");
  assert.equal(normalizeFlowSearchQuery("payment method"), "adding a payment method");
  assert.equal(normalizeFlowSearchQuery("invite teammates by email and assign roles"), "invite team members");
  assert.equal(normalizeFlowSearchQuery("onboarding with personalization questions"), "personalizing onboarding");
  assert.equal(normalizeFlowSearchQuery("personalised onboarding"), "personalizing onboarding");
  assert.equal(normalizeFlowSearchQuery("change language in account settings"), "changing language");
  assert.equal(normalizeFlowSearchQuery("switch the app language"), "changing language");
  assert.equal(normalizeFlowSearchQuery("upload a profile photo and crop it"), "uploading a profile photo");
  assert.equal(normalizeFlowSearchQuery("change my profile picture"), "uploading a profile photo");
  assert.equal(normalizeFlowSearchQuery("checkout flow"), "checkout");
  assert.equal(normalizeFlowSearchQuery("invite team members"), "invite team members");
  assert.equal(normalizeFlowSearchQuery("flow"), "flow");

  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "logging in",
    limit: 5,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const queries: string[] = [];
  await searchAccessibleFlows(adminUser, {
    ...deps,
    publishedFlowCatalogPage: async (input) => {
      queries.push(input.query ?? "");
      return { ...page, nextCursor: null };
    },
  }, {
    query: "login flow",
    limit: 3,
  });
  assert.deepEqual(queries, ["logging in", "logging in", "logging in"]);
});

test("Flow MCP broadens personalized onboarding after preserving its specific matches", async () => {
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "personalizing onboarding",
    limit: 3,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const queries: string[] = [];
  const results = await searchAccessibleFlows(proUser, {
    ...deps,
    publishedFlowCatalogPage: async (input) => {
      queries.push(input.query ?? "");
      const titles = input.query === "personalizing onboarding"
        ? ["Personalizing trial"]
        : ["Personalizing feeds", "Personalizing profile"];
      return {
        ...page,
        items: titles.map((title, index) => ({
          ...page.items[0]!,
          title,
          preview: {
            ...page.items[0]!.preview,
            appId: `${input.query === "personalizing onboarding" ? "specific" : "broad"}-${index}`,
            sourceFlowId: `${input.query === "personalizing onboarding" ? "specific" : "broad"}-${index}`,
            flow: {
              ...page.items[0]!.preview.flow,
              id: `${input.query === "personalizing onboarding" ? "specific" : "broad"}-${index}`,
              title,
            },
          },
        })),
        nextCursor: null,
      };
    },
  }, {
    query: "onboarding with personalization questions",
    platform: "web",
    limit: 3,
  });

  assert.deepEqual(results.map(({ title }) => title), [
    "Personalizing trial",
    "Personalizing feeds",
    "Personalizing profile",
  ]);
  assert.deepEqual(queries, ["personalizing onboarding", "personalizing"]);
});

test("Flow MCP hides source-specific IDs and accepts both public and legacy IDs", async () => {
  const internalFlowId = "mobbin-flow-68c35291-9004-4f43-8fa4-0c1cd625151f";
  const publicId = "flow-68c35291-9004-4f43-8fa4-0c1cd625151f";
  const imported = { ...onboarding, id: internalFlowId };
  const deps = dependencies();
  const page = await deps.publishedFlowCatalogPage({
    platform: "web",
    query: "checkout",
    limit: 5,
    sort: "grouped",
    flowGroups: [],
    cursorSecret: deps.flowCatalogSecret,
    includeFacets: false,
  });
  const importedDeps: FlowMcpDependencies = {
    ...deps,
    getVersionFlows: async () => [imported],
    publishedFlowCatalogPage: async () => ({
      ...page,
      items: page.items.map((item) => ({
        ...item,
        preview: {
          ...item.preview,
          sourceFlowId: internalFlowId,
          flow: { ...item.preview.flow, id: "linear:71" },
        },
      })),
    }),
  };

  const search = await searchAccessibleFlows(proUser, importedDeps, {
    query: "checkout",
    platform: "web",
    limit: 5,
  });
  assert.equal(search[0]?.flowId, publicId);
  assert.match(search[0]?.url ?? "", new RegExp(`flow=${publicId}$`));

  for (const flowId of [publicId, internalFlowId]) {
    const result = await getAccessibleFlow(proUser, importedDeps, {
      app: "linear",
      platform: "web",
      flowId,
    });
    assert.equal(result?.flowId, publicId);
    assert.match(String(result?.url), new RegExp(`flow=${publicId}$`));
    assert.doesNotMatch(JSON.stringify(result), /mobbin/i);
  }
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
    params: { name: "search_flows", arguments: { query: "login flow", platform: "web" } },
  });
  assert.equal(search.status, 200);
  const result = await mcpMessage(search) as {
    result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  };
  assert.match(result.result.content[0]?.text ?? "", /invite-admins/);
  const searchPayload = JSON.parse(result.result.content[0]?.text ?? "{}") as {
    query?: string;
    effectiveQuery?: string;
    searchedPlatforms?: string[];
    resultCount?: number;
    flows?: Array<{ previewSteps?: string[] }>;
  };
  assert.equal(searchPayload.query, "login flow");
  assert.equal(searchPayload.effectiveQuery, "logging in");
  assert.deepEqual(searchPayload.searchedPlatforms, ["web"]);
  assert.equal(searchPayload.resultCount, 1);
  assert.deepEqual(searchPayload.flows?.[0]?.previewSteps, ["Choose administrator permissions"]);
  assert.deepEqual(result.result.content.slice(1), [
    { type: "text", text: "Top Flow preview 1: Invite workspace administrators — linear (web) — Choose administrator permissions" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);
  const screenSearch = await request({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "search_screens", arguments: { query: "administrator permissions screen", platform: "web" } },
  });
  assert.equal(screenSearch.status, 200);
  const screenSearchResult = await mcpMessage(screenSearch) as {
    result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };
  };
  assert.match(screenSearchResult.result.content[0]?.text ?? "", /Assign administrator permissions/);
  assert.doesNotMatch(screenSearchResult.result.content[0]?.text ?? "", /Manage members/);
  assert.deepEqual(screenSearchResult.result.content.slice(1), [
    { type: "text", text: "Screen result 1: Assign administrator permissions. — Linear (web)" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);
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
  assert.deepEqual(detailResult.result.content.slice(1), [
    { type: "text", text: "Screen capture: Choose administrator permissions" },
    { type: "image", data: "dGVzdC1jYXB0dXJl", mimeType: "image/jpeg" },
  ]);
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
    { action: "mcp-search_screens", outcome: "success" },
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
