import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card, Spinner, Table, Text, proportional } from '@astryxdesign/core';
import { PageHeader } from './PageHeader';
import { useUsersGrowth } from '../useUsersGrowth';
import type { AdminUser, DailySignupPoint } from '../types';

// Matches styles.css's actual body font, not @astryxdesign/core's --font-family-body token
// (which is a system-font stack the rest of this page doesn't actually render in).
const CHART_FONT = "'Figtree', system-ui, sans-serif";
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11, fontFamily: CHART_FONT };

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card padding={3}>
      <Text type="supporting" color="secondary">{label}</Text>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </Card>
  );
}

function SignupChart({ dailySignups }: { dailySignups: DailySignupPoint[] }) {
  return (
    <Card padding={4}>
      <Text weight="semibold">Daily signups (30d)</Text>
      <div style={{ marginTop: 12, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailySignups} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="day"
              tickFormatter={(day: string) => day.slice(5)}
              tick={axisTick}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
              interval={4}
            />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: 'var(--color-background-muted)' }}
              contentStyle={{
                background: 'var(--color-background-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontFamily: CHART_FONT,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value) => [value, 'Signups']}
            />
            <Bar dataKey="signups" fill="var(--color-accent)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const roleBadge = (role: AdminUser['role']) => (
  <Badge variant={role === 'admin' ? 'purple' : 'neutral'} label={role} />
);
const statusBadge = (active: boolean) => (
  <Badge variant={active ? 'success' : 'error'} label={active ? 'Active' : 'Disabled'} />
);
const planBadge = (subscriptionStatus: string | null) => (
  <Badge variant={subscriptionStatus === 'active' ? 'success' : 'neutral'} label={subscriptionStatus ?? 'Free'} />
);

export function UsersPage() {
  const { users, growth, loading, error } = useUsersGrowth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !users || !growth) {
    return (
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '40px 28px' }}>
        <Text color="secondary">Could not load users: {error ?? 'unknown error'}</Text>
      </div>
    );
  }

  const { stats, dailySignups } = growth;
  const conversion = stats.total_users > 0
    ? `${((stats.active_subscribers / stats.total_users) * 100).toFixed(1)}%`
    : '—';

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 40px' }}>
      <PageHeader title="Users & Growth" description="Founder view of signups, activation, and conversion." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatTile label="Total users" value={stats.total_users} />
        <StatTile label="New (7d)" value={stats.new_users_7d} />
        <StatTile label="Active subscribers" value={stats.active_subscribers} />
        <StatTile label="Conversion" value={conversion} />
        <StatTile label="DAU" value={stats.dau} />
        <StatTile label="WAU" value={stats.wau} />
        <StatTile label="Free unlocks" value={stats.total_free_unlocks} />
      </div>

      <div style={{ marginTop: 20 }}>
        <SignupChart dailySignups={dailySignups} />
      </div>

      {/* Table's proportional columns enforce a 120px floor each — 5 columns won't fit a
          phone viewport, so this scrolls horizontally rather than squeezing illegibly
          (the Table component itself has no built-in responsive/collapse mode). */}
      <div style={{ marginTop: 20, overflowX: 'auto' }}>
        <Table<AdminUser>
          data={users}
          columns={[
            { key: 'email', header: 'Email', width: proportional(2) },
            { key: 'role', header: 'Role', width: proportional(1), renderCell: (u) => roleBadge(u.role) },
            { key: 'active', header: 'Status', width: proportional(1), renderCell: (u) => statusBadge(u.active) },
            { key: 'subscription_status', header: 'Plan', width: proportional(1), renderCell: (u) => planBadge(u.subscription_status) },
            {
              key: 'created_at',
              header: 'Joined',
              width: proportional(1),
              renderCell: (u) => new Date(u.created_at).toLocaleDateString(),
            },
          ]}
          density="compact"
          hasHover
        />
      </div>
    </div>
  );
}
