-- Additive migration: existing Stripe identifiers and event history remain untouched.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paddle_price_id TEXT;

ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT UNIQUE;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT UNIQUE;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS paddle_price_id TEXT;

CREATE TABLE IF NOT EXISTS paddle_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
