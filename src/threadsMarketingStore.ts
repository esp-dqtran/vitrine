import type { QueryResultRow } from "pg";
import {
  emptyThreadsPostMetrics,
  type ThreadsMarketingPost,
  type ThreadsPalette,
  type ThreadsPostMetrics,
} from "./threadsMarketing.ts";

export interface ThreadsMarketingStore {
  findDaily(date: string): Promise<ThreadsMarketingPost | undefined>;
  get(id: string): Promise<ThreadsMarketingPost | undefined>;
  save(post: ThreadsMarketingPost): Promise<ThreadsMarketingPost>;
  markPublished(id: string, threadsPostId: string, publishedAt: Date): Promise<ThreadsMarketingPost>;
  markFailed(id: string, message: string): Promise<ThreadsMarketingPost>;
  updateMetrics(id: string, metrics: ThreadsPostMetrics, refreshedAt: Date): Promise<ThreadsMarketingPost>;
  list(limit?: number): Promise<ThreadsMarketingPost[]>;
}

interface MarketingRow extends QueryResultRow {
  id: string;
  kind: ThreadsMarketingPost["kind"];
  palette_date: string;
  palette: ThreadsPalette;
  caption: string;
  status: ThreadsMarketingPost["status"];
  threads_post_id: string | null;
  published_at: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  metrics_refreshed_at: string | null;
  error: string | null;
  created_at: string;
}

function post(row: MarketingRow): ThreadsMarketingPost {
  return {
    id: row.id,
    kind: row.kind,
    paletteDate: row.palette_date.slice(0, 10),
    palette: row.palette,
    caption: row.caption,
    status: row.status,
    threadsPostId: row.threads_post_id,
    publishedAt: row.published_at,
    metrics: {
      ...emptyThreadsPostMetrics(),
      views: Number(row.views), likes: Number(row.likes), replies: Number(row.replies),
      reposts: Number(row.reposts), quotes: Number(row.quotes), shares: Number(row.shares),
    },
    metricsRefreshedAt: row.metrics_refreshed_at,
    error: row.error,
    createdAt: row.created_at,
  };
}

export function createThreadsMarketingStore(query: <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<{ rows: R[] }>): ThreadsMarketingStore {
  const select = `SELECT id, kind, palette_date::text, palette, caption, status, threads_post_id,
    published_at::text, views, likes, replies, reposts, quotes, shares, metrics_refreshed_at::text,
    error, created_at::text FROM threads_marketing_posts`;
  return {
    async findDaily(date) {
      const result = await query<MarketingRow>(`${select} WHERE kind = 'daily' AND palette_date = $1`, [date]);
      return result.rows[0] ? post(result.rows[0]) : undefined;
    },
    async get(id) {
      const result = await query<MarketingRow>(`${select} WHERE id = $1`, [id]);
      return result.rows[0] ? post(result.rows[0]) : undefined;
    },
    async save(value) {
      const result = await query<MarketingRow>(
        `INSERT INTO threads_marketing_posts (id, kind, palette_date, palette, caption, status, threads_post_id, published_at, views, likes, replies, reposts, quotes, shares, metrics_refreshed_at, error, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET palette = EXCLUDED.palette, caption = EXCLUDED.caption, status = EXCLUDED.status,
           threads_post_id = EXCLUDED.threads_post_id, published_at = EXCLUDED.published_at, views = EXCLUDED.views,
           likes = EXCLUDED.likes, replies = EXCLUDED.replies, reposts = EXCLUDED.reposts, quotes = EXCLUDED.quotes,
           shares = EXCLUDED.shares, metrics_refreshed_at = EXCLUDED.metrics_refreshed_at, error = EXCLUDED.error
         RETURNING id, kind, palette_date::text, palette, caption, status, threads_post_id, published_at::text,
           views, likes, replies, reposts, quotes, shares, metrics_refreshed_at::text, error, created_at::text`,
        [value.id, value.kind, value.paletteDate, JSON.stringify(value.palette), value.caption, value.status,
          value.threadsPostId, value.publishedAt, value.metrics.views, value.metrics.likes, value.metrics.replies,
          value.metrics.reposts, value.metrics.quotes, value.metrics.shares, value.metricsRefreshedAt,
          value.error, value.createdAt],
      );
      return post(result.rows[0]!);
    },
    async markPublished(id, threadsPostId, publishedAt) {
      const result = await query<MarketingRow>(
        `${select.replace(" FROM threads_marketing_posts", " FROM (UPDATE threads_marketing_posts SET status = 'published', threads_post_id = $2, published_at = $3, error = NULL WHERE id = $1 RETURNING *) AS threads_marketing_posts")}`,
        [id, threadsPostId, publishedAt.toISOString()],
      );
      if (!result.rows[0]) throw new Error("Threads marketing post not found");
      return post(result.rows[0]);
    },
    async markFailed(id, message) {
      const result = await query<MarketingRow>(
        `${select.replace(" FROM threads_marketing_posts", " FROM (UPDATE threads_marketing_posts SET status = 'failed', error = $2 WHERE id = $1 RETURNING *) AS threads_marketing_posts")}`,
        [id, message.slice(0, 1000)],
      );
      if (!result.rows[0]) throw new Error("Threads marketing post not found");
      return post(result.rows[0]);
    },
    async updateMetrics(id, metrics, refreshedAt) {
      const result = await query<MarketingRow>(
        `${select.replace(" FROM threads_marketing_posts", " FROM (UPDATE threads_marketing_posts SET views = $2, likes = $3, replies = $4, reposts = $5, quotes = $6, shares = $7, metrics_refreshed_at = $8 WHERE id = $1 RETURNING *) AS threads_marketing_posts")}`,
        [id, metrics.views, metrics.likes, metrics.replies, metrics.reposts, metrics.quotes, metrics.shares, refreshedAt.toISOString()],
      );
      if (!result.rows[0]) throw new Error("Threads marketing post not found");
      return post(result.rows[0]);
    },
    async list(limit = 30) {
      const result = await query<MarketingRow>(`${select} ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $1`, [Math.min(Math.max(limit, 1), 100)]);
      return result.rows.map(post);
    },
  };
}
