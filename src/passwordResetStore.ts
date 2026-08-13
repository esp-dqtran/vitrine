import { hashPassword } from "./authCrypto.ts";
import { normalizeEmail } from "./authStore.ts";
import { query, withTransaction } from "./db.ts";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "./passwordResetToken.ts";

const RESET_TTL_MS = 30 * 60_000;

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
}

/** Creates a replacement one-time reset token. Only its SHA-256 digest reaches Postgres. */
export async function createPasswordReset(email: string): Promise<PasswordResetRequest | undefined> {
  const normalizedEmail = normalizeEmail(email);
  const token = createPasswordResetToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  return withTransaction(async (client) => {
    const user = await client.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE email = $1 AND active = true FOR UPDATE",
      [normalizedEmail],
    );
    const row = user.rows[0];
    if (!row) return undefined;
    await client.query(
      "UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL",
      [row.id],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [row.id, hashPasswordResetToken(token), expiresAt],
    );
    return { email: row.email, token, expiresAt };
  });
}

/** Consumes a reset token exactly once while changing the password. */
export async function resetPasswordWithToken(token: string, password: string): Promise<boolean> {
  const tokenHash = hashPasswordResetToken(token);
  return withTransaction(async (client) => {
    const tokenResult = await client.query<{ id: number; user_id: number }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [tokenHash],
    );
    const reset = tokenResult.rows[0];
    if (!reset) return false;
    const passwordHash = await hashPassword(password);
    await client.query("UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL", [reset.user_id]);
    await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND active = true", [passwordHash, reset.user_id]);
    return true;
  });
}

/** Deletes only old, already-used reset records; a bounded maintenance helper for cron use. */
export async function prunePasswordResetTokens(): Promise<void> {
  await query(
    `DELETE FROM password_reset_tokens WHERE id IN (
       SELECT id FROM password_reset_tokens
       WHERE expires_at < now() - interval '1 day' OR consumed_at < now() - interval '1 day'
       ORDER BY id LIMIT 500
     )`,
  );
}
