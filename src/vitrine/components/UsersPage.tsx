import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Spinner } from '@astryxdesign/core';
import { useUsersGrowth } from '../useUsersGrowth';
import {
  filterAdminUsers,
  formatConversion,
  formatJoinedDate,
  groupAdminUsers,
  USER_FILTER_LABELS,
  userInitial,
  userPlanLabel,
  type UserFilter,
} from '../usersPageModel';
import type { AdminUser, DailySignupPoint, GrowthStats } from '../types';

const CHART_FONT = "'Figtree', system-ui, sans-serif";
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11, fontFamily: CHART_FONT };

interface UsersGrowthView {
  stats: GrowthStats;
  dailySignups: DailySignupPoint[];
}

function MemberRow({ user }: { user: AdminUser }) {
  const plan = userPlanLabel(user);

  return (
    <li className="admin-users-member-row">
      <div className="admin-users-member-identity">
        <span className="admin-users-avatar" data-tone={user.id % 5} aria-hidden="true">
          {userInitial(user.email)}
        </span>
        <span className="admin-users-member-copy">
          <strong>{user.email}</strong>
          <span>Joined {formatJoinedDate(user.created_at)}</span>
        </span>
      </div>

      <div className="admin-users-member-badges" aria-label={`Role ${user.role}, plan ${plan}`}>
        <Badge variant={user.role === 'admin' ? 'purple' : 'neutral'} label={user.role === 'admin' ? 'Admin' : 'User'} />
        <Badge variant={plan === 'Pro' ? 'success' : 'neutral'} label={plan} />
      </div>

      <span className={`admin-users-status${user.active ? '' : ' is-disabled'}`}>
        <span aria-hidden="true" />
        {user.active ? 'Active' : 'Disabled'}
      </span>
    </li>
  );
}

function MemberDirectory({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const visibleUsers = useMemo(() => filterAdminUsers(users, query, filter), [filter, query, users]);
  const groups = useMemo(() => groupAdminUsers(visibleUsers, filter), [filter, visibleUsers]);
  const hasFilters = Boolean(query.trim()) || filter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };

  return (
    <section className="admin-users-directory" aria-labelledby="admin-users-directory-title">
      <div className="admin-users-directory-heading">
        <div>
          <h2 id="admin-users-directory-title">Members</h2>
          <p>{visibleUsers.length} of {users.length} shown</p>
        </div>
      </div>

      <div className="admin-users-toolbar">
        <input
          className="admin-users-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search members"
          placeholder="Search by email…"
        />
        <select
          className="admin-users-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as UserFilter)}
          aria-label="Filter members"
        >
          {Object.entries(USER_FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {users.length === 0 ? (
        <div className="admin-users-empty">
          <h3>No members yet</h3>
          <p>New accounts will appear here when they join.</p>
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="admin-users-empty">
          <h3>No members match these filters</h3>
          <p>Try another email or reset the current segment.</p>
          {hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div className="admin-users-groups">
          {groups.map((group) => (
            <section key={group.key} className="admin-users-group" aria-labelledby={`admin-users-group-${group.key}`}>
              <h3 id={`admin-users-group-${group.key}`}>{group.label} <span>· {group.users.length}</span></h3>
              <ul>
                {group.users.map((user) => <MemberRow key={user.id} user={user} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function GrowthPulse({ stats, dailySignups }: UsersGrowthView) {
  const metrics = [
    { label: 'Total users', value: stats.total_users, detail: 'All members' },
    { label: 'New this week', value: stats.new_users_7d, detail: 'Last 7 days' },
    { label: 'Pro members', value: stats.active_subscribers, detail: `${formatConversion(stats.active_subscribers, stats.total_users)} of users` },
    { label: 'Conversion', value: formatConversion(stats.active_subscribers, stats.total_users), detail: 'Signups to Pro' },
  ];

  return (
    <aside className="admin-users-growth" aria-labelledby="admin-users-growth-title">
      <div className="admin-users-growth-heading">
        <h2 id="admin-users-growth-title">Growth pulse</h2>
        <p>Last 30 days</p>
      </div>

      <div
        className="admin-users-chart"
        role="img"
        aria-label={`Daily signups over 30 days. ${stats.new_users_7d} users joined in the last 7 days.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailySignups} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(day: string) => day.slice(5)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={6}
            />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: 'var(--color-background-muted)' }}
              contentStyle={{
                background: 'var(--color-background-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                fontFamily: CHART_FONT,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value) => [value, 'Signups']}
            />
            <Bar dataKey="signups" fill="var(--color-accent)" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="admin-users-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <span>{metric.detail}</span>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function UsersPageView({ users, growth }: { users: AdminUser[]; growth: UsersGrowthView }) {
  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div>
          <h1>Users</h1>
          <p>Manage members and monitor growth.</p>
        </div>
        <span>{statsLabel(growth.stats.total_users)}</span>
      </header>

      <div className="admin-users-layout">
        <MemberDirectory users={users} />
        <GrowthPulse stats={growth.stats} dailySignups={growth.dailySignups} />
      </div>
    </main>
  );
}

function statsLabel(total: number) {
  return `${total} ${total === 1 ? 'member' : 'members'}`;
}

export function UsersPage() {
  const { users, growth, loading, error, refresh } = useUsersGrowth();

  if (loading) {
    return (
      <div className="admin-users-state" aria-label="Loading users">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !users || !growth) {
    return (
      <div className="admin-users-state admin-users-error">
        <h1>Could not load users</h1>
        <p>{error ?? 'The user data is unavailable right now.'}</p>
        <button type="button" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }

  return <UsersPageView users={users} growth={growth} />;
}
