import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core';
import {
  APPS_DISCOVERY_CATEGORIES,
  APPS_DISCOVERY_STATIC_FACETS,
  buildAppsFilterOptions,
  filterAppsDiscoveryScreens,
  type AppsFacet,
  type AppsFilterOption,
  type AppsPlatform,
} from '../appsDiscovery.ts';
import {
  appsDiscoveryFacets,
  clearAppsDiscoveryFacet,
  toggleAppsDiscoveryFacet,
  type AppsDiscoveryFilterState,
} from '../appsDiscoveryState.ts';
import {
  createAppsDiscoveryAdapter,
  type AppsDiscoveryControllerState,
} from '../appsDiscoveryAdapter.ts';
import type { DiscoveryFacet, DiscoveryFilter } from '../discoveryTypes.ts';
import { fetchRandomFacetPreview, type FacetPreview } from '../facetPreviewApi.ts';
import type { SearchFilters } from '../../searchTypes.ts';
import type { App } from '../types.ts';
import { updateLocation, useLocationKey } from '../router.ts';
import { useCategoryHoverPreview } from '../useCategoryHoverPreview.ts';
import {
  useDiscoveryController,
  type DiscoveryController,
} from '../useDiscoveryController.ts';
import { AppCard } from './AppCard.tsx';
import { AppsDiscoveryScreenCard } from './AppsDiscoveryScreenCard.tsx';
import { DiscoveryFilterBar } from './AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';

const readyAppFacetPreviews = new Map<string, FacetPreview>();
const appFacetPreviewRequests = new Map<string, Promise<FacetPreview | null>>();
const appFacetImageRequests = new Map<string, Promise<boolean>>();

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

export interface AppsDiscoveryPageProps {
  isAdmin: boolean;
  query?: string;
  facet?: AppsFacet | null;
  onFacetChange?: (facet: AppsFacet | null) => void;
  onOpenSearch: (seed?: Partial<SearchFilters>) => void;
  searchMode: 'legacy' | 'advanced';
  initialPlatform?: AppsPlatform;
  activeFilterCount?: number;
  onOpenApp: (appId: string) => void;
  accountControls?: ReactNode;
  beforeGrid?: ReactNode;
  reviewItemLimit?: number;
}

export interface AppsDiscoveryPageViewProps
  extends Omit<AppsDiscoveryPageProps, 'initialPlatform' | 'facet' | 'query'> {
  controller: DiscoveryController<
    App,
    AppsDiscoveryControllerState['sort'],
    AppsDiscoveryControllerState
  >;
}

interface UseAppsDiscoveryPageControllerOptions {
  isAdmin: boolean;
  locationSearch: string;
  initialPlatform: AppsPlatform;
  initialFacet: AppsFacet | null;
  initialQuery: string;
  onFacetChange?: (facet: AppsFacet | null) => void;
  onNavigate(search: string, mode: 'push' | 'replace'): void;
}

const APP_DISCOVERY_TAXONOMY = [
  {
    group: 'categories' as const,
    label: 'Categories',
    values: APPS_DISCOVERY_CATEGORIES,
  },
  ...APPS_DISCOVERY_STATIC_FACETS,
];

const FILTER_LABELS: Record<AppsFacet['group'], string> = {
  categories: 'Categories',
  screens: 'Screens',
  elements: 'UI Elements',
  flows: 'Flows',
};

const RESULT_LABELS = {
  apps: { singular: 'app', plural: 'apps' },
  screens: { singular: 'screen', plural: 'screens' },
  elements: { singular: 'UI element', plural: 'UI elements' },
  flows: { singular: 'flow', plural: 'flows' },
} as const;

const isAppsFacetGroup = (group: string): group is AppsFacet['group'] =>
  group === 'categories'
  || group === 'screens'
  || group === 'elements'
  || group === 'flows';

const groupedFilters = (
  filters: readonly DiscoveryFilter[],
): AppsDiscoveryFilterState['filters'] =>
  filters.reduce<AppsDiscoveryFilterState['filters']>((result, filter) => {
    if (!isAppsFacetGroup(filter.group)) return result;
    result[filter.group] = [...(result[filter.group] ?? []), filter.value];
    return result;
  }, {});

const filterState = (
  state: AppsDiscoveryControllerState,
): AppsDiscoveryFilterState => ({
  platform: state.platform,
  contentType: state.contentType,
  sort: state.sort,
  filters: groupedFilters(state.filters),
});

const controllerState = (
  state: AppsDiscoveryFilterState,
  query: string,
): AppsDiscoveryControllerState => ({
  platform: state.platform,
  contentType: state.contentType,
  sort: state.sort,
  query,
  filters: appsDiscoveryFacets(state),
});

export function appsDiscoveryFacetOptions(
  facets: readonly DiscoveryFacet[],
  apps: readonly App[],
): Record<AppsFacet['group'], AppsFilterOption[]> {
  const staticOptions = buildAppsFilterOptions([]);
  const loadedOptions = buildAppsFilterOptions([...apps]);
  const matchedPreviews = new Map<string, {
    url: string | null | undefined;
    label: string;
  }>();
  for (const app of apps) {
    for (const screen of app.screens) {
      for (const facet of screen.matchedFacets ?? []) {
        const key = `${facet.group}:${facet.value.toLocaleLowerCase()}`;
        if (!matchedPreviews.has(key)) {
          matchedPreviews.set(key, {
            url: screen.thumbnailUrl ?? screen.url,
            label: `${app.app} · ${facet.value}`,
          });
        }
      }
    }
  }
  const result = Object.fromEntries(
    Object.entries(staticOptions).map(([group, options]) => [group, [...options]]),
  ) as Record<AppsFacet['group'], AppsFilterOption[]>;
  const resultByValue = Object.fromEntries(
    (Object.keys(result) as AppsFacet['group'][]).map((group) => [
      group,
      new Map(result[group].map((option) => [option.value, option])),
    ]),
  ) as Record<AppsFacet['group'], Map<string, AppsFilterOption>>;
  const loadedByValue = Object.fromEntries(
    (Object.keys(loadedOptions) as AppsFacet['group'][]).map((group) => [
      group,
      new Map(loadedOptions[group].map((option) => [option.value, option])),
    ]),
  ) as Record<AppsFacet['group'], Map<string, AppsFilterOption>>;

  for (const facet of facets) {
    if (!isAppsFacetGroup(facet.group)) continue;
    const existing = resultByValue[facet.group].get(facet.value);
    const loaded = loadedByValue[facet.group].get(facet.value);
    const matched = matchedPreviews.get(
      `${facet.group}:${facet.value.toLocaleLowerCase()}`,
    );
    const option: AppsFilterOption = {
      value: facet.value,
      section: facet.section?.trim() || loaded?.section || FILTER_LABELS[facet.group],
      count: facet.count,
      previewUrl: matched?.url ?? loaded?.previewUrl,
      previewLabel: matched?.label ?? loaded?.previewLabel ?? facet.value,
      ...(facet.description === undefined ? {} : { description: facet.description }),
      ...(facet.aliases === undefined ? {} : { aliases: facet.aliases }),
      ...(facet.sectionPosition === undefined
        ? {}
        : { sectionPosition: facet.sectionPosition }),
      ...(facet.position === undefined ? {} : { position: facet.position }),
    };
    if (existing) Object.assign(existing, option);
    else {
      result[facet.group].push(option);
      resultByValue[facet.group].set(facet.value, option);
    }
  }

  for (const group of Object.keys(result) as AppsFacet['group'][]) {
    result[group].sort((left, right) =>
      (left.sectionPosition ?? Number.MAX_SAFE_INTEGER)
        - (right.sectionPosition ?? Number.MAX_SAFE_INTEGER)
      || (left.position ?? Number.MAX_SAFE_INTEGER)
        - (right.position ?? Number.MAX_SAFE_INTEGER)
      || left.section.localeCompare(right.section)
      || left.value.localeCompare(right.value));
  }
  return result;
}

const compatibleFacet = (state: AppsDiscoveryFilterState): AppsFacet | null => {
  const facets = appsDiscoveryFacets(state);
  return facets.find(({ group }) => group === state.contentType)
    ?? facets.find(({ group }) => group === 'categories')
    ?? null;
};

export function useAppsDiscoveryPageController({
  isAdmin,
  locationSearch,
  initialPlatform,
  initialFacet,
  initialQuery,
  onFacetChange,
  onNavigate,
}: UseAppsDiscoveryPageControllerOptions) {
  const initialFallbackRef = useRef<{
    platform: AppsPlatform;
    facet: AppsFacet | null;
    query: string;
  } | null>(null);
  initialFallbackRef.current ??= {
    platform: initialPlatform,
    facet: initialFacet,
    query: initialQuery,
  };
  const adapter = useMemo(
    () => createAppsDiscoveryAdapter({
      ...initialFallbackRef.current!,
      source: isAdmin ? 'admin' : 'catalog',
    }),
    [isAdmin],
  );
  const controller = useDiscoveryController({
    adapter,
    locationSearch,
    onNavigate,
  });
  const compatibleFacetKey = `${controller.state.contentType}:${controller.state.filters
    .map(({ group, value }) => `${group}.${value}`)
    .join('|')}`;

  useEffect(() => {
    onFacetChange?.(compatibleFacet(filterState(controller.state)));
  }, [compatibleFacetKey, onFacetChange]);
  return controller;
}

export function AppsDiscoveryPageView({
  controller,
  isAdmin,
  onFacetChange,
  onOpenApp,
  beforeGrid,
  reviewItemLimit,
}: AppsDiscoveryPageViewProps) {
  const state = filterState(controller.state);
  const activeFacets = appsDiscoveryFacets(state);
  const { previewRef, showPreview, movePreview, hidePreview } = useCategoryHoverPreview();
  const hoverRequestRef = useRef(0);
  const hoverPointRef = useRef({ x: 0, y: 0 });
  const options = useMemo(() => buildAppsFilterOptions([]), []);
  const visibleScreens = useMemo(() => {
    const exactFacetKeys = new Set(activeFacets
      .filter(({ group }) => group === 'screens' || group === 'elements')
      .map(({ group, value }) => `${group}:${value.toLocaleLowerCase()}`));
    const exactMedia = exactFacetKeys.size > 0;
    return filterAppsDiscoveryScreens(controller.items, {
      query: exactMedia ? '' : controller.state.query,
      facets: exactMedia ? [] : activeFacets,
      platform: controller.state.platform,
      sort: controller.state.sort,
    }).filter(({ screen }) =>
      !exactMedia
      || screen.matchedFacets?.some(({ group, value }) =>
        exactFacetKeys.has(`${group}:${value.toLocaleLowerCase()}`)));
  },
    [
      activeFacets,
      controller.items,
      controller.state.platform,
      controller.state.query,
      controller.state.sort,
    ],
  );
  const screenMediaMode = controller.state.contentType === 'screens'
    || controller.state.contentType === 'elements'
    || activeFacets.some(({ group }) => group === 'screens' || group === 'elements');
  const appsMode = !screenMediaMode;
  const renderedApps = reviewItemLimit === undefined
    ? controller.items
    : controller.items.slice(0, reviewItemLimit);
  const renderedScreens = reviewItemLimit === undefined
    ? visibleScreens
    : visibleScreens.slice(0, reviewItemLimit);
  const renderedCount = appsMode ? renderedApps.length : renderedScreens.length;
  // The API total is an App total. Non-App modes render matching cards derived
  // only from the Apps returned so far, so their count intentionally reflects
  // visible cards rather than mislabeling the server's App total.
  const displayedTotal = appsMode ? controller.totalCount : renderedCount;
  const labels = appsMode
    ? RESULT_LABELS.apps
    : RESULT_LABELS[controller.state.contentType === 'elements' ? 'elements' : 'screens'];

  const changeState = (next: AppsDiscoveryFilterState) => {
    if (next.platform !== controller.state.platform) {
      hoverRequestRef.current += 1;
      hidePreview();
    }
    controller.setState(controllerState(next, controller.state.query));
  };

  return (
    <DiscoveryPageLayout
      kind="apps"
      header={null}
      taxonomyLabel="App discovery filters"
      taxonomy={(
        <>
          {APP_DISCOVERY_TAXONOMY.filter((group) => group.group === 'categories').map((group) => (
            <ReferenceDiscoveryFacetGroup
              key={group.group}
              label={group.label}
              className={`apps-discovery__facet apps-discovery__facet--${group.group}`}
            >
              {group.values.map((value) => {
                const facet = { group: group.group, value } satisfies AppsFacet;
                const selected = (state.filters[group.group] ?? []).includes(value);
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
                      const readyPreview = readyAppFacetPreviews.get(
                        appFacetKey(facet, controller.state.platform),
                      );
                      if (readyPreview) {
                        showPreview(readyPreview, event.clientX, event.clientY);
                      }
                      void prefetchAppFacetPreview(facet, controller.state.platform)
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
                    onClick={() => changeState(toggleAppsDiscoveryFacet(state, facet))}
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
        <DiscoveryFilterBar
          kind="apps"
          ariaLabel="App discovery controls"
          platform={{
            value: state.platform,
            ariaLabel: 'App platform',
            onChange: (platform) => changeState({ ...state, platform }),
          }}
          filters={(Object.keys(FILTER_LABELS) as AppsFacet['group'][])
            .filter((group) => group === 'categories')
            .map((group) => ({
              id: group,
              label: FILTER_LABELS[group],
              selected: state.filters[group] ?? [],
              options: options[group],
            }))}
          resultCount={renderedCount}
          resultLabels={[labels.singular, labels.plural]}
          sort={state.sort}
          sortOptions={[
            { value: 'latest', label: 'Newest' },
            { value: 'trending', label: 'Popular' },
          ]}
          onSortChange={(sort) => changeState({
            ...state,
            sort: sort as AppsDiscoveryFilterState['sort'],
          })}
          onToggleFilter={(group, value) => changeState(toggleAppsDiscoveryFacet(state, {
            group: group as AppsFacet['group'],
            value,
          }))}
          onClearFilter={(group) => changeState(clearAppsDiscoveryFacet(
            state,
            group as AppsFacet['group'],
          ))}
        />
      )}
      resultLabel={labels.plural}
      singularResultLabel={labels.singular}
      totalCount={displayedTotal}
      renderedCount={renderedCount}
      loading={controller.loading}
      loadingMore={controller.loadingMore}
      error={controller.error}
      loadMoreError={controller.loadMoreError}
      onRetry={controller.retry}
      onRetryLoadMore={controller.retryLoadMore}
      onReset={() => changeState({ ...state, filters: {} })}
      sentinelRef={reviewItemLimit === undefined ? controller.sentinelRef : undefined}
      beforeResults={beforeGrid}
    >
      {appsMode ? (
        <div
          data-apps-discovery-grid="true"
          className="reference-discovery__grid apps-discovery__grid"
        >
          {renderedApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              platform={controller.state.platform}
              onOpen={() => onOpenApp(app.id)}
            />
          ))}
        </div>
      ) : (
        <div
          data-apps-discovery-screen-grid="true"
          className="apps-discovery__screen-grid"
        >
          {renderedScreens.map((result) => (
            <AppsDiscoveryScreenCard
              key={`${result.app.id}:${result.screen.id}`}
              result={result}
              onOpen={() => onOpenApp(result.app.id)}
            />
          ))}
        </div>
      )}
    </DiscoveryPageLayout>
  );
}

export function AppsDiscoveryPage({
  isAdmin,
  initialPlatform = 'web',
  facet = null,
  query = '',
  onFacetChange,
  ...props
}: AppsDiscoveryPageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?') ? locationKey.slice(locationKey.indexOf('?')) : '';
  const controller = useAppsDiscoveryPageController({
    isAdmin,
    locationSearch: search,
    initialPlatform,
    initialFacet: facet,
    initialQuery: query,
    onFacetChange,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/apps${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  return (
    <AppsDiscoveryPageView
      {...props}
      isAdmin={isAdmin}
      controller={controller}
      onFacetChange={onFacetChange}
    />
  );
}
