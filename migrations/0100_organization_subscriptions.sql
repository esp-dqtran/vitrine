CREATE TABLE IF NOT EXISTS organization_subscriptions (
  organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  seat_count INTEGER NOT NULL DEFAULT 3,
  status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_export_usage (
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, window_start)
);
