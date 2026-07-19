import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { FeatureUsageOverview, UsageRangeKey } from '../types.ts';
import type { GrowthResponse } from '../usersApi.ts';
import { formatConversion } from '../usersPageModel.ts';

const CHART_FONT = "'Figtree', system-ui, sans-serif";
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11, fontFamily: CHART_FONT };

export function UserUsageInsights({ usage, growth, range, onRangeChange }: {
  usage: FeatureUsageOverview;
  growth: GrowthResponse;
  range: UsageRangeKey;
  onRangeChange: (range: UsageRangeKey) => void;
}) {
  const [view, setView] = useState<'usage' | 'growth'>('usage');
  return (
    <aside className="admin-users-insights" aria-labelledby="admin-users-insights-title">
      <div className="admin-users-insights-heading">
        <h2 id="admin-users-insights-title">Insights</h2>
        <SegmentedControl label="Insight view" value={view} onChange={(value) => setView(value as 'usage' | 'growth')}>
          <SegmentedControlItem value="usage" label="Feature usage" />
          <SegmentedControlItem value="growth" label="Growth" />
        </SegmentedControl>
      </div>
      <SegmentedControl label="Usage range" value={range} onChange={(value) => onRangeChange(value as UsageRangeKey)}>
        <SegmentedControlItem value="7d" label="7d" />
        <SegmentedControlItem value="30d" label="30d" />
        <SegmentedControlItem value="90d" label="90d" />
      </SegmentedControl>

      {view === 'usage' ? (
        <>
          <dl className="admin-users-insight-summary">
            <div><dt>Feature uses</dt><dd>{usage.summary.totalEvents}</dd></div>
            <div><dt>Active users</dt><dd>{usage.summary.uniqueUsers}</dd></div>
            <div><dt>Features used</dt><dd>{usage.summary.usedFeatures}</dd></div>
          </dl>
          <div className="admin-users-insight-section-heading">
            <h3>Most used features</h3><span>Members only</span>
          </div>
          {usage.features.length ? (
            <ol className="admin-users-feature-list">
              {usage.features.map((feature) => (
                <li key={feature.key}>
                  <div><strong>{feature.label}</strong><span>{feature.uniqueUsers} {feature.uniqueUsers === 1 ? 'user' : 'users'}</span></div>
                  <div className="admin-users-feature-value"><strong>{feature.uses}</strong><span>{feature.share}%</span></div>
                  <span className="admin-users-feature-bar"><span style={{ width: `${feature.share}%` }} /></span>
                </li>
              ))}
            </ol>
          ) : <p className="admin-users-insights-empty">No feature activity in this range yet.</p>}
        </>
      ) : (
        <>
          <div className="admin-users-chart" role="img" aria-label="Daily member signups">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth.dailySignups} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} tick={axisTick} axisLine={false} tickLine={false} interval={6} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: 'var(--color-background-muted)' }} />
                <Bar dataKey="signups" fill="var(--color-accent)" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="admin-users-growth-metrics">
            <div><dt>Total users</dt><dd>{growth.stats.total_users}</dd></div>
            <div><dt>New this week</dt><dd>{growth.stats.new_users_7d}</dd></div>
            <div><dt>Pro members</dt><dd>{growth.stats.active_subscribers}</dd></div>
            <div><dt>Conversion</dt><dd>{formatConversion(growth.stats.active_subscribers, growth.stats.total_users)}</dd></div>
          </dl>
        </>
      )}
    </aside>
  );
}
