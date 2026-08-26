import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, Icon } from '@astryxdesign/core';
import {
  AnimatePresence,
  arc,
  motion,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import {
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
  PUBLIC_APPS_CATALOG_LIMIT,
  type AppsDiscoveryControllerState,
} from '../appsDiscoveryAdapter.ts';
import type { DiscoveryFacet, DiscoveryFilter } from '../discoveryTypes.ts';
import type { SearchFilters } from '../../searchTypes.ts';
import type { App } from '../types.ts';
import { updateLocation, useLocationKey } from '../router.ts';
import {
  useDiscoveryController,
  type DiscoveryController,
} from '../useDiscoveryController.ts';
import { AppCard } from './AppCard.tsx';
import { AppIcon } from './AppIcon.tsx';
import { AppsDiscoveryScreenCard } from './AppsDiscoveryScreenCard.tsx';
import { DiscoveryFilterBar } from './AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';

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
  isGuest?: boolean;
  onGuestLimitReached?: () => void;
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
  isGuest: boolean;
}

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

const PLATFORM_ORDER: readonly AppsPlatform[] = ['web', 'ios', 'android'];

export type AppsResultsTransitionDirection = 'neutral' | 'left' | 'right';

const resultsDirectionSign = (direction: AppsResultsTransitionDirection) =>
  direction === 'right' ? 1 : direction === 'left' ? -1 : 0;

const appsResultsMotionVariants: Variants = {
  initial: (direction: AppsResultsTransitionDirection) => {
    const sign = resultsDirectionSign(direction);
    return {
      opacity: 0,
      x: sign * 64,
      y: 8,
      rotate: sign * 1.8,
      scale: 0.99,
    };
  },
  animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
  exit: (direction: AppsResultsTransitionDirection) => {
    const sign = resultsDirectionSign(direction);
    return {
      opacity: 0,
      x: sign * -48,
      y: 8,
      rotate: sign * -1.6,
      scale: 0.99,
    };
  },
};

interface AppsDiscoveryHeroProps {
  onExplore(): void;
}

const APPS_HERO_INDEXED_TOTAL = 32;
const APPS_HERO_PROOF_APPS = [
  { name: 'Aboard', iconUrl: '/assets/icons/1713649/1c9e9c7a6ba04331339db89c48c5751fdf447352328cc812c90ec5983597bbf3.webp' },
  { name: 'Artlist', iconUrl: '/assets/icons/1712996/e48bdcb7cefc31405ca61938616d1571154a509ae2f55a7dc66b5188ca72f96a.webp' },
  { name: 'Greptile', iconUrl: '/assets/icons/1712546/89041bfe287242a780f3cc7680c98e0b8018719c340cef2cad5bce7a8949f0d4.webp' },
  { name: 'Twenty', iconUrl: '/assets/icons/1711107/a36b8dd1bd6afb300475d490f6efbecd1e2359158bfabca1fc8c4b1a45d21c6e.webp' },
  { name: 'Gamma', iconUrl: '/assets/icons/1709381/2e24b0badc58b587c4af7fd74cc3118b4e1891f04c49bff8086b63b86cd63783.webp' },
  { name: 'Xero', iconUrl: '/assets/icons/1707387/b06fce050cb33f64536eef5a594f42f0fd36231bebbd06828dfd09f021fef6e9.webp' },
  { name: 'Semrush', iconUrl: '/assets/icons/1705716/5f781fff49d5e9912218c735747810229d6f4b46dd24c3d3af5ad9da4108013d.webp' },
  { name: 'Mercor', iconUrl: '/assets/icons/1705104/46409590007f147da9d7e569c209ba9df3e96117af18714847f6d2046a111c17.webp' },
  { name: 'Writer', iconUrl: '/assets/icons/1661102/49024a8dcc16e0bba614cc752461197db2729c936df0c49a8d0d617d9a8a5a3e.webp' },
  { name: 'Codecademy', iconUrl: '/assets/icons/1657692/3d2b7eedd5d543604416fd6f2d1cdc0b2de3e9e277a8bc69ccfb219bc6a113ea.webp' },
  { name: 'Adobe Express', iconUrl: '/assets/icons/1647634/942833cacdfe1bbe4a9e4e6a8ad8a722acc613c87c22cefc70b7061a82f580b9.webp' },
  { name: 'WeTransfer', iconUrl: '/assets/icons/555974/a946575b6dac43180ffcc128b45c6919475b68d2de77da5faa1723c97671391e.webp' },
  { name: 'Zendesk', iconUrl: '/assets/icons/1635601/845d7b9a700534078ab5d5a65468a65dfa4be7b583db8e536cd71c982abe6271.webp' },
  { name: 'Cake Equity', iconUrl: '/assets/icons/1635346/5885c55c171ee76f9c1fac9596e24e38b3c80720c6779be14b2269044b43fcab.webp' },
  { name: 'Gamma NFT', iconUrl: '/assets/icons/1628933/58a4cc8e9ad4b4f1396562110b39f6c8cdf0410cd90820d9cef8893096ddf861.webp' },
  { name: 'Stripe', iconUrl: '/assets/icons/1619662/21372be7451b3ba5922a917fa72bb00c3354d780ac3d7d5efbc33be82f32da06.webp' },
  { name: 'Deputy', iconUrl: '/assets/icons/1597622/5205c68bd734fe86e566a065c6271fc8a79e202ebde2fb4638ccb580e8b2f009.webp' },
  { name: 'Trello', iconUrl: '/assets/icons/573081/5ed247d909667789e918681ca87bdb2021c4f818ded5c5f41ff300ecd029983d.webp' },
  { name: 'Grain', iconUrl: '/assets/icons/1592718/d6957e01ed47d775b2f2454e07c8268b896b13eab436c6ec846141d5926315a7.webp' },
  { name: 'VEED', iconUrl: '/assets/icons/1591031/4acee09ca846f92255c6b031025746c14c46b82cbe59b4b309a8f3cb15a076ed.webp' },
  { name: 'Oku', iconUrl: '/assets/icons/650297/ea89a0876b5aacd75d9cbb9d03611592b5c1fdebbf163eb31a8b31fdebc21a2c.webp' },
  { name: 'Twist', iconUrl: '/assets/icons/1575368/139cf3d0e4e5970364ce196a11fe3388ac0f219274c86c9ad383472c99c6c7e5.webp' },
  { name: 'Plane', iconUrl: '/assets/icons/1574203/9990abdeb65af9c3d45632f26865151dd66dacfcd157608569fc683aeb3e85d7.webp' },
  { name: 'Twingate', iconUrl: '/assets/icons/1571200/51d030dad55502c9a9bf8f94b2460be4089cad291320094285f75a3d7c0323c1.webp' },
] as const;
const APPS_HERO_ROTATING_WORDS = ['APPS.', 'SCREENS.', 'FLOWS.'] as const;

const heroRotatingWordVariants: Variants = {
  initial: {
    transition: { staggerChildren: 0.028, staggerDirection: -1 },
  },
  animate: {
    transition: { staggerChildren: 0.028, staggerDirection: -1 },
  },
  exit: {
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const heroRotatingCharacterVariants: Variants = {
  initial: { opacity: 0, y: '105%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: '-110%' },
};

const AppsHeroRotatingHeadline = memo(function AppsHeroRotatingHeadline() {
  const [wordIndex, setWordIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const word = APPS_HERO_ROTATING_WORDS[wordIndex];

  useEffect(() => {
    if (prefersReducedMotion) {
      setWordIndex(0);
      return undefined;
    }
    const interval = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % APPS_HERO_ROTATING_WORDS.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <h1 data-apps-hero-rotating-text="true">
      <span className="apps-discovery-hero__rotating-sr-only">
        The details behind the world&rsquo;s best {word}
      </span>
      <span className="apps-discovery-hero__headline" aria-hidden="true">
        <span className="apps-discovery-hero__headline-line">The details behind</span>
        <span className="apps-discovery-hero__headline-line apps-discovery-hero__headline-line--rotating">
          <span>the world&rsquo;s best</span>
          <span className="apps-discovery-hero__rotating-slot">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={word}
                className="apps-discovery-hero__rotating-word"
                variants={heroRotatingWordVariants}
                initial={prefersReducedMotion ? false : 'initial'}
                animate="animate"
                exit={prefersReducedMotion ? undefined : 'exit'}
              >
                {Array.from(word).map((character, index) => (
                  <motion.span
                    className="apps-discovery-hero__rotating-character"
                    key={`${character}-${index}`}
                    variants={heroRotatingCharacterVariants}
                    transition={{
                      type: 'spring',
                      stiffness: 240,
                      damping: 28,
                      mass: 0.82,
                    }}
                  >
                    {character}
                  </motion.span>
                ))}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </span>
    </h1>
  );
});

const AppsDiscoveryHero = memo(function AppsDiscoveryHero({
  onExplore,
}: AppsDiscoveryHeroProps) {
  const proofCycleDuration = Math.max(7, APPS_HERO_PROOF_APPS.length * 1.1);

  return (
    <section className="apps-discovery-hero" data-apps-discovery-hero="true">
      <div className="apps-discovery-hero__content">
        <AppsHeroRotatingHeadline />
        <p>Explore the screens and patterns shaping exceptional digital products.</p>
        <div className="apps-discovery-hero__actions">
          <Button
            label="Explore apps"
            variant="primary"
            size="lg"
            onClick={onExplore}
            endContent={<Icon icon="chevronRight" size="sm" />}
          />
          <div
            className="apps-discovery-hero__proof"
            aria-label={`Catalog scale: ${APPS_HERO_INDEXED_TOTAL} products indexed`}
          >
            <span className="apps-discovery-hero__icons" aria-hidden="true">
              <span
                className="apps-discovery-hero__icon-track"
                style={{ animationDuration: `${proofCycleDuration}s` }}
              >
                {[0, 1].map((copyIndex) => (
                  <span className="apps-discovery-hero__icon-set" key={copyIndex}>
                    {APPS_HERO_PROOF_APPS.map((app) => (
                      <AppIcon
                        key={`${copyIndex}-${app.name}`}
                        name={app.name}
                        iconUrl={app.iconUrl}
                        size={34}
                      />
                    ))}
                  </span>
                ))}
              </span>
            </span>
            <span>{APPS_HERO_INDEXED_TOTAL} products indexed</span>
          </div>
        </div>
      </div>
    </section>
  );
});

export const appsPlatformTransitionDirection = (
  from: AppsPlatform,
  to: AppsPlatform,
): AppsResultsTransitionDirection => {
  if (from === to) return 'neutral';
  const fromIndex = PLATFORM_ORDER.indexOf(from);
  const toIndex = PLATFORM_ORDER.indexOf(to);
  const clockwiseSteps = (toIndex - fromIndex + PLATFORM_ORDER.length) % PLATFORM_ORDER.length;
  const counterClockwiseSteps = (fromIndex - toIndex + PLATFORM_ORDER.length) % PLATFORM_ORDER.length;
  return clockwiseSteps <= counterClockwiseSteps ? 'right' : 'left';
};

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
  isGuest,
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
      isGuest,
    }),
    [isAdmin, isGuest],
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
  isGuest = false,
  onGuestLimitReached,
}: AppsDiscoveryPageViewProps) {
  const state = filterState(controller.state);
  const activeFacets = appsDiscoveryFacets(state);
  const catalogRef = useRef<HTMLDivElement>(null);
  const [resultsTransitionDirection, setResultsTransitionDirection] =
    useState<AppsResultsTransitionDirection>('neutral');
  const prefersReducedMotion = useReducedMotion();
  const clockwiseResultsArc = useMemo(
    () => arc({ direction: 'cw', strength: 0.18, rotate: 0.1 }),
    [],
  );
  const counterClockwiseResultsArc = useMemo(
    () => arc({ direction: 'ccw', strength: 0.18, rotate: 0.1 }),
    [],
  );
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
  const displayedTotal = appsMode
    ? isGuest
      ? Math.min(controller.totalCount, PUBLIC_APPS_CATALOG_LIMIT)
      : controller.totalCount
    : renderedCount;
  const labels = appsMode
    ? RESULT_LABELS.apps
    : RESULT_LABELS[controller.state.contentType === 'elements' ? 'elements' : 'screens'];
  const resultsMotionSign = resultsDirectionSign(resultsTransitionDirection);
  const resultsMotionTransition = prefersReducedMotion ? { duration: 0 } : {
    type: 'spring' as const,
    stiffness: 250,
    damping: 29,
    mass: 0.78,
    path: resultsTransitionDirection === 'left'
      ? counterClockwiseResultsArc
      : clockwiseResultsArc,
  };

  const resultCardMotion = (index: number) => ({
    initial: prefersReducedMotion ? false : {
      opacity: 0,
      x: resultsMotionSign * Math.min(54, 30 + index * 4),
      y: 12,
      rotate: resultsMotionSign * Math.min(2.2, 1.2 + index * 0.14),
      scale: 0.985,
    },
    animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
    transition: prefersReducedMotion ? { duration: 0 } : {
      type: 'spring' as const,
      stiffness: 270,
      damping: 28,
      mass: 0.72,
      delay: Math.min(index, 6) * 0.035,
      path: resultsTransitionDirection === 'left'
        ? counterClockwiseResultsArc
        : clockwiseResultsArc,
    },
  });

  const changeState = (next: AppsDiscoveryFilterState) => {
    setResultsTransitionDirection(appsPlatformTransitionDirection(
      controller.state.platform,
      next.platform,
    ));
    controller.setState(controllerState(next, controller.state.query));
  };

  const exploreCatalog = useCallback(() => {
    const catalog = catalogRef.current;
    if (!catalog) return;
    const reduceMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    catalog.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    catalog.focus({ preventScroll: true });
  }, []);

  return (
    <DiscoveryPageLayout
      kind="apps"
      header={null}
      taxonomyLabel="Vitrines app inspiration"
      taxonomy={(
        <AppsDiscoveryHero
          onExplore={exploreCatalog}
        />
      )}
      toolbar={(
        <div ref={catalogRef} id="apps-catalog" className="apps-discovery__catalog-anchor" tabIndex={-1}>
          <DiscoveryFilterBar
            kind="apps"
            ariaLabel="App discovery controls"
            platform={{
              value: state.platform,
              ariaLabel: 'App platform',
              onChange: (platform) => changeState({ ...state, platform }),
            }}
            filters={(Object.keys(FILTER_LABELS) as AppsFacet['group'][])
              .filter((group) => group === 'categories' || group === 'screens')
              .map((group) => ({
                id: group,
                label: FILTER_LABELS[group],
                selected: state.filters[group] ?? [],
                options: options[group],
              }))}
            resultCount={renderedCount}
            resultLabels={[labels.singular, labels.plural]}
            showSort={false}
            sort={state.sort}
            sortOptions={[]}
            onSortChange={() => undefined}
            onToggleFilter={(group, value) => changeState(toggleAppsDiscoveryFacet(state, {
              group: group as AppsFacet['group'],
              value,
            }))}
            onClearFilter={(group) => changeState(clearAppsDiscoveryFacet(
              state,
              group as AppsFacet['group'],
            ))}
          />
        </div>
      )}
      showResultMeta={false}
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
      guestLimitReached={isGuest && controller.items.length >= PUBLIC_APPS_CATALOG_LIMIT}
      onGuestLimitReached={onGuestLimitReached}
      sentinelRef={reviewItemLimit === undefined ? controller.sentinelRef : undefined}
      beforeResults={beforeGrid}
    >
      <AnimatePresence
        initial={false}
        mode="popLayout"
        custom={resultsTransitionDirection}
      >
        {appsMode ? (
          <motion.div
            key={`apps-results:${controller.state.platform}`}
            data-apps-discovery-grid="true"
            data-apps-results-mode="apps"
            data-apps-results-transition-direction={resultsTransitionDirection}
            className="reference-discovery__grid apps-discovery__grid apps-discovery__results-transition"
            custom={resultsTransitionDirection}
            variants={appsResultsMotionVariants}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            exit={prefersReducedMotion ? { opacity: 0 } : 'exit'}
            transition={resultsMotionTransition}
          >
            {renderedApps.map((app, index) => (
              <motion.div
                key={app.id}
                className="apps-discovery__motion-card"
                {...resultCardMotion(index)}
              >
                <AppCard
                  app={app}
                  platform={controller.state.platform}
                  onOpen={() => onOpenApp(app.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`screen-results:${controller.state.platform}`}
            data-apps-discovery-screen-grid="true"
            data-apps-results-mode="screens"
            data-apps-results-transition-direction={resultsTransitionDirection}
            className="apps-discovery__screen-grid apps-discovery__results-transition"
            custom={resultsTransitionDirection}
            variants={appsResultsMotionVariants}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            exit={prefersReducedMotion ? { opacity: 0 } : 'exit'}
            transition={resultsMotionTransition}
          >
            {renderedScreens.map((result, index) => (
              <motion.div
                key={`${result.app.id}:${result.screen.id}`}
                className="apps-discovery__motion-card"
                {...resultCardMotion(index)}
              >
                <AppsDiscoveryScreenCard
                  result={result}
                  onOpen={() => onOpenApp(result.app.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </DiscoveryPageLayout>
  );
}

export function AppsDiscoveryPage({
  isAdmin,
  initialPlatform = 'web',
  facet = null,
  query = '',
  onFacetChange,
  isGuest = false,
  onGuestLimitReached,
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
    isGuest,
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
      isGuest={isGuest}
      onGuestLimitReached={onGuestLimitReached}
    />
  );
}
