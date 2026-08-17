import assert from "node:assert/strict";
import test from "node:test";
import {
  createThreadsMarketingService,
  currentDateInTimeZone,
  threadsMarketingConfigFromEnv,
} from "./threadsMarketing.ts";
import {
  emptyThreadsPostMetrics,
  type ThreadsMarketingPost,
  type ThreadsPostMetrics,
} from "../../../src/threadsMarketing.ts";
import type { ThreadsMarketingStore } from "../../../src/threadsMarketingStore.ts";

function store(): ThreadsMarketingStore {
  const posts = new Map<string, ThreadsMarketingPost>();
  return {
    findDaily: async (date) => [...posts.values()].find((post) => post.kind === "daily" && post.paletteDate === date),
    get: async (id) => posts.get(id),
    save: async (post) => { posts.set(post.id, post); return post; },
    markPublished: async (id, threadsPostId, publishedAt) => {
      const post = posts.get(id)!;
      const next = { ...post, status: "published" as const, threadsPostId, publishedAt: publishedAt.toISOString(), error: null };
      posts.set(id, next); return next;
    },
    markFailed: async (id, error) => {
      const post = posts.get(id)!;
      const next = { ...post, status: "failed" as const, error };
      posts.set(id, next); return next;
    },
    updateMetrics: async (id, metrics, refreshedAt) => {
      const post = posts.get(id)!;
      const next = { ...post, metrics, metricsRefreshedAt: refreshedAt.toISOString() };
      posts.set(id, next); return next;
    },
    list: async () => [...posts.values()],
  };
}

test("Threads marketing remains safely inactive without explicit configuration", () => {
  assert.equal(threadsMarketingConfigFromEnv({}), undefined);
  assert.throws(() => threadsMarketingConfigFromEnv({ THREADS_MARKETING_ENABLED: "true" }), /THREADS_ACCESS_TOKEN/);
});

test("daily publishing is idempotent and saves traction", async () => {
  const memory = store();
  let published = 0;
  const service = createThreadsMarketingService({
    store: memory,
    config: { accessToken: "token", apiOrigin: "https://graph.threads.net", publicImageOrigin: "https://vitrines.ai", dailyTime: "09:00", timeZone: "Asia/Ho_Chi_Minh" },
    client: {
      publish: async () => ({ id: `thread-${++published}` }),
      insights: async (): Promise<ThreadsPostMetrics> => ({ ...emptyThreadsPostMetrics(), views: 42, likes: 4 }),
    },
  });
  const now = new Date("2026-08-16T03:00:00.000Z");
  const first = await service.publishDaily(now);
  const second = await service.publishDaily(now);
  assert.equal(first.status, "published");
  assert.equal(second.id, first.id);
  assert.equal(published, 1);
  const [refreshed] = await service.refreshInsights(first.id);
  assert.equal(refreshed.metrics.views, 42);
  assert.equal(currentDateInTimeZone(now, "Asia/Ho_Chi_Minh"), "2026-08-16");
});
