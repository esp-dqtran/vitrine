import { useMemo, useState, type ReactNode } from 'react';
import type { AppsPlatform } from '../appsDiscovery.ts';
import { PUBLIC_APPS_CATALOG_LIMIT } from '../appsDiscoveryAdapter.ts';
import { useCatalogCategories } from '../categoryFacets.ts';
import { navigate, updateLocation, useLocationKey } from '../router.ts';
import { AppCard } from './AppCard.tsx';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';
import { CatalogBanner, CatalogSection } from './CatalogSection.tsx';
import { useAppsDiscoveryPageController } from './AppsDiscoveryPage.tsx';

const PLATFORMS: { value: AppsPlatform; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

const CATEGORY_LIMIT = 8;

export interface CatalogBrowsePageProps {
  isAdmin: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  isGuest?: boolean;
  onOpenApp: (appId: string) => void;
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

/*
 * The rebuilt catalog browse surface: a persistent sidebar beside a dense grid,
 * rather than the stacked taxonomy the current /apps page uses. It lives on its
 * own route so /apps keeps working untouched while this is evaluated.
 */
export function CatalogBrowsePage({
  isAdmin,
  accountControls,
  onSignIn,
  isGuest = false,
  onOpenApp,
  entitlement,
  onUpgrade,
}: CatalogBrowsePageProps) {
  const locationKey = useLocationKey();
  const search = locationKey.includes('?')
    ? locationKey.slice(locationKey.indexOf('?'))
    : '';
  const controller = useAppsDiscoveryPageController({
    isAdmin,
    locationSearch: search,
    initialPlatform: 'web',
    initialFacet: null,
    initialQuery: '',
    isGuest,
    onNavigate: (nextSearch, mode) => {
      updateLocation(`/browse${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: mode === 'replace',
      });
    },
  });

  const [showAllCategories, setShowAllCategories] = useState(false);
  const selectedCategories = useMemo(
    () => controller.state.filters
      .filter(({ group }) => group === 'categories')
      .map(({ value }) => value),
    [controller.state.filters],
  );
  /* One loader for every rebuilt surface — it already scopes counts by
     platform, query and active filters. */
  const categories = useCatalogCategories(controller.state, isAdmin);

  /* The rows are slices of the same page the grid renders — no extra request
     for a row that is only ever six cards wide. */
  const recent = useMemo(
    () => [...controller.items]
      .sort((a, b) => (b.lastCapturedAt ?? '').localeCompare(a.lastCapturedAt ?? ''))
      .slice(0, 8),
    [controller.items],
  );
  const deepest = useMemo(
    () => [...controller.items]
      .sort((a, b) => (b.totalScreens ?? 0) - (a.totalScreens ?? 0))
      .slice(0, 8),
    [controller.items],
  );
  const latestCapture = recent[0]?.lastCapturedAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(recent[0].lastCapturedAt))
    : null;

  /* A guest is served a bounded slice of the catalog, so the server's total
     would claim more results than the page can actually show. */
  const displayedTotal = controller.totalCount === null
    ? null
    : isGuest
      ? Math.min(controller.totalCount, PUBLIC_APPS_CATALOG_LIMIT)
      : controller.totalCount;

  return (
    <CatalogShell
      activeTab="explore"
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="apps"
          categories={categories}
          selectedCategories={selectedCategories}
          categoryLimit={CATEGORY_LIMIT}
          showAllCategories={showAllCategories}
          onToggleShowAll={() => setShowAllCategories((open) => !open)}
          onSelectCategory={(value) =>
            controller.toggleFilter({ group: 'categories', value })}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'apps') return;
            if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-browse" data-catalog-browse="true">
        {/* The reference leads the content column with a band for everyone —
            only the action below it depends on who is reading. */}
        <CatalogBanner
          eyebrow="Design research"
          title="Every screen, flow and token — captured, not guessed."
          description={displayedTotal !== null
            ? `${displayedTotal} products captured in depth, across iOS, Android and the web.`
            : 'Real products captured in depth, across iOS, Android and the web.'}
          actionLabel={onSignIn ? 'Create a free account' : undefined}
          onAction={onSignIn}
        />

        <div className="catalog-browse__bar">
          <h1 className="catalog-browse__title">Apps</h1>
          <div className="catalog-browse__platforms" role="group" aria-label="Platform">
            {PLATFORMS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`catalog-browse__platform${
                  controller.state.platform === value ? ' is-active' : ''
                }`}
                aria-pressed={controller.state.platform === value}
                onClick={() => controller.setPlatform(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {displayedTotal !== null ? (
            <p className="catalog-browse__count" aria-live="polite">
              {displayedTotal} {displayedTotal === 1 ? 'app' : 'apps'}
            </p>
          ) : null}
        </div>

        {controller.error ? (
          <p className="catalog-browse__state" role="alert">{controller.error}</p>
        ) : controller.loading && controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">Loading apps…</p>
        ) : controller.items.length === 0 ? (
          <p className="catalog-browse__state" role="status">No apps match these filters.</p>
        ) : (
          <>
            <CatalogSection
              title="Recently captured"
              note={latestCapture ?? undefined}
              onViewAll={() => updateLocation('/browse?sort=latest')}
            >
              {recent.map((app) => (
                <div className="catalog-section__item" key={app.id}>
                  <AppCard
                    app={app}
                    platform={controller.state.platform}
                    onOpen={() => onOpenApp(app.id)}
                    href={`/browse/${encodeURIComponent(app.id)}`}
                  />
                </div>
              ))}
            </CatalogSection>

            <CatalogSection title="Deepest coverage" note="by captured screens">
              {deepest.map((app) => (
                <div className="catalog-section__item" key={app.id}>
                  <AppCard
                    app={app}
                    platform={controller.state.platform}
                    onOpen={() => onOpenApp(app.id)}
                    href={`/browse/${encodeURIComponent(app.id)}`}
                  />
                </div>
              ))}
            </CatalogSection>


            <CatalogSection title="All apps" layout="grid">
              {controller.items.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  platform={controller.state.platform}
                  onOpen={() => onOpenApp(app.id)}
                  href={`/browse/${encodeURIComponent(app.id)}`}
                />
              ))}
            </CatalogSection>
          </>
        )}

        <div ref={controller.sentinelRef} aria-hidden="true" />
      </div>
    </CatalogShell>
  );
}
