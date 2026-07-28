import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button, EmptyState, Icon, IconButton } from '@astryxdesign/core';
import {
  APPS_DISCOVERY_CATEGORIES,
  APPS_DISCOVERY_STATIC_FACETS,
  filterAndSortApps,
  type AppsFacet,
  type AppsPlatform,
  type AppsSort,
} from '../appsDiscovery.ts';
import { fetchRandomFacetPreview, type FacetPreview } from '../facetPreviewApi.ts';
import type { SearchFilters } from '../../searchTypes.ts';
import type { App } from '../types.ts';
import { useCategoryHoverPreview } from '../useCategoryHoverPreview.ts';
import { useCatalogFacetApps } from '../useApps.ts';
import { AppCard } from './AppCard.tsx';
import { AppsPlatformSwitcher } from './AppsPlatformSwitcher';
import { ReferenceCatalogLoading } from './ReferenceCatalogLoading.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import { ReferenceDiscoveryPageShell } from './ReferenceDiscoveryPageShell.tsx';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { ReferenceDiscoveryToolbar } from './ReferenceDiscoveryToolbar.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

const readyAppFacetPreviews = new Map<string, FacetPreview>();
const appFacetPreviewRequests = new Map<string, Promise<FacetPreview | null>>();
const appFacetImageRequests = new Map<string, Promise<boolean>>();

const APPS_FACET_LABELS: Record<AppsFacet['group'], string> = {
  categories: 'Category',
  screens: 'Screen',
  elements: 'UI Element',
  flows: 'Flow',
};

const appFacetKey = (facet: AppsFacet, platform: AppsPlatform) =>
  `${platform}:${facet.group}:${facet.value}`;

const appFacetPreviewSources = (preview: FacetPreview) => (
  preview.kind === 'icon'
    ? [preview.iconUrl].filter((url): url is string => Boolean(url))
    : preview.media
);

function prefetchAppFacetImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  const cached = appFacetImageRequests.get(url);
  if (cached) return cached;

  const request = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const decode = typeof image.decode === 'function'
        ? image.decode().catch(() => undefined)
        : Promise.resolve();
      decode.finally(() => resolve(true));
    };
    image.onerror = () => {
      appFacetImageRequests.delete(url);
      resolve(false);
    };
    image.src = url;
  });
  appFacetImageRequests.set(url, request);
  return request;
}

function prefetchAppFacetPreview(
  facet: AppsFacet,
  platform: AppsPlatform,
): Promise<FacetPreview | null> {
  if (platform === 'android') return Promise.resolve(null);
  const key = appFacetKey(facet, platform);
  const cached = appFacetPreviewRequests.get(key);
  if (cached) return cached;

  const request = fetchRandomFacetPreview({ ...facet, platform })
    .then(async (preview) => {
      if (!preview) return null;
      const loaded = await Promise.all(
        appFacetPreviewSources(preview).map(prefetchAppFacetImage),
      );
      if (loaded.length === 0 || loaded.some((ready) => !ready)) return null;
      readyAppFacetPreviews.set(key, preview);
      return preview;
    })
    .catch(() => null)
    .finally(() => {
      appFacetPreviewRequests.delete(key);
    });
  appFacetPreviewRequests.set(key, request);
  return request;
}

interface AppsDiscoveryPageProps {
  apps: App[] | null;
  isAdmin: boolean;
  query: string;
  facet: AppsFacet | null;
  onFacetChange: (facet: AppsFacet | null) => void;
  onOpenSearch: (seed?: Partial<SearchFilters>) => void;
  searchMode: 'legacy' | 'advanced';
  initialPlatform?: AppsPlatform;
  activeFilterCount?: number;
  onOpenApp: (appId: string) => void;
  onRetry: () => void;
  totalApps: number | null;
  error?: string | null;
  loadMoreError?: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onRetryLoadMore?: () => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  accountControls?: ReactNode;
  beforeGrid?: ReactNode;
}

export function AppsDiscoveryPage(props: AppsDiscoveryPageProps) {
  const [platform, setPlatform] = useState<AppsPlatform>(props.initialPlatform ?? 'web');
  const [sort, setSort] = useState<AppsSort>('latest');
  const { previewRef, showPreview, movePreview, hidePreview } = useCategoryHoverPreview();
  const hoverRequestRef = useRef(0);
  const hoverPointRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (props.initialPlatform) setPlatform(props.initialPlatform);
  }, [props.initialPlatform]);
  const facets = [
    {
      group: 'categories' as const,
      label: 'Categories',
      values: APPS_DISCOVERY_CATEGORIES,
    },
    ...APPS_DISCOVERY_STATIC_FACETS,
  ];
  const serverFacet = props.facet?.group === 'categories' || props.facet?.group === 'flows'
    ? props.facet
    : null;
  const facetCatalog = useCatalogFacetApps(serverFacet, platform, Boolean(serverFacet));
  const facetSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = facetSentinelRef.current;
    if (!serverFacet || !sentinel || !facetCatalog.hasMore || facetCatalog.loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(({ isIntersecting }) => isIntersecting)) void facetCatalog.loadMore();
    }, { rootMargin: '600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [facetCatalog.hasMore, facetCatalog.loadMore, facetCatalog.loadingMore, serverFacet]);
  const sourceApps = serverFacet ? facetCatalog.apps : props.apps;
  const sourceError = serverFacet ? facetCatalog.error : props.error;
  const visibleApps = useMemo(
    () => filterAndSortApps(sourceApps ?? [], {
      query: props.query,
      facet: serverFacet ? null : props.facet,
      platform,
      sort,
    }),
    [platform, props.facet, props.query, serverFacet, sort, sourceApps],
  );
  const openSearch = () => props.onOpenSearch({
    platform: [platform],
    ...(props.facet?.group === 'categories' ? { appCategory: [props.facet.value] } : {}),
    ...(props.facet?.group === 'screens' ? { pageType: [props.facet.value] } : {}),
    ...(props.facet?.group === 'elements' ? { component: [props.facet.value] } : {}),
    ...(props.facet?.group === 'flows' ? { flow: [props.facet.value] } : {}),
  });
  const state = sourceError
    ? {
        title: 'Could not load crawled screens',
        description: `The catalog could not be loaded: ${sourceError}`,
        role: 'alert' as const,
      }
    : sourceApps !== null && sourceApps.length === 0
      ? {
          title: 'No screens crawled yet',
          description: props.isAdmin
            ? 'Import captured web screens to build the first observed design system.'
            : 'No curated web apps have been published yet.',
          role: 'status' as const,
        }
      : sourceApps !== null && visibleApps.length === 0
        ? {
            title: 'No Apps match these filters',
            description: 'Try a different search, taxonomy, or platform.',
            role: 'status' as const,
          }
        : null;
  return (
    <ReferenceDiscoveryPageShell
      kind="apps"
      header={(
        <ReferenceDiscoveryTopNav
          active="apps"
          className="apps-top-nav"
          search={(
            <SearchTrigger
              label={props.query ? `${visibleApps.length} apps · search or filter…` : 'Search on Web...'}
              activeCategory={null}
              onOpen={openSearch}
              onClearCategory={() => props.onFacetChange(null)}
              mode={props.searchMode}
              activeFilterCount={props.searchMode === 'advanced' ? props.activeFilterCount : 0}
            />
          )}
          accountControls={props.accountControls}
        />
      )}
      taxonomyLabel="App discovery filters"
      taxonomy={(
        <>
          {facets.map((group) => (
            <ReferenceDiscoveryFacetGroup
              key={group.group}
              label={group.label}
              className={`apps-discovery__facet apps-discovery__facet--${group.group}`}
            >
              {group.values.map((value) => {
                const facet = { group: group.group, value } satisfies AppsFacet;
                const selected = props.facet?.group === group.group && props.facet.value === value;
                return (
                  <Button
                    key={value}
                    label={value}
                    variant="ghost"
                    size="sm"
                    aria-pressed={selected}
                    data-has-app-preview="true"
                    data-facet-preview={group.group}
                    onPointerEnter={(event) => {
                      const request = ++hoverRequestRef.current;
                      hoverPointRef.current = { x: event.clientX, y: event.clientY };
                      const readyPreview = readyAppFacetPreviews.get(appFacetKey(facet, platform));
                      if (readyPreview) showPreview(
                        readyPreview,
                        event.clientX,
                        event.clientY,
                      );
                      void prefetchAppFacetPreview(facet, platform)
                        .then((preview) => {
                          if (!readyPreview && preview && request === hoverRequestRef.current) {
                            const point = hoverPointRef.current;
                            showPreview(preview, point.x, point.y);
                          }
                        })
                        .catch(() => undefined);
                    }}
                    onPointerMove={(event) => {
                      hoverPointRef.current = { x: event.clientX, y: event.clientY };
                      movePreview(event.clientX, event.clientY);
                    }}
                    onPointerLeave={() => {
                      hoverRequestRef.current += 1;
                      hidePreview();
                    }}
                    onClick={() => props.onFacetChange(selected ? null : facet)}
                  />
                );
              })}
            </ReferenceDiscoveryFacetGroup>
          ))}
        </>
      )}
      preview={(
        <div ref={previewRef} className="apps-discovery__hover-preview" aria-hidden="true">
          <img alt="" aria-hidden="true" data-preview-frame="1" />
          <img alt="" aria-hidden="true" data-preview-frame="2" />
          <img alt="" aria-hidden="true" data-preview-frame="3" />
        </div>
      )}
      toolbar={(
        <ReferenceDiscoveryToolbar
          label="App ordering"
          value={sort}
          options={[
            { value: 'latest', label: 'Latest' },
            { value: 'popular', label: 'Most popular' },
          ]}
          onChange={setSort}
          leading={(
            <AppsPlatformSwitcher
              value={platform}
              onChange={(value) => {
                hoverRequestRef.current += 1;
                hidePreview();
                setPlatform(value);
              }}
            />
          )}
        />
      )}
    >
      {props.facet ? (
        <div className="apps-discovery__filter-context" aria-label="Active App filter">
          <div className="apps-discovery__filter-summary">
            <span className="apps-discovery__filter-label">Filtered by</span>
            <div className="apps-discovery__filter-chip">
              <Button
                className="apps-discovery__filter-value"
                aria-label={`Edit ${APPS_FACET_LABELS[props.facet.group]} filter: ${props.facet.value}`}
                label={(
                  <>
                    <span>{APPS_FACET_LABELS[props.facet.group]}</span>
                    <span aria-hidden="true">·</span>
                    <strong>{props.facet.value}</strong>
                  </>
                )}
                variant="ghost"
                size="sm"
                onClick={openSearch}
              />
              <IconButton
                className="apps-discovery__filter-clear"
                label={`Clear ${APPS_FACET_LABELS[props.facet.group]} filter`}
                icon={<Icon icon="close" size="xsm" />}
                variant="ghost"
                size="sm"
                onClick={() => props.onFacetChange(null)}
              />
            </div>
          </div>
          <span className="apps-discovery__filter-count" aria-live="polite">
            {sourceApps === null
              ? 'Loading apps…'
              : `${visibleApps.length} ${visibleApps.length === 1 ? 'app' : 'apps'}`}
          </span>
        </div>
      ) : null}
      {props.beforeGrid}
      {state ? (
          <div className="reference-discovery__state apps-discovery__state" role={state.role}>
            <EmptyState
              title={state.title}
              description={state.description}
              actions={sourceError
                ? <Button
                    variant="primary"
                    label="Retry"
                    onClick={serverFacet ? facetCatalog.retry : props.onRetry}
                  />
                : undefined}
            />
          </div>
      ) : sourceApps === null ? (
          <ReferenceCatalogLoading label="Loading Apps" />
      ) : (
        <>
          <div
            data-apps-discovery-grid="true"
            className="reference-discovery__grid apps-discovery__grid"
          >
            {visibleApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                platform={platform}
                onOpen={() => props.onOpenApp(app.id)}
                status={props.isAdmin && !serverFacet
                  ? (app.analyzedScreens ?? 0) >= app.totalScreens ? 'Complete' : 'In progress'
                  : undefined}
                progressLabel={`${app.analyzedScreens ?? 0}/${app.totalScreens} analyzed`}
              />
            ))}
          </div>
          {(serverFacet ? facetCatalog.hasMore : props.hasMore)
            ? <div
                ref={serverFacet ? facetSentinelRef : props.sentinelRef}
                aria-hidden="true"
                className="apps-discovery__sentinel"
              />
            : null}
          {(serverFacet ? facetCatalog.loadingMore : props.loadingMore)
            ? <ReferenceCatalogLoading label="Loading more Apps" compact />
            : null}
          {(serverFacet ? facetCatalog.loadMoreError : props.loadMoreError) ? (
            <div role="alert" className="apps-discovery__load-more-error">
              <span>
                Could not load more Apps: {serverFacet ? facetCatalog.loadMoreError : props.loadMoreError}
              </span>
              <Button
                variant="secondary"
                label="Retry"
                onClick={serverFacet ? () => void facetCatalog.loadMore() : props.onRetryLoadMore}
              />
            </div>
          ) : null}
        </>
      )}
    </ReferenceDiscoveryPageShell>
  );
}
