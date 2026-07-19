import { useState } from 'react';
import { Button, Spinner } from '@astryxdesign/core';
import type { AdminUser, FeatureUsageOverview, UsageRangeKey, UserFilter } from '../types.ts';
import type { GrowthResponse } from '../usersApi.ts';
import { setAdminUserActive } from '../usersApi.ts';
import { useUsersDirectory } from '../useUsersDirectory.ts';
import { useUsersInsights } from '../useUsersInsights.ts';
import { UserDirectory } from './UserDirectory.tsx';
import { UserUsageDialog } from './UserUsageDialog.tsx';
import { UserUsageInsights } from './UserUsageInsights.tsx';

interface UsersPageViewProps {
  users: AdminUser[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  query: string;
  filter: UserFilter;
  growth: GrowthResponse;
  usage: FeatureUsageOverview;
  range: UsageRangeKey;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: UserFilter) => void;
  onLoadMore: () => void;
  onSetActive: (user: AdminUser, active: boolean) => Promise<void>;
  onRangeChange: (range: UsageRangeKey) => void;
  onSelectUser: (user: AdminUser) => void;
}

export function UsersPageView(props: UsersPageViewProps) {
  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div><h1>Users</h1><p>Manage access and understand what members use most.</p><span>{props.total} {props.total === 1 ? 'member' : 'members'}</span></div>
      </header>
      <div className="admin-users-layout">
        <UserDirectory {...props} />
        <UserUsageInsights usage={props.usage} growth={props.growth} range={props.range} onRangeChange={props.onRangeChange} />
      </div>
    </main>
  );
}

export function UsersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [range, setRange] = useState<UsageRangeKey>('30d');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const directory = useUsersDirectory(query, filter);
  const insights = useUsersInsights(range);

  const updateActive = async (user: AdminUser, active: boolean) => {
    const updated = await setAdminUserActive(user.id, active);
    directory.updateUser(updated);
    setSelectedUser((selected) => selected?.id === updated.id ? updated : selected);
  };

  if (directory.loading || insights.loading) return <div className="admin-users-state" aria-label="Loading users"><Spinner size="lg" /></div>;
  if (directory.error || insights.error || !directory || !insights.growth || !insights.usage) {
    return <div className="admin-users-state admin-users-error"><h1>Could not load users</h1><p>{directory.error ?? insights.error ?? 'The user data is unavailable right now.'}</p><Button label="Try again" clickAction={() => { void directory.refresh(); void insights.refresh(); }} /></div>;
  }

  return (
    <>
      <UsersPageView
        users={directory.users}
        total={directory.total}
        hasMore={directory.hasMore}
        loadingMore={directory.loadingMore}
        query={query}
        filter={filter}
        growth={insights.growth}
        usage={insights.usage}
        range={range}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onLoadMore={() => void directory.loadMore()}
        onSetActive={updateActive}
        onRangeChange={setRange}
        onSelectUser={setSelectedUser}
      />
      <UserUsageDialog user={selectedUser} range={range} onClose={() => setSelectedUser(null)} />
    </>
  );
}
