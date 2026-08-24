import { useMemo, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, EmptyState } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl';
import type { AdvancedSearchResult, SearchFacets, SearchResultItem } from '../../searchTypes';
import type { App, Screen } from '../../vitrine/types';
import { AppCard } from '../../vitrine/components/AppCard';
import { Spinner } from '../../vitrine/components/Spinner';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from '../../vitrine/components/AppsFilterBar';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
} from '../../vitrine/components/AstryxDropdown';
import { QuickSearch } from '../../vitrine/components/QuickSearch';
import { ReferenceDiscoveryFacetGroup } from '../../vitrine/components/ReferenceDiscoveryFacetGroup';
import { ReferenceDiscoveryPageShell } from '../../vitrine/components/ReferenceDiscoveryPageShell';
import { ApplicationHeader } from '../../vitrine/components/ApplicationHeader';
import { SearchTrigger } from '../../vitrine/components/SearchTrigger';
import { defaultSearchState, type SearchPageState } from '../../vitrine/searchState';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/components/AstryxDropdown.css';
import '../../vitrine/productTypography.css';
import '../../vitrine/productSpacing.css';
import '../../vitrine/productShape.css';
import '../../vitrine/productMotion.css';
import '../../vitrine/productResponsive.css';
import '../../vitrine/productDataDisplay.css';
import '../../vitrine/productForms.css';
import './SearchFiltersAndResults.css';

const meta = {
  title: 'Patterns/Search, Filters and Results',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An interactive production-grounded review of Apps Discovery search entry, advanced Quick Search, shared filters, sorting, result states, and responsive reflow.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const APP_ID = 'aboard-ea683077-aadb-47c5-a771-d21fd9676510';
const PREVIEW_HOST = 'http://127.0.0.1:5173';
const APP_ICON = 'https://framerusercontent.com/images/xPxsJSUAOqt5MenB8yTyoLImC0.png';

const makeScreen = (id: number, platform: Platform = 'web'): Screen => ({
  id,
  type: id === 1 ? 'Dashboard' : id === 2 ? 'Settings' : 'Onboarding',
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
    platforms: ['web'],
    analyzedScreens: 0,
    lastCapturedAt: '2026-07-24T00:00:00.000Z',
    iconUrl: APP_ICON,
    description: 'Business, Jobs & Recruitment',
    previewVideoUrl: null,
    screens: [makeScreen(1)],
  },
  {
    id: 'artlist-search-review',
    app: 'Artlist',
    categories: [{ id: 2, name: 'Photo & Video', slug: 'photo-video' }],
    accent: '#f6d33b',
    totalScreens: 201,
    platforms: ['web'],
    analyzedScreens: 0,
    lastCapturedAt: '2026-07-20T00:00:00.000Z',
    iconUrl: null,
    description: 'Photo & Video',
    previewVideoUrl: null,
    screens: [makeScreen(2)],
  },
  {
    id: 'linear-search-review',
    app: 'Linear',
    categories: [{ id: 3, name: 'Productivity', slug: 'productivity' }],
    accent: '#5e6ad2',
    totalScreens: 184,
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
    options: ['AI', 'Business', 'CRM', 'Finance', 'News'].map((value) => ({ value, section: 'Categories' })),
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

const emptyFacets: SearchFacets = {
  platform: [{ value: 'web', count: 452 }],
  app: apps.map(({ app }) => ({ value: app, count: 1 })),
  appCategory: apps.map(({ categories }) => ({ value: categories[0]!.name, count: 1 })),
  pageType: [{ value: 'Dashboard', count: 72 }, { value: 'Settings', count: 64 }],
  productArea: [{ value: 'Workspace', count: 96 }],
  flow: [{ value: 'Onboarding', count: 48 }],
  component: [{ value: 'Dialog', count: 61 }, { value: 'Button', count: 124 }],
  state: [{ value: 'Default', count: 452 }],
  theme: [{ value: 'light', count: 312 }, { value: 'dark', count: 140 }],
  layout: [],
  siteSection: [],
  siteStyle: [],
};

const searchItem = (
  documentId: string,
  entityType: SearchResultItem['entityType'],
  title: string,
): SearchResultItem => ({
  documentId,
  indexVersion: 1,
  catalogScope: 'apps',
  catalogName: 'Aboard',
  versionId: 1,
  appId: 1,
  appName: 'Aboard',
  catalogCategories: ['Business, Jobs & Recruitment'],
  siteSections: [],
  siteStyles: [],
  platform: 'web',
  entityType,
  sourceId: documentId,
  title,
  description: 'A production search result from the Apps catalog.',
  aliases: [],
  visibleText: title,
  productArea: 'Workspace',
  components: entityType === 'component' ? [title] : [],
  states: ['Default'],
  theme: 'light',
  layoutPatterns: [],
  appCategory: 'Business, Jobs & Recruitment',
  publishedAt: '2026-07-24T00:00:00.000Z',
  sourcePayload: {},
  matchedContext: [{ kind: 'text', value: title }],
});

const searchResult: AdvancedSearchResult = {
  requestId: 'storybook-search-review',
  items: [
    searchItem('screen:aboard:1', 'screen', 'Home dashboard'),
    searchItem('flow:aboard:onboarding', 'flow', 'Onboarding'),
    searchItem('component:aboard:dialog', 'component', 'Dialog'),
  ],
  facets: emptyFacets,
  typeCounts: { app: 3, site: 0, screen: 1, flow: 1, component: 1, pattern: 0 },
  nextCursor: null,
  hasMore: false,
  degraded: false,
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
    <section className="search-review__section">
      <header className="search-review__section-header">
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

type ResultState = 'results' | 'loading' | 'empty' | 'error';

function SearchFilteringReview() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchState, setSearchState] = useState<SearchPageState>({
    ...defaultSearchState,
    scope: 'apps',
  });
  const [platform, setPlatform] = useState<Platform>('web');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState('latest');
  const [resultState, setResultState] = useState<ResultState>('results');
  const [accountOpen, setAccountOpen] = useState(false);

  const selectedCount = filters.reduce((count, group) => count + group.selected.length, 0);
  const visibleApps = useMemo(() => {
    const sorted = [...apps].sort((left, right) => {
      if (sort === 'trending') return right.totalScreens - left.totalScreens;
      return String(right.lastCapturedAt).localeCompare(String(left.lastCapturedAt));
    });
    const categories = filters.find(({ id }) => id === 'categories')?.selected ?? [];
    if (!categories.length) return sorted;
    return sorted.filter((app) => app.categories.some(({ name }) => categories.some((value) => name.includes(value))));
  }, [filters, sort]);

  const toggleFilter = (groupId: string, value: string) => {
    setFilters((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const selected = group.selected.includes(value)
        ? group.selected.filter((item) => item !== value)
        : [...group.selected, value];
      return { ...group, selected };
    }));
  };

  const renderResults = () => {
    if (resultState === 'loading') {
      return (
        <div className="discovery-page-layout__state search-review__results" role="status" aria-label="Loading apps">
          <Spinner size="md" shade="subtle" aria-hidden="true" />
        </div>
      );
    }
    if (resultState === 'empty' || (resultState === 'results' && visibleApps.length === 0)) {
      return (
        <div className="search-review__result-state">
          <EmptyState
            title="No apps match these filters"
            description="Remove one or more filters to see more captured references."
            actions={<Button label="Clear filters" variant="primary" onClick={() => setFilters(initialFilters)} />}
          />
        </div>
      );
    }
    if (resultState === 'error') {
      return (
        <div className="search-review__result-state" role="alert">
          <EmptyState
            title="Apps could not be loaded"
            description="The last useful filters stay in place while the request is retried."
            actions={<Button label="Try again" variant="primary" onClick={() => setResultState('results')} />}
          />
        </div>
      );
    }
    return (
      <div className="reference-discovery__grid apps-discovery__grid search-review__results">
        {visibleApps.map((app) => (
          <AppCard key={app.id} app={app} platform={platform} onOpen={() => {}} />
        ))}
      </div>
    );
  };

  return (
    <main className="search-review">
      <header className="search-review__intro">
        <div>
          <p className="search-review__eyebrow">Vitrines · Pattern system</p>
          <h1>Search, Filters &amp; Results</h1>
          <p className="search-review__lede">
            The real Apps Discovery components define one continuous path from search intent to a stable, explainable result set.
          </p>
        </div>
        <span className="search-review__status">Visual review · Apps pilot</span>
      </header>

      <ReviewSection
        index="01"
        title="Search entry and advanced search"
        description="The production header opens the real advanced Quick Search modal. Query, scope, filters, keyboard focus, and View all remain one URL-backed search state."
      >
        <div className="search-review__production-frame search-review__header-frame">
          <ApplicationHeader
            active="apps"
            className="apps-top-nav"
            search={(
              <SearchTrigger
                label="Search Apps…"
                activeCategory={null}
                mode="advanced"
                activeFilterCount={selectedCount}
                onOpen={() => setSearchOpen(true)}
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
        <div className="search-review__guidance-grid">
          <article><strong>Search is a task</strong><span>Open from the header or ⌘K without moving the page.</span></article>
          <article><strong>State survives handoff</strong><span>Scope, query, and active filters move together to full results.</span></article>
          <article><strong>Keyboard first</strong><span>Arrow keys preview results; Escape closes and restores context.</span></article>
        </div>
      </ReviewSection>

      <ReviewSection
        index="02"
        title="Filters and sort"
        description="Platform, structured filters, and sort use the same production dropdown component and remain aligned as one toolbar at every width."
      >
        <div className="search-review__toolbar-frame">
          <DiscoveryFilterBar
            kind="apps"
            ariaLabel="App discovery controls"
            platform={{ value: platform, ariaLabel: 'App platform', onChange: setPlatform }}
            filters={filters}
            resultCount={visibleApps.length}
            resultLabels={['app', 'apps']}
            sort={sort}
            sortOptions={[{ value: 'latest', label: 'Latest' }, { value: 'trending', label: 'Trending' }]}
            onSortChange={setSort}
            onToggleFilter={toggleFilter}
            onClearFilter={(groupId) => setFilters((current) => current.map((group) => group.id === groupId ? { ...group, selected: [] } : group))}
          />
        </div>
      </ReviewSection>

      <ReviewSection
        index="03"
        title="Result states"
        description="Results, loading, empty, and error share the same footprint, preserve the toolbar, and always offer a clear recovery action."
      >
        <div className="search-review__state-switcher" role="group" aria-label="Preview result state">
          {(['results', 'loading', 'empty', 'error'] as const).map((state) => (
            <Button
              key={state}
              label={state[0]!.toUpperCase() + state.slice(1)}
              variant={resultState === state ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={resultState === state}
              onClick={() => setResultState(state)}
            />
          ))}
        </div>
        <div className="search-review__result-frame">
          <p className="reference-discovery__result-meta" aria-live="polite">
            <small>Showing</small> <strong>{resultState === 'results' ? visibleApps.length : resultState === 'loading' ? 452 : 0} apps</strong>
          </p>
          {renderResults()}
        </div>
      </ReviewSection>

      <ReviewSection
        index="04"
        title="Responsive contract"
        description="The same controls reflow without changing meaning: desktop keeps the full taxonomy, while compact screens retain search, merged filters, sort, and result recovery."
      >
        <div className="search-review__responsive-grid">
          <article>
            <span>Wide · 3 columns</span>
            <strong>Persistent search and explicit filters</strong>
          </article>
          <article>
            <span>Medium · 2 columns</span>
            <strong>One aligned, horizontally safe toolbar</strong>
          </article>
          <article>
            <span>Compact · 1 column</span>
            <strong>Single-line header and merged filter access</strong>
          </article>
        </div>
      </ReviewSection>

      {searchOpen ? (
        <QuickSearch
          state={searchState}
          recent={['onboarding with progressive disclosure', 'empty states for project tools']}
          initialResult={searchState.query.trim() ? searchResult : null}
          client={async () => searchResult}
          onStateChange={setSearchState}
          onClose={() => setSearchOpen(false)}
          onPreview={() => setSearchOpen(false)}
          onViewAll={() => setSearchOpen(false)}
        />
      ) : null}
    </main>
  );
}

export const VisualReview: Story = {
  render: () => <SearchFilteringReview />,
};
