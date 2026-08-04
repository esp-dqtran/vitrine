import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, EmptyState } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl';
import type { App, Screen } from '../../vitrine/types';
import { AppCard } from '../../vitrine/components/AppCard';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from '../../vitrine/components/AppsFilterBar';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
} from '../../vitrine/components/AstryxDropdown';
import { ReferenceDiscoveryFacetGroup } from '../../vitrine/components/ReferenceDiscoveryFacetGroup';
import { ReferenceDiscoveryPageShell } from '../../vitrine/components/ReferenceDiscoveryPageShell';
import { ReferenceDiscoveryTopNav } from '../../vitrine/components/ReferenceDiscoveryTopNav';
import { SearchTrigger } from '../../vitrine/components/SearchTrigger';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import './PageLayoutsAndResponsive.css';

const meta = {
  title: 'Patterns/Page layouts and responsive',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A production-grounded visual review of Vitrines discovery and detail page frames, shared gutters, sticky chrome, result grids, state placement, and responsive reflow.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const APP_ID = 'aboard-ea683077-aadb-47c5-a771-d21fd9676510';
const PREVIEW_HOST = 'http://127.0.0.1:5173';
const APP_DETAIL_URL = `${PREVIEW_HOST}/apps/${APP_ID}/screens?platform=web&version=1`;
const APP_ICON = 'https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png';

const makeScreen = (id: number, platform: Platform = 'web'): Screen => ({
  id,
  type: 'Dashboard',
  productArea: 'Workspace',
  theme: 'light',
  visibleStates: ['Default'],
  platform,
  description: null,
  url: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/${id}?variant=full`,
  thumbnailUrl: `${PREVIEW_HOST}/api/preview-media/${APP_ID}/${id}`,
});

const apps: App[] = [
  {
    id: APP_ID,
    app: 'Aboard',
    categories: [{ id: 1, name: 'Business, Jobs & Recruitment', slug: 'business' }],
    accent: '#08bfe8',
    totalScreens: 624,
    totalUiElements: 118,
    totalFlows: 166,
    platforms: ['web'],
    analyzedScreens: 0,
    lastCapturedAt: '2026-07-24T00:00:00.000Z',
    iconUrl: APP_ICON,
    description: 'Business, Jobs & Recruitment',
    previewVideoUrl: null,
    screens: [makeScreen(1)],
  },
  {
    id: 'artlist-layout-review',
    app: 'Artlist',
    categories: [{ id: 2, name: 'Photo & Video', slug: 'photo-video' }],
    accent: '#f6d33b',
    totalScreens: 201,
    totalUiElements: 48,
    totalFlows: 72,
    platforms: ['web'],
    analyzedScreens: 0,
    lastCapturedAt: '2026-07-20T00:00:00.000Z',
    iconUrl: null,
    description: 'Photo & Video',
    previewVideoUrl: null,
    screens: [makeScreen(2)],
  },
  {
    id: 'linear-layout-review',
    app: 'Linear',
    categories: [{ id: 3, name: 'Productivity', slug: 'productivity' }],
    accent: '#5e6ad2',
    totalScreens: 184,
    totalUiElements: 65,
    totalFlows: 54,
    platforms: ['web'],
    analyzedScreens: 184,
    lastCapturedAt: '2026-07-18T00:00:00.000Z',
    iconUrl: null,
    description: 'Productivity',
    previewVideoUrl: null,
    screens: [makeScreen(3)],
  },
];

const initialFilters: DiscoveryFilterGroup[] = [
  {
    id: 'categories',
    label: 'Categories',
    selected: [],
    options: ['AI', 'Business', 'Finance'].map((value) => ({ value, section: 'Categories' })),
  },
  {
    id: 'screens',
    label: 'Screens',
    selected: [],
    options: ['Dashboard', 'Settings', 'Onboarding'].map((value) => ({ value, section: 'Screens' })),
  },
  {
    id: 'elements',
    label: 'UI Elements',
    selected: [],
    options: ['Button', 'Dialog', 'Text Field'].map((value) => ({ value, section: 'UI Elements' })),
  },
  {
    id: 'flows',
    label: 'Flows',
    selected: [],
    options: ['Setting Up', 'Searching & Finding', 'Reporting'].map((value) => ({ value, section: 'Flows' })),
  },
];

function ReviewSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="layout-review__section">
      <header className="layout-review__section-header">
        <span>{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function LayoutContract() {
  const frames = [
    { name: 'Wide', range: '≥ 1101px', gutter: '32px', columns: '3 columns' },
    { name: 'Medium', range: '721–1100px', gutter: '24px', columns: '2 columns' },
    { name: 'Compact', range: '≤ 720px', gutter: '20px', columns: '1 column' },
  ];

  return (
    <div className="layout-review__contract-grid">
      {frames.map((frame, index) => (
        <article key={frame.name} className={`layout-review__contract layout-review__contract--${frame.name.toLowerCase()}`}>
          <header>
            <strong>{frame.name}</strong>
            <span>{frame.range}</span>
          </header>
          <div className="layout-review__contract-canvas" aria-hidden="true">
            <span className="layout-review__contract-nav" />
            <span className="layout-review__contract-hero" />
            <span className="layout-review__contract-toolbar" />
            <span className="layout-review__contract-results">
              {Array.from({ length: 3 - index }, (_, item) => <i key={item} />)}
            </span>
          </div>
          <footer><span>{frame.gutter} gutter</span><span>{frame.columns}</span></footer>
        </article>
      ))}
    </div>
  );
}

function DiscoveryPilot() {
  const [platform, setPlatform] = useState<Platform>('web');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState('latest');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const toggleFilter = (groupId: string, value: string) => {
    setFilters((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const selected = group.selected.includes(value)
        ? group.selected.filter((item) => item !== value)
        : [...group.selected, value];
      return { ...group, selected };
    }));
  };

  const taxonomy = [
    { label: 'Categories', values: ['AI', 'Finance', 'CRM', 'Business'] },
    { label: 'Screens', values: ['My Account & Profile', 'Filter & Sort', 'Signup'] },
    { label: 'UI Elements', values: ['Navigation Menu', 'Dialog', 'Card'] },
    { label: 'Flows', values: ['Setting Up', 'Searching & Finding', 'Reporting'] },
  ];

  return (
    <div
      className="layout-review__production-frame layout-review__discovery-frame"
      role="region"
      aria-label="Apps Discovery scroll behavior preview"
    >
      <ReferenceDiscoveryTopNav
        active="apps"
        className="apps-top-nav"
        search={<SearchTrigger label="Search Apps…" activeCategory={null} mode="advanced" onOpen={() => {}} onClearCategory={() => {}} />}
        accountControls={(
          <div className="layout-review__account-controls">
            <AstryxDropdown
              label="admin@gmail.com"
              ariaLabel="Account menu: admin@gmail.com"
              open={accountMenuOpen}
              menuWidth={220}
              onOpenChange={setAccountMenuOpen}
            >
              <AstryxDropdownItem label="Collections" onSelect={() => setAccountMenuOpen(false)} />
              <AstryxDropdownItem label="Settings" onSelect={() => setAccountMenuOpen(false)} />
              <AstryxDropdownDivider />
              <AstryxDropdownItem label="Log out" onSelect={() => setAccountMenuOpen(false)} />
            </AstryxDropdown>
          </div>
        )}
      />
      <ReferenceDiscoveryPageShell
        kind="apps"
        header={null}
        taxonomyLabel="App discovery filters"
        taxonomy={(
          <div className="layout-review__taxonomy">
            {taxonomy.map((group) => (
              <ReferenceDiscoveryFacetGroup key={group.label} label={group.label}>
                {group.values.map((value) => <Button key={value} label={value} variant="ghost" size="sm" />)}
              </ReferenceDiscoveryFacetGroup>
            ))}
          </div>
        )}
        toolbar={(
          <DiscoveryFilterBar
            kind="apps"
            ariaLabel="App discovery controls"
            platform={{ value: platform, ariaLabel: 'App platform', onChange: setPlatform }}
            filters={filters}
            resultCount={452}
            resultLabels={['app', 'apps']}
            sort={sort}
            sortOptions={[{ value: 'latest', label: 'Latest' }, { value: 'trending', label: 'Trending' }]}
            onSortChange={setSort}
            onToggleFilter={toggleFilter}
            onClearFilter={(groupId) => setFilters((current) => current.map((group) => group.id === groupId ? { ...group, selected: [] } : group))}
          />
        )}
      >
        <div className="reference-discovery__grid apps-discovery__grid">
          {apps.map((app) => <AppCard key={app.id} app={app} platform={platform} onOpen={() => {}} />)}
        </div>
      </ReferenceDiscoveryPageShell>
    </div>
  );
}

function DetailPilot() {
  return (
    <iframe
      className="layout-review__live-app-detail"
      title="Live production App Detail"
      src={APP_DETAIL_URL}
      loading="eager"
    />
  );
}

function StatePlacement() {
  return (
    <div className="layout-review__state-grid">
      <article>
        <span>Loading</span>
        <div className="layout-review__state layout-review__state--loading" role="status" aria-label="Loading results">
          <i /><i /><i />
        </div>
      </article>
      <article>
        <span>Empty</span>
        <div className="layout-review__state">
          <EmptyState
            title="No apps match these filters"
            description="Remove one or more filters to see more captured references."
            actions={<Button label="Clear filters" variant="primary" size="md" />}
          />
        </div>
      </article>
      <article>
        <span>Error</span>
        <div className="layout-review__state">
          <EmptyState
            title="Apps could not be loaded"
            description="The current filters stay in place while you try again."
            actions={<Button label="Try again" variant="primary" size="md" />}
          />
        </div>
      </article>
    </div>
  );
}

function PageLayoutsAndResponsiveReview() {
  return (
    <main className="layout-review">
      <header className="layout-review__intro">
        <div>
          <p className="layout-review__eyebrow">Vitrines · Pattern system</p>
          <h1>Page Layouts &amp; Responsive</h1>
          <p className="layout-review__lede">One page frame keeps discovery, detail, and system states aligned from wide desktop to compact mobile.</p>
        </div>
        <span className="layout-review__status">Visual review · Apps + App Detail</span>
      </header>

      <ReviewSection index="01" title="Layout contract" description="Content stays full-width with stable gutters; grids reflow at task-driven breakpoints without hiding controls.">
        <LayoutContract />
      </ReviewSection>

      <ReviewSection index="02" title="Apps Discovery pilot" description="Persistent navigation, taxonomy, filters, result metadata, and cards share one horizontal frame.">
        <DiscoveryPilot />
      </ReviewSection>

      <ReviewSection index="03" title="App Detail pilot" description="The live production route is embedded here so navigation, hero, metadata, controls, loading, evidence, and responsive behavior cannot drift from the real screen.">
        <DetailPilot />
      </ReviewSection>

      <ReviewSection index="04" title="System state placement" description="Loading, empty, and error states replace the results region without moving the toolbar or changing page width.">
        <StatePlacement />
      </ReviewSection>
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <PageLayoutsAndResponsiveReview />,
};
