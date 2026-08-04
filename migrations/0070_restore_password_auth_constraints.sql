DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE password_hash IS NULL) THEN
    RAISE EXCEPTION 'Cannot restore password authentication constraints while password hashes are missing';
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS clerk_user_id;
