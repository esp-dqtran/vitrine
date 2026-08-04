import { query } from "./db.ts";
import { hashPassword, verifyPassword } from "./authCrypto.ts";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

interface StoredUser extends AuthUser {
  password_hash: string;
  active: boolean;
}

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
  return safeUser(admin);
}

export async function registerUser(email: string, password: string): Promise<AuthUser | undefined> {
  const passwordHash = await hashPassword(password);
  const result = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role, active, updated_at)
     VALUES ($1, $2, 'user', true, now())
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, role`,
    [normalizeEmail(email), passwordHash]
  );
  return result.rows[0] ? safeUser(result.rows[0]) : undefined;
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
