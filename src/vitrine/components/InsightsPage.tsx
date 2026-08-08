import { Spinner } from './Spinner.tsx';
import { useState } from 'react';
import { Button, Heading, Text } from '@astryxdesign/core';
import type { UsageRangeKey } from '../types.ts';
import { useUsersInsights } from '../useUsersInsights.ts';
import { UserUsageInsights } from './UserUsageInsights.tsx';

/*
 * Insights is its own Admin section: the Users page is the member directory, and
 * the growth / revenue / referral panels live here with the full panel width.
 */
export function InsightsPage() {
  const [range, setRange] = useState<UsageRangeKey>('30d');
  const insights = useUsersInsights(range);
  const hasInsights = Boolean(insights.growth && insights.usage && insights.referrals);

  /*
   * Only the FIRST load takes over the page. Changing the range refetches with
   * the previous data still on screen — returning the spinner here unmounted the
   * heading, both switchers, and the panel on every range click.
   */
  if (insights.loading && !hasInsights) {
    return (
      <div className="projects-workspace__loading" role="status" aria-label="Loading insights">
        <Spinner size="lg" />
      </div>
    );
  }

  /* Likewise for failures: only a load that produced nothing takes the page. A
     refetch that fails keeps the last panel and reports itself beside the range. */
  if (!insights.growth || !insights.usage || !insights.referrals) {
    return (
      <div className="admin-users-state admin-users-error">
        <h1>Could not load insights</h1>
        <p>{insights.error ?? 'The insight data is unavailable right now.'}</p>
        <Button label="Try again" clickAction={() => void insights.refresh()} />
      </div>
    );
  }

  return (
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
        usage={insights.usage}
        growth={insights.growth}
        referrals={insights.referrals}
        range={range}
        refreshing={insights.loading}
        error={insights.error}
        onRangeChange={setRange}
      />
    </>
  );
}
