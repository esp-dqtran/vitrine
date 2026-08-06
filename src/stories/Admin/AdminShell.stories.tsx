import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading, Text } from "@astryxdesign/core";

import { AdminDashboardShell } from "../../vitrine/AdminDashboard.tsx";
import { WorkspaceChromeProvider } from "../../vitrine/components/WorkspaceChromeContext.tsx";
import { UsersPageView } from "../../vitrine/components/UsersPage.tsx";
import { UserDirectory } from "../../vitrine/components/UserDirectory.tsx";
import { UserUsageInsights } from "../../vitrine/components/UserUsageInsights.tsx";
import type { UsageRangeKey } from "../../vitrine/types.ts";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "../../vitrine/styles.css";
import "../../vitrine/projectsWorkspace.css";
import "../../vitrine/components/AstryxDropdown.css";
import "../../vitrine/productTypography.css";
import "../../vitrine/productSpacing.css";
import "../../vitrine/productShape.css";
import "../../vitrine/productIconography.css";
import "../../vitrine/productMotion.css";
import "../../vitrine/productResponsive.css";
import "../../vitrine/productDataDisplay.css";
import "../../vitrine/productTables.css";
import "../../vitrine/productForms.css";

const users = [
  { id: 1, email: "admin@vitrines.ai", role: "admin" as const, active: true, created_at: "2026-05-02T00:00:00.000Z", subscription_status: null },
  { id: 2, email: "pro@example.com", role: "user" as const, active: true, created_at: "2026-06-14T00:00:00.000Z", subscription_status: "active" },
  { id: 3, email: "free@example.com", role: "user" as const, active: false, created_at: "2026-07-19T00:00:00.000Z", subscription_status: null },
];

const growth = {
  stats: {
    total_users: 128, new_users_7d: 9, active_subscribers: 14, dau: 21, wau: 63,
    total_free_unlocks: 47, active_monthly: 11, active_yearly: 3, canceled_30d: 2,
  },
  dailySignups: Array.from({ length: 30 }, (_, index) => ({
    day: `2026-07-${String((index % 30) + 1).padStart(2, "0")}`,
    signups: (index * 7) % 5,
  })),
};

const usage = {
  summary: { totalEvents: 412, uniqueUsers: 63, usedFeatures: 4 },
  features: [
    { key: "search" as const, label: "Search", uses: 210, uniqueUsers: 52, share: 51 },
    { key: "exports" as const, label: "Exports", uses: 118, uniqueUsers: 24, share: 28.6 },
  ],
  daily: [{ day: "2026-07-19", uses: 34 }],
};

const referrals = {
  linksCreated: 18, uniqueReferralVisits: 96, referredSignups: 22, referredActivations: 11,
  rewardsIssued: 8, signupToActivationRate: 50, referredPaidConversions: 4,
  organicPaidConversions: 10, referredRetention: { day7: 72, day30: 48, day60: 31 }, revocations: 1,
};

const directory = (
  <UserDirectory
    users={users}
    total={users.length}
    hasMore={false}
    loadingMore={false}
    query=""
    filter="all"
    onQueryChange={() => undefined}
    onFilterChange={() => undefined}
    onLoadMore={() => undefined}
    onSetActive={async () => undefined}
    onSelectUser={() => undefined}
  />
);

/*
 * Admin has two sections now — the Users directory and Insights — so each gets a
 * story. Both render through the hoisted chrome provider, which is what supplies
 * the rail (pages publish their chrome in an effect).
 */
function AdminSectionSpecimen({ section }: { section: "users" | "insights" }) {
  const [range, setRange] = useState<UsageRangeKey>("30d");
  return (
    <WorkspaceChromeProvider>
      <AdminDashboardShell
        email="admin@vitrines.ai"
        section={section}
        onSectionChange={() => undefined}
        onBack={() => undefined}
        onLogout={() => undefined}
        page={section === "insights" ? (
          <>
            <header className="projects-workspace__page-header">
              <div>
                <Heading level={1}>Insights</Heading>
                <Text color="secondary">
                  Growth, revenue, and referral performance across the member base.
                </Text>
              </div>
            </header>
            <UserUsageInsights
              usage={usage}
              growth={growth}
              referrals={referrals}
              range={range}
              onRangeChange={setRange}
            />
          </>
        ) : (
          <UsersPageView total={users.length} directory={directory} />
        )}
      />
    </WorkspaceChromeProvider>
  );
}

const meta = {
  title: "Admin/Shell and Navigation",
  component: AdminSectionSpecimen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminSectionSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UsersDashboard: Story = { args: { section: "users" } };

export const Insights: Story = { args: { section: "insights" } };
