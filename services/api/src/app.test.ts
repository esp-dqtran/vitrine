import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { createApiApp, createCrawlRepairRequester } from "./app.ts";
import type { ObjectMetadata, ObjectStore } from "../../../src/objectStore.ts";
import type { CatalogSearchResult } from "../../../src/catalogResearch.ts";
import type { JobRow, JobStatus } from "../../../src/db.ts";
import type { ReferralCampaign } from "../../../src/referralStore.ts";
import type { ProgressSnapshot } from "../../../src/progress.ts";
import type { PublicFacetInput } from "../../../src/publicFacetPreview.ts";
import {
  CatalogCursorError,
  encodeUpdatedCatalogCursor,
} from "../../../src/catalogCursor.ts";
import { buildPublishedCatalogPage } from "../../../src/gallery.ts";

const admin = { id: 1, email: "admin@example.com", role: "admin" as const };
const user = { id: 2, email: "user@example.com", role: "user" as const };
const freeEntitlements = {
  plan: "free" as const,
  entitlementSource: "free" as const,
  promotionExpiresAt: null,
  subscription: null,
  freeUnlocks: [] as string[],
  freeUnlocksRemaining: 3,
  exportUsage: { used: 0, limit: 20 as const, resetAt: null },
};
const proEntitlements = { ...freeEntitlements, plan: "pro" as const, entitlementSource: "paid" as const };
const referralCampaign = {
  id: "launch-2026",
  startsAt: new Date("2026-07-21T00:00:00Z"),
  endsAt: new Date("2026-10-19T00:00:00Z"),
  rewardCap: 3 as const,
};
const publishedVersion = { id: 1, app: "linear", platform: "web", version_number: 1, label: "v1", source_url: null, provider: "m" as const, status: "published" as const, notes: "", captured_at: "2026-07-10T00:00:00.000Z", submitted_at: null, published_at: "2026-07-10T01:00:00.000Z", screen_count: 1, analyzed_count: 1, component_count: 1, token_count: 1, flow_count: 0 };
const adminAuth = { authorization: "Bearer admin" };
const previewSha256 = createHash("sha256").update("image").digest("hex");
const previewMetadata: ObjectMetadata = {
  key: `images/7/${previewSha256}.webp`, sha256: previewSha256, byteSize: 5,
  contentType: "image/webp", accessClass: "public-preview",
};
const failureBody = Buffer.from("real-png-evidence");
const failureSha256 = createHash("sha256").update(failureBody).digest("hex");
const failureMetadata: ObjectMetadata = {
  key: `crawl-failures/21/62726f7773652d70726f6475637473/6f70656e2d736f667477617265/${failureSha256}.png`,
  sha256: failureSha256,
  byteSize: failureBody.byteLength,
  contentType: "image/png",
  accessClass: "internal",
};
const localObjectStore: ObjectStore = {
  put: async () => { throw new Error("unused"); },
  head: async () => previewMetadata,
  get: async () => ({ metadata: previewMetadata, body: Buffer.from("image") }),
  signedGetUrl: async () => undefined,
  async *list() { yield previewMetadata; },
  delete: async () => false,
};
const catalogImages = [
  {
    id: 7,
    app: "linear",
    platform: "web",
    image_url: "mobbin-bulk:0123456789abcdef",
    description: "Toolbar",
  },
];
const productivityCategory = {
  id: 1,
  name: "Productivity",
  slug: "productivity",
};
const catalogPageRecord = {
  apps: [{
    app_id: 1,
    app: "linear",
    display_name: "Linear",
    categories: [productivityCategory],
    website_url: "https://linear.app",
    icon_url: null,
    accent_color: "#5E6AD2",
    total_screens: 1,
    available_platforms: ["web"],
    last_captured_at: "2026-07-25T00:00:00.000Z",
  }],
  previews: [{ ...catalogImages[0], preview_rank: 1 }],
  nextCursor: null,
};

function jobRecord(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 1,
    parent_id: null,
    type: "import-app",
    payload: {},
    status: "queued",
    message: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function crawlPlan(revision = 1, reviewed = false) {
  return {
    app: "atlassian",
    revision,
    startUrl: "https://www.atlassian.com/",
    domain: "Team collaboration and developer tools.",
    sources: ["https://www.atlassian.com/software/jira"],
    reviewed,
    flows: [{
      id: "browse-products",
      title: "Browse products",
      description: "Open Jira from the catalog.",
      safe: true,
      requiredSecrets: [],
      steps: [{
        id: "open-software",
        action: "goto",
        url: "/software",
        safety: "read",
        expected: {
          state: "Software catalog",
          url: "https://www.atlassian.com/software",
          visible: { text: "Explore Atlassian products" },
        },
      }],
    }],
  };
}

function crawlPlanWithSecret() {
  const plan = crawlPlan();
  plan.flows.push({
    id: "signup",
    title: "Start signup",
    description: "Enter a disposable test email without submitting.",
    safe: false,
    requiredSecrets: ["ATLASSIAN_TEST_EMAIL"],
    steps: [{
      id: "enter-email",
      action: "fill",
      role: "textbox",
      name: "Email",
      value: "$ATLASSIAN_TEST_EMAIL",
      safety: "read",
      expected: { state: "Email entered", visible: { role: "textbox", name: "Email" } },
    }],
  } as never);
  return plan;
}

function crawlRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "21",
    app_id: 4,
    app: "atlassian",
    version_id: 8,
    plan_id: "11",
    run_kind: "planned",
    parent_run_id: null,
    platform: "web",
    allow_all: false,
    pause_requested_at: null,
    job_id: null,
    status: "queued",
    current_flow_id: null,
    current_step_id: null,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    cancel_requested_at: null,
    retry_of_run_id: null,
    retry_mode: "all",
    environment: {
      headless: true,
      browserName: "chromium",
      requestedFlowIds: [],
      unsafeApproved: false,
      disposableAccountAcknowledged: false,
      allowSideEffects: false,
    },
    worker_id: null,
    heartbeat_at: null,
    created_at: "2026-07-12T00:00:00.000Z",
    started_at: null,
    finished_at: null,
    updated_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

test("uses the repository's free host API port", async () => {
  const appModule = await import("./app.ts");
  assert.equal((appModule as { DEFAULT_API_PORT?: number }).DEFAULT_API_PORT, 3010);
});

test("App Knowledge availability comes from its browser provider config", () => {
  const source = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
  assert.match(source, /appKnowledgeProviderModelFromEnvironment/);
  assert.doesNotMatch(
    source.match(/appKnowledgeProviderModel:[^\n]+/)?.[0] ?? "",
    /RESEARCH_LLM_MODEL/,
  );
});

test("mounts scoped App Knowledge generation after session and admin authorization", async () => {
  const published: unknown[] = [];
  const created = {
    id: 44,
    snapshotId: 45,
    transportJobId: 91,
    requestedBy: admin.id,
    status: "queued" as const,
    stage: "preparing" as const,
    doneCount: 0,
    totalCount: 0,
    cacheHitCount: 0,
    failedCount: 0,
    providerModel: "vision-model",
    promptVersion: 1,
    cancelRequested: false,
    retryFailedOnly: false,
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
  const api = createApiApp({
    verifyAuthToken: async (token) => token === "admin" ? admin : token === "user" ? user : undefined,
    canAccessApp: async () => true,
    resolveAppVersion: async () => ({
      ...publishedVersion,
      app_id: 3,
      platform_id: 5,
      id: 7,
      version_number: 2,
    }),
    createJob: async () => 91,
    publishJob: async (job) => { published.push(job); },
    recordAccessEvent: async () => {},
    appKnowledgeStore: {
      createJob: async () => created,
    } as never,
    appKnowledgeProviderModel: "vision-model",
    appKnowledgePromptVersion: 1,
  });
  const { base, server } = await serve(api);
  try {
    const request = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app: "linear", platform: "web", version: 2 }),
    };
    assert.equal((await fetch(`${base}/app-knowledge/jobs`, request)).status, 401);
    assert.equal((await fetch(`${base}/app-knowledge/jobs`, {
      ...request,
      headers: { ...request.headers, authorization: "Bearer user" },
    })).status, 403);
    const response = await fetch(`${base}/app-knowledge/jobs`, {
      ...request,
      headers: { ...request.headers, authorization: "Bearer admin" },
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json() as { id: number }).id, 44);
    assert.deepEqual(published, [{
      type: "generate-app-knowledge",
      runId: "44",
      jobId: 91,
    }]);
  } finally {
    await close(server);
  }
});

async function serve(app: ReturnType<typeof createApiApp>): Promise<{ base: string; server: Server }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("serves a sitemap from one App identity query without invalid slugs", async () => {
  let appSlugQueries = 0;
  const { base, server } = await serve(createApiApp({
    publishedCatalogAppSlugs: async () => {
      appSlugQueries += 1;
      return ["figma", "linear"];
    },
    sitesStore: {
      listReadySites: async () => [],
    } as never,
  }));
  try {
    const response = await fetch(`${base}/seo/sitemap.xml`);
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.equal(appSlugQueries, 1);
    assert.match(xml, /<loc>https:\/\/vitrines\.ai\/browse\/figma<\/loc>/);
    assert.match(xml, /<loc>https:\/\/vitrines\.ai\/browse\/linear<\/loc>/);
    assert.doesNotMatch(xml, /\/undefined/);
  } finally {
    await close(server);
  }
});

async function readSseUntil(reader: ReadableStreamDefaultReader<Uint8Array>, pattern: RegExp): Promise<string> {
  let output = "";
  const deadline = Date.now() + 2_000;
  while (!pattern.test(output)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Timed out waiting for SSE pattern ${pattern}`);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out reading SSE stream")), remaining);
      }),
    ]).finally(() => clearTimeout(timeout));
    if (result.done) throw new Error("SSE stream closed before the expected event");
    output += new TextDecoder().decode(result.value);
  }
  return output;
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("serves real catalog stats publicly, without a session", async (t) => {
  const { base, server } = await serve(createApiApp({
    catalogStats: async () => ({ apps: 512, screens: 137412, uiElements: 647 }),
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/stats`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { apps: 512, screens: 137412, uiElements: 647 });
});

test("serves a bounded public app evidence preview and records the view", async (t) => {
  const events: Array<{ userId?: number; action: string; appSlug?: string }> = [];
  let uiElementInput: unknown;
  let flowInput: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    publishedAppPreviewMetadata: async (app) => {
      assert.equal(app, "linear");
      return {
        app: "linear", display_name: "Linear", icon_url: null,
        categories: [productivityCategory], total_screens: 443, total_ui_elements: 18,
        total_flows: 12, analyzed_screens: 401, last_captured_at: "2026-07-25T00:00:00.000Z",
        available_platforms: ["web"],
      };
    },
    publishedPreviewImages: async (app) => {
      assert.equal(app, "linear");
      return catalogPageRecord.previews;
    },
    appUiElementSummary: async (input) => {
      uiElementInput = input;
      return {
        totalOccurrences: 18,
        totalTypes: 4,
        items: [{
          component_type: "Top Navigation Bar",
          component_group: "Navigation",
          occurrence_count: 9,
          image_id: 8,
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Primary navigation",
          purpose: "Navigate",
          visible_states: ["Default"],
        }],
      };
    },
    publishedAppPreviewFlows: async (...input) => {
      flowInput = input;
      return [{
        version_id: 11,
        version_flow_id: 22,
        source_flow_id: "onboarding",
        title: "Onboarding",
        description: "Create a workspace",
        steps: [
          { label: "Start", evidence: [7] },
          { label: "Finish", evidence: [8] },
        ],
      }];
    },
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/linear/preview`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.app.totalScreens, 443);
  assert.equal(body.app.totalUiElements, 18);
  assert.equal(body.app.totalFlows, 12);
  assert.equal(body.previewScreens.length, 1);
  assert.deepEqual(uiElementInput, {
    app: "linear",
    platform: "web",
    publishedOnly: true,
    limit: 3,
  });
  assert.deepEqual(flowInput, ["linear", "web"]);
  assert.deepEqual(body.previewUiElements, [{
    type: "Top Navigation Bar",
    group: "Navigation",
    count: 9,
    thumbnailUrl: "/api/apps/facet-media/linear/elements/Top%20Navigation%20Bar/web/1",
  }]);
  assert.deepEqual(body.previewFlows, [{
    id: "onboarding",
    title: "Onboarding",
    description: "Create a workspace",
    platform: "web",
    stepCount: 2,
    screens: [{
      label: "Start",
      imageUrl: "/api/flows/media/linear/web/11/22/1?variant=full",
      thumbnailUrl: "/api/flows/media/linear/web/11/22/1?variant=thumb",
    }, {
      label: "Finish",
      imageUrl: "/api/flows/media/linear/web/11/22/2?variant=full",
      thumbnailUrl: "/api/flows/media/linear/web/11/22/2?variant=thumb",
    }],
  }]);
  assert.equal(response.headers.get("cache-control"), "private, max-age=60, stale-while-revalidate=300");
  assert.deepEqual(events, [{
    ipPrefix: "127.0.0.0/24",
    appSlug: "linear",
    featureKey: "library",
    action: "preview_viewed",
    outcome: "success",
  }]);
});

test("serves ordered published Categories publicly", async (t) => {
  const categories = [
    { id: 2, name: "Business", slug: "business", appCount: 127 },
    { id: 7, name: "Productivity", slug: "productivity", appCount: 101 },
  ];
  const { base, server } = await serve(createApiApp({
    categoryStore: {
      listPublished: async () => categories,
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/categories`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(await response.json(), { categories });
});

test("serves the Flow taxonomy publicly and keeps classification review admin-only", async (t) => {
  const categories = [{
    id: 1,
    slug: "authentication",
    name: "Authentication",
    position: 1,
    approvedFlowCount: 3,
    types: [{ id: 7, slug: "password-reset", name: "Password reset", position: 5 }],
  }];
  const reviewItems = [{
    flowId: 9,
    title: "Reset password",
    currentCategory: "Account",
    appFlowCount: 38,
    appCount: 14,
    classification: null,
  }];
  const saved = {
    flowId: 9,
    type: {
      id: 7,
      slug: "password-reset",
      name: "Password reset",
      position: 5,
      category: { id: 1, slug: "authentication", name: "Authentication", position: 1 },
    },
    status: "approved",
    confidence: 0.9,
    source: "manual",
    reviewedByUserId: admin.id,
    reviewedAt: "2026-08-17T10:00:00.000Z",
  };
  const saves: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async (token: string) => token === "admin" ? admin : token === "user" ? user : undefined,
    flowTaxonomyStore: {
      listPublished: async () => categories,
      listReviewQueue: async () => reviewItems,
      saveClassification: async (input: unknown) => {
        saves.push(input);
        return saved;
      },
    },
  } as never));
  t.after(() => close(server));

  const taxonomy = await fetch(`${base}/flow-taxonomy`);
  assert.equal(taxonomy.status, 200);
  assert.equal(taxonomy.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(await taxonomy.json(), { categories });
  assert.equal((await fetch(`${base}/admin/flow-classifications`, {
    headers: { authorization: "Bearer user" },
  })).status, 403);

  const queue = await fetch(`${base}/admin/flow-classifications?limit=20`, { headers: adminAuth });
  assert.equal(queue.status, 200);
  assert.deepEqual(await queue.json(), { items: reviewItems });
  const response = await fetch(`${base}/admin/flow-classifications/9`, {
    method: "PUT",
    headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify({ flowTypeId: 7, status: "approved", confidence: 0.9 }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { classification: saved });
  assert.deepEqual(saves, [{
    flowId: 9,
    flowTypeId: 7,
    status: "approved",
    confidence: 0.9,
    source: "manual",
    reviewedByUserId: admin.id,
  }]);
});

test("serves the exact canonical Flow discovery envelope", async (t) => {
  const inputs: unknown[] = [];
  const facets = [{ group: "flowCategories", value: "account-settings", count: 12 }];
  const { base, server } = await serve(createApiApp({
    publishedFlowCatalogPage: async (input: unknown) => {
      inputs.push(input);
      return {
        items: [{
          category: "Account Management",
          type: "Edit profile",
          title: "Editing Profile",
          count: 1081,
        }],
        nextCursor: "next",
        totalCount: 27,
        facets,
      };
    },
    mediaSigningSecret: "flow-route-secret-0123456789abcdef",
    verifyAuthToken: async () => admin,
  } as never));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/flows?platform=web&query=profile&sort=grouped`
      + `&filter=flowCategories.account-settings&filter=flowTypes.account-settings%2Fedit-profile&limit=40`,
    { headers: adminAuth },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{
      category: "Account Management",
      type: "Edit profile",
      title: "Editing Profile",
      count: 1081,
    }],
    nextCursor: "next",
    totalCount: 27,
    facets,
  });
  assert.deepEqual(inputs, [{
    platform: "web",
    cursor: undefined,
    limit: 40,
    query: "profile",
    sort: "grouped",
    flowCategories: ["account-settings"],
    flowTypes: ["account-settings/edit-profile"],
    cursorSecret: "flow-route-secret-0123456789abcdef",
  }]);
});

test("limits free Flow catalog requests to twelve records", async (t) => {
  const inputs: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async (token: string) => token === "free" ? user : undefined,
    getAccountEntitlements: async () => freeEntitlements,
    publishedFlowCatalogPage: async (input: unknown) => {
      inputs.push(input);
      return { items: [], nextCursor: "next", totalCount: 100, facets: [] };
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/flows?platform=web&limit=40`, {
    headers: { authorization: "Bearer free" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [],
    nextCursor: null,
    totalCount: 12,
    facets: [],
  });
  assert.equal((inputs[0] as { limit: number }).limit, 12);
});

test("uses Typesense for full-text Flow search", async (t) => {
  const calls: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    typesenseFlowCatalog: {
      search: async (input: unknown) => {
        calls.push(input);
        return { items: [], nextPage: 2, totalCount: 19, facets: [{ group: "flowCategories", value: "account-settings", count: 19 }] };
      },
    },
    publishedFlowCatalogPage: async () => {
      throw new Error("PostgreSQL Flow search should not run");
    },
    verifyAuthToken: async () => admin,
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/flows/search?platform=web&query=open%20profile&filter=flowCategories.account-settings&limit=20`, { headers: adminAuth });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("server-timing")?.startsWith("typesense-flow;dur="), true);
  assert.deepEqual(await response.json(), {
    items: [], nextCursor: "typesense-flow:2", totalCount: 19,
    facets: [{ group: "flowCategories", value: "account-settings", count: 19 }],
  });
  assert.deepEqual(calls, [{
    query: "open profile", platform: "web", flowCategories: ["account-settings"], flowTypes: [], page: 1, limit: 20,
  }]);
});

test("normalizes legacy Flow views to category/title order and rejects invalid queries", async (t) => {
  const inputs: unknown[] = [];
  let calls = 0;
  const { base, server } = await serve(createApiApp({
    publishedFlowCatalogPage: async (input: unknown) => {
      calls += 1;
      inputs.push(input);
      return { items: [], nextCursor: null, totalCount: 0, facets: [] };
    },
    mediaSigningSecret: "flow-route-secret-0123456789abcdef",
  } as never));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/flows?platform=web&view=browse`)).status, 200);
  assert.equal((await fetch(`${base}/flows?platform=web&view=grouped`)).status, 200);
  assert.equal((inputs[0] as { sort: string }).sort, "grouped");
  assert.equal((inputs[1] as { sort: string }).sort, "grouped");

  const invalid = [
    "platform=desktop",
    `platform=web&query=${"x".repeat(121)}`,
    "platform=web&view=unknown",
    "platform=web&sort=latest",
    "platform=web&sort=popular&view=browse",
    "platform=web&filter=flows.Onboarding",
    "platform=web&filter=flowGroups.",
    `platform=web&filter=${Array.from({ length: 41 }, (_, index) => `flowGroups.G${index}`).join("&filter=")}`,
    "platform=web&limit=101",
    "platform=web&limit=1.5",
  ];
  for (const query of invalid) {
    assert.equal((await fetch(`${base}/flows?${query}`)).status, 400);
  }
  assert.equal(calls, 2);
});

test("keeps the progress stream admin-only without opening a subscription", async (t) => {
  let subscriptions = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    readProgress: () => ({ entries: [] }),
    subscribeProgress: () => {
      subscriptions++;
      return () => undefined;
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/progress/stream`, { headers: { authorization: "Bearer user" } });
  assert.equal(response.status, 403);
  assert.equal(subscriptions, 0);
});

test("progress stream sends complete snapshots and cleans up its subscription", async (t) => {
  const initial: ProgressSnapshot = {
    entries: [{ id: "worker:1", stage: "crawl", app: "linear", done: 1, total: 4, status: "running", updatedAt: "2026-07-19T00:00:00.000Z" }],
  };
  let listener: ((snapshot: ProgressSnapshot) => void) | undefined;
  let unsubscribeCalls = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    readProgress: () => initial,
    subscribeProgress: (next: (snapshot: ProgressSnapshot) => void) => {
      listener = next;
      return () => { unsubscribeCalls++; };
    },
  } as never));
  t.after(() => close(server));
  const controller = new AbortController();

  const response = await fetch(`${base}/progress/stream`, {
    headers: adminAuth,
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = response.body!.getReader();
  const first = await readSseUntil(reader, /"app":"linear"/);
  assert.match(first, /event: progress/);

  listener?.({
    entries: [{ ...initial.entries[0], app: "notion", done: 2 }],
  });
  const second = await readSseUntil(reader, /"app":"notion"/);
  assert.match(second, /event: progress/);

  controller.abort();
  await waitForCondition(() => unsubscribeCalls === 1);
});

test("keeps every crawl administration route admin-only before dependencies run", async (t) => {
  let dependencyCalls = 0;
  const touched = async () => {
    dependencyCalls++;
    return undefined as never;
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    createJob: touched,
    publishJob: touched,
    listCrawlPlans: touched,
    getCrawlPlan: touched,
    saveCrawlPlan: touched,
    approveCrawlPlan: touched,
    createCrawlRun: touched,
    listCrawlRuns: touched,
    getCrawlRun: touched,
    listCrawlRunSteps: touched,
    listCrawlRunEvidence: touched,
    listCrawlRunRepairs: touched,
    cancelCrawlRun: touched,
    retryCrawlRun: touched,
    markQueuedCrawlRunInterrupted: touched,
    requestCrawlRepair: touched,
    applyCrawlRepair: touched,
    rejectCrawlRepair: touched,
  } as never));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };
  const cases = [
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://www.atlassian.com" }],
    ["GET", "/crawl/apps/atlassian/plans"],
    ["GET", "/crawl/plans/11"],
    ["PUT", "/crawl/plans/11", crawlPlan(2)],
    ["POST", "/crawl/plans/11/approve"],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "full" }],
    ["GET", "/crawl/apps/atlassian/runs"],
    ["GET", "/crawl/runs/21"],
    ["POST", "/crawl/runs/21/cancel"],
    ["POST", "/crawl/runs/21/retry", { mode: "failed" }],
    ["GET", "/crawl/runs/21/failures/browse-products/open-software/screenshot"],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software" }],
    ["POST", "/crawl/repairs/31/apply"],
    ["POST", "/crawl/repairs/31/reject"],
  ] as const;
  for (const [method, path, body] of cases) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
  assert.equal(dependencyCalls, 0);
});

test("creates and inspects an admin-only autonomous crawl without exposing session ciphertext", async (t) => {
  const createdInputs: unknown[] = [];
  const published: unknown[] = [];
  const detail = {
    run: crawlRun({
      id: "42", app: "linear", plan_id: null, run_kind: "autonomous", allow_all: true,
      environment: { homepageUrl: "https://app.test/", provider: "chatgpt", requiredSecrets: ["APP_TEST_EMAIL"] },
    }),
    missions: [], states: [], transitions: [],
  };
  const makeApp = (currentUser: typeof admin | typeof user) => createApiApp({
    verifyAuthToken: async () => currentUser,
    ensureActiveAppVersion: async () => ({ id: 8 }),
    createAutonomousRun: async (input: unknown) => { createdInputs.push(input); return detail.run as never; },
    getAutonomousRun: async () => detail as never,
    publishJob: async (job: unknown) => { published.push(job); },
  } as never);
  const deniedServer = await serve(makeApp(user));
  const adminServer = await serve(makeApp(admin));
  t.after(() => Promise.all([close(deniedServer.server), close(adminServer.server)]).then(() => undefined));
  const body = {
    homepageUrl: "https://app.test",
    platform: "web",
    provider: "chatgpt",
    requiredSecrets: ["APP_TEST_EMAIL"],
    allowAll: true,
    allowAllAcknowledged: true,
    ceilings: { runtimeMinutes: 120, actions: 500, modelRequests: 50, storageBytes: 100_000_000 },
    agentConcurrency: 3,
  };
  const denied = await fetch(`${deniedServer.base}/crawl/apps/linear/autonomous-runs`, {
    method: "POST", headers: { authorization: "Bearer user", "content-type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(denied.status, 403);
  const created = await fetch(`${adminServer.base}/crawl/apps/linear/autonomous-runs`, {
    method: "POST", headers: { ...adminAuth, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(created.status, 202);
  const view = await created.json();
  assert.equal(view.allow_all, true);
  assert.equal(JSON.stringify(view).includes("encrypted_storage_state"), false);
  assert.equal(createdInputs.length, 1);
  assert.deepEqual(published, [{ type: "autonomous-crawl-app", name: "linear", runId: "42" }]);

  const inspected = await fetch(`${adminServer.base}/crawl/autonomous-runs/42`, { headers: adminAuth });
  assert.equal(inspected.status, 200);
  assert.equal(JSON.stringify(await inspected.json()).includes("encrypted_storage_state"), false);
});

test("creates Stage 1 App information without starting a crawl", async (t) => {
  const calls: unknown[] = [];
  const ingest = async (input: unknown) => {
    calls.push(input);
    return {
      id: 81,
      app: "linear",
      displayName: "Linear",
      description: "Linear is a product development platform for teams that plan and build software.",
      websiteUrl: "https://linear.app/",
      iconUrl: "/assets/apps/81/icon.webp",
      categories: [{ id: 7, name: "Developer Tools", slug: "developer-tools" }],
      categoryAnalysis: { rationale: "Software product development tooling.", provider: "test" },
      created: true,
      complete: true,
      issues: [],
    };
  };
  const deniedServer = await serve(createApiApp({
    verifyAuthToken: async () => user,
    objectStore: localObjectStore,
    ingestAppMetadata: ingest as never,
  }));
  const adminServer = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore: localObjectStore,
    ingestAppMetadata: ingest as never,
  }));
  t.after(() => Promise.all([close(deniedServer.server), close(adminServer.server)]).then(() => undefined));

  const request = { homepageUrl: "https://linear.app" };
  const denied = await fetch(`${deniedServer.base}/crawl/apps/linear/metadata`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  assert.equal(denied.status, 403);

  const created = await fetch(`${adminServer.base}/crawl/apps/linear/metadata`, {
    method: "POST",
    headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).complete, true);
  assert.deepEqual(calls, [{ app: "linear", sourceUrl: "https://linear.app/" }]);
});

test("rejects unsafe autonomous inputs before creating a parent run", async (t) => {
  let creates = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    ensureActiveAppVersion: async () => ({ id: 8 }),
    createAutonomousRun: async () => { creates++; return crawlRun() as never; },
  } as never));
  t.after(() => close(server));
  const valid = {
    homepageUrl: "https://app.test", platform: "web", provider: "chatgpt", requiredSecrets: [],
    allowAll: true, allowAllAcknowledged: true,
    ceilings: { runtimeMinutes: 60, actions: 100, modelRequests: 20, storageBytes: 1_000_000 }, agentConcurrency: 3,
  };
  for (const body of [
    { ...valid, homepageUrl: "http://127.0.0.1" },
    { ...valid, allowAllAcknowledged: false },
    { ...valid, password: "secret" },
    { ...valid, ceilings: { ...valid.ceilings, actions: 0 } },
    { ...valid, agentConcurrency: 9 },
    { ...valid, requiredSecrets: ["secret-value@example.com"] },
    { ...valid, platform: "ios" },
  ]) {
    const response = await fetch(`${base}/crawl/apps/linear/autonomous-runs`, {
      method: "POST", headers: { ...adminAuth, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(creates, 0);
});

test("encrypts shared crawl sessions and returns metadata only", async (t) => {
  let encrypted = "";
  const session = { id: "5", app_id: 4, encrypted_storage_state: "", state_version: 2, updated_by: admin.id, updated_at: new Date("2026-07-16T00:00:00Z") };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    crawlSessionEncryptionKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    saveCrawlAccountSession: async (_app: string, value: string) => { encrypted = value; return { ...session, encrypted_storage_state: value } as never; },
    getCrawlAccountSession: async () => ({ ...session, encrypted_storage_state: encrypted }) as never,
  } as never));
  t.after(() => close(server));
  const storageState = { cookies: [{ name: "session", value: "secret", domain: "app.test", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }], origins: [] };
  const saved = await fetch(`${base}/crawl/apps/linear/session`, {
    method: "PUT", headers: { ...adminAuth, "content-type": "application/json" }, body: JSON.stringify({ storageState }),
  });
  assert.equal(saved.status, 200);
  assert.doesNotMatch(encrypted, /secret/);
  assert.equal(JSON.stringify(await saved.json()).includes("encrypted_storage_state"), false);
  const viewed = await fetch(`${base}/crawl/apps/linear/session`, { headers: adminAuth });
  assert.equal(viewed.status, 200);
  assert.equal(JSON.stringify(await viewed.json()).includes("encrypted_storage_state"), false);
});

test("validates crawl slugs, public URLs, plans, modes, ids, and repair requests", async (t) => {
  let dependencyCalls = 0;
  const touched = async () => {
    dependencyCalls++;
    return undefined as never;
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    createJob: touched,
    listCrawlPlans: touched,
    getCrawlPlan: touched,
    saveCrawlPlan: touched,
    createCrawlRun: touched,
    listCrawlRuns: touched,
    getCrawlRun: touched,
    cancelCrawlRun: touched,
    retryCrawlRun: touched,
    requestCrawlRepair: touched,
    applyCrawlRepair: touched,
    rejectCrawlRepair: touched,
  } as never));
  t.after(() => close(server));
  const headers = { ...adminAuth, "content-type": "application/json" };
  const cases = [
    ["POST", "/crawl/apps/not%20safe/research", { homepageUrl: "https://example.com" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "http://127.0.0.1/private" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://user:password@example.com" }],
    ["POST", "/crawl/apps/atlassian/research", { homepageUrl: "https://example.com", provider: "gemini" }],
    ["GET", "/crawl/apps/not%20safe/plans"],
    ["GET", "/crawl/plans/0"],
    ["PUT", "/crawl/plans/11", {}],
    ["POST", "/crawl/plans/not-an-id/approve"],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "failed" }],
    ["POST", "/crawl/apps/atlassian/runs", { planId: 11, mode: "full" }],
    ["POST", "/crawl/apps/atlassian/runs", { planId: "11", mode: "full", unsafeApproved: "yes" }],
    ["GET", "/crawl/runs/9223372036854775808"],
    ["POST", "/crawl/runs/21/retry", { mode: "remaining" }],
    ["GET", "/crawl/runs/21/failures/not%20safe/open-software/screenshot"],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software", provider: "unknown" }],
    ["POST", "/crawl/runs/21/repairs", { flowId: "browse-products", stepId: "open-software", provider: "gemini" }],
    ["POST", "/crawl/repairs/not-an-id/apply"],
    ["POST", "/crawl/repairs/0/reject"],
  ] as const;
  for (const [method, path, body] of cases) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, 400, `${method} ${path}`);
  }
  assert.equal(dependencyCalls, 0);
});

test("enqueues research and supports immutable plan revision and approval", async (t) => {
  const plans = [{ id: "11", app: "atlassian", revision: 1, status: "draft", plan: crawlPlan() }];
  const published: unknown[] = [];
  const saved: unknown[] = [];
  const approvedBy: number[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    createJob: async (type: string, payload: Record<string, unknown>) => {
      assert.equal(type, "research-app");
      assert.deepEqual(payload, { name: "atlassian", homepageUrl: "https://www.atlassian.com/", provider: "claude" });
      return 41;
    },
    publishJob: async (job: unknown) => { published.push(job); },
    listCrawlPlans: async () => plans as never,
    getCrawlPlan: async () => plans[0] as never,
    saveCrawlPlan: async (plan: unknown, userId: number, metadata: Record<string, unknown>) => {
      saved.push({ plan, userId, metadata });
      return { id: "12", app: "atlassian", revision: 2, status: "draft", plan } as never;
    },
    approveCrawlPlan: async (_id: string, userId: number) => {
      approvedBy.push(userId);
      return { ...plans[0], status: "approved", plan: crawlPlan(1, true) } as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminAuth, "content-type": "application/json" };

  const research = await fetch(`${base}/crawl/apps/atlassian/research`, {
    method: "POST", headers, body: JSON.stringify({ homepageUrl: "https://www.atlassian.com", provider: "claude" }),
  });
  assert.equal(research.status, 202);
  assert.deepEqual(await research.json(), { jobId: 41, app: "atlassian", homepageUrl: "https://www.atlassian.com/" });
  assert.deepEqual(published, [{ type: "research-app", name: "atlassian", homepageUrl: "https://www.atlassian.com/", provider: "claude", jobId: 41 }]);

  assert.deepEqual(await (await fetch(`${base}/crawl/apps/atlassian/plans`, { headers })).json(), plans.map((plan) => ({ ...plan, requiredSecrets: [] })));
  assert.equal((await fetch(`${base}/crawl/plans/11`, { headers })).status, 200);
  const revised = await fetch(`${base}/crawl/plans/11`, {
    method: "PUT", headers, body: JSON.stringify(crawlPlan(2)),
  });
  assert.equal(revised.status, 201);
  assert.deepEqual(saved, [{ plan: crawlPlan(2), userId: admin.id, metadata: { sourcePlanId: "11" } }]);

  const approval = await fetch(`${base}/crawl/plans/11/approve`, { method: "POST", headers });
  assert.equal(approval.status, 200);
  assert.deepEqual(approvedBy, [admin.id]);
  assert.equal((await approval.json()).plan.reviewed, true);
});

test("reports required secret configuration without returning secret values", async (t) => {
  const secretValue = "curator-secret-must-never-leak@example.com";
  process.env.ATLASSIAN_TEST_EMAIL = secretValue;
  t.after(() => { delete process.env.ATLASSIAN_TEST_EMAIL; });
  const plan = { id: "11", app: "atlassian", revision: 1, status: "draft", plan: crawlPlanWithSecret() };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    getCrawlPlan: async () => plan as never,
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/plans/11`, { headers: adminAuth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.requiredSecrets, [{ name: "ATLASSIAN_TEST_EMAIL", configured: true }]);
  assert.equal(JSON.stringify(body).includes(secretValue), false);
});

test("persists crawl runs before transport, returns durable details, and controls retries", async (t) => {
  const createdInputs: unknown[] = [];
  const published: unknown[] = [];
  const cancelled: string[] = [];
  const retried: unknown[] = [];
  const queued = crawlRun();
  const failedStep = {
    run_id: "21",
    flow_id: "browse-products",
    step_id: "open-software",
    status: "failed",
    failure_screenshot: "data/crawl-failures/atlassian/21/failure.png",
    failure_object_key: failureMetadata.key,
    error_class: "SemanticStepError",
    error_message: "Expected software catalog",
  };
  const evidence = {
    id: "61",
    version_id: 8,
    plan_id: "11",
    image_id: 70,
    flow_id: "browse-products",
    step_id: "open-software",
    source_url: "https://www.atlassian.com/",
    final_url: "https://www.atlassian.com/software",
    state_label: "Software catalog",
    screenshot_hash: "a".repeat(64),
    viewport_width: 1440,
    viewport_height: 900,
    captured_at: "2026-07-12T00:00:00.000Z",
  };
  const repair = {
    id: "31",
    run_id: "21",
    flow_id: "browse-products",
    step_id: "open-software",
    status: "proposed",
    failure: { error: "Expected software catalog", screenshot: "/private/crawl/failure.png" },
    proposed_step: crawlPlan().flows[0].steps[0],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    createCrawlRun: async (input: unknown) => { createdInputs.push(input); return queued as never; },
    publishJob: async (job: unknown) => { published.push(job); },
    listCrawlRuns: async () => [queued] as never,
    getCrawlRun: async () => queued as never,
    listCrawlRunSteps: async () => [failedStep] as never,
    listCrawlRunEvidence: async () => [evidence] as never,
    listCrawlRunRepairs: async () => [repair] as never,
    cancelCrawlRun: async (runId: string) => { cancelled.push(runId); return crawlRun({ status: "cancelled" }) as never; },
    retryCrawlRun: async (runId: string, mode: "full" | "failed") => {
      retried.push({ runId, mode });
      return crawlRun({ id: "22", retry_of_run_id: runId, retry_mode: mode === "full" ? "all" : mode }) as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminAuth, "content-type": "application/json" };

  const started = await fetch(`${base}/crawl/apps/atlassian/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      planId: "11",
      mode: "full",
      unsafeApproved: false,
      disposableAccountAcknowledged: false,
      allowSideEffects: false,
      environment: { headless: true, browserName: "chromium", viewport: { width: 1440, height: 900 } },
    }),
  });
  assert.equal(started.status, 202, await started.clone().text());
  assert.deepEqual(createdInputs, [{
    app: "atlassian",
    planId: "11",
    unsafeApproved: false,
    disposableAccountAcknowledged: false,
    allowSideEffects: false,
    environment: { headless: true, browserName: "chromium", viewport: { width: 1440, height: 900 } },
    userId: admin.id,
  }]);
  assert.deepEqual(published, [{ type: "smart-crawl-app", name: "atlassian", runId: "21" }]);

  assert.equal((await fetch(`${base}/crawl/apps/atlassian/runs`, { headers })).status, 200);
  const detail = await (await fetch(`${base}/crawl/runs/21`, { headers })).json();
  assert.equal(detail.run.id, "21");
  assert.equal(detail.steps[0].failure_screenshot, undefined);
  assert.equal(detail.steps[0].failure_object_key, undefined);
  assert.equal(detail.steps[0].failureScreenshotUrl, "/api/crawl/runs/21/failures/browse-products/open-software/screenshot");
  assert.equal(detail.evidence[0].imageUrl, "/api/media/atlassian/aaaaaaaaaaaaaaaa");
  assert.equal(detail.repairs[0].failure.screenshot, undefined);
  assert.equal(JSON.stringify(detail).includes("/private/crawl/failure.png"), false);

  assert.equal((await fetch(`${base}/crawl/runs/21/cancel`, { method: "POST", headers })).status, 200);
  assert.deepEqual(cancelled, ["21"]);
  const retry = await fetch(`${base}/crawl/runs/21/retry`, {
    method: "POST", headers, body: JSON.stringify({ mode: "failed" }),
  });
  assert.equal(retry.status, 202);
  assert.deepEqual(retried, [{ runId: "21", mode: "failed" }]);
  assert.deepEqual(published.at(-1), { type: "smart-crawl-app", name: "atlassian", runId: "22" });
});

test("marks a persisted run interrupted and returns only safe IDs when publishing fails", async (t) => {
  const interrupted: string[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    createCrawlRun: async () => crawlRun() as never,
    publishJob: async () => { throw new Error("broker-password-must-not-leak"); },
    markQueuedCrawlRunInterrupted: async (runId: string) => {
      interrupted.push(runId);
      return crawlRun({ status: "interrupted" }) as never;
    },
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/apps/atlassian/runs`, {
    method: "POST",
    headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify({ planId: "11", mode: "full" }),
  });
  assert.equal(response.status, 503, await response.clone().text());
  const body = await response.json();
  assert.deepEqual(body, {
    error: "crawl transport unavailable",
    runId: "21",
    versionId: 8,
    planId: "11",
  });
  assert.deepEqual(interrupted, ["21"]);
  assert.equal(JSON.stringify(body).includes("broker-password"), false);
});

test("serves only the database-bound internal failure object for its exact flow and step", async (t) => {
  let lookup: unknown;
  const signedRequests: Array<{ key: string; expires: number }> = [];
  const objectStore: ObjectStore = {
    put: async () => { throw new Error("unused"); },
    head: async () => failureMetadata,
    get: async () => ({ metadata: failureMetadata, body: failureBody }),
    signedGetUrl: async (key, expires) => {
      signedRequests.push({ key, expires });
      return "http://minio:9000/astryx/internal-failure.png?signature=test";
    },
    async *list() { yield failureMetadata; },
    delete: async () => false,
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore,
    crawlFailureObject: async (input: unknown) => {
      lookup = input;
      return failureMetadata;
    },
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/runs/21/failures/browse-products/open-software/screenshot`, {
    headers: adminAuth,
    redirect: "manual",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), failureBody);
  assert.deepEqual(signedRequests, []);
  assert.deepEqual(lookup, { runId: "21", flowId: "browse-products", stepId: "open-software" });
});

test("keeps repair suggestion, apply, and reject as separate admin actions", async (t) => {
  const requests: unknown[] = [];
  const applies: unknown[] = [];
  const rejects: unknown[] = [];
  const proposed = {
    id: "31",
    run_id: "21",
    status: "proposed",
    failure: { error: "Expected software catalog", screenshot: "/private/crawl/failure.png" },
    proposed_step: crawlPlan().flows[0].steps[0],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    requestCrawlRepair: async (input: unknown) => { requests.push(input); return proposed as never; },
    applyCrawlRepair: async (id: string, userId: number) => {
      applies.push({ id, userId });
      return { ...proposed, status: "applied", applied_plan_id: "12" } as never;
    },
    rejectCrawlRepair: async (id: string, userId: number) => {
      rejects.push({ id, userId });
      return { ...proposed, status: "rejected" } as never;
    },
  } as never));
  t.after(() => close(server));
  const headers = { ...adminAuth, "content-type": "application/json" };
  const requested = await fetch(`${base}/crawl/runs/21/repairs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ flowId: "browse-products", stepId: "open-software", provider: "chatgpt" }),
  });
  assert.equal(requested.status, 201);
  const requestedBody = await requested.json();
  assert.equal(requestedBody.failure.error, "Expected software catalog");
  assert.equal(requestedBody.failure.screenshot, undefined);
  assert.equal(JSON.stringify(requestedBody).includes("/private/crawl/failure.png"), false);
  assert.deepEqual(requests, [{ runId: "21", flowId: "browse-products", stepId: "open-software", provider: "chatgpt" }]);
  assert.deepEqual(applies, []);
  assert.deepEqual(rejects, []);

  const applied = await fetch(`${base}/crawl/repairs/31/apply`, { method: "POST", headers });
  const rejected = await fetch(`${base}/crawl/repairs/31/reject`, { method: "POST", headers });
  assert.equal(applied.status, 200);
  assert.equal(rejected.status, 200);
  assert.equal((await applied.json()).failure.screenshot, undefined);
  assert.equal((await rejected.json()).failure.screenshot, undefined);
  assert.deepEqual(applies, [{ id: "31", userId: admin.id }]);
  assert.deepEqual(rejects, [{ id: "31", userId: admin.id }]);
});

test("repair suggestions attach only the verified internal failure object", async () => {
  const askedWith: unknown[] = [];
  let metadata: ObjectMetadata | undefined = failureMetadata;
  let corrupt = false;
  const requester = createCrawlRepairRequester({
    getRun: async () => crawlRun({ status: "failed" }) as never,
    getPlan: async () => ({ id: "11", plan: crawlPlan(1, true) }) as never,
    listRunSteps: async () => [{
      flow_id: "browse-products",
      step_id: "open-software",
      status: "failed",
      final_url: "https://www.atlassian.com/",
      failure_screenshot: null,
      failure_object_key: failureMetadata.key,
      error_class: "SemanticStepError",
      error_message: "Expected software catalog",
    }] as never,
    crawlFailureObject: async () => metadata,
    objectStore: {
      put: async () => { throw new Error("unused"); },
      head: async () => metadata,
      get: async () => ({ metadata: failureMetadata, body: corrupt ? Buffer.from("corrupt") : failureBody }),
      signedGetUrl: async () => undefined,
      async *list() { yield failureMetadata; },
      delete: async () => false,
    },
    startChatSession: async () => ({
      ask: async (_prompt: string, attachment?: unknown) => {
        askedWith.push(attachment);
        return JSON.stringify(crawlPlan().flows[0].steps[0]);
      },
      close: async () => {},
    }),
    proposeRepair: async () => ({ id: "31", status: "proposed" }) as never,
  });
  const input = { runId: "21", flowId: "browse-products", stepId: "open-software", provider: "chatgpt" as const };

  await requester(input);
  metadata = undefined;
  await requester(input);
  metadata = failureMetadata;
  corrupt = true;
  await assert.rejects(() => requester(input), /Object bytes do not match metadata/);

  assert.deepEqual(askedWith, [{ name: "crawl-failure.png", mimeType: "image/png", buffer: failureBody }, undefined]);
});

 test("cancels Sites and Apps jobs without crossing their cancellation boundary", async (t) => {
  let appCancellationSignals = 0;
  const jobs = new Map<number, ReturnType<typeof jobRecord>>([
    [1, jobRecord({ id: 1, type: "import-site", status: "running" })],
    [2, jobRecord({ id: 2, type: "import-app", status: "running" })],
  ]);
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    getJob: async (id) => jobs.get(id),
    setJobStatus: async (id, status, message) => {
      jobs.set(id, { ...jobs.get(id)!, status, message: message ?? null });
    },
    requestCancel: () => { appCancellationSignals++; },
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/jobs/1/cancel`, { method: "POST", headers: adminAuth })).status, 200);
  assert.equal(appCancellationSignals, 0);
  assert.equal((await fetch(`${base}/jobs/2/cancel`, { method: "POST", headers: adminAuth })).status, 200);
  assert.equal(appCancellationSignals, 1);
});

test("serves a hydrated structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      verifyAuthToken: async () => admin,
      getDesignSystem: async () => ({
        app: "linear",
        generatedAt: "2026-07-10T00:00:00.000Z",
        tokens: [
          {
            id: "color-primary",
            kind: "color",
            name: "Primary",
            value: "#5E6AD2",
            role: "primary action",
            evidence: [7],
          },
        ],
        components: [],
        flows: [],
      }),
      appImages: async () => [
        {
          id: 7,
          app: "linear",
          platform: "web",
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Toolbar",
        },
      ],
      getAppFlows: async () => [{
        id: "login",
        title: "Login",
        description: "Authenticate",
        tags: ["Authentication"],
        steps: [{ label: "Email", evidence: [7] }],
      }],
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/linear?platform=web`, { headers: adminAuth });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.tokens[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.equal(snapshot.flows[0].steps[0].label, "Email");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].thumbnailUrl, "/api/media/linear/0123456789abcdef?variant=thumb");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("downloads a complete editable Figma library and secondary exports", async (t) => {
  const snapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
    components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
    flows: [],
  };
  const durable: Array<{ exportId: number; metadata: ObjectMetadata }> = [];
  const events: Array<{ featureKey?: string; action: string; outcome: string }> = [];
  const uploaded: Array<ObjectMetadata & { body: Uint8Array }> = [];
  const evidenceBody = Buffer.from("object-backed-evidence");
  const evidenceMetadata: ObjectMetadata = {
    key: `images/7/${createHash("sha256").update(evidenceBody).digest("hex")}.webp`,
    sha256: createHash("sha256").update(evidenceBody).digest("hex"),
    byteSize: evidenceBody.byteLength,
    contentType: "image/webp",
    accessClass: "protected",
  };
  let nextExportId = 40;
  const exportStore: ObjectStore = {
    put: async (input) => {
      uploaded.push(input);
      return { created: true, metadata: input };
    },
    head: async () => undefined,
    get: async () => ({ metadata: evidenceMetadata, body: evidenceBody }),
    signedGetUrl: async () => undefined,
    async *list() { /* unused */ },
    delete: async () => false,
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getAccountEntitlements: async () => proEntitlements,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async (event) => { events.push(event); },
    createExport: async () => ++nextExportId,
    completeExport: async (exportId, metadata) => { durable.push({ exportId, metadata }); },
    failExport: async () => undefined,
    objectStore: exportStore,
    imageObjectById: async () => evidenceMetadata,
    getDesignSystem: async () => snapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot, flows: [] }),
    getAppFlows: async () => [],
    appImages: async () => catalogImages,
    versionImages: async () => catalogImages,
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };
  const figma = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "figma", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(figma.status, 200);
  assert.equal(Buffer.from(await figma.arrayBuffer()).subarray(0, 2).toString(), "PK");
  assert.match(figma.headers.get("content-disposition") ?? "", /linear-figma-library\.zip/);
  assert.equal(figma.headers.get("content-type"), "application/zip");

  const json = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "json", platform: "web", selection: { kind: "component-family", id: "button" } }),
  });
  assert.equal(json.status, 200);
  assert.equal((await json.json()).components.length, 1);
  assert.equal(uploaded.length, 2);
  assert.match(Buffer.from(uploaded[0].body).toString("utf8"), new RegExp(evidenceBody.toString("base64")));
  assert.deepEqual(durable.map(({ exportId }) => exportId), [41, 42]);
  assert.deepEqual(events.map(({ featureKey, action, outcome }) => ({ featureKey, action, outcome })), [
    { featureKey: "design_systems", action: "export-figma", outcome: "completed" },
    { featureKey: "design_systems", action: "export-json", outcome: "completed" },
  ]);
  for (let index = 0; index < uploaded.length; index++) {
    const metadata = uploaded[index];
    assert.equal(metadata.key, `exports/${41 + index}/${metadata.sha256}.${index === 0 ? "zip" : "json"}`);
    assert.equal(metadata.sha256, createHash("sha256").update(metadata.body).digest("hex"));
    assert.equal(metadata.byteSize, metadata.body.byteLength);
    assert.equal(metadata.accessClass, "protected");
    const { body: _body, ...persistedMetadata } = metadata;
    assert.deepEqual(durable[index], { exportId: 41 + index, metadata: persistedMetadata });
  }
  assert.equal((await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers, body: JSON.stringify({ format: "pdf", platform: "web", selection: { kind: "design-system" } }),
  })).status, 400);
});

test("rejects the retired flow-md export format", async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ format: "flow-md", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid export request" });
});

test("does not mount the retired flow-doc endpoints", async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };

  const get = await fetch(`${base}/design-systems/linear/flow-doc?platform=web`, { headers });
  const put = await fetch(`${base}/design-systems/linear/flow-doc`, {
    method: "PUT", headers, body: JSON.stringify({ platform: "web", body: "# Edited flow doc" }),
  });
  assert.equal(get.status, 404, await get.clone().text());
  assert.equal(put.status, 404, await put.clone().text());
});

test("does not fall back to legacy media when an associated object fails verification", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "astryx-export-object-"));
  mkdirSync(join(root, "images", "linear"), { recursive: true });
  writeFileSync(join(root, "images", "linear", "0123456789abcdef.webp"), "legacy-fallback");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const expected: ObjectMetadata = {
    key: `images/7/${"a".repeat(64)}.webp`, sha256: "a".repeat(64), byteSize: 7,
    contentType: "image/webp", accessClass: "protected",
  };
  let created = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    objectStore: { ...localObjectStore, get: async () => ({ metadata: expected, body: Buffer.from("wrong") }) },
    imageObjectById: async () => expected,
    getVersionDesignSystem: async () => ({
      version: publishedVersion,
      snapshot: { app: "linear", generatedAt: "2026-07-10T00:00:00.000Z", tokens: [], components: [], flows: [] },
      flows: [],
    }),
    versionImages: async () => catalogImages,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    createExport: async () => { created = true; return 1; },
    dataDir: root,
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST", headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ format: "figma", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Export storage unavailable" });
  assert.equal(created, false);
});

test("downloads an authorized completed export locally or by short signed redirect", async (t) => {
  const body = Buffer.from('{"tokens":[]}');
  const metadata: ObjectMetadata = {
    key: `exports/91/${createHash("sha256").update(body).digest("hex")}.json`,
    sha256: createHash("sha256").update(body).digest("hex"), byteSize: body.byteLength,
    contentType: "application/json", accessClass: "protected",
  };
  let signed = false;
  const store: ObjectStore = {
    ...localObjectStore,
    get: async () => ({ metadata, body }),
    signedGetUrl: async () => signed ? "https://objects.example/signed" : undefined,
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    objectStore: store,
    authorizedExportObject: async ({ exportId }) => {
      if (exportId === 93) throw new Error("exports/91/secret-key");
      return exportId === 91 ? { metadata, filename: "linear tokens\r\nunsafe.json" } : undefined;
    },
  }));
  t.after(() => close(server));
  const local = await fetch(`${base}/exports/91`, { headers: { authorization: "Bearer user" } });
  assert.equal(local.status, 200);
  assert.deepEqual(Buffer.from(await local.arrayBuffer()), body);
  assert.equal(local.headers.get("content-type"), "application/json");
  assert.equal(local.headers.get("content-disposition"), 'attachment; filename="linear_tokens__unsafe.json"');

  signed = true;
  const redirect = await fetch(`${base}/exports/91`, { headers: { authorization: "Bearer user" }, redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "https://objects.example/signed");
  assert.equal(redirect.headers.get("content-type"), "application/json");
  assert.equal(redirect.headers.get("content-disposition"), 'attachment; filename="linear_tokens__unsafe.json"');
  const missing = await fetch(`${base}/exports/92`, { headers: { authorization: "Bearer user" } });
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /exports\/91|object_key|signed/i);
  const failed = await fetch(`${base}/exports/93`, { headers: { authorization: "Bearer user" } });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "Export storage unavailable" });
});

test("does not complete an export when object upload fails", async (t) => {
  const snapshot = { app: "linear", generatedAt: "2026-07-10T00:00:00.000Z", tokens: [], components: [], flows: [] };
  const completed: number[] = [];
  const failed: number[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    recordAccessEvent: async () => undefined,
    createExport: async () => 73,
    completeExport: async (exportId) => { completed.push(exportId); },
    failExport: async (exportId) => { failed.push(exportId); },
    objectStore: { ...localObjectStore, put: async () => { throw new Error("checksum mismatch"); } },
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot, flows: [] }),
    versionImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ format: "json", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(completed, []);
  assert.deepEqual(failed, [73]);
});

test("serves evidence-backed search and 2-app comparison", async (t) => {
  const systems = [
    {
      app: "linear",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#5E6AD2", role: "Primary", evidence: [7] }],
      components: [{ id: "button", name: "Button", category: "Actions", description: "Action", variants: [{ id: "primary", name: "Primary", description: "Filled", evidence: [7] }] }],
      flows: [],
    },
    {
      app: "airbnb",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "accent", kind: "color" as const, name: "Accent", value: "#FF385C", role: "Primary", evidence: [8] }],
      components: [],
      flows: [],
    },
  ];
  const events: Array<{ featureKey?: string; action: string; outcome: string }> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getAccountEntitlements: async () => proEntitlements,
    allImages: async () => [{
      ...catalogImages[0],
      analysis: {
        description: "Toolbar with primary action",
        purpose: "Manage issues",
        pageType: "Workspace",
        productArea: "Issues",
        theme: "dark" as const,
        visibleStates: ["default"],
        componentNames: ["Button"],
      },
    }],
    publishedImages: async () => [{
      ...catalogImages[0],
      analysis: {
        description: "Toolbar with primary action",
        purpose: "Manage issues",
        pageType: "Workspace",
        productArea: "Issues",
        theme: "dark" as const,
        visibleStates: ["default"],
        componentNames: ["Button"],
      },
    }],
    listDesignSystems: async () => systems,
    listPublishedDesignSystems: async () => systems,
    listAppFlowSets: async () => [],
    listPublishedFlowSets: async () => [],
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));

  const search = await fetch(`${base}/search?q=primary&kind=component`, { headers: { authorization: "Bearer user" } });
  assert.equal(search.status, 200);
  const searchBody = await search.json() as CatalogSearchResult;
  assert.equal(searchBody.items[0].id, "component:linear:button");
  assert.equal(searchBody.items[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.equal(searchBody.items[0].thumbnailUrl, "/api/media/linear/0123456789abcdef?variant=thumb");
  assert.deepEqual(events[0], { userId: user.id, featureKey: "search", action: "catalog-search", outcome: "success" });

  const publicSearch = await fetch(`${base}/search?q=primary&kind=component`);
  assert.equal(publicSearch.status, 200);
  assert.equal((await publicSearch.json() as CatalogSearchResult).items[0].id, "component:linear:button");
  assert.equal(events.length, 1);

  const compare = await fetch(`${base}/compare?apps=linear,airbnb`, { headers: { authorization: "Bearer user" } });
  assert.equal(compare.status, 200);
  assert.deepEqual((await compare.json()).foundations[0].values, ["#5E6AD2", "#FF385C"]);
  assert.equal((await fetch(`${base}/compare?apps=linear`, { headers: { authorization: "Bearer user" } })).status, 400);
});

test("uses the Typesense catalog before loading the PostgreSQL search source", async (t) => {
  const calls: unknown[] = [];
  const typesenseResult: CatalogSearchResult = {
    items: [{
      id: "screen:7", kind: "screen", app: "linear", title: "Workspace", description: "Issue tracker",
      evidenceIds: [7], imageUrl: "/api/media/linear/0123456789abcdef", thumbnailUrl: "/api/media/linear/0123456789abcdef?variant=thumb",
      states: ["default"], layoutPatterns: [], componentNames: ["Button"], appCategories: ["Productivity"],
    }],
    facets: { kinds: { app: 0, screen: 1, component: 0, token: 0, flow: 0, pattern: 0 }, themes: [], pageTypes: [], productAreas: [], states: ["default"], layouts: [], components: ["Button"], appCategories: ["Productivity"] },
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    getAccountEntitlements: async () => proEntitlements,
    typesenseCatalog: {
      index: async () => 0,
      search: async (input) => { calls.push(input); return typesenseResult; },
    },
    publishedImages: async () => { throw new Error("legacy source should not load"); },
    listPublishedDesignSystems: async () => { throw new Error("legacy source should not load"); },
    listPublishedFlowSets: async () => { throw new Error("legacy source should not load"); },
    recordAccessEvent: async () => undefined,
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/search?q=workspace&kind=screen`, { headers: { authorization: "Bearer user" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), typesenseResult);
  assert.deepEqual(calls, [{ query: "workspace", kind: "screen", theme: undefined, pageType: undefined, productArea: undefined, state: undefined, layout: undefined, component: undefined, appCategory: undefined, platform: undefined, flowTag: undefined, limit: undefined }]);
});

test("creates user-owned collections and edits item notes", async (t) => {
  const now = "2026-07-11T00:00:00.000Z";
  const collection = { id: 4, name: "Onboarding", description: "", created_at: now, updated_at: now, items: [] };
  let notes = "";
  const events: Array<{ featureKey?: string; action: string; outcome: string }> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getAccountEntitlements: async () => proEntitlements,
    countUserCollections: async () => 1,
    createCollection: async (_userId, name, description) => ({ ...collection, name, description: description ?? "" }),
    listCollections: async () => [{ ...collection, items: [] }],
    listCollectionScreens: async () => [{
      item_id: 9,
      id: 7,
      app: "linear",
      platform: "web",
      image_url: "mobbin-bulk:0123456789abcdef",
      description: "Workspace",
      analysis: { pageType: "Workspace", productArea: "Projects", theme: "light", visibleStates: [] },
      capture_url: "https://linear.app",
      captured_at: now,
      accent_color: "#5E6AD2",
    }],
    addCollectionItem: async (_userId, _collectionId, item) => ({
      id: 9,
      kind: item.kind,
      app: item.app,
      reference_id: item.referenceId,
      title: item.title,
      notes: item.notes,
      created_at: now,
      updated_at: now,
    }),
    updateCollectionItemNotes: async (_userId, _collectionId, _itemId, value) => {
      notes = value;
      return { id: 9, kind: "screen", app: "linear", reference_id: "7", title: "Workspace", notes, created_at: now, updated_at: now };
    },
    removeCollectionItem: async () => true,
    deleteCollection: async () => true,
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };

  const created = await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Onboarding" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).name, "Onboarding");
  assert.equal((await fetch(`${base}/collections`, { headers })).status, 200);
  const savedScreens = await fetch(`${base}/collections/4/screens`, { headers });
  assert.equal(savedScreens.status, 200);
  assert.deepEqual(await savedScreens.json(), {
    screens: [{
      itemId: 9,
      app: "linear",
      accent: "#5E6AD2",
      screen: {
        id: 7,
        type: "Workspace",
        productArea: "Projects",
        theme: "light",
        visibleStates: [],
        platform: "web",
        description: "Workspace",
        purpose: null,
        sourceUrl: "https://linear.app",
        sourcePresentation: "unknown",
        embeddedPageType: null,
        layoutPatterns: [],
        componentNames: [],
        visibleText: [],
        icons: [],
        imagery: [],
        uiElements: [],
        contentPatterns: [],
        interactionPatterns: [],
        responsiveViewport: null,
        capturedAt: now,
        stateContext: null,
        confidence: null,
        url: "/api/media/linear/0123456789abcdef",
        thumbnailUrl: "/api/media/linear/0123456789abcdef?variant=thumb",
      },
    }],
  });

  const added = await fetch(`${base}/collections/4/items`, {
    method: "POST", headers,
    body: JSON.stringify({ kind: "screen", app: "linear", referenceId: "7", title: "Workspace", notes: "Reference" }),
  });
  assert.equal(added.status, 201);
  const patched = await fetch(`${base}/collections/4/items/9`, { method: "PATCH", headers, body: JSON.stringify({ notes: "Reuse hierarchy" }) });
  assert.equal(patched.status, 200);
  assert.equal(notes, "Reuse hierarchy");
  assert.equal((await fetch(`${base}/collections/4/items/9`, { method: "DELETE", headers })).status, 204);
  assert.equal((await fetch(`${base}/collections/4`, { method: "DELETE", headers })).status, 204);
  assert.deepEqual(events.map(({ featureKey, action, outcome }) => ({ featureKey, action, outcome })), [
    { featureKey: "collections", action: "collection-created", outcome: "created" },
    { featureKey: "collections", action: "collection-item-added", outcome: "created" },
    { featureKey: "collections", action: "collection-item-updated", outcome: "success" },
    { featureKey: "collections", action: "collection-item-removed", outcome: "success" },
    { featureKey: "collections", action: "collection-deleted", outcome: "success" },
  ]);
});

test("keeps search public while enforcing Free collection, note, and unlock policy", async (t) => {
  const now = "2026-07-21T00:00:00.000Z";
  let collectionCount = 0;
  let unlockCalled = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    getAccountEntitlements: async () => freeEntitlements,
    countUserCollections: async () => collectionCount,
    canAccessApp: async () => true,
    createCollection: async (_userId, name, description) => {
      collectionCount += 1;
      return { id: 1, name, description: description ?? "", created_at: now, updated_at: now, items: [] };
    },
    createFreeCollection: async (_userId, name) => {
      if (collectionCount >= 1) return undefined;
      collectionCount += 1;
      return { id: 1, name, description: "", created_at: now, updated_at: now, items: [] };
    },
    addCollectionItem: async () => { throw new Error("Free notes must be rejected first"); },
    updateCollectionItemNotes: async () => { throw new Error("Free notes must be rejected first"); },
    unlockFreeApp: async () => { unlockCalled = true; return { status: "unlocked", remaining: 2 }; },
    publishedImages: async () => [],
    listPublishedDesignSystems: async () => [],
    listPublishedFlowSets: async () => [],
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };

  const search = await fetch(`${base}/search?q=checkout`, { headers });
  assert.equal(search.status, 200);

  const described = await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Research", description: "Notes" }) });
  assert.equal(described.status, 403);
  assert.equal((await described.json()).code, "upgrade_required");
  assert.equal((await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Research" }) })).status, 201);
  const second = await fetch(`${base}/collections`, { method: "POST", headers, body: JSON.stringify({ name: "Second" }) });
  assert.equal(second.status, 403);
  assert.equal((await second.json()).code, "plan_limit");

  const item = { kind: "screen", app: "linear", referenceId: "7", title: "Workspace", notes: "Remember this" };
  assert.equal((await fetch(`${base}/collections/1/items`, { method: "POST", headers, body: JSON.stringify(item) })).status, 403);
  assert.equal((await fetch(`${base}/collections/1/items/1`, { method: "PATCH", headers, body: JSON.stringify({ notes: "Remember" }) })).status, 403);
  assert.equal((await fetch(`${base}/apps/linear/unlock`, { method: "POST", headers })).status, 201);
  assert.equal(unlockCalled, true);
});

test("prevents active Pro from banking permanent Free unlocks", async (t) => {
  let unlockCalled = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    getAccountEntitlements: async () => proEntitlements,
    unlockFreeApp: async () => { unlockCalled = true; return { status: "unlocked", remaining: 2 }; },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/unlock`, { method: "POST", headers: { authorization: "Bearer user" } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "already_pro");
  assert.equal(unlockCalled, false);
});

test("reviews and publishes an existing admin draft while hiding drafts from designers", async (t) => {
  const version = { id: 12, app: "linear", platform: "web", version_number: 2, label: "v2", source_url: null, provider: "m" as const, status: "draft" as const, notes: "", captured_at: "2026-07-11T00:00:00.000Z", submitted_at: null, published_at: null, screen_count: 7, analyzed_count: 7, component_count: 2, token_count: 4, flow_count: 1 };
  let publishedOnly: boolean | undefined;
  let appSync: unknown;
  let releaseAppSync: (() => void) | undefined;
  const pendingAppSync = new Promise<void>((resolve) => { releaseAppSync = resolve; });
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async (token) => token === "admin" ? admin : user,
    listAppVersions: async (_app, _platform, only) => { publishedOnly = only; return only ? [] : [version]; },
    getVersionPublicationBlockers: async () => [],
    submitAppVersionForReview: async () => ({ ...version, status: "in_review" as const }),
    publishAppVersion: async () => ({ ...version, status: "published" as const, published_at: "2026-07-11T01:00:00.000Z" }),
    syncTypesenseAppCatalog: async (...input) => {
      appSync = input;
      await pendingAppSync;
    },
  }));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/versions/12/blockers`, { headers: adminAuth })).status, 200);
  assert.equal((await fetch(`${base}/versions/12/submit`, { method: "POST", headers: adminAuth })).status, 200);
  const publish = fetch(`${base}/versions/12/publish`, { method: "POST", headers: adminAuth });
  const response = await Promise.race([
    publish,
    new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("publish waited for Typesense App sync")), 250)),
  ]);
  assert.equal((await response.json()).status, "published");
  assert.deepEqual(appSync, ["linear", "web"]);
  releaseAppSync?.();

  const designerVersions = await fetch(`${base}/apps/linear/versions?platform=web`, { headers: { authorization: "Bearer user" } });
  assert.equal(designerVersions.status, 200);
  assert.equal(publishedOnly, true);
});

test("allows only admins to choose AppCard preview screens", async (t) => {
  const selections: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async (token) => token === "admin" ? admin : user,
    replaceAppPreviewImages: async (input) => {
      selections.push(input);
      return { versionId: 7, imageIds: input.imageIds };
    },
  }));
  t.after(() => close(server));
  const body = JSON.stringify({ platform: "ios", version: 1, imageIds: [41, 19, 28] });
  const member = await fetch(`${base}/apps/linear/preview-screens`, {
    method: "PUT", headers: { authorization: "Bearer user", "content-type": "application/json" }, body,
  });
  assert.equal(member.status, 403);
  const selected = await fetch(`${base}/apps/linear/preview-screens`, {
    method: "PUT", headers: { ...adminAuth, "content-type": "application/json" }, body,
  });
  assert.equal(selected.status, 200);
  assert.deepEqual(await selected.json(), { versionId: 7, imageIds: [41, 19, 28] });
  assert.deepEqual(selections, [{ app: "linear", platform: "ios", versionNumber: 1, imageIds: [41, 19, 28] }]);
  const tooMany = await fetch(`${base}/apps/linear/preview-screens`, {
    method: "PUT", headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify({ platform: "ios", version: 1, imageIds: [1, 2, 3, 4] }),
  });
  assert.equal(tooMany.status, 400);
});

test("returns 404 when an app has no structured design system", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      verifyAuthToken: async () => admin,
      getDesignSystem: async () => undefined,
      getAppFlows: async () => [],
      appImages: async () => [],
    })
  );
  t.after(() => close(server));
  assert.equal(
    (await fetch(`${base}/design-systems/linear?platform=web`, { headers: adminAuth })).status,
    404
  );
});

test("reuses the version list when loading an explicit design system", async (t) => {
  let versionLists = 0;
  let resolvedVersionId: number | undefined;
  const snapshot = {
    app: "linear", generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [], components: [], flows: [], rules: [],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    listAppVersions: async () => {
      versionLists += 1;
      return [publishedVersion];
    },
    getVersionDesignSystem: async (_app, _platform, _number, resolvedVersion) => {
      resolvedVersionId = resolvedVersion?.id;
      return { version: publishedVersion, snapshot, flows: [] };
    },
    versionImages: async () => [],
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/apps/linear/versions?platform=web`, { headers: adminAuth })).status, 200);
  assert.equal((await fetch(`${base}/design-systems/linear?platform=web&version=1`, { headers: adminAuth })).status, 200);
  assert.equal(versionLists, 1);
  assert.equal(resolvedVersionId, publishedVersion.id);
});

test("serves imported current design when an entitled user has no published version", async (t) => {
  const imported = {
    app: "linear", generatedAt: "2026-07-22T00:00:00.000Z", summary: "Dark product UI",
    tokens: [{ id: "primary", kind: "color" as const, name: "Primary", value: "#5e6ad2", role: "Brand", evidence: [] }],
    components: [], flows: [], rules: [],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getVersionDesignSystem: async () => undefined,
    getImportedCurrentDesignSystem: async (app, platform) => app === "linear" && platform === "web" ? imported : undefined,
    getAppFlows: async () => [], appImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear?platform=web`, { headers: { authorization: "Bearer user" } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary, "Dark product UI");
});

test("serves imported current design when the published version has only an empty placeholder", async (t) => {
  const imported = {
    app: "linear", generatedAt: "2026-07-22T00:00:00.000Z", summary: "Dark product UI",
    tokens: [{ id: "primary", kind: "color" as const, name: "Primary", value: "#5e6ad2", role: "Brand", evidence: [] }],
    components: [], flows: [], rules: [],
  };
  const placeholder = {
    app: "linear", generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [], components: [], flows: [], rules: [],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot: placeholder, flows: [] }),
    getImportedCurrentDesignSystem: async () => imported,
    getAppFlows: async () => [], appImages: async () => [], versionImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear?platform=web`, { headers: { authorization: "Bearer user" } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.summary, "Dark product UI");
  assert.equal(body.tokens.length, 1);
});

test("never uses imported-current fallback for an explicit version", async (t) => {
  let fallbackReads = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    getVersionDesignSystem: async () => undefined,
    getDesignSystem: async () => undefined,
    getImportedCurrentDesignSystem: async () => { fallbackReads += 1; return undefined; },
    getAppFlows: async () => [], appImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear?platform=web&version=2`, { headers: adminAuth });
  assert.equal(response.status, 404);
  assert.equal(fallbackReads, 0);
});

test("exports imported current design when an entitled user has no published version", async (t) => {
  const bodies: Uint8Array[] = [];
  const store: ObjectStore = {
    put: async (input) => { bodies.push(input.body); return { created: true, metadata: input }; },
    head: async () => undefined, get: async () => { throw new Error("unused"); },
    signedGetUrl: async () => undefined, async *list() {}, delete: async () => false,
  };
  const imported = {
    app: "linear", generatedAt: "2026-07-22T00:00:00.000Z", summary: "Dark product UI",
    tokens: [{ id: "primary", kind: "color" as const, name: "Primary", value: "#5e6ad2", role: "Brand", evidence: [] }],
    components: [], flows: [], rules: [],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user, canAccessApp: async () => true,
    getAccountEntitlements: async () => proEntitlements,
    reserveExportOperation: async () => ({ status: "reserved" as const, used: 1, limit: 20 as const, resetAt: "2026-08-01T00:00:00.000Z" }),
    createExport: async () => 99, completeExport: async () => undefined, failExport: async () => undefined,
    recordAccessEvent: async () => undefined, objectStore: store,
    getVersionDesignSystem: async () => undefined,
    getImportedCurrentDesignSystem: async () => imported,
    getAppFlows: async () => [], appImages: async () => [],
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/design-systems/linear/exports`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ format: "json", platform: "web", selection: { kind: "design-system" } }),
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(Buffer.from(bodies[0]).toString("utf8")).summary, "Dark product UI");
});

test("serves crawled flows even when an app has not been through AI synthesis", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      verifyAuthToken: async () => admin,
      getDesignSystem: async () => undefined,
      appImages: async () => [
        { id: 7, app: "lang-chain", platform: "web", image_url: "mobbin-bulk:0123456789abcdef", description: null },
      ],
      getAppFlows: async () => [{
        id: "onboarding",
        title: "Onboarding",
        description: "Crawled from Mobbin",
        tags: [],
        steps: [{ label: "Step 1", evidence: [7] }],
      }],
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/lang-chain?platform=web`, { headers: adminAuth });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.components, []);
  assert.equal(snapshot.flows[0].title, "Onboarding");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].imageUrl, "/api/media/lang-chain/0123456789abcdef");
  assert.equal(snapshot.flows[0].steps[0].evidence[0].thumbnailUrl, "/api/media/lang-chain/0123456789abcdef?variant=thumb");
});

test("does not serve legacy local bulk media from the public route", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-api-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const { base, server } = await serve(
    createApiApp({ dataDir, verifyAuthToken: async () => admin })
  );
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  assert.equal(
    (await fetch(`${base}/media/linear/0123456789abcdef`, { headers: adminAuth })).status,
    404,
  );
  assert.equal(
    (await fetch(`${base}/media/linear/not-a-hash`, { headers: adminAuth })).status,
    400
  );
});

test("does not expose protected design-system media without an authenticated delivery request", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-public-media-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const signedSnapshot = {
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [
      { id: "color", kind: "color" as const, name: "Color", value: "#000", role: "text", evidence: [7] },
      { id: "invalid", kind: "color" as const, name: "Invalid", value: "#fff", role: "background", evidence: [8] },
    ],
    components: [],
    flows: [],
  };
  const { base, server } = await serve(createApiApp({
    dataDir,
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getDesignSystem: async () => signedSnapshot,
    getVersionDesignSystem: async () => ({ version: publishedVersion, snapshot: signedSnapshot, flows: [] }),
    appImages: async () => catalogImages,
    versionImages: async () => [...catalogImages, { ...catalogImages[0], id: 8, image_url: "javascript:alert(1)" }],
    getAppFlows: async () => [],
  }));
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  const snapshot = await (await fetch(`${base}/design-systems/linear?platform=web`, {
    headers: { authorization: "Bearer owner" },
  })).json();
  const mediaUrl = snapshot.tokens[0].evidence[0].imageUrl as string;
  assert.equal(snapshot.tokens[1].evidence[0].imageUrl, "");
  assert.equal(mediaUrl, "/api/media/linear/0123456789abcdef");
  assert.equal((await fetch(`${base}${mediaUrl.replace("/api", "")}`)).status, 404);
});

test("keeps health public and rejects private data without a session", async (t) => {
  const { base, server } = await serve(
    createApiApp({ verifyAuthToken: async () => undefined })
  );
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/health`)).status, 200);
  // /apps is the public Apps grid — published-only, no admin visibility.
  assert.notEqual((await fetch(`${base}/apps`)).status, 401);
  assert.equal((await fetch(`${base}/jobs`)).status, 401);
});

test("keeps liveness up but fails readiness when object storage is unavailable", async (t) => {
  const { base, server } = await serve(createApiApp({
    storageReady: async () => { throw new Error("Object storage is unavailable"); },
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/health`)).status, 200);
  const response = await fetch(`${base}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", error: "object_storage_unavailable" });
});

test("briefly reuses a successful storage readiness check", async (t) => {
  let checks = 0;
  const { base, server } = await serve(createApiApp({
    storageReady: async () => { checks += 1; },
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/ready`)).status, 200);
  assert.equal((await fetch(`${base}/ready`)).status, 200);
  assert.equal(checks, 1);
});

test("serves the last readiness result while refreshing it", async (t) => {
  let now = 1_000;
  let checks = 0;
  let finishRefresh: (() => void) | undefined;
  t.mock.method(Date, "now", () => now);
  const { base, server } = await serve(createApiApp({
    storageReady: async () => {
      checks += 1;
      if (checks === 2) await new Promise<void>((resolve) => { finishRefresh = resolve; });
    },
  }));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/ready`)).status, 200);
  now += 10_001;
  assert.equal((await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) })).status, 200);
  assert.equal(checks, 2);
  finishRefresh?.();
});

test("serves the public catalog from one bounded page dependency", async (t) => {
  let input: { cursor?: string; limit?: number } | undefined;
  const validCursor = encodeUpdatedCatalogCursor({
    v: 1,
    sort: "updated",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async (next: { cursor?: string; limit?: number }) => {
      input = next;
      return catalogPageRecord;
    },
    publishedImages: async () => {
      throw new Error("legacy full-catalog reader called");
    },
    publishedPreviewImages: async () => {
      throw new Error("legacy full-preview reader called");
    },
    verifyAuthToken: async () => admin,
  } as never));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps?cursor=${validCursor}&limit=3`, { headers: adminAuth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(input, {
    cursor: validCursor,
    limit: 3,
    filters: [],
    sort: "latest",
  });
  assert.equal(body.items[0].previewScreens.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /mobbin-bulk|image_url/);
});

test("briefly reuses an identical public catalog page", async (t) => {
  let reads = 0;
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => {
      reads += 1;
      return catalogPageRecord;
    },
  } as never));
  t.after(() => close(server));

  const path = `${base}/apps?platform=web&facets=summary&limit=12`;
  assert.equal((await fetch(path)).status, 200);
  assert.equal((await fetch(path)).status, 200);
  assert.equal(reads, 1);
});

test("serves the last public catalog page while refreshing it", async (t) => {
  let now = 1_000;
  let reads = 0;
  let finishRefresh: (() => void) | undefined;
  t.mock.method(Date, "now", () => now);
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => {
      reads += 1;
      if (reads === 2) await new Promise<void>((resolve) => { finishRefresh = resolve; });
      return catalogPageRecord;
    },
  } as never));
  t.after(() => close(server));

  const path = `${base}/apps?platform=web&facets=summary&limit=12`;
  assert.equal((await fetch(path)).status, 200);
  now += 30_001;
  assert.equal((await fetch(path, { signal: AbortSignal.timeout(500) })).status, 200);
  assert.equal(reads, 2);
  finishRefresh?.();
});

test("serves eligible App catalog searches from Typesense with timing metadata", async (t) => {
  let fallbackCalls = 0;
  let typesenseInput: unknown;
  const { base, server } = await serve(createApiApp({
    typesenseAppCatalog: {
      search: async (input: unknown) => {
        typesenseInput = input;
        return {
          apps: buildPublishedCatalogPage(catalogPageRecord).apps,
          totalCount: 1,
          nextPage: 2,
          facets: [{ group: "categories", value: "Productivity", count: 1 }],
        };
      },
    },
    publishedCatalogPage: async () => {
      fallbackCalls += 1;
      return catalogPageRecord;
    },
    verifyAuthToken: async () => admin,
  } as never));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/apps/search?platform=web&query=linear&filter=categories.Productivity&limit=3`,
    { headers: adminAuth },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("server-timing") ?? "", /^typesense-app;dur=\d/);
  assert.deepEqual(typesenseInput, {
    query: "linear",
    platform: "web",
    filters: [{ group: "categories", value: "Productivity" }],
    sort: "latest",
    page: 1,
    limit: 3,
  });
  assert.equal(fallbackCalls, 0);
  assert.deepEqual(await response.json(), {
    items: buildPublishedCatalogPage(catalogPageRecord).apps,
    nextCursor: "typesense-app:2",
    totalCount: 1,
    facets: [{ group: "categories", value: "Productivity", count: 1 }],
  });
});

test("keeps empty-query Apps browsing on PostgreSQL when Typesense is configured", async (t) => {
  let typesenseCalls = 0;
  let fallbackCalls = 0;
  const { base, server } = await serve(createApiApp({
    typesenseAppCatalog: {
      search: async () => {
        typesenseCalls += 1;
        return { apps: [], totalCount: 0, nextPage: null, facets: [] };
      },
    },
    publishedCatalogPage: async () => {
      fallbackCalls += 1;
      return catalogPageRecord;
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps?platform=web&facets=summary`);
  assert.equal(response.status, 200);
  assert.equal(typesenseCalls, 0);
  assert.equal(fallbackCalls, 1);
  assert.equal(response.headers.get("server-timing"), null);
  assert.deepEqual((await response.json()).items, buildPublishedCatalogPage(catalogPageRecord).apps);
});

test("does not expose the retired public catalog route", async (t) => {
  const { base, server } = await serve(createApiApp());
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/catalog`)).status, 401);
  assert.equal((await fetch(`${base}/catalog/flows?platform=web`)).status, 401);
});

test("falls back to PostgreSQL when an eligible Typesense App search fails", async (t) => {
  let fallbackCalls = 0;
  const { base, server } = await serve(createApiApp({
    typesenseAppCatalog: { search: async () => { throw new Error("Typesense unavailable"); } },
    publishedCatalogPage: async () => {
      fallbackCalls += 1;
      return catalogPageRecord;
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/search?platform=web&query=linear`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("server-timing") ?? "", /typesense-app;dur=\d.*fallback/);
  assert.equal(fallbackCalls, 1);
});

test("returns 400 for an invalid public catalog cursor", async (t) => {
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => { throw new CatalogCursorError(); },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps?cursor=***`);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Create an account or sign in to continue browsing the catalog",
    code: "guest_catalog_limit",
  });
});

test("requires an account before a catalog cursor can fetch Apps, Sites, or Flows", async (t) => {
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => {
      throw new Error("anonymous App cursor reached the store");
    },
    publishedFlowCatalogPage: async () => {
      throw new Error("anonymous Flow cursor reached the store");
    },
    verifyAuthToken: async (token: string) => token === "free" ? user : undefined,
    getAccountEntitlements: async () => freeEntitlements,
  } as never));
  t.after(() => close(server));

  for (const path of [
    "/apps?cursor=next-page",
    "/flows?platform=web&cursor=next-page",
    "/sites?cursor=next-page",
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, path);
    assert.deepEqual(await response.json(), {
      error: "Create an account or sign in to continue browsing the catalog",
      code: "guest_catalog_limit",
    });
  }

  const freeResponse = await fetch(`${base}/sites?cursor=next-page`, {
    headers: { authorization: "Bearer free" },
  });
  assert.equal(freeResponse.status, 403);
  assert.deepEqual(await freeResponse.json(), {
    error: "Create an account or sign in to continue browsing the catalog",
    code: "guest_catalog_limit",
  });
});

test("passes valid category and flow facets to public catalog pagination", async (t) => {
  const inputs: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async (input: unknown) => {
      inputs.push(input);
      return { apps: [], previews: [], nextCursor: null };
    },
  } as never));
  t.after(() => close(server));

  assert.equal((await fetch(
    `${base}/apps?group=categories&value=CRM&platform=web`,
  )).status, 200);
  assert.equal((await fetch(
    `${base}/apps?group=flows&value=Setting%20Up&platform=android`,
  )).status, 200);
  assert.deepEqual(inputs, [
    {
      cursor: undefined,
      limit: 32,
      filters: [{ group: "categories", value: "CRM" }],
      platform: "web",
      sort: "latest",
    },
    {
      cursor: undefined,
      limit: 32,
      filters: [{ group: "flows", value: "Setting Up" }],
      platform: "android",
      sort: "latest",
    },
  ]);
});

test("rejects incomplete public catalog facets", async (t) => {
  const { base, server } = await serve(createApiApp());
  t.after(() => close(server));

  const response = await fetch(`${base}/apps?group=flows&value=Setting%20Up`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid catalog facet" });
});

test("serves one exact discovery envelope for repeated canonical catalog filters", async (t) => {
  const inputs: unknown[] = [];
  const facets = [
    { group: "categories", value: "CRM", count: 12 },
    { group: "flows", value: "Setting Up", count: 4 },
  ];
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async (input: unknown) => {
      inputs.push(input);
      return { ...catalogPageRecord, totalCount: 27, facets };
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/apps?filter=categories.CRM&filter=categories.Sales`
      + `&filter=flows.Setting%20Up&platform=web&query=linear&sort=trending&limit=3`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(inputs, [{
    cursor: undefined,
    limit: 3,
    filters: [
      { group: "categories", value: "CRM" },
      { group: "categories", value: "Sales" },
      { group: "flows", value: "Setting Up" },
    ],
    platform: "web",
    query: "linear",
    sort: "trending",
  }]);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["items", "nextCursor", "totalCount", "facets"]);
  assert.equal(body.items[0].previewScreens.length, 1);
  assert.equal(body.totalCount, 27);
  assert.deepEqual(body.facets, facets);
  assert.doesNotMatch(JSON.stringify(body), /mobbin-bulk|image_url/);
});

test("compresses a large catalog envelope without dropping complete facets", async (t) => {
  const facets = Array.from({ length: 4_000 }, (_, index) => ({
    group: "flows",
    value: `Flow ${index}`,
    count: index + 1,
  }));
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => ({
      ...catalogPageRecord,
      totalCount: 1,
      facets,
    }),
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps?platform=web`, {
    headers: { "accept-encoding": "gzip" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.deepEqual((await response.json() as { facets: unknown[] }).facets, facets);
});

test("rejects invalid repeated canonical catalog filters before reading the store", async (t) => {
  let calls = 0;
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => {
      calls += 1;
      return { ...catalogPageRecord, totalCount: 1, facets: [] };
    },
  } as never));
  t.after(() => close(server));

  const invalid = [
    "filter=unknown.Value",
    "filter=flows.",
    `filter=categories.${"x".repeat(121)}`,
    "filter=flows.Setting%20Up&platform=desktop",
    `filter=${Array.from({ length: 41 }, (_, index) => `categories.C${index}`).join("&filter=")}`,
    `query=${"q".repeat(121)}`,
    "sort=popular",
  ];
  for (const query of invalid) {
    assert.equal((await fetch(`${base}/apps?${query}`)).status, 400);
  }
  assert.equal(calls, 0);
});

test("keeps the catalog public and every App detail endpoint private", async (t) => {
  const { base, server } = await serve(createApiApp({
    publishedCatalogPage: async () => catalogPageRecord,
    verifyAuthToken: async () => undefined,
  } as never));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/apps`)).status, 200);
  assert.equal((await fetch(`${base}/preview-media/linear/web/1`)).status, 503);

  const privatePaths = [
    "/apps/linear",
    "/apps/linear/versions",
    "/apps/linear/screens?platform=web",
    "/apps/linear/ui-elements?platform=web",
    "/apps/linear/flows?platform=web",
    "/apps/linear/page-preview/1",
  ];

  for (const path of privatePaths) {
    assert.equal((await fetch(`${base}${path}`)).status, 401, path);
  }
});

test("keeps the Sites catalog and media public, but the Site detail JSON private", async (t) => {
  const sitesStore = {
    listReadySitesPage: async () => ({
      items: [{
        siteId: 1,
        versionId: 2,
        name: "V7",
        slug: "v-7",
        sourceUrl: "https://v7labs.com/",
        categories: [],
        styles: [],
        popularity: 1,
        label: "Jul 2026",
        isLatest: true,
        pageCount: 1,
        sectionCount: 1,
        previewUrl: "/api/sites/1/versions/2/media/preview",
        previews: [{
          id: 10,
          title: "Home",
          position: 0,
          url: "/api/sites/1/versions/2/pages/10/media",
        }],
        updatedAt: "2026-07-20T00:00:00.000Z",
      }],
      nextCursor: null,
      totalCount: 1,
      facets: [],
    }),
    siteMediaObject: async () => previewMetadata,
  };
  const { base, server } = await serve(createApiApp({
    sitesStore,
    objectStore: localObjectStore,
    verifyAuthToken: async () => undefined,
  } as never));
  t.after(() => close(server));

  assert.equal((await fetch(`${base}/sites`)).status, 200);
  assert.equal(
    (await fetch(`${base}/sites/1/versions/2/catalog-media/preview`)).status,
    200,
  );

  // Media is public: <video>/<img src> loads can't attach a bearer header.
  const publicMediaPaths = [
    "/sites/1/versions/2/media/preview",
    "/sites/1/versions/2/media/mobile",
    "/sites/1/versions/2/pages/10/media",
    "/sites/1/versions/2/sections/10/media",
    "/sites/1/versions/2/sections/10/poster",
  ];
  for (const path of publicMediaPaths) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, path);
  }

  assert.equal((await fetch(`${base}/sites/1/versions/2`)).status, 401);
});

test("serves only the first three public preview images for the requested platform", async (t) => {
  const inputs: Array<{ platform: string; rank: number; variant?: "full" | "thumb" }> = [];
  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    publishedPreviewObject: async ({ platform, rank, variant }) => {
      inputs.push({ platform, rank, variant });
      return rank === 1 ? previewMetadata : undefined;
    },
  }));
  t.after(() => close(server));
  const preview = await fetch(`${base}/preview-media/linear/web/1`);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/webp");
  assert.equal(preview.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await preview.text(), "image");
  assert.equal((await fetch(`${base}/preview-media/linear/web/1?variant=full`)).status, 200);
  assert.equal((await fetch(`${base}/preview-media/linear/web/2`)).status, 404);
  assert.equal((await fetch(`${base}/preview-media/linear/web/4`)).status, 400);
  assert.equal((await fetch(`${base}/preview-media/linear/1`)).status, 401);
  assert.deepEqual(inputs, [
    { platform: "web", rank: 1, variant: "thumb" },
    { platform: "web", rank: 1, variant: "full" },
    { platform: "web", rank: 2, variant: "thumb" },
  ]);
});

test("streams public preview bytes for same-origin canvas insertion", async (t) => {
  let signedUrlCalls = 0;
  let objectBodyCalls = 0;
  const signedObjectStore: ObjectStore = {
    ...localObjectStore,
    get: async () => {
      objectBodyCalls += 1;
      return { metadata: previewMetadata, body: Buffer.from("image") };
    },
    signedGetUrl: async () => {
      signedUrlCalls += 1;
      return "https://objects.example.test/signed-preview";
    },
  };
  const { base, server } = await serve(createApiApp({
    objectStore: signedObjectStore,
    publishedPreviewObject: async () => previewMetadata,
  }));
  t.after(() => close(server));

  const redirected = await fetch(`${base}/preview-media/linear/web/1`, { redirect: "manual" });
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get("location"), "https://objects.example.test/signed-preview");

  const inline = await fetch(`${base}/preview-media/linear/web/1?variant=full&inline=1`, {
    redirect: "manual",
  });
  assert.equal(inline.status, 200);
  assert.equal(inline.headers.get("content-type"), "image/webp");
  assert.equal(await inline.text(), "image");
  assert.equal(signedUrlCalls, 1);
  assert.equal(objectBodyCalls, 1);
});

test("serves allowlisted public taxonomy previews and protected media", async (t) => {
  const metadataInputs: unknown[] = [];
  const mediaInputs: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    publishedFacetPreviews: async (input: PublicFacetInput) => {
      metadataInputs.push(input);
      return [
        {
          kind: "flow",
          app: "linear",
          label: "Setting Up",
          iconUrl: null,
          mediaCount: 3,
        },
        {
          kind: "flow",
          app: "notion",
          label: "Setting Up",
          iconUrl: null,
          mediaCount: 2,
        },
      ];
    },
    publishedFacetPreviewObject: async (
      input: PublicFacetInput & { app: string; rank: number },
    ) => {
      mediaInputs.push(input);
      return previewMetadata;
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/apps/facet-preview?group=flows&value=Setting%20Up&platform=web`,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    previews: [
      {
        kind: "flow",
        app: "linear",
        label: "Setting Up",
        iconUrl: null,
        media: [
          "/api/apps/facet-media/linear/flows/Setting%20Up/web/1",
          "/api/apps/facet-media/linear/flows/Setting%20Up/web/2",
          "/api/apps/facet-media/linear/flows/Setting%20Up/web/3",
        ],
      },
      {
        kind: "flow",
        app: "notion",
        label: "Setting Up",
        iconUrl: null,
        media: [
          "/api/apps/facet-media/notion/flows/Setting%20Up/web/1",
          "/api/apps/facet-media/notion/flows/Setting%20Up/web/2",
        ],
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(body), /object_key|image_id|mobbin-bulk/);
  assert.deepEqual(metadataInputs, [{
    group: "flows",
    value: "Setting Up",
    platform: "web",
  }]);

  const media = await fetch(
    `${base}/apps/facet-media/linear/flows/Setting%20Up/web/2`,
  );
  assert.equal(media.status, 200);
  assert.deepEqual(mediaInputs, [{
    app: "linear",
    group: "flows",
    value: "Setting Up",
    platform: "web",
    rank: 2,
  }]);
});

test("serves dynamic Screen-pattern media and quick previews from the normalized taxonomy", async (t) => {
  const mediaInputs: unknown[] = [];
  const exactPage = buildPublishedCatalogPage({
    apps: [catalogPageRecord.apps[0]!],
    previews: [{
      ...catalogImages[0],
      matched_facets: [{ group: "screens", value: "Dashboard" }],
      preview_rank: 1,
    }],
    nextCursor: null,
  });
  const exactUrl = exactPage.apps[0]?.previewScreens[0]?.url;
  assert.ok(exactUrl);

  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    publishedFacetPreviews: async () => [{
      kind: "screen",
      app: "linear",
      label: "Dashboard",
      iconUrl: null,
      mediaCount: 1,
    }],
    publishedFacetPreviewObject: async (input: unknown) => {
      mediaInputs.push(input);
      const facet = input as { value?: string };
      return facet.value === "Dashboard" ? previewMetadata : undefined;
    },
  } as never));
  t.after(() => close(server));

  const exact = await fetch(`${base}${exactUrl.replace(/^\/api/, "")}`);
  assert.equal(exact.status, 200);
  assert.equal(await exact.text(), "image");
  assert.deepEqual(mediaInputs[0], {
    app: "linear",
    group: "screens",
    value: "Dashboard",
    platform: "web",
    rank: 1,
  });

  assert.equal((await fetch(
    `${base}/apps/facet-media/linear/screens/Does%20Not%20Exist/web/1`,
  )).status, 404);
  assert.equal((await fetch(
    `${base}/apps/facet-media/linear/screens/${"x".repeat(121)}/web/1`,
  )).status, 400);
  assert.equal((await fetch(
    `${base}/apps/facet-preview?group=screens&value=Dashboard&platform=web`,
  )).status, 200);
  assert.equal(mediaInputs.length, 2);
});

test("serves bounded public Flow catalog media without an App detail request", async (t) => {
  const inputs: unknown[] = [];
  let signedUrlCalls = 0;
  const { base, server } = await serve(createApiApp({
    objectStore: {
      ...localObjectStore,
      signedGetUrl: async () => {
        signedUrlCalls += 1;
        return undefined;
      },
    },
    publishedFlowCatalogPreviewObject: async (input: unknown) => {
      inputs.push(input);
      return previewMetadata;
    },
  } as never));
  t.after(() => close(server));

  const media = await fetch(
    `${base}/flows/media/linear/web/7/71/2`,
  );
  assert.equal(media.status, 200);
  assert.equal(media.headers.get("content-type"), "image/webp");
  assert.equal(await media.text(), "image");
  assert.deepEqual(inputs, [{
    app: "linear",
    platform: "web",
    versionId: 7,
    versionFlowId: 71,
    rank: 2,
    variant: "full",
  }]);

  const thumbnail = await fetch(
    `${base}/flows/media/linear/web/7/71/2?variant=thumb`,
  );
  assert.equal(thumbnail.status, 200);
  assert.deepEqual(inputs[1], {
    app: "linear",
    platform: "web",
    versionId: 7,
    versionFlowId: 71,
    rank: 2,
    variant: "thumb",
  });

  const inline = await fetch(
    `${base}/flows/media/linear/web/7/71/2?inline=1`,
  );
  assert.equal(inline.status, 200);
  assert.equal(await inline.text(), "image");
  assert.equal(signedUrlCalls, 2);
  assert.deepEqual(inputs[2], {
    app: "linear",
    platform: "web",
    versionId: 7,
    versionFlowId: 71,
    rank: 2,
    variant: "full",
  });

  assert.equal((await fetch(
    `${base}/flows/media/linear/web/7/71/0`,
  )).status, 400);
  assert.equal(inputs.length, 3);
});

test("rejects unknown taxonomy preview inputs before dependencies run", async (t) => {
  let calls = 0;
  const { base, server } = await serve(createApiApp({
    publishedFacetPreviews: async () => {
      calls += 1;
      return [];
    },
    publishedFacetPreviewObject: async () => {
      calls += 1;
      return undefined;
    },
  } as never));
  t.after(() => close(server));

  assert.equal((await fetch(
    `${base}/apps/facet-preview?group=elements&value=Unknown&platform=web`,
  )).status, 400);
  assert.equal((await fetch(
    `${base}/apps/facet-preview?group=flows&value=Setting%20Up&platform=android`,
  )).status, 400);
  assert.equal((await fetch(
    `${base}/apps/facet-media/linear/flows/Setting%20Up/web/4`,
  )).status, 400);
  assert.equal(calls, 0);
});

test("redirects authorized object-backed media to a short-lived signed URL", async (t) => {
  const signedStore: ObjectStore = {
    ...localObjectStore,
    signedGetUrl: async (_key, expires) => {
      assert.equal(expires, 300);
      return "https://objects.example/signed";
    },
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore: signedStore,
    entitledImageObject: async () => ({ ...previewMetadata, accessClass: "protected" }),
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/media/linear/0123456789abcdef`, {
    headers: adminAuth,
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://objects.example/signed");
  assert.equal(response.headers.get("cache-control"), "private, max-age=280");
});

test("does not expose protected object-backed media without an entitlement", async (t) => {
  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    adminImageObject: async () => ({ ...previewMetadata, accessClass: "protected" }),
  }));
  t.after(() => close(server));

  assert.equal(
    (await fetch(`${base}/media/linear/0123456789abcdef`, { redirect: "manual" })).status,
    404,
  );
});

test("serves explicitly public-preview object-backed media without a session", async (t) => {
  const { base, server } = await serve(createApiApp({
    objectStore: localObjectStore,
    adminImageObject: async () => previewMetadata,
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/media/linear/0123456789abcdef`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("passes the thumb variant through to the object lookup, defaulting to full otherwise", async (t) => {
  const seenVariants: Array<string | undefined> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore: localObjectStore,
    entitledImageObject: async (input) => {
      seenVariants.push(input.variant);
      return { ...previewMetadata, accessClass: "protected" };
    },
  }));
  t.after(() => close(server));
  await fetch(`${base}/media/linear/0123456789abcdef?variant=thumb`, { headers: adminAuth, redirect: "manual" });
  await fetch(`${base}/media/linear/0123456789abcdef`, { headers: adminAuth, redirect: "manual" });
  assert.deepEqual(seenVariants, ["thumb", "full"]);
});

test("streams protected media through the API when inline delivery is requested", async (t) => {
  let signedRequests = 0;
  const protectedMetadata = { ...previewMetadata, accessClass: "protected" as const };
  const objectStore: ObjectStore = {
    ...localObjectStore,
    get: async () => ({ metadata: protectedMetadata, body: Buffer.from("image") }),
    signedGetUrl: async () => {
      signedRequests += 1;
      return "https://objects.example/signed";
    },
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore,
    entitledImageObject: async () => protectedMetadata,
  }));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/media/linear/0123456789abcdef?delivery=inline`,
    { headers: adminAuth, redirect: "manual" },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(await response.text(), "image");
  assert.equal(signedRequests, 0);
});

test("returns a short-lived signed URL for authenticated browser media", async (t) => {
  let objectReads = 0;
  let signedRequests = 0;
  const protectedMetadata = { ...previewMetadata, accessClass: "protected" as const };
  const objectStore: ObjectStore = {
    ...localObjectStore,
    get: async () => {
      objectReads += 1;
      return { metadata: protectedMetadata, body: Buffer.from("image") };
    },
    signedGetUrl: async (_key, expiresSeconds) => {
      signedRequests += 1;
      assert.equal(expiresSeconds, 300);
      return "https://objects.example/signed-screen.png?token=temporary";
    },
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    objectStore,
    entitledImageObject: async () => protectedMetadata,
  }));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/media/linear/0123456789abcdef?delivery=url`,
    { headers: adminAuth },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, max-age=60");
  assert.deepEqual(await response.json(), {
    url: "https://objects.example/signed-screen.png?token=temporary",
    expiresInSeconds: 300,
  });
  assert.equal(signedRequests, 1);
  assert.equal(objectReads, 0);
});

test("gates customer app detail and unlocks a Free app", async (t) => {
  let unlocked = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    appMetadata: async (app: string) => ({
      app, icon_url: null, categories: [], total_screens: 1, total_ui_elements: 0,
      total_flows: 0, analyzed_screens: 0, last_captured_at: null,
      available_platforms: ["web", "ios", "android"],
    }),
    canAccessApp: async () => unlocked,
    getAccountEntitlements: async () => freeEntitlements,
    unlockFreeApp: async () => {
      unlocked = true;
      return { status: "unlocked", remaining: 2 };
    },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));
  const locked = await fetch(`${base}/apps/linear`, { headers: { authorization: "Bearer user" } });
  assert.equal(locked.status, 403);
  assert.deepEqual(await locked.json(), { error: "Upgrade required", code: "upgrade_required" });
  const unlock = await fetch(`${base}/apps/linear/unlock`, {
    method: "POST",
    headers: { authorization: "Bearer user" },
  });
  assert.equal(unlock.status, 201);
  const detail = await fetch(`${base}/apps/linear`, { headers: { authorization: "Bearer user" } });
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).app.platforms, ["web", "ios", "android"]);
});

test("returns app metadata without invoking section dependencies", async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    appMetadata: async () => ({
      app: "linear",
      icon_url: "https://cdn.example.com/linear.png",
      categories: [productivityCategory],
      total_screens: 236,
      total_ui_elements: 41,
      total_flows: 12,
      analyzed_screens: 200,
      last_captured_at: "2026-07-19T01:00:00.000Z",
      available_platforms: ["ios", "android"],
    }),
    listAppVersions: async () => { throw new Error("must not load versions"); },
    appEvidencePage: async () => { throw new Error("must not load evidence"); },
    getVersionFlows: async () => { throw new Error("must not load flows"); },
    getVersionDesignSystem: async () => { throw new Error("must not load design system"); },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/linear`, { headers: adminAuth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.app.totalScreens, 236);
  assert.deepEqual(body.app.categories, [productivityCategory]);
  assert.equal(body.app.totalUiElements, 41);
  assert.equal(body.app.totalFlows, 12);
  assert.equal("screens" in body.app, false);
  assert.equal("version" in body, false);
  assert.equal("nextCursor" in body, false);
  assert.equal((await fetch(`${base}/apps/linear?limit=48`, { headers: adminAuth })).status, 400);
});

test("returns captured website metadata and serves its app-scoped scrolling preview", async (t) => {
  const previewBody = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
  const preview: ObjectMetadata = {
    key: "public-pages/example.com/version/preview.webm",
    sha256: createHash("sha256").update(previewBody).digest("hex"),
    byteSize: previewBody.byteLength,
    contentType: "video/webm",
    accessClass: "protected",
  };
  const seen: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    appMetadata: async () => ({
      app: "example-com",
      icon_url: "https://example.com/favicon.ico",
      categories: [
        { id: 1, name: "Business", slug: "business" },
        { id: 2, name: "Developer tools", slug: "developer-tools" },
      ],
      display_name: "Example",
      description: "Build better examples.",
      website_url: "https://example.com",
      accent_color: "#123456",
      preview_version_id: 71,
      total_screens: 1,
      total_ui_elements: 5,
      total_flows: 0,
      analyzed_screens: 0,
      last_captured_at: "2026-07-21T01:00:00.000Z",
      available_platforms: ["web"],
    }),
    publicPageStore: {
      previewObject: async (app: string, versionId: number, publishedOnly?: boolean) => {
        seen.push([app, versionId, publishedOnly]);
        return app === "example-com" && versionId === 71 ? preview : undefined;
      },
    },
    objectStore: {
      ...localObjectStore,
      get: async () => ({ metadata: preview, body: previewBody }),
    },
    recordAccessEvent: async () => {},
  } as never));
  t.after(() => close(server));

  const detail = await fetch(`${base}/apps/example-com`, { headers: adminAuth });
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).app, {
    id: "example-com",
    app: "Example",
    categories: [
      { id: 1, name: "Business", slug: "business" },
      { id: 2, name: "Developer tools", slug: "developer-tools" },
    ],
    accent: "#123456",
    totalScreens: 1,
    totalUiElements: 5,
    totalFlows: 0,
    platforms: ["web"],
    analyzedScreens: 0,
    lastCapturedAt: "2026-07-21T01:00:00.000Z",
    websiteUrl: "https://example.com",
    iconUrl: "https://example.com/favicon.ico",
    description: "Build better examples.",
    previewVideoUrl: "/api/apps/example-com/page-preview/71",
  });

  const media = await fetch(`${base}/apps/example-com/page-preview/71`, { headers: adminAuth });
  assert.equal(media.status, 200);
  assert.equal(media.headers.get("content-type"), "video/webm");
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), previewBody);
  assert.deepEqual(seen, [["example-com", 71, false]]);
  assert.equal(
    (await fetch(`${base}/apps/another-app/page-preview/71`, { headers: adminAuth })).status,
    404,
  );
});

test("loads screens with complete category facets and filters the paged result", async (t) => {
  const calls: Array<{ kind: string; limit?: number; screenTypes?: string[] }> = [];
  let versionLists = 0;
  let versionResolutions = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    appPlatforms: async () => { throw new Error("explicit platform must skip platform discovery"); },
    listAppVersions: async () => {
      versionLists += 1;
      return [{ ...publishedVersion, app: "linear", platform: "ios" }];
    },
    resolveAppVersion: async () => {
      versionResolutions += 1;
      return { ...publishedVersion, app: "linear", platform: "ios" };
    },
    appEvidencePage: async (input) => {
      calls.push({ kind: input.kind, limit: input.limit, screenTypes: input.screenTypes });
      return { rows: catalogImages.map((image) => ({ ...image, platform: "ios", kind: input.kind })), nextCursor: "next" };
    },
    appScreenTypes: async () => ["Dashboard", "Login"],
    getVersionFlows: async () => { throw new Error("must not load flows"); },
    getVersionDesignSystem: async () => { throw new Error("must not load design system"); },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const versions = await fetch(`${base}/apps/linear/versions?platform=ios`, { headers: adminAuth });
  const screens = await fetch(`${base}/apps/linear/screens?platform=ios&version=1&type=Login&limit=48`, { headers: adminAuth });
  const elements = await fetch(`${base}/apps/linear/ui-elements?platform=ios&version=1&limit=24`, { headers: adminAuth });
  assert.equal(versions.status, 200);
  assert.equal(screens.status, 200);
  assert.equal(elements.status, 200);
  assert.deepEqual(calls, [
    { kind: "screen", limit: 48, screenTypes: ["Login"] },
    { kind: "ui_element", limit: 24, screenTypes: undefined },
  ]);
  assert.equal(versionLists, 1);
  assert.equal(versionResolutions, 0);
  const screenBody = await screens.json();
  assert.equal(screenBody.screens.length, 1);
  assert.deepEqual(screenBody.screenTypes, ["Dashboard", "Login"]);
  assert.equal((await elements.json()).nextCursor, "next");
});

test("returns entitlement-gated Screen and UI Element media URLs", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "astryx-section-media-"));
  mkdirSync(join(dataDir, "images", "linear"), { recursive: true });
  writeFileSync(join(dataDir, "images", "linear", "0123456789abcdef.webp"), "image");
  const { base, server } = await serve(createApiApp({
    dataDir,
    verifyAuthToken: async () => user,
    objectStore: localObjectStore,
    entitledImageObject: async () => previewMetadata,
    adminImageObject: async () => undefined,
    canAccessApp: async () => true,
    appPlatforms: async () => ["web"],
    resolveAppVersion: async () => publishedVersion,
    appEvidencePage: async (input) => ({
      rows: [{
        ...catalogImages[0],
        kind: input.kind,
        image_url: input.kind === "ui_element"
          ? "mobbin-bulk:ui_element:0123456789abcdef:1"
          : "mobbin-bulk:0123456789abcdef",
        ...(input.kind === "ui_element"
          ? {
              source_screen_id: 8,
              source_screen_image_url: "mobbin-bulk:0123456789abcdef",
            }
          : {}),
      }],
      nextCursor: null,
    }),
    recordAccessEvent: async () => {},
    recordReferralAppOpen: async () => {},
  }));
  t.after(async () => {
    await close(server);
    rmSync(dataDir, { recursive: true, force: true });
  });

  const headers = { authorization: "Bearer user" };
  const screens = await (await fetch(`${base}/apps/linear/screens?platform=web&version=1`, { headers })).json();
  const elements = await (await fetch(`${base}/apps/linear/ui-elements?platform=web&version=1`, { headers })).json();
  const screenUrl = new URL(screens.screens[0].url, base);
  const screenThumbnailUrl = new URL(screens.screens[0].thumbnailUrl, base);
  const elementUrl = new URL(elements.screens[0].url, base);
  const sourceScreenUrl = new URL(elements.screens[0].sourceScreen.url, base);

  for (const url of [screenUrl, screenThumbnailUrl, elementUrl, sourceScreenUrl]) {
    assert.equal(url.searchParams.has("expires"), false);
    assert.equal(url.searchParams.has("token"), false);
  }
  assert.equal(screenThumbnailUrl.searchParams.get("variant"), "thumb");
  assert.equal(elementUrl.searchParams.get("kind"), "ui_element");
  assert.equal(elementUrl.searchParams.get("i"), "1");
  assert.equal((await fetch(`${base}${screenUrl.pathname.replace("/api", "")}${screenUrl.search}`)).status, 404);
  assert.equal((await fetch(`${base}${screenUrl.pathname.replace("/api", "")}${screenUrl.search}`, { headers })).status, 200);
  assert.equal((await fetch(`${base}${elementUrl.pathname.replace("/api", "")}${elementUrl.search}`, { headers })).status, 200);
});

test("summarizes analyzed UI element crops for the Design System", async (t) => {
  let requested: {
    app: string;
    platform: string;
    versionNumber?: number | null;
    limit?: number;
  } | undefined;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    appPlatforms: async () => ["ios"],
    resolveAppVersion: async () => ({ ...publishedVersion, app: "shopee", platform: "ios" }),
    appUiElementSummary: async (input) => {
      requested = input;
      return {
        totalOccurrences: 5967,
        totalTypes: 42,
        items: [{
          component_type: "Top Navigation Bar",
          component_group: "Navigation",
          occurrence_count: 971,
          image_id: 1872010,
          image_url: "mobbin-bulk:0123456789abcdef",
          description: "Account and Security navigation",
          purpose: "Navigate back",
          visible_states: ["Default"],
        }],
      };
    },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/apps/shopee/ui-element-summary?platform=ios&version=1&limit=12`,
    { headers: adminAuth },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(requested, {
    app: "shopee",
    platform: "ios",
    versionNumber: 1,
    publishedOnly: false,
    limit: 12,
  });
  const body = await response.json();
  assert.equal(body.totalOccurrences, 5967);
  assert.equal(body.items[0].type, "Top Navigation Bar");
  assert.equal(body.items[0].count, 971);
  assert.match(body.items[0].imageUrl, /\/api\/media\/shopee\//);
});

test("loads flows without loading a design-system snapshot", async (t) => {
  let evidenceIds: number[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    appPlatforms: async () => ["ios"],
    listAppVersions: async () => [{ ...publishedVersion, app: "linear", platform: "ios" }],
    resolveAppVersion: async () => ({ ...publishedVersion, app: "linear", platform: "ios" }),
    getVersionFlows: async () => [{
      id: "login", title: "Login", description: "Authenticate", tags: [],
      steps: [{ label: "Enter email", evidence: [7] }],
    }],
    flowEvidenceImages: async ({ imageIds }) => {
      evidenceIds = imageIds;
      return catalogImages.map((image) => ({ ...image, platform: "ios" }));
    },
    getVersionDesignSystem: async () => { throw new Error("must not load design system"); },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/linear/flows?platform=ios&version=1`, { headers: adminAuth });
  assert.equal(response.status, 200);
  assert.deepEqual(evidenceIds, [7]);
  assert.equal((await response.json()).flows[0].id, "login");
});

test("uses app-scoped evidence for an admin app without a published version", async (t) => {
  let requested: { app: string; kind: string; platform: string } | undefined;
  const platformMetadata = { appPlatforms: async () => ["web"] };
  const { base, server } = await serve(createApiApp({
    ...platformMetadata,
    verifyAuthToken: async () => admin,
    canAccessApp: async () => true,
    listAppVersions: async () => { throw new Error("section routes must not list all versions"); },
    resolveAppVersion: async () => undefined,
    appEvidencePage: async (input) => {
      requested = { app: input.app, kind: input.kind, platform: input.platform };
      return { rows: catalogImages.filter((image) => image.app === input.app), nextCursor: null };
    },
    recordAccessEvent: async () => {},
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/apps/linear/screens?platform=web&limit=1`, { headers: adminAuth });
  assert.equal(response.status, 200);
  assert.deepEqual(requested, { app: "linear", kind: "screen", platform: "web" });
  assert.equal((await response.json()).screens.length, 1);
});




test("rejects invalid canonical admin Apps discovery before reading stores", async (t) => {
  let calls = 0;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    adminCatalogPage: async () => {
      calls += 1;
      return catalogPageRecord;
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(
    `${base}/apps?platform=desktop&sort=trending&filter=screens.Dashboard`,
    { headers: adminAuth },
  );
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});


test("returns a paginated user directory and growth stats for an admin", async (t) => {
  const growthStats = {
    total_users: 12,
    new_users_7d: 3,
    active_subscribers: 2,
    dau: 4,
    wau: 8,
    total_free_unlocks: 5,
    active_monthly: 1,
    active_yearly: 1,
    canceled_30d: 1,
  };
  const dailySignups = [{ day: "2026-07-15", signups: 1 }];
  const userRow = { id: 2, email: user.email, role: "user" as const, active: true, created_at: "2026-07-14T00:00:00.000Z", subscription_status: null };
  let requested: unknown;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    listAdminUsersPage: async (input) => {
      requested = input;
      return { users: [userRow], nextCursor: "next", total: 42 };
    },
    getGrowthStats: async () => growthStats,
    getDailySignups: async () => dailySignups,
  }));
  t.after(() => close(server));

  const users = await fetch(`${base}/admin/users?limit=30&q=pro&filter=pro`, { headers: adminAuth });
  assert.equal(users.status, 200);
  assert.deepEqual(requested, { limit: 30, cursor: undefined, query: "pro", filter: "pro" });
  assert.deepEqual(await users.json(), { users: [userRow], nextCursor: "next", total: 42 });

  const growth = await fetch(`${base}/admin/users/growth`, { headers: adminAuth });
  assert.equal(growth.status, 200);
  assert.deepEqual(await growth.json(), { stats: growthStats, dailySignups });
});

test("updates account state and maps safety errors", async (t) => {
  let requested: unknown;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    setAdminUserActive: async (input) => {
      requested = input;
      return { status: "forbidden", reason: "self_disable" };
    },
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/admin/users/${admin.id}/active`, {
    method: "PATCH",
    headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(requested, { actorUserId: admin.id, userId: admin.id, active: false });
  assert.deepEqual(await response.json(), { error: "You cannot disable your own account", code: "self_disable" });
});

test("grants and revokes manual Pro access for an admin", async (t) => {
  const userRow = {
    id: user.id, email: user.email, role: "user" as const, active: true,
    created_at: "2026-07-14T00:00:00.000Z", subscription_status: "active", manual_pro_grant: true,
  };
  const requests: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    grantAdminUserPro: async (input) => { requests.push(["grant", input]); return { status: "updated", user: userRow }; },
    revokeAdminUserProGrant: async (userId) => { requests.push(["revoke", userId]); return { status: "updated", user: { ...userRow, manual_pro_grant: false, subscription_status: null } }; },
  }));
  t.after(() => close(server));

  const grant = await fetch(`${base}/admin/users/${user.id}/subscription/upgrade`, { method: "POST", headers: adminAuth });
  const revoke = await fetch(`${base}/admin/users/${user.id}/subscription/grant`, { method: "DELETE", headers: adminAuth });
  assert.equal(grant.status, 200);
  assert.deepEqual(await grant.json(), userRow);
  assert.equal(revoke.status, 200);
  assert.deepEqual(requests, [
    ["grant", { actorUserId: admin.id, userId: user.id }],
    ["revoke", user.id],
  ]);
});

test("returns global and per-user usage for supported ranges", async (t) => {
  const overview = {
    summary: { totalEvents: 3, uniqueUsers: 1, usedFeatures: 1 },
    features: [{ key: "exports" as const, label: "Exports", uses: 3, uniqueUsers: 1, share: 100 }],
    daily: [{ day: "2026-07-19", uses: 3 }],
  };
  const detail = {
    summary: { totalEvents: 3, lastActiveAt: "2026-07-19T08:00:00.000Z" },
    features: overview.features,
    recentEvents: [],
  };
  const requested: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    getFeatureUsageOverview: async (range) => { requested.push(["global", range]); return overview; },
    getUserFeatureUsage: async (userId, range) => { requested.push(["user", userId, range]); return detail; },
  }));
  t.after(() => close(server));

  const global = await fetch(`${base}/admin/users/usage?range=30d`, { headers: adminAuth });
  assert.equal(global.status, 200);
  assert.deepEqual(await global.json(), overview);
  const perUser = await fetch(`${base}/admin/users/2/usage?range=7d`, { headers: adminAuth });
  assert.equal(perUser.status, 200);
  assert.deepEqual(await perUser.json(), detail);
  assert.deepEqual(requested, [
    ["global", { key: "30d", days: 30 }],
    ["user", 2, { key: "7d", days: 7 }],
  ]);
});

test("validates user analytics ranges and missing users", async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    getUserFeatureUsage: async () => undefined,
  }));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/admin/users/usage?range=365d`, { headers: adminAuth })).status, 400);
  assert.equal((await fetch(`${base}/admin/users/999/usage?range=30d`, { headers: adminAuth })).status, 404);
});

test("logs in with a JWT Bearer token and resolves me", async (t) => {
  const { base, server } = await serve(
    createApiApp({
      authenticateUser: async (email, password) =>
        email === admin.email && password === "admin password" ? admin : undefined,
    })
  );
  t.after(() => close(server));

  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "admin password" }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as {
    user: typeof admin;
    token: string;
    expiresAt: string;
  };
  const { token } = loginBody;
  assert.deepEqual(loginBody.user, admin);
  assert.equal(token.split(".").length, 3);
  assert.ok(Date.parse(loginBody.expiresAt) > Date.now());
  assert.match(login.headers.get("set-cookie") ?? "", /astryx_session=;/);
  assert.doesNotMatch(login.headers.get("set-cookie") ?? "", /eyJ/);

  const me = await fetch(`${base}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.deepEqual(await me.json(), admin);

  const logout = await fetch(`${base}/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(logout.status, 204);

  // Stateless logout cannot revoke a copied token before its expiry.
  const copiedToken = await fetch(`${base}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.deepEqual(await copiedToken.json(), admin);
});

test("resolves an anonymous me request as no user", async (t) => {
  const { base, server } = await serve(createApiApp());
  t.after(() => close(server));

  const response = await fetch(`${base}/auth/me`);
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
  assert.match(response.headers.get("set-cookie") ?? "", /astryx_session=;/);
});

test("returns one generic login failure", async (t) => {
  const { base, server } = await serve(
    createApiApp({ authenticateUser: async () => undefined })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "wrong" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid email or password" });
});

test("signs up a new user with a JWT Bearer token", async (t) => {
  const newUser = { id: 3, email: "new@example.com", role: "user" as const };
  const { base, server } = await serve(
    createApiApp({
      registerUser: async (email, password) =>
        email === newUser.email && password === "a long enough password" ? newUser : undefined,
    })
  );
  t.after(() => close(server));

  const response = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: newUser.email, password: "a long enough password" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { user: typeof newUser; token: string; expiresAt: string };
  assert.deepEqual(body.user, newUser);
  assert.equal(body.token.split(".").length, 3);
  assert.ok(Date.parse(body.expiresAt) > Date.now());
  assert.match(response.headers.get("set-cookie") ?? "", /astryx_session=;/);
  assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /eyJ/);
});

test("rejects a duplicate email and invalid signup input", async (t) => {
  const { base, server } = await serve(
    createApiApp({ registerUser: async () => undefined })
  );
  t.after(() => close(server));

  const duplicate = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "taken@example.com", password: "a long enough password" }),
  });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: "An account with this email already exists" });

  const badEmail = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "a long enough password" }),
  });
  assert.equal(badEmail.status, 400);

  const shortPassword = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password: "short" }),
  });
  assert.equal(shortPassword.status, 400);
});

test("sends a neutral one-time password reset link without exposing the token", async (t) => {
  const deliveries: Array<{ to: string; resetUrl: string }> = [];
  const requested: string[] = [];
  const { base, server } = await serve(createApiApp({
    appUrl: "https://vitrines.example",
    createPasswordReset: async (email: string) => {
      requested.push(email);
      return email === "member@example.com"
        ? { email, token: "a".repeat(43), expiresAt: new Date("2026-08-12T10:30:00Z") }
        : undefined;
    },
    passwordResetEmailSender: { send: async (delivery) => { deliveries.push(delivery); } },
  }));
  t.after(() => close(server));

  const known = await fetch(`${base}/auth/password-reset/request`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "member@example.com" }),
  });
  const unknown = await fetch(`${base}/auth/password-reset/request`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com" }),
  });

  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.deepEqual(await known.json(), { accepted: true });
  assert.deepEqual(await unknown.json(), { accepted: true });
  assert.deepEqual(requested, ["member@example.com", "missing@example.com"]);
  assert.deepEqual(deliveries, [{
    to: "member@example.com",
    resetUrl: `https://vitrines.example/reset-password?token=${"a".repeat(43)}`,
  }]);
});

test("limits reset email delivery per recipient while keeping every response neutral", async (t) => {
  const deliveries: string[] = [];
  const { base, server } = await serve(createApiApp({
    createPasswordReset: async (email: string) => ({
      email,
      token: "a".repeat(43),
      expiresAt: new Date("2026-08-12T10:30:00Z"),
    }),
    passwordResetEmailSender: { send: async ({ to }) => { deliveries.push(to); } },
  }));
  t.after(() => close(server));

  const responses = await Promise.all([...Array(4)].map(() => fetch(`${base}/auth/password-reset/request`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "member@example.com" }),
  })));
  assert.deepEqual(responses.map(({ status }) => status), [202, 202, 202, 202]);
  assert.equal(deliveries.length, 3);
});

test("redeems only a valid reset token and enforces password length", async (t) => {
  const resets: Array<[string, string]> = [];
  const { base, server } = await serve(createApiApp({
    resetPasswordWithToken: async (token: string, password: string) => {
      resets.push([token, password]);
      return token === "a".repeat(43);
    },
  }));
  t.after(() => close(server));

  const short = await fetch(`${base}/auth/password-reset`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43), password: "short" }),
  });
  const invalid = await fetch(`${base}/auth/password-reset`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "bad", password: "long enough" }),
  });
  const valid = await fetch(`${base}/auth/password-reset`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43), password: "long enough" }),
  });

  assert.equal(short.status, 400);
  assert.equal(invalid.status, 400);
  assert.equal(valid.status, 204);
  assert.deepEqual(resets, [["a".repeat(43), "long enough"]]);
});

test("validates referral links publicly and keeps signup available when attribution fails", async (t) => {
  const newUser = { id: 3, email: "referred@example.com", role: "user" as const };
  const validations: Array<{ token: string; visitor?: string }> = [];
  let attributedUserId: number | undefined;
  const { base, server } = await serve(createApiApp({
    referralCampaign,
    appUrl: "https://astryx.example",
    validateReferralToken: async (token: string, _campaign: ReferralCampaign, visitor?: string) => {
      validations.push({ token, visitor });
      return token === "v".repeat(48);
    },
    registerUser: async () => newUser,
    attributeReferralSignup: async ({ invitedUserId }: { invitedUserId: number }) => {
      attributedUserId = invitedUserId;
      throw new Error("referral store unavailable");
    },
  } as never));
  t.after(() => close(server));

  const validation = await fetch(`${base}/referrals/validate?token=${"v".repeat(48)}&visitor=browser-visitor`);
  assert.equal(validation.status, 200);
  assert.deepEqual(await validation.json(), { valid: true });
  assert.deepEqual(validations, [{ token: "v".repeat(48), visitor: "browser-visitor" }]);

  const signup = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: newUser.email,
      password: "a long enough password",
      referralToken: "v".repeat(48),
    }),
  });
  assert.equal(signup.status, 200);
  assert.deepEqual((await signup.json() as { user: typeof newUser }).user, newUser);
  assert.equal(attributedUserId, newUser.id);
});

test("returns safe referral state, creates a share link, and activates a banked month", async (t) => {
  const summary = {
    campaign: { id: referralCampaign.id, active: true, endsAt: referralCampaign.endsAt.toISOString() },
    referralCount: 1,
    activatedCount: 1,
    earnedCount: 1,
    availableMonths: 1,
    referrals: [{ id: "11", state: "rewarded" as const }],
  };
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    referralCampaign,
    appUrl: "https://astryx.example",
    createReferralCode: async () => ({ token: "s".repeat(48) }),
    referralSummary: async () => summary,
    activateProMonth: async () => ({
      status: "activated",
      expiresAt: "2026-08-24T10:00:00.000Z",
      availableMonths: 0,
    }),
  } as never));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user" };

  const link = await fetch(`${base}/referrals/link`, { method: "POST", headers });
  assert.equal(link.status, 201);
  assert.deepEqual(await link.json(), { url: `https://astryx.example/?ref=${"s".repeat(48)}` });
  assert.deepEqual(await (await fetch(`${base}/referrals/summary`, { headers })).json(), summary);
  assert.deepEqual(await (await fetch(`${base}/referrals/rewards/activate`, { method: "POST", headers })).json(), {
    status: "activated",
    expiresAt: "2026-08-24T10:00:00.000Z",
    availableMonths: 0,
  });
});

test("records only authorized app-detail opens for referral activation", async (t) => {
  const recorded: string[] = [];
  let allowed = true;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    referralCampaign,
    canAccessApp: async () => allowed,
    recordReferralAppOpen: async (_userId: number, appSlug: string) => {
      recorded.push(appSlug);
      return { rewardIssued: false };
    },
    appMetadata: async (app: string) => ({
      app, icon_url: null, categories: [], total_screens: 1, total_ui_elements: 0,
      total_flows: 0, analyzed_screens: 0, last_captured_at: null,
      available_platforms: ["web"],
    }),
    recordAccessEvent: async () => undefined,
  } as never));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user" };

  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  allowed = false;
  assert.equal((await fetch(`${base}/apps/notion`, { headers })).status, 403);
  assert.deepEqual(recorded, ["linear"]);
});

test("keeps referral metrics and revocations admin-only", async (t) => {
  const metrics = {
    linksCreated: 4,
    uniqueReferralVisits: 10,
    referredSignups: 5,
    referredActivations: 3,
    rewardsIssued: 3,
    signupToActivationRate: 60,
    referredPaidConversions: 1,
    organicPaidConversions: 2,
    referredRetention: { day7: 80, day30: 60, day60: 50 },
    revocations: 1,
  };
  let metricCalls = 0;
  const userApp = await serve(createApiApp({
    verifyAuthToken: async () => user,
    referralCampaign,
    referralCampaignMetrics: async () => { metricCalls += 1; return metrics; },
  } as never));
  t.after(() => close(userApp.server));
  assert.equal((await fetch(`${userApp.base}/admin/referrals/metrics`, {
    headers: { authorization: "Bearer user" },
  })).status, 403);
  assert.equal(metricCalls, 0);

  const revoked: string[] = [];
  const adminApp = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    referralCampaign,
    referralCampaignMetrics: async () => metrics,
    revokeReferral: async (id: number) => { revoked.push(`referral:${id}`); return id === 11; },
    revokeReferralReward: async (id: number) => { revoked.push(`reward:${id}`); return true; },
    revokePromotionalEntitlement: async (id: number) => { revoked.push(`entitlement:${id}`); return true; },
  } as never));
  t.after(() => close(adminApp.server));
  const headers = { authorization: "Bearer admin" };
  assert.deepEqual(await (await fetch(`${adminApp.base}/admin/referrals/metrics`, { headers })).json(), metrics);
  assert.equal((await fetch(`${adminApp.base}/admin/referrals/11/revoke`, { method: "POST", headers })).status, 204);
  assert.equal((await fetch(`${adminApp.base}/admin/referral-rewards/12/revoke`, { method: "POST", headers })).status, 204);
  assert.equal((await fetch(`${adminApp.base}/admin/promotional-entitlements/13/revoke`, { method: "POST", headers })).status, 204);
  assert.equal((await fetch(`${adminApp.base}/admin/referrals/not-an-id/revoke`, { method: "POST", headers })).status, 400);
  assert.equal((await fetch(`${adminApp.base}/admin/referrals/99/revoke`, { method: "POST", headers })).status, 404);
  assert.deepEqual(revoked, ["referral:11", "reward:12", "entitlement:13", "referral:99"]);
});

test("rejects legacy cookie authentication after the Bearer-token cutover", async (t) => {
  const { base, server } = await serve(createApiApp());
  t.after(() => close(server));
  const response = await fetch(`${base}/auth/me`, {
    headers: { cookie: "astryx_session=legacy-opaque-token" },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});

test("rejects normal users and keeps imports disabled for admins", async (t) => {
  const userApp = await serve(createApiApp({ verifyAuthToken: async () => user }));
  t.after(() => close(userApp.server));
  const denied = await fetch(`${userApp.base}/jobs`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(denied.status, 403);

  let created = false;
  const adminApp = await serve(
    createApiApp({
      verifyAuthToken: async () => admin,
      createJob: async () => {
        created = true;
        return 9;
      },
      publishJob: async () => {},
    })
  );
  t.after(() => close(adminApp.server));
  const allowed = await fetch(`${adminApp.base}/jobs`, {
    method: "POST",
    headers: { authorization: "Bearer admin", "content-type": "application/json" },
    body: JSON.stringify({
      type: "import-app",
      name: "linear",
      url: "https://mobbin.com/apps/a/b/screens",
    }),
  });
  assert.equal(allowed.status, 410);
  assert.deepEqual(await allowed.json(), { error: "Imports are disabled" });
  assert.equal(created, false);
});

test("accepts raw Paddle webhooks before JSON parsing", async (t) => {
  let received = "";
  const { base, server } = await serve(createApiApp({
    billing: {
      createCheckout: async () => ({ status: "already_subscribed" }),
      createTeamCheckout: async () => ({ status: "already_subscribed" }),
      createPortal: async () => undefined,
      reconcileCheckoutSession: async () => "not_found",
      handleWebhook: async (body) => {
        received = body.toString();
        return "processed";
      },
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "paddle-signature": "sig" },
    body: '{"id":"evt_1"}',
  });
  assert.equal(response.status, 200);
  assert.equal(received, '{"id":"evt_1"}');
});

test("creates Checkout and returns safe subscription state", async (t) => {
  const events: Array<{ action: string; outcome: string; metadata?: Record<string, unknown> }> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    billing: {
      createCheckout: async (_user, interval) => ({ status: "created", transactionId: `txn_${interval}` }),
      createTeamCheckout: async () => ({ status: "created", transactionId: "txn_team" }),
      createPortal: async () => ({ url: "https://paddle/portal" }),
      reconcileCheckoutSession: async () => "processed",
      handleWebhook: async () => "processed",
    },
    getAccountEntitlements: async () => ({
      plan: "pro",
      entitlementSource: "paid",
      promotionExpiresAt: null,
      subscription: {
        user_id: user.id,
        stripe_customer_id: "cus_secret",
        stripe_subscription_id: "sub_secret",
        stripe_price_id: "price_secret",
        paddle_customer_id: "ctm_secret",
        paddle_subscription_id: "sub_secret",
        paddle_price_id: "pri_secret",
        billing_interval: "month",
        status: "active",
        current_period_start: "2026-07-01T00:00:00Z",
        current_period_end: "2026-08-01T00:00:00Z",
        cancel_at_period_end: false,
        grace_expires_at: null,
      },
      freeUnlocks: ["linear"],
      freeUnlocksRemaining: 2,
      team: null,
      exportUsage: { used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" },
    }),
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const checkout = await fetch(`${base}/billing/checkout`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ interval: "month" }),
  });
  assert.equal(checkout.status, 201);
  assert.deepEqual(await checkout.json(), { transactionId: "txn_month" });
  const subscription = await (await fetch(`${base}/billing/subscription`, {
    headers: { authorization: "Bearer user" },
  })).json();
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.interval, "month");
  assert.equal(subscription.stripe_customer_id, undefined);
  assert.deepEqual(events.map(({ action, outcome, metadata }) => ({ action, outcome, metadata })), [{
    action: "checkout_started",
    outcome: "created",
    metadata: { interval: "month" },
  }]);
});

test("records only allowed authenticated app funnel events", async (t) => {
  const events: Array<{ action: string; outcome: string; appSlug?: string }> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };

  const accepted = await fetch(`${base}/apps/linear/funnel-events`, {
    method: "POST", headers, body: JSON.stringify({ action: "unlock_clicked" }),
  });
  assert.equal(accepted.status, 204);
  const rejected = await fetch(`${base}/apps/linear/funnel-events`, {
    method: "POST", headers, body: JSON.stringify({ action: "invented_event" }),
  });
  assert.equal(rejected.status, 400);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "unlock_clicked");
  assert.equal(events[0]?.outcome, "viewed");
  assert.equal(events[0]?.appSlug, "linear");
});

test("blocks catalog-wide traversal and records a redacted audit event", async (t) => {
  const events: Array<{ appSlug?: string; ipPrefix?: string; featureKey?: string; action: string; outcome: string }> = [];
  const images = [
    ...catalogImages,
    { ...catalogImages[0], id: 8, app: "notion", image_url: "mobbin-bulk:1111111111111111" },
  ];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    appMetadata: async (app) => ({
      app, icon_url: null, categories: [],
      total_screens: images.filter((image) => image.app === app).length,
      total_ui_elements: 0, total_flows: 0, analyzed_screens: 0,
      last_captured_at: null, available_platforms: ["web"],
    }),
    appTraversalLimit: 1,
    recordAccessEvent: async (event) => { events.push(event); },
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user" };
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/apps/linear`, { headers })).status, 200);
  const blocked = await fetch(`${base}/apps/notion`, { headers });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "600");
  assert.equal(events.at(-1)?.appSlug, "notion");
  assert.equal(events.at(-1)?.outcome, "blocked");
  assert.match(events.at(-1)?.ipPrefix ?? "", /\/24$/);
  assert.equal(events.find(({ outcome }) => outcome === "success")?.featureKey, "library");
});

test("reserves a validated selected export for entitled Pro", async (t) => {
  let receivedUserId: number | undefined;
  const events: Array<{ featureKey?: string; action: string; outcome: string }> = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    appImages: async () => catalogImages,
    recordAccessEvent: async (event) => { events.push(event); },
    reserveExportOperation: async (userId) => {
      receivedUserId = userId;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "screens", ids: [7] }),
  });
  assert.equal(response.status, 201);
  assert.equal(receivedUserId, user.id);
  assert.equal((await response.json()).status, "reserved");
  assert.deepEqual(events[0], {
    userId: user.id,
    ipPrefix: "127.0.0.0/24",
    appSlug: "linear",
    featureKey: "exports",
    action: "export-reservation",
    outcome: "accepted",
  });
});

test("rejects oversized or unavailable export reservations", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => false,
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "not_pro", used: 0, limit: 20, resetAt: null };
    },
  }));
  t.after(() => close(server));
  const headers = { authorization: "Bearer user", "content-type": "application/json" };
  const invalid = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "screens", ids: Array.from({ length: 11 }, (_, i) => i + 1) }),
  });
  assert.equal(invalid.status, 400);
  const locked = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(locked.status, 403);
  assert.equal(reserved, false);
});

test("rejects component exports that do not belong to the app design system", async (t) => {
  let reserved = false;
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    canAccessApp: async () => true,
    getDesignSystem: async () => ({
      app: "linear",
      generatedAt: "2026-07-10T00:00:00Z",
      tokens: [],
      components: [],
      flows: [],
    }),
    recordAccessEvent: async () => {},
    reserveExportOperation: async () => {
      reserved = true;
      return { status: "reserved", used: 1, limit: 20, resetAt: "2026-08-01T00:00:00Z" };
    },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/apps/linear/exports/reservations?platform=web`, {
    method: "POST",
    headers: { authorization: "Bearer user", "content-type": "application/json" },
    body: JSON.stringify({ kind: "component-family", id: "buttons" }),
  });
  assert.equal(response.status, 400);
  assert.equal(reserved, false);
});
