import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { FacetPreview } from '../facetPreviewApi.ts';
import type { SearchFilters } from '../../searchTypes.ts';
import { navigate, updateLocation, useLocationKey } from '../router.ts';
import {
  createSitesDiscoveryAdapter,
  PUBLIC_SITES_CATALOG_LIMIT,
  type SitesDiscoveryControllerState,
} from '../sitesDiscoveryAdapter.ts';
import type { SiteSummary } from '../types.ts';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
} from './AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { DiscoverySignupReveal } from './DiscoverySignupReveal.tsx';
import { SiteCard } from './SiteCard.tsx';
import { SitesDiscoveryHero } from './SitesDiscoveryHero.tsx';
import {
  useDiscoveryController,
  type DiscoveryController,
} from '../useDiscoveryController.ts';
export type SiteSort = 'latest' | 'popular';
export type SiteFacet = { group: 'categories' | 'sections' | 'styles'; value: string };
export type SiteFacetPreviewPools = Map<string, FacetPreview[]>;

const SITE_SECTION_PREVIEW_VALUES = ['Pricing', 'How It Works', 'About', 'FAQ', 'Hero'];

const DISCOVERY_FACETS: Array<{
  group: SiteFacet['group'];
  label: string;
  defaults: string[];
  // Full catalog values (from `/api/sites/facets`), used to seed the toolbar filter
  // dropdown so it doesn't need a live facet query. `defaults` above stays a short
  // curated list for the taxonomy quick-links panel.
  allValues: string[];
}> = [
  {
    group: 'categories',
    label: 'Categories',
    defaults: ['Portfolio', 'Lifestyle', 'Finance', 'Business', 'Shopping'],
    allValues: [
      'AI', 'Business', 'Crypto', 'Education', 'Entertainment', 'Finance', 'Food',
      'Health', 'Lifestyle', 'Other', 'Portfolio', 'Shopping', 'Social', 'Technology',
      'Travel',
    ],
  },
  {
    group: 'sections',
    label: 'Sections',
    defaults: ['How It Works', 'About', 'FAQ', 'Hero'],
    allValues: [
      '404', 'About', 'About Section', 'About Us', 'Blog', 'Brand', 'CTA Section',
      'Call to Action Section', 'Careers', 'Company', 'Comparison', 'Contact',
      'Contact Us', 'Content Section', 'Customer Stories', 'Customers', 'Demo',
      'Download', 'Downloads', 'Enterprise', 'FAQ', 'FAQ Section', 'Faq',
      'Feature Section', 'Features', 'Footer Section', 'Hero Section', 'Home',
      'How It Works', 'How It Works Section', 'Integrations', 'Navigation Section',
      'News', 'Newsletter', 'Newsroom', 'Pricing', 'Product', 'Resources',
      'Showcase Section', 'Social Proof', 'Social Proof Section', 'Stats Section',
      'Store', 'Templates', 'Work',
    ],
  },
  {
    group: 'styles',
    label: 'Styles',
    defaults: ['Minimal', 'Dark', 'Photography', 'Motion', 'Colorful'],
    allValues: [
      '3D', 'Black & White', 'Bold', 'Brutalist', 'Colorful', 'Dark', 'Editorial',
      'Fun', 'Glass', 'Grid', 'Illustration', 'Light', 'Minimal', 'Motion',
      'Photography', 'Scroll Effects', 'Typography',
    ],
  },
];

const siteFacetKey = (facet: SiteFacet) => `${facet.group}:${facet.value.toLowerCase()}`;
const siteFacetPreviewUrl = (preview: FacetPreview) => (
  preview.kind === 'icon' ? preview.iconUrl : preview.media[0]
);

export function buildSiteFacetPreviewPools(sites: SiteSummary[]): SiteFacetPreviewPools {
  const pools: SiteFacetPreviewPools = new Map();
  const sectionValues = SITE_SECTION_PREVIEW_VALUES;
  const add = (facet: SiteFacet, preview: FacetPreview) => {
    const key = siteFacetKey(facet);
    const pool = pools.get(key) ?? [];
    if (pool.length >= 6) return;
    pool.push(preview);
    pools.set(key, pool);
  };

  sites.forEach((site) => {
    if (site.logoUrl) {
      const logoUrl = site.logoUrl;
      (site.categories ?? []).forEach((value) => {
        add(
          { group: 'categories', value },
          {
            kind: 'icon',
            app: site.name,
            label: value,
            iconUrl: logoUrl,
            media: [],
          },
        );
      });
    }

    site.previews.forEach((page) => {
      sectionValues.forEach((value) => {
        if (!page.title.toLowerCase().includes(value.toLowerCase())) return;
        add(
          { group: 'sections', value },
          {
            kind: 'screen',
            app: site.name,
            label: value,
            iconUrl: site.logoUrl ?? null,
            media: [page.url],
          },
        );
      });
    });
  });
  return pools;
}

export function siteFacetPreview(
  pools: SiteFacetPreviewPools,
  facet: SiteFacet,
  random: () => number = Math.random,
  readyUrls?: ReadonlySet<string>,
): FacetPreview | null {
  if (facet.group === 'styles') return null;
  const pool = pools.get(siteFacetKey(facet)) ?? [];
  const candidates = readyUrls
    ? pool.filter((preview) => {
        const url = siteFacetPreviewUrl(preview);
        return Boolean(url && readyUrls.has(url));
      })
    : pool;
  if (candidates.length === 0) return null;
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length)),
  );
  return candidates[index] ?? null;
}

export function visibleSiteFacetPreviews(pools: SiteFacetPreviewPools): FacetPreview[] {
  return DISCOVERY_FACETS.flatMap(({ group, defaults }) => {
    if (group === 'styles') return [];
    const values = group === 'sections' ? SITE_SECTION_PREVIEW_VALUES : defaults;
    return values.flatMap((value) => {
      const preview = pools.get(siteFacetKey({ group, value }))?.[0];
      return preview ? [preview] : [];
    });
  });
}

interface SitesPageViewProps {
  controller: DiscoveryController<
    SiteSummary,
    SitesDiscoveryControllerState['sort'],
    SitesDiscoveryControllerState
  >;
  isAdmin: boolean;
  onOpenSearch?: (seed?: Partial<SearchFilters>) => void;
  searchMode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
  onOpen?: (site: SiteSummary) => void;
  memberControls?: ReactNode;
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
}

export function SitesPageView({
  controller,
  isAdmin,
  onOpen = (site) => navigate({ name: 'site-version', siteSlug: site.routeSlug }),
  isGuest = false,
  onGuestLimitReached,
}: SitesPageViewProps) {
  void isAdmin;
  const previewPools = useMemo(
    () => buildSiteFacetPreviewPools(controller.items),
    [controller.items],
  );
  const filterGroups = useMemo<DiscoveryFilterGroup[]>(() =>
    DISCOVERY_FACETS.map((group) => ({
      id: group.group,
      label: group.label,
      selected: controller.state.filters
        .filter((filter) => filter.group === group.group)
        .map(({ value }) => value),
      options: group.allValues.map((value) => {
        const preview = previewPools.get(siteFacetKey({ group: group.group, value }))?.[0];
        return {
          value,
          section: group.label,
          count: 0,
          previewUrl: preview ? siteFacetPreviewUrl(preview) : undefined,
          previewLabel: preview ? `${preview.app} · ${value}` : value,
        };
      }),
    })),
  [controller.state.filters, previewPools]);
  const searchMatchLabel = (site: SiteSummary) => siteSearchMatchLabel(
    site,
    controller.state.query,
  );
  return (
    <DiscoveryPageLayout
      kind="sites"
      header={null}
      taxonomyLabel="Site inspiration"
      taxonomy={<SitesDiscoveryHero />}
      preview={null}
      toolbar={(
        <DiscoveryFilterBar
          kind="sites"
          ariaLabel="Site discovery controls"
          platform={{
            value: controller.state.platform,
            platforms: ['web'],
            ariaLabel: 'Site platform',
            onChange: controller.setPlatform,
          }}
          filters={filterGroups}
          resultCount={controller.items.length}
          resultLabels={['site', 'sites']}
          showPlatform={false}
          showResultCount={false}
          showSort={false}
          sort={controller.state.sort}
          sortOptions={[
            { value: 'latest', label: 'Latest' },
            { value: 'popular', label: 'Most popular' },
          ]}
          onSortChange={(value) => controller.setSort(value as SiteSort)}
          onToggleFilter={(group, value) => controller.toggleFilter({ group, value })}
          onClearFilter={controller.clearFilterGroup}
        />
      )}
      showResultMeta={false}
      resultLabel="sites"
      singularResultLabel="site"
      totalCount={isGuest && controller.totalCount !== null
        ? Math.min(controller.totalCount, PUBLIC_SITES_CATALOG_LIMIT)
        : controller.totalCount}
      renderedCount={controller.items.length}
      loading={controller.loading}
      loadingMore={controller.loadingMore}
      error={controller.error}
      loadMoreError={controller.loadMoreError}
      onRetry={controller.retry}
      onRetryLoadMore={controller.retryLoadMore}
      onReset={() => controller.setState({ ...controller.state, query: '', filters: [] })}
      guestLimitReached={isGuest && controller.items.length >= PUBLIC_SITES_CATALOG_LIMIT}
      onGuestLimitReached={onGuestLimitReached}
      sentinelRef={controller.sentinelRef}
      footerReveal={<DiscoverySignupReveal />}
    >
      <div
        data-reference-gallery-grid="true"
        className="reference-discovery__grid sites-discovery__grid"
      >
        {controller.items.map((site) => (
          <SiteCard
            key={`${site.id}:${site.versionId}`}
            site={site}
            matchLabel={searchMatchLabel(site)}
            onOpen={() => onOpen(site)}
          />
        ))}
      </div>
    </DiscoveryPageLayout>
  );
}

function siteSearchMatchLabel(site: SiteSummary, rawQuery: string): string | undefined {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return undefined;
  if (site.name.toLocaleLowerCase().includes(query)) return 'Matched site name';
  if (safeSiteHostname(site.sourceUrl).includes(query)) return 'Matched domain';
  if (site.description?.toLocaleLowerCase().includes(query)) return 'Matched description';
  const category = site.categories?.find((value) => value.toLocaleLowerCase().includes(query));
  if (category) return `Matched category: ${category}`;
  const style = site.styles?.find((value) => value.toLocaleLowerCase().includes(query));
  if (style) return `Matched style: ${style}`;
  return 'Matched captured site evidence';
}

function safeSiteHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLocaleLowerCase();
  } catch {
    return '';
  }
}

interface SitesPageProps {
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onOpen?: (site: SiteSummary) => void;
  onOpenSearch?: (seed?: Partial<SearchFilters>) => void;
  searchMode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
  memberControls?: ReactNode;
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
}

interface UseSitesDiscoveryPageControllerOptions {
  query: string;
  onQueryChange: (value: string) => void;
  locationSearch: string;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
  isGuest: boolean;
}

export function useSitesDiscoveryPageController({
  query,
  onQueryChange,
  locationSearch,
  onNavigate,
  isGuest,
}: UseSitesDiscoveryPageControllerOptions) {
  const initialQueryRef = useRef(query);
  const adapter = useMemo(
    () => createSitesDiscoveryAdapter({ query: initialQueryRef.current, isGuest }),
    [isGuest],
  );
  const controller = useDiscoveryController({
    adapter,
    locationSearch,
    onNavigate,
  });
  const syncedQueryRef = useRef(query);
  const pendingExternalQueryRef = useRef<string | null>(null);
  const locationSearchRef = useRef(locationSearch);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  if (locationSearchRef.current !== locationSearch) {
    locationSearchRef.current = locationSearch;
    pendingExternalQueryRef.current = null;
  }

  useEffect(() => {
    if (query === syncedQueryRef.current) return;
    syncedQueryRef.current = query;
    if (query === controller.state.query) return;
    pendingExternalQueryRef.current = query;
    controller.setQuery(query);
  }, [controller, query]);

  useEffect(() => {
    const pending = pendingExternalQueryRef.current;
    if (pending !== null) {
      if (controller.state.query !== pending) return;
      pendingExternalQueryRef.current = null;
    }
    if (controller.state.query === syncedQueryRef.current) return;
    syncedQueryRef.current = controller.state.query;
    onQueryChangeRef.current(controller.state.query);
  }, [controller.state.query]);

  return controller;
}

export function SitesPage({
  isAdmin,
  query,
  onQueryChange,
  onOpen,
  onOpenSearch,
  searchMode,
  activeFilterCount,
  memberControls,
  isGuest = false,
  onGuestLimitReached,
}: SitesPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
  const controller = useSitesDiscoveryPageController({
    query,
    onQueryChange,
    locationSearch: search,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/sites${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
    isGuest,
  });

  return (
    <SitesPageView
      controller={controller}
      isAdmin={isAdmin}
      onOpen={onOpen}
      onOpenSearch={onOpenSearch}
      searchMode={searchMode}
      activeFilterCount={activeFilterCount}
      memberControls={memberControls}
      isGuest={isGuest}
      onGuestLimitReached={onGuestLimitReached}
    />
  );
}
