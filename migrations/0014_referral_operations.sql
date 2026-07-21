ALTER TABLE referrals ADD COLUMN revoked_at TIMESTAMPTZ;

CREATE INDEX referrals_campaign_revoked_idx
  ON referrals (campaign_id, revoked_at, created_at);
