import { createHash, randomBytes } from "node:crypto";
import { query } from "./db.ts";
import type { AuthUser } from "./authStore.ts";

const TOKEN_PREFIX = "vtr_mcp_";
const TOKEN_TTL_DAYS = 90;

export interface McpAccessTokenView {
  id: number;
  label: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

interface McpAccessTokenRow {
  id: number;
  label: string;
  token_prefix: string;
  created_at: string | Date;
  expires_at: string | Date;
  last_used_at: string | Date | null;
}

function asIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function view(row: McpAccessTokenRow): McpAccessTokenView {
  return {
    id: Number(row.id),
    label: row.label,
    prefix: row.token_prefix,
    createdAt: asIso(row.created_at),
    expiresAt: asIso(row.expires_at),
    lastUsedAt: row.last_used_at ? asIso(row.last_used_at) : null,
  };
}

export function mcpTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newMcpAccessToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export async function createMcpAccessToken(input: {
  userId: number;
  label?: string;
  now?: Date;
}): Promise<{ token: string; accessToken: McpAccessTokenView }> {
  const token = newMcpAccessToken();
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1_000);
  const result = await query<McpAccessTokenRow>(
    `INSERT INTO mcp_access_tokens (user_id, label, token_prefix, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, token_prefix, created_at, expires_at, last_used_at`,
    [input.userId, input.label?.trim() || "Flow MCP", token.slice(0, 16), mcpTokenHash(token), expiresAt],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Could not create MCP access token");
  return { token, accessToken: view(row) };
}

export async function listMcpAccessTokens(userId: number): Promise<McpAccessTokenView[]> {
  const result = await query<McpAccessTokenRow>(
    `SELECT id, label, token_prefix, created_at, expires_at, last_used_at
     FROM mcp_access_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return result.rows.map(view);
}

export async function revokeMcpAccessToken(input: { userId: number; tokenId: number }): Promise<boolean> {
  const result = await query(
    `UPDATE mcp_access_tokens SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [input.tokenId, input.userId],
  );
  return result.rowCount === 1;
}

export async function verifyMcpAccessToken(token: string): Promise<AuthUser | undefined> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 256) return undefined;
  const result = await query<AuthUser>(
    `UPDATE mcp_access_tokens token
     SET last_used_at = now()
     FROM users user_account
     WHERE token.token_hash = $1
       AND token.user_id = user_account.id
       AND token.revoked_at IS NULL
       AND token.expires_at > now()
       AND user_account.active = true
     RETURNING user_account.id, user_account.email, user_account.role`,
    [mcpTokenHash(token)],
  );
  return result.rows[0];
}
