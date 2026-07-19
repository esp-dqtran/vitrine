import { pool, query } from "./db.ts";

export type AdminUserFilter = "all" | "admin" | "pro" | "free" | "disabled";

export const ADMIN_USER_FILTERS = new Set<AdminUserFilter>([
  "all",
  "admin",
  "pro",
  "free",
  "disabled",
]);

export interface AdminUserRow {
  id: number;
  email: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
  subscription_status: string | null;
}

interface UserCursor {
  createdAt: string;
  id: number;
}

export function encodeAdminUserCursor(cursor: UserCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeAdminUserCursor(value: string): UserCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<UserCursor>;
    if (typeof parsed.createdAt !== "string" || !Number.isInteger(parsed.id) || Number(parsed.id) < 1) throw new Error();
    if (Number.isNaN(new Date(parsed.createdAt).getTime())) throw new Error();
    return { createdAt: parsed.createdAt, id: Number(parsed.id) };
  } catch {
    throw new Error("Invalid user cursor");
  }
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function listAdminUsersPage(input: {
  limit?: number;
  cursor?: string;
  query?: string;
  filter?: AdminUserFilter;
}): Promise<{ users: AdminUserRow[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 30), 1), 50);
  const filter = input.filter ?? "all";
  if (!ADMIN_USER_FILTERS.has(filter)) throw new Error("Invalid user filter");
  const cursor = input.cursor ? decodeAdminUserCursor(input.cursor) : undefined;
  const email = input.query?.trim() || null;
  const predicates = `
    ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%')
    AND ($2 = 'all'
      OR ($2 = 'admin' AND u.role = 'admin')
      OR ($2 = 'pro' AND s.status = 'active')
      OR ($2 = 'free' AND s.status IS DISTINCT FROM 'active')
      OR ($2 = 'disabled' AND u.active = false))`;
  const rows = await query<AdminUserRow>(
    `SELECT u.id, u.email, u.role, u.active, u.created_at, s.status AS subscription_status
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE ${predicates}
       AND ($3::timestamptz IS NULL OR (u.created_at, u.id) < ($3::timestamptz, $4::int))
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $5`,
    [email, filter, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const count = await query<{ total: number }>(
    `SELECT count(*)::int AS total
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE ${predicates}`,
    [email, filter],
  );
  const users = rows.rows.slice(0, limit);
  const last = users.at(-1);
  return {
    users,
    total: count.rows[0]?.total ?? 0,
    nextCursor: rows.rows.length > limit && last
      ? encodeAdminUserCursor({ createdAt: isoTimestamp(last.created_at), id: last.id })
      : null,
  };
}

export type SetAdminUserActiveResult =
  | { status: "updated"; user: AdminUserRow }
  | { status: "not_found" }
  | { status: "forbidden"; reason: "self_disable" | "last_active_admin" };

export async function setAdminUserActive(input: {
  actorUserId: number;
  userId: number;
  active: boolean;
}): Promise<SetAdminUserActiveResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<AdminUserRow>(
      `SELECT u.id, u.email, u.role, u.active, u.created_at, s.status AS subscription_status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1
       FOR UPDATE OF u`,
      [input.userId],
    );
    const user = target.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return { status: "not_found" };
    }
    if (!input.active && input.actorUserId === input.userId) {
      await client.query("ROLLBACK");
      return { status: "forbidden", reason: "self_disable" };
    }
    if (!input.active && user.role === "admin" && user.active) {
      const activeAdmins = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM users WHERE role = 'admin' AND active = true",
      );
      if ((activeAdmins.rows[0]?.count ?? 0) <= 1) {
        await client.query("ROLLBACK");
        return { status: "forbidden", reason: "last_active_admin" };
      }
    }
    const updated = await client.query<AdminUserRow>(
      `UPDATE users
       SET active = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, role, active, created_at,
         (SELECT status FROM subscriptions WHERE user_id = users.id) AS subscription_status`,
      [input.userId, input.active],
    );
    if (!input.active) {
      await client.query(
        `UPDATE sessions
         SET revoked_at = now(), revoked_reason = 'account_disabled'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [input.userId],
      );
    }
    await client.query("COMMIT");
    return { status: "updated", user: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
