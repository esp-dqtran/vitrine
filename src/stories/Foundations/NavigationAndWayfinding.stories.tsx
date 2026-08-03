import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Button,
  BreadcrumbItem,
  Breadcrumbs,
  Pagination,
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
  AstryxSingleSelectDropdown,
} from '../../vitrine/components/AstryxDropdown';
import {
  DiscoveryFilterMenu,
  type DiscoveryFilterGroup,
  type DiscoveryFilterOption,
} from '../../vitrine/components/AppsFilterBar';
import { AppsPlatformSwitcher } from '../../vitrine/components/AppsPlatformSwitcher';
import { HeroButton } from '../../vitrine/components/HeroButton';
import { ReferenceDiscoveryTopNav } from '../../vitrine/components/ReferenceDiscoveryTopNav';
import { ReferenceDetailShell } from '../../vitrine/components/ReferenceDetailShell';
import { SearchTrigger } from '../../vitrine/components/SearchTrigger';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/components/AstryxDropdown.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productIconography.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productForms.css';
import './NavigationAndWayfinding.css';

const meta = {
  title: 'Foundations/Navigation and wayfinding',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Vitrines navigation review: persistent product navigation, App Detail tabs, breadcrumbs, segmented choices, side navigation, pagination, and compact overflow behavior.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const detailTabs = [
  { id: 'screens', label: 'Screens' },
  { id: 'elements', label: 'UI Elements' },
  { id: 'flows', label: 'Flows' },
] as const;
type DetailTab = (typeof detailTabs)[number]['id'];

const detailTotals: Record<DetailTab, string> = {
  screens: '624 screens',
  elements: '118 UI elements',
  flows: '166 flows',
};

const detailFilterLabels: Record<DetailTab, string> = {
  screens: 'Screens',
  elements: 'UI Elements',
  flows: 'Flows',
};

const detailFilterOptions: Record<DetailTab, DiscoveryFilterOption[]> = {
  screens: [
    { value: 'Unclassified', section: 'Screen types' },
    { value: '1-on-1', section: 'Found in Flows' },
    { value: '1-on-1 (employee portal)', section: 'Found in Flows' },
    { value: 'Access to employee', section: 'Found in Flows' },
    { value: 'Account settings', section: 'Found in Flows' },
    { value: 'Activating profile completion', section: 'Found in Flows' },
    { value: 'Activating time tracking', section: 'Found in Flows' },
    { value: 'Activating whistleblowing', section: 'Found in Flows' },
    { value: 'Adding a category and skill', section: 'Found in Flows' },
    { value: 'Adding a cover image and a description', section: 'Found in Flows' },
    { value: 'Adding a document', section: 'Found in Flows' },
    { value: 'Adding a form', section: 'Found in Flows' },
  ],
  elements: [
    { value: 'Button', section: 'Element types' },
    { value: 'Dropdown Menu', section: 'Element types' },
    { value: 'Text Field', section: 'Element types' },
    { value: 'Onboarding', section: 'Found in Flows' },
    { value: 'Account settings', section: 'Found in Flows' },
  ],
  flows: [
    { value: 'Onboarding', section: 'Categories' },
    { value: 'Account settings', section: 'Categories' },
    { value: 'Creating', section: 'Interactions' },
    { value: 'Updating', section: 'Interactions' },
    { value: 'Completed', section: 'States' },
  ],
};

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
    <section className="navigation-review__section">
      <header className="navigation-review__section-header">
        <span className="navigation-review__section-index">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ProductNavigation() {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <article className="navigation-review__card navigation-review__card--top-nav">
      <div className="navigation-review__card-copy">
        <strong>Persistent product navigation</strong>
        <span>One current destination, predictable search placement, and stable account access.</span>
      </div>
      <div className="reference-discovery navigation-review__production-nav">
        <ReferenceDiscoveryTopNav
          active="apps"
          className="apps-top-nav"
          search={(
            <SearchTrigger
              label="Search Apps…"
              activeCategory={null}
              activeFilterCount={1}
              mode="advanced"
              onOpen={() => {}}
              onClearCategory={() => {}}
            />
          )}
          accountControls={(
            <AstryxDropdown
              label="admin@gmail.com"
              ariaLabel="Account menu: admin@gmail.com"
              open={accountOpen}
              menuWidth={220}
              onOpenChange={setAccountOpen}
            >
              <AstryxDropdownItem label="Collections" onSelect={() => setAccountOpen(false)} />
              <AstryxDropdownItem label="Settings" onSelect={() => setAccountOpen(false)} />
              <AstryxDropdownDivider />
              <AstryxDropdownItem label="Log out" onSelect={() => setAccountOpen(false)} />
            </AstryxDropdown>
          )}
        />
      </div>
    </article>
  );
}

function AppDetailFilter({ tab }: { tab: DetailTab }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<DiscoveryFilterOption | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const label = detailFilterLabels[tab];
  const group: DiscoveryFilterGroup = {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    selected,
    options: detailFilterOptions[tab],
  };

  return (
    <DiscoveryFilterMenu
      group={group}
      open={open}
      query={query}
      preview={preview}
      containerRef={containerRef}
      onToggleOpen={() => {
        setQuery('');
        setPreview(null);
        setOpen((current) => !current);
      }}
      onQueryChange={setQuery}
      onPreview={setPreview}
      onToggleOption={(option) => {
        setSelected((current) => current.includes(option.value)
          ? current.filter((value) => value !== option.value)
          : [...current, option.value]);
      }}
      onClear={() => setSelected([])}
    />
  );
}

function AppDetailPilot() {
  const [activeTab, setActiveTab] = useState<DetailTab>('screens');
  const activeLabel = detailTabs.find(({ id }) => id === activeTab)?.label ?? 'Screens';

  return (
    <article className="navigation-review__pilot" aria-label="App Detail navigation pilot">
      <ReferenceDetailShell
        title="Aboard"
        description="Bring all your people data into one place — and instantly turn it into insights, overviews, and answers when you need them."
        className="app-detail app-detail--web navigation-review__app-detail-shell"
        dataDetailKind="app"
        identityKey="storybook-aboard-app"
        identityLabel="A"
        identityImageUrl="https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png"
        metadata={[
          {
            label: 'Platform',
            value: 'Web',
            content: (
              <AppsPlatformSwitcher
                value="web"
                platforms={['web']}
                onChange={() => {}}
              />
            ),
          },
          { label: 'Category', value: 'Business, Jobs & Recruitment' },
          { label: 'Screens', value: '624' },
          { label: 'Last updated', value: 'Jul 24, 2026' },
        ]}
        actions={(
          <>
            <HeroButton primary>Export to Figma</HeroButton>
            <HeroButton>Visit Site</HeroButton>
          </>
        )}
        tabs={[...detailTabs]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabLeading={(
          <AstryxSingleSelectDropdown
            ariaLabel="App version"
            value="1"
            options={[
              { value: '1', label: 'Latest' },
              { value: '0', label: 'Version 0' },
            ]}
            onChange={() => {}}
          />
        )}
        tabControls={(
          <div className="app-detail__navigation-tools">
            <AppDetailFilter key={activeTab} tab={activeTab} />
          </div>
        )}
        tabTrailing={(
          <span className="reference-detail__section-total">
            <span>Showing</span>
            <strong>{detailTotals[activeTab]}</strong>
          </span>
        )}
        bodyPadding="32px 40px 72px"
      >
        <div className="navigation-review__app-detail-results" aria-label={`${activeLabel} preview`}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="navigation-review__app-detail-result">
              <span>{activeLabel}</span>
              <strong>{item === 1 ? 'Onboarding' : item === 2 ? 'Account setup' : 'People overview'}</strong>
            </div>
          ))}
        </div>
      </ReferenceDetailShell>
    </article>
  );
}

function WayfindingPatterns() {
  const [theme, setTheme] = useState('light');
  const [page, setPage] = useState(2);
  const themeIndex = Math.max(0, ['light', 'dark', 'system'].indexOf(theme));

  return (
    <div className="navigation-review__pattern-grid">
      <article className="navigation-review__card navigation-review__card--wide">
        <div className="navigation-review__card-copy">
          <strong>Breadcrumbs</strong>
          <span>Use for hierarchy and return context, not for switching peer views.</span>
        </div>
        <Breadcrumbs>
          <BreadcrumbItem href="#projects">Projects</BreadcrumbItem>
          <BreadcrumbItem href="#research">Research library</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Aboard analysis</BreadcrumbItem>
        </Breadcrumbs>
      </article>

      <article className="navigation-review__card">
        <div className="navigation-review__card-copy">
          <strong>Theme choice</strong>
          <span>Use a segmented choice when every setting option should remain visible.</span>
        </div>
        <SegmentedControl
          className="navigation-review__segmented-choice"
          label="Theme"
          value={theme}
          onChange={setTheme}
          layout="fill"
          style={{
            '--navigation-review-segment-shift': `${themeIndex * 100}%`,
          } as CSSProperties}
        >
          <SegmentedControlItem value="light" label="Light" />
          <SegmentedControlItem value="dark" label="Dark" />
          <SegmentedControlItem value="system" label="System" />
        </SegmentedControl>
      </article>

      <article className="navigation-review__card">
        <div className="navigation-review__card-copy">
          <strong>Pagination</strong>
          <span>Use for stable result sets; retain the current page after inspection.</span>
        </div>
        <Pagination
          className="navigation-review__pagination"
          page={page}
          onChange={setPage}
          totalItems={452}
          pageSize={24}
          variant="pages"
        />
      </article>

      <article className="navigation-review__card navigation-review__card--project-nav">
        <div className="navigation-review__card-copy">
          <strong>Project workspace navigation</strong>
          <span>Use a persistent left sidebar for Project context and workspace tools.</span>
        </div>
        <div className="navigation-review__project-nav-frame">
          <ProjectWorkspaceSidebar />
        </div>
      </article>
    </div>
  );
}

type WorkspaceDestination = 'overview' | 'evidence' | 'canvas' | 'documents' | 'settings';

function ProjectWorkspaceSidebar() {
  const [active, setActive] = useState<WorkspaceDestination>('canvas');
  const item = (value: WorkspaceDestination, label: string) => (
    <Button
      className="navigation-review__workspace-nav-item"
      label={label}
      variant={active === value ? 'primary' : 'ghost'}
      size="md"
      onClick={() => setActive(value)}
    />
  );

  return (
    <nav className="navigation-review__workspace-sidebar" aria-label="Project workspace">
      <div className="navigation-review__workspace-sidebar-header">
        <span className="navigation-review__workspace-mark" aria-hidden="true">V</span>
        <span>
          <strong>Research project</strong>
          <small>Aboard analysis</small>
        </span>
      </div>
      <div className="navigation-review__workspace-sidebar-items">
        {item('overview', 'Overview')}
        {item('evidence', 'Evidence')}
        <span className="navigation-review__workspace-sidebar-label">Workspace</span>
        {item('canvas', 'Canvas')}
        {item('documents', 'Documents')}
        {item('settings', 'Settings')}
      </div>
    </nav>
  );
}

function ResponsiveNavigation() {
  return (
    <div className="navigation-review__responsive-grid">
      <article className="navigation-review__viewport-card">
        <span>Wide · ≥ 1080px</span>
        <div className="navigation-review__viewport navigation-review__viewport--wide">
          <strong>Latest</strong>
          <nav aria-label="Wide detail sections"><b>Screens</b><span>UI Elements</span><span>Flows</span></nav>
          <small>Showing 624 screens</small>
        </div>
      </article>
      <article className="navigation-review__viewport-card">
        <span>Compact · ≤ 720px</span>
        <div className="navigation-review__viewport navigation-review__viewport--compact">
          <strong>Latest</strong>
          <small>Filter</small>
          <nav aria-label="Compact detail sections"><b>Screens</b><span>UI Elements</span><span>Flows</span></nav>
        </div>
      </article>
    </div>
  );
}

function NavigationAndWayfindingReview() {
  return (
    <div className="navigation-review">
      <header className="navigation-review__intro">
        <div>
          <p className="navigation-review__eyebrow">Vitrines · Component system</p>
          <h1>Navigation &amp; Wayfinding</h1>
          <p className="navigation-review__lede">
            A consistent system for knowing where you are, moving between peer views, and returning through hierarchy.
          </p>
        </div>
        <span className="navigation-review__status">Visual review · App Detail pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Product navigation"
        description="Persistent destinations stay stable across discovery screens while search follows the active content type."
      >
        <ProductNavigation />
      </ReviewSection>

      <ReviewSection
        index="02"
        title="App Detail pilot"
        description="The current App Detail composition is the reference for peer tabs, leading sort, contextual filtering, and result count."
      >
        <AppDetailPilot />
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Wayfinding patterns"
        description="Use the smallest navigation pattern that preserves hierarchy, peer choice, and task context."
      >
        <WayfindingPatterns />
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive behavior"
        description="Reflow utilities before tabs; keep every peer section horizontally reachable instead of hiding it."
      >
        <ResponsiveNavigation />
      </ReviewSection>
    </div>
  );
}

export const VisualReview: Story = {
  render: () => <NavigationAndWayfindingReview />,
};
