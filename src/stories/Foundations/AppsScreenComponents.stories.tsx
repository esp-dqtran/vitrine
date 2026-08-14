import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Badge,
  Button,
  CheckboxInput,
  EmptyState,
  Icon,
  IconButton,
  ProgressBar,
  Skeleton,
  ToggleButton,
} from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl';
import type { App, ProgressSnapshot, Screen } from '../../vitrine/types';
import { AppCard } from '../../vitrine/components/AppCard';
import { AppCardSkeleton } from '../../vitrine/components/AppCardSkeleton';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
} from '../../vitrine/components/AstryxDropdown';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from '../../vitrine/components/AppsFilterBar';
import { HeroButton } from '../../vitrine/components/HeroButton';
import { ProgressBannerView } from '../../vitrine/components/ProgressBanner';
import { ReferenceDiscoveryFacetGroup } from '../../vitrine/components/ReferenceDiscoveryFacetGroup';
import { ApplicationHeader } from '../../vitrine/components/ApplicationHeader';
import { ScreenPreviewDialog } from '../../vitrine/components/ScreenPreviewDialog';
import {
  AstryxInputText,
  SearchTrigger,
} from '../../vitrine/components/SearchTrigger';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/flowPreviewDialog.css';
import '../../vitrine/components/AstryxDropdown.css';
import './AppsScreenComponents.css';

const meta = {
  title: 'Foundations/Apps screen components',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A live inventory of the local composite components used by the Vitrines Apps screen.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PREVIEW_HOST = 'http://127.0.0.1:5174';

function makeScreen(id: number, url: string, platform: Platform = 'web'): Screen {
  return {
    id,
    type: 'Dashboard',
    productArea: 'Workspace',
    theme: 'dark',
    visibleStates: ['default'],
    platform,
    description: null,
    url,
  };
}

function makeApp({
  id,
  name,
  description,
  accent,
  preview,
  iconUrl,
  totalScreens,
}: {
  id: string;
  name: string;
  description: string;
  accent: string;
  preview: string;
  iconUrl?: string;
  totalScreens: number;
}): App {
  return {
    id,
    app: name,
    categories: [{ id: 1, name: 'Business', slug: 'business' }],
    accent,
    totalScreens,
    platforms: ['web'],
    analyzedScreens: 0,
    lastCapturedAt: '2026-07-24T00:00:00.000Z',
    iconUrl: iconUrl ?? null,
    description,
    previewVideoUrl: null,
    screens: [makeScreen(1, preview)],
  };
}

const apps: App[] = [
  makeApp({
    id: 'aboard',
    name: 'Aboard',
    description: 'Business, Jobs & Recruitment',
    accent: '#5b8ff9',
    totalScreens: 624,
    preview: `${PREVIEW_HOST}/api/preview-media/aboard-ea683077-aadb-47c5-a771-d21fd9676510/web/1`,
    iconUrl:
      'https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/app_logos/f6788135-eea1-4370-a4de-80aaa3da4b52.png?f=png&w=400&q=85&fit=shrink-cover',
  }),
  makeApp({
    id: 'artlist',
    name: 'Artlist',
    description: 'Photo & Video',
    accent: '#f5b041',
    totalScreens: 201,
    preview: `${PREVIEW_HOST}/api/preview-media/artlist/web/1`,
  }),
];

const progress: ProgressSnapshot = {
  entries: [
    {
      id: 'crawl-wispr-flow',
      stage: 'crawl',
      app: 'wispr-flow',
      done: 134,
      total: 140,
      status: 'running',
      message: 'Captured 134/140',
      updatedAt: '2026-07-31T12:00:00.000Z',
    },
  ],
};

const initialFilters: DiscoveryFilterGroup[] = [
  {
    id: 'categories',
    label: 'Categories',
    selected: [],
    options: [
      { value: 'AI', section: 'Categories', description: 'AI-assisted products' },
      { value: 'Business', section: 'Categories', description: 'Business tools' },
      { value: 'Finance', section: 'Categories', description: 'Finance products' },
    ],
  },
  {
    id: 'screens',
    label: 'Screens',
    selected: [],
    options: [
      { value: 'My Account & Profile', section: 'Screens' },
      { value: 'Filter & Sort', section: 'Screens' },
      { value: 'Settings & Preferences', section: 'Screens' },
    ],
  },
  {
    id: 'elements',
    label: 'UI Elements',
    selected: [],
    options: [
      { value: 'Navigation Menu', section: 'UI Elements' },
      { value: 'Dialog', section: 'UI Elements' },
      { value: 'Card', section: 'UI Elements' },
    ],
  },
  {
    id: 'flows',
    label: 'Flows',
    selected: [],
    options: [
      { value: 'Setting Up', section: 'Flows' },
      { value: 'Searching & Finding', section: 'Flows' },
      { value: 'Filtering & Sorting', section: 'Flows' },
    ],
  },
];

function AccountMenu() {
  const [open, setOpen] = useState(false);
  return (
    <AstryxDropdown
      label="admin@localhost.test"
      ariaLabel="Account menu: admin@localhost.test"
      open={open}
      menuWidth={220}
      onOpenChange={setOpen}
    >
      <AstryxDropdownItem label="Research projects" onSelect={() => setOpen(false)} />
      <AstryxDropdownItem label="Collections (3)" onSelect={() => setOpen(false)} />
      <AstryxDropdownItem label="Settings" onSelect={() => setOpen(false)} />
      <AstryxDropdownDivider />
      <AstryxDropdownItem label="Log out" onSelect={() => setOpen(false)} />
    </AstryxDropdown>
  );
}

function ControlStandard({
  name,
  description,
  children,
  wide = false,
}: {
  name: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      className={`apps-components__control-standard ${
        wide ? 'apps-components__control-standard--wide' : ''
      }`}
    >
      <div className="apps-components__control-copy">
        <strong>{name}</strong>
        <span>{description}</span>
      </div>
      <div className="apps-components__control-demo">{children}</div>
    </article>
  );
}

function ControlStandards() {
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);

  return (
    <div className="apps-components__control-standards">
      <ControlStandard
        name="Primary button"
        description="White filled action for the highest-priority task on a page."
      >
        <HeroButton primary onClick={() => {}}>Export to Figma</HeroButton>
      </ControlStandard>

      <ControlStandard
        name="Secondary button"
        description="Dark supporting action placed beside the primary action."
      >
        <HeroButton onClick={() => {}}>Visit Site</HeroButton>
      </ControlStandard>

      <ControlStandard
        name="Primary dropdown"
        description="White filled trigger for the main scope or platform selection."
      >
        <AstryxDropdown
          label="Web"
          ariaLabel="App platform: Web"
          open={primaryOpen}
          triggerVariant="primary"
          onOpenChange={setPrimaryOpen}
        >
          <AstryxDropdownItem label="Web" selected onSelect={() => setPrimaryOpen(false)} />
          <AstryxDropdownItem label="iOS" onSelect={() => setPrimaryOpen(false)} />
          <AstryxDropdownItem label="Android" onSelect={() => setPrimaryOpen(false)} />
        </AstryxDropdown>
      </ControlStandard>

      <ControlStandard
        name="Secondary dropdown"
        description="Dark outlined trigger for supporting filters, sort, and menus."
      >
        <AstryxDropdown
          label="Categories"
          ariaLabel="Open Categories filters"
          open={secondaryOpen}
          triggerVariant="secondary"
          onOpenChange={setSecondaryOpen}
        >
          <AstryxDropdownItem label="AI" onSelect={() => setSecondaryOpen(false)} />
          <AstryxDropdownItem label="Business" onSelect={() => setSecondaryOpen(false)} />
          <AstryxDropdownItem label="Finance" onSelect={() => setSecondaryOpen(false)} />
        </AstryxDropdown>
      </ControlStandard>

      <ControlStandard
        name="Input text"
        description="Dark search field with leading icon and placeholder treatment."
      >
        <AstryxInputText
          label={searchOpened ? 'Quick Search opened' : 'Search Apps…'}
          ariaLabel="Search Apps…, Open Quick Search"
          onOpen={() => setSearchOpened(true)}
        />
      </ControlStandard>

      <ControlStandard
        name="Dropdown menu"
        description="One shared surface for menu items, selected state, divider, and destructive action."
        wide
      >
        <div
          className="astryx-dropdown apps-components__menu-preview"
          role="menu"
          aria-label="Dropdown menu standard"
        >
          <AstryxDropdownItem label="AI" selected onSelect={() => {}} />
          <AstryxDropdownItem label="Business" onSelect={() => {}} />
          <AstryxDropdownDivider />
          <AstryxDropdownItem
            label="Clear filters"
            tone="destructive"
            onSelect={() => {}}
          />
        </div>
      </ControlStandard>
    </div>
  );
}

function AppsHeader() {
  const [searchOpened, setSearchOpened] = useState(false);
  return (
    <>
      <ApplicationHeader
        active="apps"
        className="apps-top-nav"
        search={
          <SearchTrigger
            label={searchOpened ? 'Quick Search opened' : 'Search Apps…'}
            activeCategory={null}
            onOpen={() => setSearchOpened(true)}
            onClearCategory={() => {}}
            mode="advanced"
          />
        }
        accountControls={<AccountMenu />}
      />
    </>
  );
}

function Taxonomy() {
  const [selected, setSelected] = useState('AI');
  const groups = [
    { label: 'Categories', values: ['AI', 'Finance', 'CRM', 'Business', 'News'] },
    {
      label: 'Screens',
      values: ['My Account & Profile', 'Filter & Sort', 'Chat Bot', 'Signup'],
    },
    {
      label: 'UI Elements',
      values: ['Navigation Menu', 'Dialog', 'Card', 'Dropdown Menu'],
    },
    {
      label: 'Flows',
      values: ['Setting Up', 'Searching & Finding', 'Filtering & Sorting'],
    },
  ];
  return (
    <div className="apps-components__taxonomy">
      {groups.map((group) => (
        <ReferenceDiscoveryFacetGroup key={group.label} label={group.label}>
          {group.values.map((value) => (
            <Button
              key={value}
              label={value}
              variant="ghost"
              size="sm"
              aria-pressed={selected === value}
              onClick={() => setSelected(value)}
            />
          ))}
        </ReferenceDiscoveryFacetGroup>
      ))}
    </div>
  );
}

function FilterBar() {
  const [platform, setPlatform] = useState<Platform>('web');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState('latest');
  return (
    <DiscoveryFilterBar
      kind="apps"
      ariaLabel="App discovery controls"
      platform={{
        value: platform,
        ariaLabel: 'App platform',
        onChange: setPlatform,
      }}
      filters={filters}
      resultCount={452}
      resultLabels={['app', 'apps']}
      sort={sort}
      sortOptions={[
        { value: 'latest', label: 'Latest' },
        { value: 'trending', label: 'Trending' },
      ]}
      onSortChange={setSort}
      onToggleFilter={(groupId, value) =>
        setFilters((current) =>
          current.map((group) =>
            group.id !== groupId
              ? group
              : {
                  ...group,
                  selected: group.selected.includes(value)
                    ? group.selected.filter((item) => item !== value)
                    : [...group.selected, value],
                },
          ),
        )
      }
      onClearFilter={(groupId) =>
        setFilters((current) =>
          current.map((group) =>
            group.id === groupId ? { ...group, selected: [] } : group,
          ),
        )
      }
    />
  );
}

function Primitive({
  name,
  usedBy,
  demoClassName = '',
  children,
}: {
  name: string;
  usedBy: string;
  demoClassName?: string;
  children: ReactNode;
}) {
  return (
    <article className="apps-components__primitive">
      <h3>{name}</h3>
      <p>{usedBy}</p>
      <div
        className={`apps-components__primitive-demo ${demoClassName}`.trim()}
      >
        {children}
      </div>
    </article>
  );
}

function PrimaryPrimitives() {
  const [checked, setChecked] = useState(true);
  const [pressed, setPressed] = useState(true);
  return (
    <div className="apps-components__primitives">
      <Primitive
        name="Button"
        usedBy="Hero actions, taxonomy facets, SearchTrigger, AstryxDropdown triggers, retry and cancel actions."
      >
        <Button label="Primary" variant="primary" size="sm" />
        <Button label="Secondary" variant="secondary" size="sm" />
        <Button label="Ghost" variant="ghost" size="sm" />
      </Primitive>

      <Primitive
        name="ToggleButton"
        usedBy="ReferenceTypeTabs for Apps, Sites, and Flows."
      >
        <ToggleButton
          label="Apps"
          size="sm"
          isPressed={pressed}
          onPressedChange={setPressed}
        />
        <ToggleButton label="Sites" size="sm" />
      </Primitive>

      <Primitive
        name="Input text"
        usedBy="The same shared AstryxInputText standard shown above."
      >
        <AstryxInputText
          label="Search categories…"
          ariaLabel="Search categories…, Open search"
          onOpen={() => {}}
        />
      </Primitive>

      <Primitive
        name="CheckboxInput"
        usedBy="DiscoveryFilterOptionCheckbox for multi-select filter values."
        demoClassName="apps-components__primitive-demo--stack"
      >
        <CheckboxInput
          label="Business"
          value={checked}
          onChange={setChecked}
          size="sm"
          width="100%"
        />
        <CheckboxInput
          label="Finance"
          value={false}
          onChange={() => {}}
          size="sm"
          width="100%"
        />
      </Primitive>

      <Primitive
        name="Icon + IconButton"
        usedBy="Search, chevrons, selected checks, panel preview fallback, and clear-filter actions."
      >
        <Icon icon="search" size="md" />
        <Icon icon="chevronDown" size="md" />
        <IconButton
          label="Clear filter"
          icon={<Icon icon="close" size="xsm" />}
          variant="ghost"
          size="sm"
        />
      </Primitive>

      <Primitive
        name="ProgressBar"
        usedBy="ProgressBannerView for crawl and analysis stages."
        demoClassName="apps-components__primitive-demo--stack"
      >
        <ProgressBar
          label="Captured 134/140"
          value={134}
          max={140}
          hasValueLabel
          variant="accent"
        />
      </Primitive>

      <Primitive
        name="Badge"
        usedBy="AppCard status overlays for queued, in-progress, complete, and attention states."
      >
        <Badge label="In progress" variant="info" />
        <Badge label="Complete" variant="success" />
        <Badge label="Needs attention" variant="error" />
      </Primitive>

      <Primitive
        name="Skeleton"
        usedBy="AppCardSkeleton while the initial Apps result set is loading."
        demoClassName="apps-components__primitive-demo--stack"
      >
        <Skeleton width="100%" height={42} radius="rounded" index={0} />
        <Skeleton width="58%" height={12} radius={2} index={1} />
      </Primitive>

      <Primitive
        name="EmptyState"
        usedBy="PlaceholderImage when a captured preview is unavailable."
        demoClassName="apps-components__empty-demo"
      >
        <EmptyState
          title="Observed preview unavailable"
          headingLevel={4}
          isCompact
        />
      </Primitive>
    </div>
  );
}

function Section({
  index,
  title,
  description,
  stageClassName = '',
  children,
}: {
  index: string;
  title: string;
  description: string;
  stageClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="apps-components__section">
      <header className="apps-components__section-head">
        <span className="apps-components__section-index">{index}</span>
        <div>
          <h2 className="apps-components__section-title">{title}</h2>
          <p className="apps-components__section-copy">{description}</p>
        </div>
      </header>
      <div className={`apps-components__stage ${stageClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
}

function AppsScreenComponents() {
  return (
    <main className="apps-components">
      <header className="apps-components__intro">
        <div>
          <p className="apps-components__eyebrow">Vitrines · Apps screen</p>
          <h1 className="apps-components__title">Actual component inventory</h1>
          <p className="apps-components__lede">
            This sheet renders the local composites used by the live Apps
            screen—not generic substitutes from the core library.
          </p>
        </div>
        <span className="apps-components__status">Scanned from /apps</span>
      </header>

      <Section
        index="00"
        title="Standard controls"
        description="The six canonical control roles used across Vitrines product screens."
      >
        <ControlStandards />
      </Section>

      <Section
        index="01"
        title="Persistent discovery navigation"
        description="Reference type tabs, Quick Search trigger, brand, and account dropdown."
        stageClassName="apps-components__nav-stage"
      >
        <AppsHeader />
      </Section>

      <Section
        index="02"
        title="Discovery taxonomy"
        description="ReferenceDiscoveryFacetGroup composed with compact ghost Buttons."
      >
        <Taxonomy />
      </Section>

      <Section
        index="03"
        title="Discovery filter bar"
        description="AstryxDropdown triggers, filter panels, TextInput search, CheckboxInput options, clear IconButton, and sort."
      >
        <FilterBar />
      </Section>

      <Section
        index="04"
        title="Crawl progress"
        description="ProgressBannerView composed with ProgressBar and the destructive cancellation action."
      >
        <ProgressBannerView snapshot={progress} />
      </Section>

      <Section
        index="05"
        title="App results"
        description="AppCard → DiscoveryCard with PlaceholderImage, Badge, identity metadata, plus AppCardSkeleton loading state."
      >
        <div className="apps-components__cards">
          <AppCard
            app={apps[0]}
            platform="web"
            onOpen={() => {}}
          />
          <AppCard
            app={apps[1]}
            platform="web"
            onOpen={() => {}}
          />
          <AppCardSkeleton />
        </div>
        <p className="apps-components__card-note">
          Card styling is the local DiscoveryCard system; it is not the generic
          core Card component.
        </p>
      </Section>

      <Section
        index="06"
        title="Primary core primitives"
        description="The exact @astryxdesign/core layer underneath the Apps composites. Components not used on /apps are intentionally excluded."
      >
        <PrimaryPrimitives />
      </Section>
    </main>
  );
}

export const Overview: Story = {
  render: () => <AppsScreenComponents />,
};

const analyzedScreen: Screen = {
  id: 42,
  type: 'Dashboard',
  productArea: 'Workspace analytics',
  theme: 'light',
  visibleStates: ['Selected navigation', 'Active filter'],
  platform: 'web',
  description: 'A workspace dashboard with persistent navigation, summary metrics, filters, and a dense activity table.',
  purpose: 'Monitor workspace performance and investigate recent activity.',
  url: 'http://localhost:5173/api/preview-media/aboard-ea683077-aadb-47c5-a771-d21fd9676510/web/1?variant=full',
  sourceUrl: 'https://mobbin.com',
  componentNames: ['Sidebar navigation', 'Metric card', 'Filter bar', 'Data table'],
  visibleText: ['Overview', 'Active users', 'Recent activity'],
  layoutPatterns: ['Fixed sidebar', 'Dashboard grid', 'Dense table'],
  icons: ['Search', 'Filter', 'Chevron down'],
  imagery: ['User avatars'],
  contentPatterns: ['Summary metric', 'Metadata row'],
  interactionPatterns: ['Tabs', 'Filter menu', 'Pagination'],
  responsiveViewport: 'desktop',
  capturedAt: '2026-08-14T00:00:00.000Z',
  confidence: 0.94,
};

export const ScreenAnalysisDialog: Story = {
  render: () => (
    <ScreenPreviewDialog
      appName="Aboard"
      screen={analyzedScreen}
      index={0}
      total={1}
      foundInFlows={['Reviewing workspace performance']}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />
  ),
};
