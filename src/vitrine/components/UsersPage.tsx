import { useState, type ReactNode } from 'react';
import { Button, Spinner } from '@astryxdesign/core';
import type { FeatureUsageOverview, ReferralCampaignMetrics, UsageRangeKey } from '../types.ts';
import type { GrowthResponse } from '../usersApi.ts';
import { useUsersInsights } from '../useUsersInsights.ts';
import { UsersDirectoryContainer } from './UsersDirectoryContainer.tsx';
import { UserUsageInsights } from './UserUsageInsights.tsx';

interface UsersPageViewProps {
  total: number;
  directory: ReactNode;
  growth: GrowthResponse;
  usage: FeatureUsageOverview;
  referrals: ReferralCampaignMetrics;
  range: UsageRangeKey;
  onRangeChange: (range: UsageRangeKey) => void;
}

export function UsersPageView(props: UsersPageViewProps) {
  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div><h1>Users</h1><p>Manage access and understand what members use most.</p><span>{props.total} {props.total === 1 ? 'member' : 'members'}</span></div>
      </header>
      <div className="admin-users-layout">
        {props.directory}
        <UserUsageInsights usage={props.usage} growth={props.growth} referrals={props.referrals} range={props.range} onRangeChange={props.onRangeChange} />
      </div>
    </main>
  );
}

export function UsersPage() {
  const [range, setRange] = useState<UsageRangeKey>('30d');
  const insights = useUsersInsights(range);

  if (insights.loading) return <div className="admin-users-state" aria-label="Loading users"><Spinner size="lg" /></div>;
  if (insights.error || !insights.growth || !insights.usage || !insights.referrals) {
    return <div className="admin-users-state admin-users-error"><h1>Could not load users</h1><p>{insights.error ?? 'The user data is unavailable right now.'}</p><Button label="Try again" clickAction={() => void insights.refresh()} /></div>;
  }

  return (
    <UsersPageView
      total={insights.growth.stats.total_users}
      directory={<UsersDirectoryContainer range={range} />}
      growth={insights.growth}
      usage={insights.usage}
      referrals={insights.referrals}
      range={range}
      onRangeChange={setRange}
    />
  );
}
