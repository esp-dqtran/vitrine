import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  Divider,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  SideNav,
  SideNavItem,
  SideNavSection,
  Text,
} from '@astryxdesign/core';

type Issue = {
  key: string;
  title: string;
  label: [string, string] | null;
  who: string;
  pr: number;
  status: 'In Progress' | 'Todo' | 'Backlog';
  desc: string;
};

const issues: Issue[] = [
  { key: 'VIT-142', title: 'Redesign the browse gallery grid', label: ['Design', 'purple'], who: 'Maya Chen', pr: 3, status: 'In Progress', desc: 'Move the gallery to a responsive masonry grid with denser cards and hover previews.' },
  { key: 'VIT-139', title: 'Virtualize long screen lists for performance', label: ['Perf', 'blue'], who: 'Devin Park', pr: 2, status: 'In Progress', desc: 'Render only visible rows so apps with 200+ screens stay smooth while scrolling.' },
  { key: 'VIT-151', title: 'Add keyboard navigation to the flow viewer', label: ['A11y', 'green'], who: 'Sam Rivera', pr: 2, status: 'Todo', desc: 'Arrow keys move between steps; Escape closes the viewer.' },
  { key: 'VIT-148', title: 'Empty state for zero search results', label: null, who: 'Jo Kim', pr: 1, status: 'Todo', desc: 'Show a helpful empty state with a clear-filters action when a search returns nothing.' },
  { key: 'VIT-146', title: 'Persist active filters in the URL', label: ['Web', 'cyan'], who: 'Maya Chen', pr: 1, status: 'Todo', desc: 'Encode category and platform filters in the query string so views are shareable.' },
  { key: 'VIT-131', title: 'Dark mode polish pass', label: ['Design', 'purple'], who: 'Devin Park', pr: 0, status: 'Backlog', desc: 'Audit token contrast and shadows across every surface in dark mode.' },
  { key: 'VIT-127', title: 'Export collections as PDF', label: null, who: 'Sam Rivera', pr: 0, status: 'Backlog', desc: 'Let users export a saved board of screens as a shareable PDF.' },
];

const statusDot: Record<Issue['status'], string> = {
  'In Progress': 'var(--color-icon-yellow)',
  Todo: 'var(--color-icon-blue)',
  Backlog: 'var(--color-icon-gray)',
};
const prMeta = [
  { label: 'No priority', dot: 'var(--color-icon-gray)', badge: 'neutral' as const },
  { label: 'Low', dot: 'var(--color-icon-blue)', badge: 'blue' as const },
  { label: 'Medium', dot: 'var(--color-icon-yellow)', badge: 'yellow' as const },
  { label: 'Urgent', dot: 'var(--color-icon-red)', badge: 'red' as const },
];

function IssueTracker() {
  const [groupBy, setGroupBy] = useState<'status' | 'priority'>('status');
  const [selKey, setSelKey] = useState<string | null>('VIT-142');
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const groups =
    groupBy === 'status'
      ? (['In Progress', 'Todo', 'Backlog'] as const).map((s) => ({ label: s, dot: statusDot[s], items: issues.filter((i) => i.status === s) }))
      : [3, 2, 1, 0]
          .map((p) => ({ label: prMeta[p].label, dot: prMeta[p].dot, items: issues.filter((i) => i.pr === p) }))
          .filter((g) => g.items.length);
  const sel = issues.find((i) => i.key === selKey) || null;

  return (
    <div style={{ height: 620, borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-med)' }}>
      <AppShell
        height="auto"
        variant="surface"
        contentPadding={0}
        sideNav={
          <SideNav
            collapsible
            header={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--color-accent)', flex: '0 0 auto' }} />
                <Text weight="bold">Vitrine</Text>
                <Text type="supporting">▾</Text>
              </div>
            }
          >
            <SideNavItem label="Inbox" />
            <SideNavItem label="My Issues" isSelected />
            <SideNavSection title="Workspace">
              <SideNavItem label="Projects" />
              <SideNavItem label="Views" />
              <SideNavItem label="Members" />
            </SideNavSection>
            <SideNavSection title="Your teams">
              <SideNavItem label="Engineering" />
              <SideNavItem label="Design" />
            </SideNavSection>
          </SideNav>
        }
      >
        <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flex: '0 0 auto' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-icon-yellow)', flex: '0 0 auto' }} />
                <Heading level={4}>Active Issues</Heading>
                <Text type="supporting">{String(issues.length)}</Text>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <SegmentedControl label="Group by" size="sm" value={groupBy} onChange={(v) => setGroupBy(v as 'status' | 'priority')}>
                  <SegmentedControlItem label="Status" value="status" />
                  <SegmentedControlItem label="Priority" value="priority" />
                </SegmentedControl>
                <Button variant="primary" size="sm" label="New issue" />
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {groups.map((g) => (
                <div key={g.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'var(--color-background-muted)' }}>
                    <div style={{ width: 9, height: 9, borderRadius: 3, background: g.dot, flex: '0 0 auto' }} />
                    <Text weight="semibold">{g.label}</Text>
                    <Text type="supporting">{String(g.items.length)}</Text>
                  </div>
                  {g.items.map((it) => (
                    <div
                      key={it.key}
                      onClick={() => setSelKey(it.key)}
                      onMouseEnter={() => setHoverKey(it.key)}
                      onMouseLeave={() => setHoverKey(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        background: it.key === selKey ? 'var(--color-accent-muted)' : it.key === hoverKey ? 'var(--color-overlay-hover)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12, flex: '0 0 auto' }}>
                        {[0, 1, 2].map((b) => (
                          <div key={b} style={{ width: 3, height: 4 + b * 4, borderRadius: 1, background: b < it.pr ? 'var(--color-icon-secondary)' : 'var(--color-border-emphasized)' }} />
                        ))}
                      </div>
                      <div style={{ width: 56, flex: '0 0 auto' }}>
                        <Text type="supporting">{it.key}</Text>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <Text weight="medium">{it.title}</Text>
                      </div>
                      {it.label ? <Badge variant={it.label[1] as never} label={it.label[0]} /> : null}
                      <Avatar name={it.who} size="tiny" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {sel ? (
            <div style={{ width: 320, flex: '0 0 auto', borderLeft: '1px solid var(--color-border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text type="supporting">{sel.key}</Text>
                <div style={{ flex: 1 }} />
                <Button variant="ghost" size="sm" label="Close" onClick={() => setSelKey(null)} />
              </div>
              <Heading level={3}>{sel.title}</Heading>
              <Text type="body" color="secondary">
                {sel.desc}
              </Text>
              <Divider />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 84, flex: '0 0 auto' }}>
                  <Text type="supporting">Status</Text>
                </div>
                <Badge variant={sel.status === 'In Progress' ? 'yellow' : sel.status === 'Todo' ? 'blue' : 'neutral'} label={sel.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 84, flex: '0 0 auto' }}>
                  <Text type="supporting">Priority</Text>
                </div>
                <Badge variant={prMeta[sel.pr].badge} label={prMeta[sel.pr].label} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 84, flex: '0 0 auto' }}>
                  <Text type="supporting">Assignee</Text>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Avatar name={sel.who} size="tiny" />
                  <Text weight="medium">{sel.who}</Text>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 84, flex: '0 0 auto' }}>
                  <Text type="supporting">Labels</Text>
                </div>
                {sel.label ? (
                  <Badge variant={sel.label[1] as never} label={sel.label[0]} />
                ) : (
                  <Text type="supporting" color="secondary">
                    None
                  </Text>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </AppShell>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { description: { component: 'A keyboard-driven issue-tracker layout — sidebar workspace switcher, grouped issue list, and dense rows with priority, labels, and assignees.' } } },
  args: { children: null },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IssueTrackerDemo: Story = {
  name: 'Issue tracker',
  render: () => (
    <div style={{ padding: 24 }}>
      <IssueTracker />
    </div>
  ),
};
