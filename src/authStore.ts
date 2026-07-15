import { query } from "./db.ts";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./authCrypto.ts";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export type SessionResolution =
  | { status: "authenticated"; user: AuthUser }
  | { status: "signed_in_elsewhere" }
  | { status: "invalid" };

interface StoredUser extends AuthUser {
  password_hash: string;
  active: boolean;
}

const SESSION_MS = 12 * 60 * 60 * 1000;

const safeUser = ({ id, email, role }: AuthUser): AuthUser => ({ id, email, role });

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export async function seedAdmin(email: string, password: string): Promise<AuthUser> {
  const passwordHash = await hashPassword(password);
  const result = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role, active, updated_at)
     VALUES ($1, $2, 'admin', true, now())
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       role = 'admin', active = true, updated_at = now()
     RETURNING id, email, role`,
    [normalizeEmail(email), passwordHash]
  );
  const admin = result.rows[0];
  await query("DELETE FROM sessions WHERE user_id = $1", [admin.id]);
  return safeUser(admin);
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | undefined> {
  const result = await query<StoredUser>(
    "SELECT id, email, role, password_hash, active FROM users WHERE email = $1",
    [normalizeEmail(email)]
  );
  const user = result.rows[0];
  if (!user?.active || !(await verifyPassword(password, user.password_hash))) return undefined;
  return safeUser(user);
}

export async function createSession(
  userId: number,
  expiresAt = new Date(Date.now() + SESSION_MS)
): Promise<{ token: string; expiresAt: Date }> {
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  const token = generateSessionToken();
  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashSessionToken(token), expiresAt]
  );
  const account = await query<{ role: UserRole }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (account.rows[0]?.role === "user") {
    await query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = 'signed_in_elsewhere'
       WHERE user_id = $1 AND revoked_at IS NULL AND id NOT IN (
         SELECT id FROM sessions WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 2
       )`,
      [userId],
    );
  }
  return { token, expiresAt };
}

export async function resolveSessionState(token: string): Promise<SessionResolution> {
  const tokenHash = hashSessionToken(token);
  const result = await query<AuthUser & { active: boolean; revoked_reason: string | null }>(
    `SELECT u.id, u.email, u.role, u.active, s.revoked_reason FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (row?.revoked_reason === "signed_in_elsewhere") return { status: "signed_in_elsewhere" };
  if (!row?.active || row.revoked_reason) {
    if (!row) await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return { status: "invalid" };
  }
  return { status: "authenticated", user: safeUser(row) };
}

export async function resolveSession(token: string): Promise<AuthUser | undefined> {
  const resolution = await resolveSessionState(token);
  return resolution.status === "authenticated" ? resolution.user : undefined;
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const result = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) return false;
  const passwordHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    userId,
  ]);
  return true;
}
