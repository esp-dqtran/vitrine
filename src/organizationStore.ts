import type { QueryResult } from "pg";
import { query as databaseQuery, withTransaction } from "./db.ts";

export type OrgRole = "owner" | "admin" | "member";

export interface OrganizationSummary {
  id: number;
  name: string;
  role: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  userId: number;
  email: string;
  role: OrgRole;
  createdAt: string;
}

export type DatabaseQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<Record<string, unknown>>>;

type TransactionRunner = <T>(work: (query: DatabaseQuery) => Promise<T>) => Promise<T>;

export interface OrganizationStore {
  createOrganization(ownerUserId: number, name: string): Promise<OrganizationSummary>;
  listForUser(userId: number): Promise<OrganizationSummary[]>;
  membershipRole(orgId: number, userId: number): Promise<OrgRole | undefined>;
  listMembers(orgId: number, requesterUserId: number): Promise<OrganizationMember[] | undefined>;
  addMember(orgId: number, actorUserId: number, targetUserId: number, role: "admin" | "member"): Promise<OrganizationMember | undefined>;
  addMemberByEmail(orgId: number, actorUserId: number, email: string, role: "admin" | "member"): Promise<AddMemberByEmailResult>;
  removeMember(orgId: number, actorUserId: number, targetUserId: number): Promise<boolean>;
}

export type AddMemberByEmailResult =
  | { status: "added"; member: OrganizationMember }
  | { status: "forbidden" }
  | { status: "user_not_found" };

const text = (value: unknown): string => (value == null ? "" : String(value));
const number = (value: unknown): number => Number(value);
const isoDate = (value: unknown): string => new Date(text(value)).toISOString();

const liveQuery: DatabaseQuery = (sql, values) => databaseQuery(sql, values ? [...values] : undefined);

function defaultTransaction(runQuery: DatabaseQuery): TransactionRunner {
  if (runQuery !== liveQuery) return async (work) => work(runQuery);
  return async (work) => withTransaction((client) => work(
    (sql, values) => client.query(sql, values ? [...values] : undefined),
  ));
}

// Only owners and admins may change membership. Kept in the store because it is the
// trust boundary for team data — routes must not be the only thing enforcing it.
const canManage = (role: OrgRole | undefined): boolean => role === "owner" || role === "admin";

async function roleOf(runQuery: DatabaseQuery, orgId: number, userId: number): Promise<OrgRole | undefined> {
  const result = await runQuery(
    "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    [orgId, userId],
  );
  return result.rows[0] ? (result.rows[0].role as OrgRole) : undefined;
}

export function createOrganizationStore(
  runQuery: DatabaseQuery = liveQuery,
  runTransaction: TransactionRunner = defaultTransaction(runQuery),
): OrganizationStore {
  return {
    async createOrganization(ownerUserId, name) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Organization name is required");
      return runTransaction(async (tx) => {
        const created = await tx(
          `INSERT INTO organizations (name, owner_user_id)
           VALUES ($1, $2) RETURNING id, name, created_at`,
          [trimmed, ownerUserId],
        );
        const org = created.rows[0];
        const orgId = number(org.id);
        await tx(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'owner')`,
          [orgId, ownerUserId],
        );
        return {
          id: orgId,
          name: text(org.name),
          role: "owner" as const,
          memberCount: 1,
          createdAt: isoDate(org.created_at),
        };
      });
    },

    async listForUser(userId) {
      const result = await runQuery(
        `SELECT o.id, o.name, o.created_at, m.role,
                (SELECT count(*)::integer FROM organization_members mm WHERE mm.organization_id = o.id) AS member_count
         FROM organization_members m
         JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = $1
         ORDER BY o.created_at DESC, o.id DESC`,
        [userId],
      );
      return result.rows.map((row) => ({
        id: number(row.id),
        name: text(row.name),
        role: row.role as OrgRole,
        memberCount: number(row.member_count),
        createdAt: isoDate(row.created_at),
      }));
    },

    membershipRole(orgId, userId) {
      return roleOf(runQuery, orgId, userId);
    },

    async listMembers(orgId, requesterUserId) {
      if (!(await roleOf(runQuery, orgId, requesterUserId))) return undefined;
      const result = await runQuery(
        `SELECT m.user_id, u.email, m.role, m.created_at
         FROM organization_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = $1
         ORDER BY m.created_at, m.user_id`,
        [orgId],
      );
      return result.rows.map((row) => ({
        userId: number(row.user_id),
        email: text(row.email),
        role: row.role as OrgRole,
        createdAt: isoDate(row.created_at),
      }));
    },

    async addMember(orgId, actorUserId, targetUserId, role) {
      if (role !== "admin" && role !== "member") throw new Error("Invalid member role");
      return runTransaction(async (tx) => {
        if (!canManage(await roleOf(tx, orgId, actorUserId))) return undefined;
        // ON CONFLICT keeps an existing owner from being demoted and lets an
        // admin/member role be updated in place.
        const upserted = await tx(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, user_id)
           DO UPDATE SET role = EXCLUDED.role
           WHERE organization_members.role <> 'owner'
           RETURNING user_id, role, created_at`,
          [orgId, targetUserId, role],
        );
        const row = upserted.rows[0];
        if (!row) return undefined;
        const emailResult = await tx("SELECT email FROM users WHERE id = $1", [targetUserId]);
        return {
          userId: number(row.user_id),
          email: text(emailResult.rows[0]?.email),
          role: row.role as OrgRole,
          createdAt: isoDate(row.created_at),
        };
      });
    },

    async addMemberByEmail(orgId, actorUserId, email, role) {
      if (role !== "admin" && role !== "member") throw new Error("Invalid member role");
      const normalized = email.trim().toLowerCase();
      const found = await runQuery("SELECT id FROM users WHERE email = $1", [normalized]);
      const target = found.rows[0];
      if (!target) return { status: "user_not_found" };
      const member = await this.addMember(orgId, actorUserId, number(target.id), role);
      return member ? { status: "added", member } : { status: "forbidden" };
    },

    async removeMember(orgId, actorUserId, targetUserId) {
      return runTransaction(async (tx) => {
        if (!canManage(await roleOf(tx, orgId, actorUserId))) return false;
        // The owner cannot be removed — deleting an org happens by another path.
        const removed = await tx(
          `DELETE FROM organization_members
           WHERE organization_id = $1 AND user_id = $2 AND role <> 'owner'
           RETURNING user_id`,
          [orgId, targetUserId],
        );
        return removed.rowCount === 1;
      });
    },
  };
}
