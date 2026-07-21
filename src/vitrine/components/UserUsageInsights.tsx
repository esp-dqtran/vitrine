import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { FeatureUsageOverview, ReferralCampaignMetrics, UsageRangeKey } from '../types.ts';
import type { GrowthResponse } from '../usersApi.ts';
import { formatConversion } from '../usersPageModel.ts';

const CHART_FONT = "'Figtree', system-ui, sans-serif";
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11, fontFamily: CHART_FONT };

export function UserUsageInsights({ usage, growth, referrals, range, onRangeChange }: {
  usage: FeatureUsageOverview;
  growth: GrowthResponse;
  referrals: ReferralCampaignMetrics;
  range: UsageRangeKey;
  onRangeChange: (range: UsageRangeKey) => void;
}) {
  const [view, setView] = useState<'usage' | 'growth' | 'referrals'>('usage');
  return (
    <aside className="admin-users-insights" aria-labelledby="admin-users-insights-title">
      <div className="admin-users-insights-heading">
        <h2 id="admin-users-insights-title">Insights</h2>
        <SegmentedControl label="Insight view" value={view} onChange={(value) => setView(value as 'usage' | 'growth' | 'referrals')}>
          <SegmentedControlItem value="usage" label="Feature usage" />
          <SegmentedControlItem value="growth" label="Growth" />
          <SegmentedControlItem value="referrals" label="Referrals" />
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
      ) : view === 'growth' ? (
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
      ) : <ReferralInsights metrics={referrals} />}
    </aside>
  );
}

export function ReferralInsights({ metrics }: { metrics: ReferralCampaignMetrics }) {
  return (
    <div className="admin-users-referral-insights">
      <dl className="admin-users-growth-metrics">
        <div><dt>Links created</dt><dd>{metrics.linksCreated}</dd></div>
        <div><dt>Unique visits</dt><dd>{metrics.uniqueReferralVisits}</dd></div>
        <div><dt>Referred signups</dt><dd>{metrics.referredSignups}</dd></div>
        <div><dt>Activated users</dt><dd>{metrics.referredActivations}</dd></div>
        <div><dt>Rewards issued</dt><dd>{metrics.rewardsIssued}</dd></div>
        <div><dt>Activation rate</dt><dd>{metrics.signupToActivationRate}%</dd></div>
        <div><dt>Referred paid</dt><dd>{metrics.referredPaidConversions}</dd></div>
        <div><dt>Organic paid</dt><dd>{metrics.organicPaidConversions}</dd></div>
        <div><dt>D7 retention</dt><dd>{metrics.referredRetention.day7}%</dd></div>
        <div><dt>D30 retention</dt><dd>{metrics.referredRetention.day30}%</dd></div>
        <div><dt>D60 retention</dt><dd>{metrics.referredRetention.day60}%</dd></div>
        <div><dt>Revocations</dt><dd>{metrics.revocations}</dd></div>
      </dl>
    </div>
  );
}
