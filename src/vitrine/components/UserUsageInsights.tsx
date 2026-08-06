import { useState, type ReactElement, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { FeatureUsageOverview, GrowthStats, ReferralCampaignMetrics, UsageRangeKey } from '../types.ts';
import type { GrowthResponse } from '../usersApi.ts';
import { formatCents, formatConversion } from '../usersPageModel.ts';
import { useSegmentedIndicator } from './useSegmentedIndicator.ts';
import { revenueSummary } from '../../pricing.ts';

const CHART_FONT = "'Figtree', system-ui, sans-serif";
const axisTick = { fill: 'var(--color-text-secondary)', fontSize: 11, fontFamily: CHART_FONT };
const grid = { vertical: false, stroke: 'var(--color-border)', strokeDasharray: '3 3' } as const;
/* Bars own their hit target; a line chart needs the crosshair to find the X. */
const barCursor = { fill: 'var(--color-background-muted)' } as const;
const lineCursor = { stroke: 'var(--color-border-emphasized)', strokeWidth: 1 } as const;
const SERIES_1 = 'var(--vitrine-chart-series-1)';
const SERIES_2 = 'var(--vitrine-chart-series-2)';
/* Funnel stages are ordinal — one hue darkening down the funnel, so the order is
   visible in the color instead of eight unrelated hues competing. */
const FUNNEL_STEPS = [
  'var(--vitrine-chart-step-1)',
  'var(--vitrine-chart-step-2)',
  'var(--vitrine-chart-step-3)',
  'var(--vitrine-chart-step-4)',
  'var(--vitrine-chart-step-5)',
];

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
}

/*
 * Recharts' default tooltip is an inline-styled white box: no tokens, no dark
 * mode, no type scale. This is the product surface, and it reads value-first —
 * the pointer is already on the series, so the number is what is wanted.
 */
function ChartTooltip({ active, payload, label, unit = '' }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-users-chart-tooltip">
      {label ? <p className="admin-users-chart-tooltip__label">{label}</p> : null}
      <ul>
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)}>
            <span
              className="admin-users-chart-tooltip__key"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <strong>{entry.value}{unit}</strong>
            <span>{entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/*
 * Every chart carries its numbers in `label`: a canvas is invisible to screen
 * readers, and ResponsiveContainer renders nothing at all without a measured
 * width (server render, jsdom), so this is the only text alternative there is.
 */
function ChartFigure({ title, note, label, height = 260, children }: {
  title: string;
  note?: string;
  label: string;
  height?: number;
  children: ReactElement;
}) {
  return (
    <figure className="admin-users-chart-figure">
      <figcaption className="admin-users-insight-section-heading">
        <h3>{title}</h3>{note ? <span>{note}</span> : null}
      </figcaption>
      <div className="admin-users-chart" style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </figure>
  );
}

/* Category axis on the left, value bars running right — used for rankings and
   funnels, where the labels are words rather than dates. */
function RankedBars({ data, valueKey, name, labelWidth = 118, steps }: {
  data: Array<{ label: string } & Record<string, string | number>>;
  valueKey: string;
  name: string;
  labelWidth?: number;
  /* Ordinal ramp, one step per row — omit for a plain one-hue ranking. */
  steps?: string[];
}) {
  return (
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid {...grid} vertical horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="label" width={labelWidth} tick={axisTick} axisLine={false} tickLine={false} />
      <Tooltip cursor={barCursor} content={<ChartTooltip />} />
      <Bar
        dataKey={valueKey}
        name={name}
        fill={SERIES_1}
        radius={[0, 3, 3, 0]}
        maxBarSize={18}
        /* `shape` per recharts 3 — Cell is deprecated for exactly this. */
        shape={steps
          ? (props: { index?: number }) => (
              <Rectangle {...props} fill={steps[(props.index ?? 0) % steps.length]} />
            )
          : undefined}
      />
    </BarChart>
  );
}

function Metrics({ children }: { children: ReactNode }) {
  return <dl className="admin-users-growth-metrics">{children}</dl>;
}

export function UserUsageInsights({ usage, growth, referrals, range, refreshing, error, onRangeChange }: {
  usage: FeatureUsageOverview;
  growth: GrowthResponse;
  referrals: ReferralCampaignMetrics;
  range: UsageRangeKey;
  /* A range change refetches behind the current panel — same as the directory. */
  refreshing?: boolean;
  error?: string | null;
  onRangeChange: (range: UsageRangeKey) => void;
}) {
  const [view, setView] = useState<InsightView>('usage');
  const viewSwitcherRef = useSegmentedIndicator(view);
  const rangeSwitcherRef = useSegmentedIndicator(range);
  return (
    /* No "Insights" heading: this is the whole Insights page and the page title
       already says so. View and range are one control row. */
    <section className="admin-users-insights">
      <div className="admin-users-insights-heading">
        <SegmentedControl ref={viewSwitcherRef} label="Insight view" value={view} onChange={(value) => setView(value as InsightView)}>
          <SegmentedControlItem value="usage" label="Usage" />
          <SegmentedControlItem value="growth" label="Growth" />
          <SegmentedControlItem value="revenue" label="Revenue" />
          <SegmentedControlItem value="referrals" label="Referrals" />
        </SegmentedControl>
        <div className="admin-users-insights-range">
          {error ? (
            <span className="admin-users-insights-error" role="alert">{error}</span>
          ) : refreshing ? (
            <span className="admin-users-refreshing" role="status">Updating…</span>
          ) : null}
          <SegmentedControl ref={rangeSwitcherRef} label="Usage range" value={range} onChange={(value) => onRangeChange(value as UsageRangeKey)}>
            <SegmentedControlItem value="7d" label="7d" />
            <SegmentedControlItem value="30d" label="30d" />
            <SegmentedControlItem value="90d" label="90d" />
          </SegmentedControl>
        </div>
      </div>

      {/* Keyed so switching view or range replays the panel enter animation. */}
      <div className="admin-users-insight-panel" key={`${view}-${range}`}>
      {view === 'usage' ? (
        <UsageInsights usage={usage} range={range} />
      ) : view === 'growth' ? (
        <GrowthInsights growth={growth} />
      ) : view === 'revenue' ? (
        <RevenueInsights stats={growth.stats} />
      ) : <ReferralInsights metrics={referrals} />}
      </div>
    </section>
  );
}

type InsightView = 'usage' | 'growth' | 'revenue' | 'referrals';

export function UsageInsights({ usage, range }: { usage: FeatureUsageOverview; range: UsageRangeKey }) {
  const features = usage.features.map((feature) => ({
    label: feature.label,
    uses: feature.uses,
    users: feature.uniqueUsers,
    share: feature.share,
  }));
  return (
    <>
      <Metrics>
        <div><dt>Feature uses</dt><dd>{usage.summary.totalEvents}</dd></div>
        <div><dt>Active users</dt><dd>{usage.summary.uniqueUsers}</dd></div>
        <div><dt>Features used</dt><dd>{usage.summary.usedFeatures}</dd></div>
      </Metrics>

      {usage.daily.length ? (
        <ChartFigure
          title="Feature uses over time"
          note={`Last ${range}`}
          label={`Feature uses per day over the last ${range}: ${usage.daily.map((point) => `${point.day} ${point.uses}`).join(', ')}`}
        >
          <LineChart data={usage.daily} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={28} />
            <Tooltip cursor={lineCursor} content={<ChartTooltip />} />
            <Line type="monotone" dataKey="uses" name="Uses" stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartFigure>
      ) : <p className="admin-users-insights-empty">No feature activity in this range yet.</p>}

      {features.length ? (
        <ChartFigure
          title="Most used features"
          note="Members only"
          height={Math.max(200, features.length * 42 + 56)}
          label={`Uses by feature: ${features.map((feature) => `${feature.label} ${feature.uses} uses by ${feature.users} users, ${feature.share}%`).join('; ')}`}
        >
          {/* Two series, so identity is never colour alone: a legend names both. */}
          <BarChart data={features} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} vertical horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={118} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={barCursor} content={<ChartTooltip />} />
            <Legend verticalAlign="top" align="left" iconType="rect" iconSize={9} wrapperStyle={{ paddingBottom: 8 }} formatter={(value) => <span className="admin-users-chart-legend">{value}</span>} />
            <Bar dataKey="uses" name="Uses" fill={SERIES_1} radius={[0, 3, 3, 0]} maxBarSize={12} />
            <Bar dataKey="users" name="Unique users" fill={SERIES_2} radius={[0, 3, 3, 0]} maxBarSize={12} />
          </BarChart>
        </ChartFigure>
      ) : null}
    </>
  );
}

export function GrowthInsights({ growth }: { growth: GrowthResponse }) {
  const { stats, dailySignups } = growth;
  return (
    <>
      <Metrics>
        <div><dt>Total users</dt><dd>{stats.total_users}</dd></div>
        <div><dt>New this week</dt><dd>{stats.new_users_7d}</dd></div>
        <div><dt>Pro members</dt><dd>{stats.active_subscribers}</dd></div>
        <div><dt>Conversion</dt><dd>{formatConversion(stats.active_subscribers, stats.total_users)}</dd></div>
      </Metrics>

      <ChartFigure
        title="Daily signups"
        label={`Daily member signups: ${dailySignups.map((point) => `${point.day} ${point.signups}`).join(', ')}`}
      >
        <BarChart data={dailySignups} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={28} />
          <Tooltip cursor={barCursor} content={<ChartTooltip />} />
          <Bar dataKey="signups" name="Signups" fill={SERIES_1} radius={[3, 3, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ChartFigure>

      <ChartFigure
        title="Active members"
        note="Daily vs weekly"
        height={200}
        label={`Active members: ${stats.dau} daily, ${stats.wau} weekly`}
      >
        <RankedBars
          data={[
            { label: 'Daily active', members: stats.dau },
            { label: 'Weekly active', members: stats.wau },
          ]}
          valueKey="members"
          name="Members"
        />
      </ChartFigure>
    </>
  );
}

export function RevenueInsights({ stats }: { stats: GrowthStats }) {
  const { mrrCents, arrCents, churnRate } = revenueSummary(stats);
  const paying = stats.active_monthly + stats.active_yearly;
  return (
    <>
      <Metrics>
        <div><dt>MRR</dt><dd>{formatCents(mrrCents)}</dd></div>
        <div><dt>ARR</dt><dd>{formatCents(arrCents)}</dd></div>
        <div><dt>Churn (30d)</dt><dd>{churnRate}%</dd></div>
        <div><dt>ARPU</dt><dd>{formatCents(paying ? Math.round(mrrCents / paying) : 0)}</dd></div>
      </Metrics>

      <ChartFigure
        title="Subscription mix"
        note="Active plans"
        height={220}
        label={`Subscription mix: ${stats.active_monthly} monthly plans, ${stats.active_yearly} yearly plans, ${stats.canceled_30d} canceled in the last 30 days`}
      >
        <RankedBars
          data={[
            { label: 'Monthly', plans: stats.active_monthly },
            { label: 'Yearly', plans: stats.active_yearly },
            { label: 'Canceled (30d)', plans: stats.canceled_30d },
          ]}
          valueKey="plans"
          name="Plans"
        />
      </ChartFigure>
    </>
  );
}

export function ReferralInsights({ metrics }: { metrics: ReferralCampaignMetrics }) {
  const funnel = [
    { label: 'Links created', people: metrics.linksCreated },
    { label: 'Unique visits', people: metrics.uniqueReferralVisits },
    { label: 'Referred signups', people: metrics.referredSignups },
    { label: 'Activated users', people: metrics.referredActivations },
    { label: 'Referred paid', people: metrics.referredPaidConversions },
  ];
  const retention = [
    { label: 'D7', rate: metrics.referredRetention.day7 },
    { label: 'D30', rate: metrics.referredRetention.day30 },
    { label: 'D60', rate: metrics.referredRetention.day60 },
  ];
  return (
    <div className="admin-users-referral-insights">
      <Metrics>
        <div><dt>Activation rate</dt><dd>{metrics.signupToActivationRate}%</dd></div>
        <div><dt>Rewards issued</dt><dd>{metrics.rewardsIssued}</dd></div>
        <div><dt>Organic paid</dt><dd>{metrics.organicPaidConversions}</dd></div>
        <div><dt>Revocations</dt><dd>{metrics.revocations}</dd></div>
      </Metrics>

      <ChartFigure
        title="Referral funnel"
        height={240}
        label={`Referral funnel: ${funnel.map((step) => `${step.label} ${step.people}`).join(', ')}`}
      >
        <RankedBars data={funnel} valueKey="people" name="People" labelWidth={128} steps={FUNNEL_STEPS} />
      </ChartFigure>

      <ChartFigure
        title="Referred retention"
        note="Share still active"
        height={220}
        label={`Referred retention: ${retention.map((point) => `${point.label} retention ${point.rate}%`).join(', ')}`}
      >
        <LineChart data={retention} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} unit="%" tick={axisTick} axisLine={false} tickLine={false} width={40} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip unit="%" />} />
          <Line type="monotone" dataKey="rate" name="Still active" stroke={SERIES_1} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ChartFigure>
    </div>
  );
}
