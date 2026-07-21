CREATE TABLE promotional_entitlements (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('referral_signup', 'referral_reward')),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX promotional_entitlements_active_idx
  ON promotional_entitlements (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE referral_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (length(token) BETWEEN 32 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE referral_visits (
  code_id BIGINT NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  visitor_key_hash BYTEA NOT NULL,
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code_id, campaign_id, visitor_key_hash)
);

CREATE TABLE referrals (
  id BIGSERIAL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  code_id BIGINT NOT NULL REFERENCES referral_codes(id),
  inviter_user_id INTEGER NOT NULL REFERENCES users(id),
  invited_user_id INTEGER NOT NULL REFERENCES users(id),
  signup_entitlement_id BIGINT NOT NULL UNIQUE REFERENCES promotional_entitlements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invited_user_id),
  CHECK (inviter_user_id <> invited_user_id)
);

CREATE INDEX referrals_inviter_campaign_idx
  ON referrals (inviter_user_id, campaign_id, created_at);

CREATE TABLE referral_activity (
  referral_id BIGINT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ NOT NULL,
  last_opened_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (referral_id, app_id),
  CHECK (last_opened_at >= first_opened_at)
);

CREATE TABLE referral_rewards (
  id BIGSERIAL PRIMARY KEY,
  referral_id BIGINT NOT NULL REFERENCES referrals(id),
  inviter_user_id INTEGER NOT NULL REFERENCES users(id),
  state TEXT NOT NULL DEFAULT 'available'
    CHECK (state IN ('available', 'activated', 'revoked')),
  entitlement_id BIGINT UNIQUE REFERENCES promotional_entitlements(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (referral_id),
  CHECK (
    (state = 'available' AND entitlement_id IS NULL AND activated_at IS NULL AND revoked_at IS NULL)
    OR (state = 'activated' AND entitlement_id IS NOT NULL AND activated_at IS NOT NULL AND revoked_at IS NULL)
    OR (state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX referral_rewards_owner_state_idx
  ON referral_rewards (inviter_user_id, state, earned_at);
