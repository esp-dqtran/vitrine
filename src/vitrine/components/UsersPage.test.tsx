import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UserDirectory } from "./UserDirectory.tsx";
import { UsersPageView } from "./UsersPage.tsx";
import { ReferralInsights, UsageInsights, UserUsageInsights } from "./UserUsageInsights.tsx";

const users = [
  { id: 1, email: "admin@gmail.com", role: "admin" as const, active: true, created_at: "2026-07-13T00:00:00.000Z", subscription_status: null },
  { id: 2, email: "pro@example.com", role: "user" as const, active: false, created_at: "2026-07-15T00:00:00.000Z", subscription_status: "active" },
];

const growth = {
  stats: {
    total_users: 2, new_users_7d: 1, active_subscribers: 1, dau: 1, wau: 2, total_free_unlocks: 0,
    active_monthly: 1, active_yearly: 0, canceled_30d: 0,
  },
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
    directory={<UserDirectory
      users={users}
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
  />);

  assert.match(html, /<h1[^>]*>Users<\/h1>/);
  assert.match(html, /Search members/);
  assert.match(html, /Filter members/);
  assert.match(html, /admin@gmail\.com/);
  assert.match(html, /pro@example\.com/);
  assert.match(html, /Actions/);
  assert.match(html, /Load more/);
  // Insights is its own Admin section now — no insight panel on the Users page.
  assert.doesNotMatch(html, /admin-users-insights/);
  assert.doesNotMatch(html, />Usage</);
  assert.doesNotMatch(html, /Most used features/);
  assert.doesNotMatch(html, /<h3[^>]*>Administrators/);
  assert.doesNotMatch(html, /admin-users-groups/);
});

test("renders the insight switchers on the Insights section", () => {
  const html = renderToStaticMarkup(
    <UserUsageInsights
      usage={usage}
      growth={growth}
      referrals={referrals}
      range="30d"
      onRangeChange={() => undefined}
    />,
  );

  assert.match(html, />Usage</);
  assert.match(html, /Growth/);
  assert.match(html, /Revenue/);
  assert.match(html, /Most used features/);
  // The page is already titled Insights — the panel must not repeat it.
  assert.doesNotMatch(html, /<h2[^>]*>Insights<\/h2>/);
  assert.doesNotMatch(html, /<aside/);
});

test("keeps the Insights panel mounted while a new range loads", () => {
  const source = readFileSync(new URL("./InsightsPage.tsx", import.meta.url), "utf8");
  // Returning the spinner on any `loading` unmounted the whole page per range click.
  assert.doesNotMatch(source, /if \(insights\.loading\)\s*\{/);
  assert.match(source, /insights\.loading && !hasInsights/);
  assert.match(source, /refreshing=\{insights\.loading\}/);
  // A refetch that fails keeps the last panel too; only an empty load takes the page.
  assert.match(source, /if \(!insights\.growth \|\| !insights\.usage \|\| !insights\.referrals\)/);
});

test("charts the metric series instead of listing them as numbers", () => {
  const referralHtml = renderToStaticMarkup(<ReferralInsights metrics={referrals} />);
  const usageHtml = renderToStaticMarkup(<UsageInsights usage={usage} range="30d" />);

  // Charts are canvas-only to a screen reader, and ResponsiveContainer renders
  // nothing without a measured width — the aria-label is the whole text alternative.
  assert.match(referralHtml, /class="admin-users-chart-figure"/);
  assert.match(referralHtml, /aria-label="Referral funnel: Links created 4/);
  assert.match(referralHtml, /aria-label="Referred retention: D7 retention 80%/);
  assert.match(usageHtml, /aria-label="Feature uses per day over the last 30d/);
  assert.match(usageHtml, /aria-label="Uses by feature: Search 9 uses/);
  // The hand-rolled percentage bars the feature list used to draw are gone.
  assert.doesNotMatch(usageHtml, /admin-users-feature-bar/);
});

test("dresses the chart hover layer and series in the design system", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const source = readFileSync(new URL("./UserUsageInsights.tsx", import.meta.url), "utf8");

  // Recharts' default tooltip is an inline-styled white box that ignores tokens
  // and stays white in dark mode. Every chart must pass our own content instead.
  assert.equal(source.match(/<Tooltip /g)?.length, source.match(/content=\{<ChartTooltip/g)?.length);
  assert.match(css, /\.admin-users-chart-tooltip \{[^}]*background: var\(--color-background-surface\)/s);

  /*
   * Chart colors are a domain palette, deliberately outside the 13 product color
   * roles (UI_FOUNDATION_STANDARD.specializedColorPolicy). These exact steps were
   * validated in both modes against this product's surfaces — lightness band,
   * chroma floor, colour-vision separation and contrast. Re-validate before edits.
   */
  assert.match(css, /--vitrine-chart-series-1: light-dark\(#2a78d6, #3987e5\)/);
  assert.match(css, /--vitrine-chart-series-2: light-dark\(#eb6834, #d95926\)/);
  assert.match(css, /--vitrine-chart-step-5: light-dark\(#104281, #184f95\)/);
  // No raw hex in the charts themselves — series read from the tokens.
  assert.doesNotMatch(source, /#[0-9a-f]{6}/i);
});

test("gives the two-series chart a legend so identity is never colour alone", () => {
  const html = renderToStaticMarkup(<UsageInsights usage={usage} range="30d" />);
  assert.match(html, /aria-label="Uses by feature/);
  const source = readFileSync(new URL("./UserUsageInsights.tsx", import.meta.url), "utf8");
  assert.match(source, /<Legend[\s\S]*?admin-users-chart-legend/);
  assert.match(source, /name="Uses"[\s\S]*?name="Unique users"/);
});

test("drops the sidebar chrome now that Insights owns the full page", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const insights = /\.admin-users-insights\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.doesNotMatch(insights, /position:\s*sticky|border-left|padding-left/);
  // Metric tiles size themselves, so the same grid reads in the dialog and on the page.
  assert.match(css, /\.admin-users-detail-summary\s*\{[^}]*repeat\(auto-fit, minmax\(180px, 1fr\)\)/s);
});

test("renders honest empty directory copy", () => {
  const html = renderToStaticMarkup(<UsersPageView
    directory={<UserDirectory
      users={[]}
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
    hasMore={false}
    loadingMore={false}
    refreshing
    query="pro"
    filter="pro"
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

test("gives the directory the full page width and stacks its toolbar when narrow", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("./UsersPage.tsx", import.meta.url), "utf8");
  // Insights left the page; the split grid and its sidebar gutter left with it.
  assert.doesNotMatch(pageSource, /admin-users-layout/);
  assert.doesNotMatch(css, /\.admin-users-layout\s*\{/);
  assert.doesNotMatch(css, /\.admin-users-directory\s*\{[^}]*padding-right/s);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.admin-users-toolbar\s*\{[^}]*flex-direction:\s*column;/);
});

test("carries no member counts — the rows are the count", () => {
  const html = renderToStaticMarkup(<UsersPageView
    directory={<UserDirectory
      users={users}
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
  />);
  assert.doesNotMatch(html, /\d+ of \d+ shown/);
  assert.doesNotMatch(html, /\d+ members?</);
  assert.doesNotMatch(html, /admin-users-directory-count/);
});

test("reflows the member row on a phone against a cell that exists", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const html = renderToStaticMarkup(<UserDirectory
    users={users}
    hasMore={false}
    loadingMore={false}
    query=""
    filter="all"
    onQueryChange={() => undefined}
    onFilterChange={() => undefined}
    onLoadMore={() => undefined}
    onSetActive={async () => undefined}
    onSelectUser={() => undefined}
  />);

  // The narrow reflow used to place `.astryx-dropdown-menu`, a class the design
  // system never renders, so the actions control was never placed at all.
  assert.doesNotMatch(css, /\.admin-users-member-row > \.astryx-dropdown-menu/);
  assert.match(html, /class="admin-users-member-actions"/);
  assert.match(
    css,
    /@media \(max-width:\s*640px\)[\s\S]*?\.admin-users-member-actions\s*\{[^}]*grid-column:\s*3;/,
  );
});

test("makes the filter and row actions primary controls", () => {
  const source = readFileSync(new URL("./UserDirectory.tsx", import.meta.url), "utf8");
  assert.match(source, /ariaLabel="Filter members"[\s\S]*?triggerVariant="primary"/);
  assert.match(source, /label: 'Actions',[^}]*variant: 'primary'/);
});
