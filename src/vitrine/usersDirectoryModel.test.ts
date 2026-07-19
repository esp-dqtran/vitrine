import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminUser } from "./types.ts";
import { mergeUserPages } from "./usersDirectoryModel.ts";

const user = (id: number, active = true): AdminUser => ({
  id,
  email: `user-${id}@example.com`,
  role: "user",
  active,
  created_at: "2026-07-19T00:00:00.000Z",
  subscription_status: null,
});

test("merges infinite-scroll pages without duplicates and keeps updates", () => {
  assert.deepEqual(
    mergeUserPages([user(1), user(2)], [user(2, false), user(3)]).map(({ id, active }) => [id, active]),
    [[1, true], [2, false], [3, true]],
  );
});
