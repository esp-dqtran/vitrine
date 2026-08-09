CREATE TABLE admin_pro_grants (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX admin_pro_grants_active_idx
  ON admin_pro_grants (user_id)
  WHERE revoked_at IS NULL;
