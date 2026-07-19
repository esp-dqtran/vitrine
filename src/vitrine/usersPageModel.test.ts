import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminUser } from "./types.ts";
import {
  filterAdminUsers,
  formatConversion,
  formatJoinedDate,
  userInitial,
  userPlanLabel,
} from "./usersPageModel.ts";

const users: AdminUser[] = [
  { id: 1, email: "admin@gmail.com", role: "admin", active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
  { id: 2, email: "free@example.com", role: "user", active: true, created_at: "2026-07-14T00:00:00.000Z", subscription_status: null },
  { id: 3, email: "pro@example.com", role: "user", active: true, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
  { id: 4, email: "disabled@example.com", role: "user", active: false, created_at: "invalid", subscription_status: "canceled" },
];

test("searches and filters users with composable real-data rules", () => {
  assert.deepEqual(filterAdminUsers(users, "PRO@", "all").map(({ id }) => id), [3]);
  assert.deepEqual(filterAdminUsers(users, "", "admin").map(({ id }) => id), [1]);
  assert.deepEqual(filterAdminUsers(users, "", "pro").map(({ id }) => id), [3]);
  assert.deepEqual(filterAdminUsers(users, "", "free").map(({ id }) => id), [1, 2, 4]);
  assert.deepEqual(filterAdminUsers(users, "", "disabled").map(({ id }) => id), [4]);
  assert.deepEqual(filterAdminUsers(users, "disabled", "pro"), []);
});

test("formats only deterministic values available in the API", () => {
  assert.equal(userInitial("admin@gmail.com"), "A");
  assert.equal(userInitial("growth.smoke@example.com"), "G");
  assert.equal(userInitial(""), "?");
  assert.equal(userPlanLabel(users[2]), "Pro");
  assert.equal(userPlanLabel(users[3]), "Free");
  assert.equal(formatJoinedDate("invalid"), "Unknown join date");
  assert.equal(formatConversion(2, 8), "25.0%");
  assert.equal(formatConversion(0, 0), "—");
});
