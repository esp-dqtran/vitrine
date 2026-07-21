import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UserDirectory } from "./UserDirectory.tsx";
import { UsersPageView } from "./UsersPage.tsx";
import { ReferralInsights } from "./UserUsageInsights.tsx";

const users = [
  { id: 1, email: "admin@gmail.com", role: "admin" as const, active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
  { id: 2, email: "pro@example.com", role: "user" as const, active: false, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
];

const growth = {
  stats: { total_users: 2, new_users_7d: 1, active_subscribers: 1, dau: 1, wau: 2, total_free_unlocks: 0 },
  dailySignups: [{ day: "2026-07-19", signups: 1 }],
};

const usage = {
  summary: { totalEvents: 14, uniqueUsers: 2, usedFeatures: 2 },
  features: [
    { key: "search" as const, label: "Search", uses: 9, uniqueUsers: 2, share: 64.3 },
    { key: "exports" as const, label: "Exports", uses: 5, uniqueUsers: 1, share: 35.7 },
  ],
  daily: [{ day: "2026-07-19", uses: 14 }],
};

const referrals = {
  linksCreated: 4,
  uniqueReferralVisits: 10,
  referredSignups: 5,
  referredActivations: 3,
  rewardsIssued: 3,
  signupToActivationRate: 60,
  referredPaidConversions: 1,
  organicPaidConversions: 2,
  referredRetention: { day7: 80, day30: 60, day60: 50 },
  revocations: 1,
};

test("keeps directory filter state below the Users page render boundary", () => {
  const pageSource = readFileSync(new URL("./UsersPage.tsx", import.meta.url), "utf8");
  const containerUrl = new URL("./UsersDirectoryContainer.tsx", import.meta.url);
  const containerSource = existsSync(containerUrl) ? readFileSync(containerUrl, "utf8") : "";

  assert.doesNotMatch(pageSource, /useUsersDirectory/);
  assert.match(pageSource, /directory=\{<UsersDirectoryContainer/);
  assert.match(containerSource, /useState\(['"]{2}\)/);
  assert.match(containerSource, /useState<UserFilter>\(['"]all['"]\)/);
  assert.match(containerSource, /useUsersDirectory\(query,\s*filter\)/);
});

test("renders one unified, searchable directory with account actions", () => {
  const html = renderToStaticMarkup(<UsersPageView
    total={12}
    directory={<UserDirectory
      users={users}
      total={12}
      hasMore
      loadingMore={false}
      query=""
      filter="all"
      onQueryChange={() => undefined}
      onFilterChange={() => undefined}
      onLoadMore={() => undefined}
      onSetActive={async () => undefined}
      onSelectUser={() => undefined}
    />}
    growth={growth}
    usage={usage}
    referrals={referrals}
    range="30d"
    onRangeChange={() => undefined}
  />);

  assert.match(html, /<h1[^>]*>Users<\/h1>/);
  assert.match(html, /Search members/);
  assert.match(html, /Filter members/);
  assert.match(html, /admin@gmail\.com/);
  assert.match(html, /pro@example\.com/);
  assert.match(html, /Actions/);
  assert.match(html, /Load more/);
  assert.match(html, /Feature usage/);
  assert.match(html, /Growth/);
  assert.match(html, /Most used features/);
  assert.doesNotMatch(html, /<h3[^>]*>Administrators/);
  assert.doesNotMatch(html, /admin-users-groups/);
});

test("renders honest empty directory copy", () => {
  const html = renderToStaticMarkup(<UsersPageView
    total={0}
    directory={<UserDirectory
      users={[]}
      total={0}
      hasMore={false}
      loadingMore={false}
      query=""
      filter="all"
      onQueryChange={() => undefined}
      onFilterChange={() => undefined}
      onLoadMore={() => undefined}
      onSetActive={async () => undefined}
      onSelectUser={() => undefined}
    />}
    growth={growth}
    usage={usage}
    referrals={referrals}
    range="30d"
    onRangeChange={() => undefined}
  />);
  assert.match(html, /No members yet/);
});

test("renders the referral funnel without invited-user activity", () => {
  const html = renderToStaticMarkup(<ReferralInsights metrics={referrals} />);
  assert.match(html, /Links created/);
  assert.match(html, /Unique visits/);
  assert.match(html, /Referred signups/);
  assert.match(html, /60%/);
  assert.match(html, /D7 retention/);
  assert.match(html, /80%/);
  assert.match(html, /Revocations/);
  assert.doesNotMatch(html, /email|app detail/i);
});

test("keeps existing rows visible while filtered results refresh", () => {
  const html = renderToStaticMarkup(<UserDirectory
    users={users}
    total={12}
    hasMore={false}
    loadingMore={false}
    refreshing
    query="pro"
    filter="active"
    onQueryChange={() => undefined}
    onFilterChange={() => undefined}
    onLoadMore={() => undefined}
    onSetActive={async () => undefined}
    onSelectUser={() => undefined}
  />);

  assert.match(html, /admin@gmail\.com/);
  assert.match(html, /pro@example\.com/);
  assert.match(html, /Updating/);
});

test("defines the split workspace and narrow responsive states", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.admin-users-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(320px, 2fr\);/s);
  assert.match(css, /@media \(max-width:\s*1100px\)[\s\S]*?\.admin-users-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.admin-users-toolbar\s*\{[^}]*flex-direction:\s*column;/);
});
