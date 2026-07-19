import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersPageView } from "./UsersPage.tsx";

test("renders the member-first Option 2 hierarchy from real API fields", () => {
  const html = renderToStaticMarkup(<UsersPageView
    users={[
      { id: 1, email: "admin@gmail.com", role: "admin", active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
      { id: 2, email: "pro@example.com", role: "user", active: true, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
    ]}
    growth={{
      stats: { total_users: 2, new_users_7d: 1, active_subscribers: 1, dau: 0, wau: 1, total_free_unlocks: 0 },
      dailySignups: [{ day: "2026-07-19", signups: 1 }],
    }}
  />);

  assert.match(html, /<h1[^>]*>Users<\/h1>/);
  assert.match(html, /Manage members and monitor growth/);
  assert.match(html, /2 members/);
  assert.match(html, /aria-label="Search members"/);
  assert.match(html, /aria-label="Filter members"/);
  assert.match(html, /Administrators/);
  assert.match(html, /Members/);
  assert.match(html, /admin@gmail\.com/);
  assert.match(html, /pro@example\.com/);
  assert.match(html, /Growth pulse/);
  assert.match(html, /Total users/);
  assert.match(html, /New this week/);
  assert.match(html, /Pro members/);
  assert.match(html, /Conversion/);
  assert.doesNotMatch(html, /Invited|Active .* ago|role="table"|Free unlocks|DAU|WAU/);
});

test("renders honest empty and filtered-empty copy", () => {
  const empty = renderToStaticMarkup(<UsersPageView
    users={[]}
    growth={{
      stats: { total_users: 0, new_users_7d: 0, active_subscribers: 0, dau: 0, wau: 0, total_free_unlocks: 0 },
      dailySignups: [],
    }}
  />);

  assert.match(empty, /No members yet/);
  assert.doesNotMatch(empty, /No members match these filters/);
});
