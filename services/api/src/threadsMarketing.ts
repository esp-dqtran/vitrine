import type express from "express";
import {
  createThreadsMarketingPost,
  emptyThreadsPostMetrics,
  type ThreadsMarketingPost,
  type ThreadsPostMetrics,
} from "../../../src/threadsMarketing.ts";
import type { ThreadsMarketingStore } from "../../../src/threadsMarketingStore.ts";

export interface ThreadsMarketingConfig {
  accessToken: string;
  apiOrigin: string;
  publicImageOrigin: string;
  dailyTime: string;
  timeZone: string;
}

export interface ThreadsClient {
  publish(input: { caption: string; imageUrl: string }): Promise<{ id: string }>;
  insights(postId: string): Promise<ThreadsPostMetrics>;
}

export function threadsMarketingConfigFromEnv(env: Record<string, string | undefined>): ThreadsMarketingConfig | undefined {
  if (env.THREADS_MARKETING_ENABLED !== "true") return undefined;
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`${key} is required when THREADS_MARKETING_ENABLED=true`);
    return value;
  };
  const dailyTime = env.THREADS_DAILY_TIME?.trim() || "09:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyTime)) throw new Error("THREADS_DAILY_TIME must be HH:MM");
  const timeZone = env.THREADS_TIME_ZONE?.trim() || "Asia/Ho_Chi_Minh";
  try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new Error("THREADS_TIME_ZONE must be a valid IANA timezone"); }
  const accessToken = required("THREADS_ACCESS_TOKEN");
  const publicImageOrigin = required("THREADS_PUBLIC_IMAGE_ORIGIN").replace(/\/$/, "");
  if (!/^https:\/\//.test(publicImageOrigin)) throw new Error("THREADS_PUBLIC_IMAGE_ORIGIN must be an HTTPS URL");
  return {
    accessToken,
    apiOrigin: (env.THREADS_API_ORIGIN?.trim() || "https://graph.threads.net").replace(/\/$/, ""),
    publicImageOrigin,
    dailyTime,
    timeZone,
  };
}

function apiError(body: unknown, fallback: string): Error {
  const record = body && typeof body === "object" ? body as { error?: { message?: unknown } } : undefined;
  return new Error(typeof record?.error?.message === "string" ? record.error.message : fallback);
}

export function createThreadsClient(config: ThreadsMarketingConfig, fetcher: typeof fetch = fetch): ThreadsClient {
  const request = async (path: string, body?: URLSearchParams) => {
    const response = await fetcher(`${config.apiOrigin}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { authorization: `Bearer ${config.accessToken}`, "content-type": "application/x-www-form-urlencoded" } : { authorization: `Bearer ${config.accessToken}` },
      ...(body ? { body } : {}),
    });
    const json = await response.json().catch(() => undefined);
    if (!response.ok) throw apiError(json, `Threads API request failed (${response.status})`);
    return json as Record<string, unknown>;
  };
  return {
    async publish({ caption, imageUrl }) {
      const container = await request("/me/threads", new URLSearchParams({
        media_type: "IMAGE", image_url: imageUrl, text: caption,
      }));
      const creationId = typeof container.id === "string" ? container.id : undefined;
      if (!creationId) throw new Error("Threads API did not return a media container id");
      const published = await request(`/me/threads_publish?creation_id=${encodeURIComponent(creationId)}`, new URLSearchParams());
      if (typeof published.id !== "string") throw new Error("Threads API did not return a post id");
      return { id: published.id };
    },
    async insights(postId) {
      const response = await request(`/${encodeURIComponent(postId)}/insights?metric=views,likes,replies,reposts,quotes,shares`);
      const data = Array.isArray(response.data) ? response.data : [];
      const result = emptyThreadsPostMetrics();
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const metric = item as { name?: unknown; values?: unknown };
        const value = Array.isArray(metric.values) ? metric.values.at(-1) : undefined;
        const raw = value && typeof value === "object" ? (value as { value?: unknown }).value : undefined;
        if (typeof metric.name === "string" && metric.name in result && typeof raw === "number") {
          result[metric.name as keyof ThreadsPostMetrics] = raw;
        }
      }
      return result;
    },
  };
}

export function currentDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function renderThreadsPaletteSvg(post: ThreadsMarketingPost): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!));
  const blocks = post.palette.colors.map((color, index) => {
    const y = 90 + index * 330;
    const outlined = index === 2 ? ` stroke="${color.foreground}" stroke-width="6"` : "";
    return `<rect x="70" y="${y}" width="940" height="390" rx="52" fill="${color.hex}"${outlined}/><text x="140" y="${y + 125}" fill="${color.foreground}" font-family="Arial, sans-serif" font-size="32" font-weight="700">HEX</text><text x="140" y="${y + 172}" fill="${color.foreground}" font-family="Arial, sans-serif" font-size="34" font-weight="700">${color.hex}</text><text x="140" y="${y + 286}" fill="${color.foreground}" font-family="Arial, sans-serif" font-size="72" font-weight="700">${escape(color.name)}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1200" viewBox="0 0 1080 1200"><rect width="1080" height="1200" fill="#F0D6BC"/>${blocks}</svg>`;
}

export interface ThreadsMarketingService {
  publishDaily(now?: Date): Promise<ThreadsMarketingPost>;
  publishOnDemand(now?: Date): Promise<ThreadsMarketingPost>;
  refreshInsights(id?: string): Promise<ThreadsMarketingPost[]>;
  dashboard(): Promise<{ configured: boolean; dailyTime: string | null; timeZone: string | null; posts: ThreadsMarketingPost[] }>;
}

export function createThreadsMarketingService({ store, client, config }: {
  store: ThreadsMarketingStore;
  client?: ThreadsClient;
  config?: ThreadsMarketingConfig;
}): ThreadsMarketingService {
  const publish = async (post: ThreadsMarketingPost): Promise<ThreadsMarketingPost> => {
    if (!client || !config) return store.markFailed(post.id, "Threads marketing is not configured");
    try {
      const result = await client.publish({ caption: post.caption, imageUrl: `${config.publicImageOrigin}/api/threads-marketing/posts/${post.id}/image.svg` });
      return await store.markPublished(post.id, result.id, new Date());
    } catch (error) {
      return store.markFailed(post.id, error instanceof Error ? error.message : "Threads publishing failed");
    }
  };
  return {
    async publishDaily(now = new Date()) {
      const date = currentDateInTimeZone(now, config?.timeZone ?? "Asia/Ho_Chi_Minh");
      const existing = await store.findDaily(date);
      if (existing?.status === "published") return existing;
      return publish(existing ?? await store.save(createThreadsMarketingPost({ kind: "daily", paletteDate: date, now })));
    },
    async publishOnDemand(now = new Date()) {
      const date = currentDateInTimeZone(now, config?.timeZone ?? "Asia/Ho_Chi_Minh");
      return publish(await store.save(createThreadsMarketingPost({ kind: "on-demand", paletteDate: date, now })));
    },
    async refreshInsights(id) {
      const posts = id ? [await store.get(id)].filter((post): post is ThreadsMarketingPost => Boolean(post)) : await store.list();
      if (!client) return posts;
      return Promise.all(posts.map(async (post) => post.threadsPostId
        ? store.updateMetrics(post.id, await client.insights(post.threadsPostId), new Date())
        : post));
    },
    async dashboard() {
      return { configured: Boolean(client && config), dailyTime: config?.dailyTime ?? null, timeZone: config?.timeZone ?? null, posts: await store.list() };
    },
  };
}

export function mountThreadsMarketingPublicRoutes(app: express.Express, store: ThreadsMarketingStore): void {
  app.get("/threads-marketing/posts/:id/image.svg", async (req, res) => {
    const post = await store.get(req.params.id);
    if (!post) { res.status(404).end(); return; }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.type("image/svg+xml").send(renderThreadsPaletteSvg(post));
  });
}

export function mountThreadsMarketingRoutes(app: express.Express, requireAdmin: express.RequestHandler, service: ThreadsMarketingService): void {
  app.get("/admin/threads-marketing", requireAdmin, async (_req, res) => res.json(await service.dashboard()));
  app.post("/admin/threads-marketing/posts", requireAdmin, async (_req, res) => res.status(201).json(await service.publishOnDemand()));
  app.post("/admin/threads-marketing/daily", requireAdmin, async (_req, res) => res.json(await service.publishDaily()));
  app.post("/admin/threads-marketing/insights", requireAdmin, async (req, res) => {
    const id = typeof req.body?.postId === "string" ? req.body.postId : undefined;
    res.json(await service.refreshInsights(id));
  });
}
