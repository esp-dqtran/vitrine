-- A Clerk-based auth migration was tried and reverted (app code is back to the
-- password/session system). This schema change was left in place rather than rolled
-- back: it's already applied to the shared Supabase DB, it's inert for the current
-- code (password_hash is always set on insert; clerk_user_id is simply unused), and
-- dropping it would desync this file from the schema_migrations ledger.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
