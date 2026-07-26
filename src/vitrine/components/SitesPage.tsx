import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import type { FacetPreview } from '../facetPreviewApi.ts';
import type { SearchFilters } from '../../searchTypes.ts';
import { navigate } from '../router.ts';
import { listSites } from '../sitesApi.ts';
import type { SiteSummary } from '../types.ts';
import { useCategoryHoverPreview } from '../useCategoryHoverPreview.ts';
import { SiteImportDialog } from './SiteImportDialog.tsx';
import { SiteCard } from './SiteCard.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import { ReferenceDiscoveryPageShell } from './ReferenceDiscoveryPageShell.tsx';
import { ReferenceDiscoveryToolbar } from './ReferenceDiscoveryToolbar.tsx';
import { SitesTopNav } from './SitesTopNav.tsx';

export type SiteSort = 'latest' | 'popular';
export type SiteFacet = { group: 'categories' | 'sections' | 'styles'; value: string };
export type SiteFacetPreviewPools = Map<string, FacetPreview[]>;

const siteFacetImageCache = new Map<string, Promise<void>>();
const siteFacetImageReady = new Set<string>();

const DISCOVERY_FACETS: Array<{
  group: SiteFacet['group'];
  label: string;
  defaults: string[];
}> = [
  { group: 'categories', label: 'Categories', defaults: ['Portfolio', 'Lifestyle', 'Finance', 'Business', 'Shopping'] },
  { group: 'sections', label: 'Sections', defaults: ['Pricing', 'How It Works', 'About', 'Social Proof', 'FAQ', '404', 'Blog', 'Hero', 'Showcase', 'Footer'] },
  { group: 'styles', label: 'Styles', defaults: ['Minimal', 'Dark', 'Photography', 'Motion', 'Colorful'] },
];

const siteFacetKey = (facet: SiteFacet) => `${facet.group}:${facet.value.toLowerCase()}`;
const siteFacetPreviewUrl = (preview: FacetPreview) => (
  preview.kind === 'icon' ? preview.iconUrl : preview.media[0]
);

export function filterAndSortSites(
  sites: SiteSummary[],
  query: string,
  facet: SiteFacet | null,
  sort: SiteSort,
): SiteSummary[] {
  const needle = query.trim().toLowerCase();
  const normalizedFacet = facet?.value.toLowerCase();
  return sites
    .filter((site) => {
      const searchable = [
        site.name,
        site.label,
        site.sourceUrl,
        site.description ?? '',
        ...(site.categories ?? []),
        ...(site.styles ?? []),
        ...site.previews.map((page) => page.title),
      ].join(' ').toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (!facet || !normalizedFacet) return true;
      if (facet.group === 'categories') {
        return (site.categories ?? []).some((value) => value.toLowerCase() === normalizedFacet);
      }
      if (facet.group === 'styles') {
        return (site.styles ?? []).some((value) => value.toLowerCase() === normalizedFacet);
      }
      return site.previews.some((page) => page.title.toLowerCase().includes(normalizedFacet));
    })
    .sort((a, b) => {
      if (sort === 'popular') {
        return (b.popularity ?? b.sectionCount) - (a.popularity ?? a.sectionCount)
          || b.sectionCount - a.sectionCount
          || a.name.localeCompare(b.name);
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name);
    });
}

export function buildSiteFacetPreviewPools(sites: SiteSummary[]): SiteFacetPreviewPools {
  const pools: SiteFacetPreviewPools = new Map();
  const sectionValues = DISCOVERY_FACETS.find(({ group }) => group === 'sections')?.defaults ?? [];
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
    return defaults.flatMap((value) => {
      const preview = pools.get(siteFacetKey({ group, value }))?.[0];
      return preview ? [preview] : [];
    });
  });
}

function prefetchSiteFacetPreview(preview: FacetPreview): Promise<void> {
  const url = siteFacetPreviewUrl(preview);
  if (!url || typeof Image === 'undefined') return Promise.resolve();

  const cached = siteFacetImageCache.get(url);
  if (cached) return cached;

  const request = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const decode = typeof image.decode === 'function'
        ? image.decode().catch(() => undefined)
        : Promise.resolve();
      decode.finally(() => {
        siteFacetImageReady.add(url);
        resolve();
      });
    };
    image.onerror = () => {
      siteFacetImageCache.delete(url);
      resolve();
    };
    image.src = url;
  });
  siteFacetImageCache.set(url, request);
  return request;
}

function prefetchVisibleSiteFacetPreviews(pools: SiteFacetPreviewPools): void {
  visibleSiteFacetPreviews(pools).forEach((preview) => {
    void prefetchSiteFacetPreview(preview);
  });
}

function prefetchNextSiteFacetPreview(pools: SiteFacetPreviewPools, facet: SiteFacet): void {
  const next = (pools.get(siteFacetKey(facet)) ?? []).find((preview) => {
    const url = siteFacetPreviewUrl(preview);
    return Boolean(url && !siteFacetImageCache.has(url));
  });
  if (next) void prefetchSiteFacetPreview(next);
}

interface SitesPageViewProps {
  sites: SiteSummary[];
  loading?: boolean;
  isAdmin: boolean;
  error?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenSearch?: (seed?: Partial<SearchFilters>) => void;
  searchMode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
  onRefresh: () => void;
  onImport: () => void;
  onOpen?: (site: SiteSummary) => void;
  memberControls?: ReactNode;
}

export function SitesPageView({
  sites,
  loading = false,
  isAdmin,
  error,
  query,
  onQueryChange,
  onOpenSearch = () => undefined,
  searchMode = 'legacy',
  activeFilterCount = 0,
  onRefresh,
  onImport,
  onOpen = (site) => navigate({ name: 'site-version', siteId: site.id, versionId: site.versionId }),
  memberControls,
}: SitesPageViewProps) {
  const [sort, setSort] = useState<SiteSort>('latest');
  const [facet, setFacet] = useState<SiteFacet | null>(null);
  const { previewRef, showPreview, movePreview, hidePreview } = useCategoryHoverPreview();
  const previewPools = useMemo(
    () => buildSiteFacetPreviewPools(sites),
    [sites],
  );
  const visibleSites = useMemo(
    () => filterAndSortSites(sites, query, facet, sort),
    [sites, query, facet, sort],
  );
  const facetGroups = DISCOVERY_FACETS.map((entry) => ({ ...entry, values: entry.defaults }));

  useEffect(() => {
    const prefetch = () => prefetchVisibleSiteFacetPreviews(previewPools);
    if (typeof window.requestIdleCallback === 'function') {
      const requestId = window.requestIdleCallback(prefetch, { timeout: 1_000 });
      return () => window.cancelIdleCallback(requestId);
    }
    const timeoutId = window.setTimeout(prefetch, 0);
    return () => window.clearTimeout(timeoutId);
  }, [previewPools]);

  const state = loading
    ? null
    : error
    ? {
        title: 'Could not load Sites',
        description: error,
        actions: <Button variant="primary" label="Retry" clickAction={onRefresh} />,
        role: 'alert' as const,
      }
    : sites.length === 0
      ? {
          title: 'No Sites imported yet',
          description: isAdmin
            ? 'Analyze one public page to create the first website reference.'
            : 'No ready website references are available yet.',
          role: 'status' as const,
        }
      : visibleSites.length === 0
        ? {
            title: facet ? 'No Sites match these filters' : 'No Sites match this search',
            description: facet
              ? 'Try another search, category, section, or style.'
              : 'Try a Site name, version, or section keyword.',
            role: 'status' as const,
          }
        : null;

  return (
    <ReferenceDiscoveryPageShell
      kind="sites"
      header={(
        <SitesTopNav
          searchLabel={query || facet ? `${visibleSites.length} sites · search or filter…` : 'Search on Web...'}
          activeCategory={facet?.value ?? 'All'}
          onClearCategory={() => setFacet(null)}
          onOpenSearch={() => onOpenSearch({
            ...(facet?.group === 'categories' ? { appCategory: [facet.value] } : {}),
            ...(facet?.group === 'sections' ? { siteSection: [facet.value] } : {}),
            ...(facet?.group === 'styles' ? { siteStyle: [facet.value] } : {}),
          })}
          searchMode={searchMode}
          activeFilterCount={activeFilterCount}
          isAdmin={isAdmin}
          onImport={onImport}
          accountControls={memberControls}
        />
      )}
      taxonomyLabel="Site discovery filters"
      taxonomy={(
        <>
          {facetGroups.map((group) => (
            <ReferenceDiscoveryFacetGroup
              key={group.group}
              label={group.label}
              wide={group.group === 'sections'}
              className={`sites-discovery__facet sites-discovery__facet--${group.group}`}
            >
              {group.values.map((value) => {
                const selected = facet?.group === group.group && facet.value === value;
                const hoverFacet = group.group === 'styles'
                  ? null
                  : { group: group.group, value } satisfies SiteFacet;
                return (
                  <Button
                    key={value}
                    label={value}
                    variant="ghost"
                    size="sm"
                    aria-pressed={selected}
                    data-facet-preview={hoverFacet?.group}
                    onPointerEnter={hoverFacet ? (event) => {
                      const preview = siteFacetPreview(
                        previewPools,
                        hoverFacet,
                        Math.random,
                        siteFacetImageReady,
                      ) ?? siteFacetPreview(previewPools, hoverFacet);
                      if (preview) showPreview(preview, event.clientX, event.clientY);
                      prefetchNextSiteFacetPreview(previewPools, hoverFacet);
                    } : undefined}
                    onPointerMove={hoverFacet ? (event) => {
                      movePreview(event.clientX, event.clientY);
                    } : undefined}
                    onPointerLeave={hoverFacet ? hidePreview : undefined}
                    onClick={() => setFacet(selected ? null : { group: group.group, value })}
                  />
                );
              })}
            </ReferenceDiscoveryFacetGroup>
          ))}
        </>
      )}
      preview={(
        <div
          ref={previewRef}
          className="apps-discovery__hover-preview sites-discovery__hover-preview"
          aria-hidden="true"
        >
          <img alt="" aria-hidden="true" data-preview-frame="1" />
          <img alt="" aria-hidden="true" data-preview-frame="2" />
          <img alt="" aria-hidden="true" data-preview-frame="3" />
        </div>
      )}
      toolbar={(
        <ReferenceDiscoveryToolbar
          label="Site ordering"
          value={sort}
          options={[
            { value: 'latest', label: 'Latest' },
            { value: 'popular', label: 'Most popular' },
          ]}
          onChange={setSort}
        />
      )}
    >
      {loading ? (
          <div
            className="reference-discovery__loading sites-discovery__loading"
            role="status"
            aria-label="Loading Sites"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} data-sites-discovery-skeleton="true" />
            ))}
          </div>
      ) : state ? (
          <div className="reference-discovery__state sites-discovery__state" role={state.role}>
            <EmptyState title={state.title} description={state.description} actions={state.actions} />
          </div>
      ) : (
        <div
          data-reference-gallery-grid="true"
          className="reference-discovery__grid sites-discovery__grid"
        >
          {visibleSites.map((site) => (
            <SiteCard key={`${site.id}:${site.versionId}`} site={site} onOpen={() => onOpen(site)} />
          ))}
        </div>
      )}
    </ReferenceDiscoveryPageShell>
  );
}

interface SitesPageProps {
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenSearch?: (seed?: Partial<SearchFilters>) => void;
  searchMode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
  memberControls?: ReactNode;
}

export function SitesPage({
  isAdmin,
  query,
  onQueryChange,
  onOpenSearch,
  searchMode,
  activeFilterCount,
  memberControls,
}: SitesPageProps) {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listSites()
      .then((items) => { if (active) { setSites(items); setError(''); } })
      .catch((cause: Error) => { if (active) { setSites([]); setError(cause.message); } });
    return () => { active = false; };
  }, [revision]);

  return (
    <>
      <SitesPageView
        sites={sites ?? []}
        loading={sites === null}
        isAdmin={isAdmin}
        error={error || undefined}
        query={query}
        onQueryChange={onQueryChange}
        onOpenSearch={onOpenSearch}
        searchMode={searchMode}
        activeFilterCount={activeFilterCount}
        onRefresh={() => setRevision((value) => value + 1)}
        onImport={() => setImportOpen(true)}
        memberControls={memberControls}
      />
      {isAdmin && (
        <SiteImportDialog
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onExisting={(siteId, versionId) => navigate({ name: 'site-version', siteId, versionId })}
        />
      )}
    </>
  );
}
