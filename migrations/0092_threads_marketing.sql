CREATE TABLE threads_marketing_posts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('daily', 'on-demand')),
  palette_date DATE NOT NULL,
  palette JSONB NOT NULL,
  caption TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'failed')),
  threads_post_id TEXT,
  published_at TIMESTAMPTZ,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  metrics_refreshed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'published') = (threads_post_id IS NOT NULL))
);

CREATE UNIQUE INDEX threads_marketing_daily_date_idx
  ON threads_marketing_posts (palette_date)
  WHERE kind = 'daily';

CREATE INDEX threads_marketing_posts_published_idx
  ON threads_marketing_posts (published_at DESC NULLS LAST, created_at DESC);
