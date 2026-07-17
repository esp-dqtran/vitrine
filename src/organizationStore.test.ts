import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult } from "pg";
import { createOrganizationStore, type DatabaseQuery } from "./organizationStore.ts";

const result = (rows: Record<string, unknown>[] = []): QueryResult<Record<string, unknown>> => ({
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
  rows,
});

const NOW = "2026-07-17T00:00:00.000Z";

test("creates an organization and seats the creator as owner in one transaction", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (/INSERT INTO organizations/.test(sql)) return result([{ id: 5, name: "Acme", created_at: NOW }]);
    return result();
  };
  const org = await createOrganizationStore(query).createOrganization(7, "  Acme  ");
  assert.deepEqual(org, { id: 5, name: "Acme", role: "owner", memberCount: 1, createdAt: NOW });
  assert.ok(calls.some((sql) => /INSERT INTO organization_members[\s\S]*'owner'/.test(sql)));
});

test("rejects a blank organization name before touching the database", async () => {
  let touched = false;
  const query: DatabaseQuery = async () => { touched = true; return result(); };
  await assert.rejects(() => createOrganizationStore(query).createOrganization(7, "   "), /name is required/);
  assert.equal(touched, false);
});

test("only owners and admins can add members", async () => {
  const asRole = (role: string | undefined) => {
    const query: DatabaseQuery = async (sql) => {
      if (/SELECT role FROM organization_members/.test(sql)) return result(role ? [{ role }] : []);
      if (/INSERT INTO organization_members/.test(sql)) return result([{ user_id: 9, role: "member", created_at: NOW }]);
      if (/SELECT email FROM users/.test(sql)) return result([{ email: "new@team.co" }]);
      return result();
    };
    return createOrganizationStore(query);
  };
  assert.equal(await asRole(undefined).addMember(1, 2, 9, "member"), undefined);
  assert.equal(await asRole("member").addMember(1, 2, 9, "member"), undefined);
  assert.deepEqual(await asRole("admin").addMember(1, 2, 9, "member"), {
    userId: 9, email: "new@team.co", role: "member", createdAt: NOW,
  });
});

test("addMember refuses roles outside admin/member (no owner escalation via invite)", async () => {
  const query: DatabaseQuery = async () => result([{ role: "owner" }]);
  await assert.rejects(
    () => createOrganizationStore(query).addMember(1, 2, 9, "owner" as "admin"),
    /Invalid member role/,
  );
});

test("addMemberByEmail resolves the user, then reports not-found / forbidden / added", async () => {
  const build = (userRow: Record<string, unknown> | undefined, actorRole: string | undefined) => {
    const query: DatabaseQuery = async (sql) => {
      if (/SELECT id FROM users WHERE email/.test(sql)) return result(userRow ? [userRow] : []);
      if (/SELECT role FROM organization_members/.test(sql)) return result(actorRole ? [{ role: actorRole }] : []);
      if (/INSERT INTO organization_members/.test(sql)) return result([{ user_id: 9, role: "member", created_at: NOW }]);
      if (/SELECT email FROM users/.test(sql)) return result([{ email: "new@team.co" }]);
      return result();
    };
    return createOrganizationStore(query);
  };
  assert.deepEqual(await build(undefined, "owner").addMemberByEmail(1, 2, "ghost@team.co", "member"), { status: "user_not_found" });
  assert.deepEqual(await build({ id: 9 }, "member").addMemberByEmail(1, 2, "new@team.co", "member"), { status: "forbidden" });
  assert.deepEqual(await build({ id: 9 }, "admin").addMemberByEmail(1, 2, "NEW@team.co", "member"), {
    status: "added",
    member: { userId: 9, email: "new@team.co", role: "member", createdAt: NOW },
  });
});

test("removeMember is gated on manager role and reports whether a row was deleted", async () => {
  const build = (role: string | undefined, deleted: number) => {
    const query: DatabaseQuery = async (sql) => {
      if (/SELECT role FROM organization_members/.test(sql)) return result(role ? [{ role }] : []);
      if (/DELETE FROM organization_members/.test(sql)) return { ...result([]), rowCount: deleted };
      return result();
    };
    return createOrganizationStore(query);
  };
  assert.equal(await build("member", 1).removeMember(1, 2, 9), false); // not a manager
  assert.equal(await build("owner", 0).removeMember(1, 2, 9), false);  // owner-protected / absent
  assert.equal(await build("admin", 1).removeMember(1, 2, 9), true);
});

test("lists a user's organizations with role and member count, and hides members from non-members", async () => {
  const query: DatabaseQuery = async (sql) => {
    if (/FROM organization_members m[\s\S]*JOIN organizations o/.test(sql)) {
      return result([{ id: 3, name: "Acme", created_at: NOW, role: "admin", member_count: 4 }]);
    }
    if (/SELECT role FROM organization_members/.test(sql)) return result([]); // requester not a member
    return result();
  };
  const store = createOrganizationStore(query);
  assert.deepEqual(await store.listForUser(7), [
    { id: 3, name: "Acme", role: "admin", memberCount: 4, createdAt: NOW },
  ]);
  assert.equal(await store.listMembers(3, 99), undefined);
});
