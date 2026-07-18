-- Editable FLOW.md per app + platform. The FLOW.md export is generated from the
-- catalog snapshot; this table holds a PM's edited copy so revisions persist and
-- are visible to teammates. One mutable row per (app, platform); last write wins.
CREATE TABLE IF NOT EXISTS flow_documents (
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, platform)
);
