import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Button, DropdownMenu, EmptyState, Spinner } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { ProgressBanner } from './components/ProgressBanner';
import { CommandPalette } from './components/CommandPalette';
import { SearchResults } from './components/SearchResults';
import { CollectionsPanel } from './components/CollectionsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ImportDialog } from './components/ImportDialog';
import { UnlockModal } from './components/UnlockModal';
import { AdvancedSearchPreview } from './components/AdvancedSearchPreview.tsx';
import { QuickSearch, quickSearchHandoff } from './components/QuickSearch.tsx';
import { GuestCatalogControls } from './components/GuestCatalogControls.tsx';
import { LoginDialog } from './components/LoginDialog.tsx';
import { AppDetailLoadingPage } from './components/AppDetailLoadingPage.tsx';
import { ApplicationSurface } from './components/ApplicationSurface.tsx';
import type { AppsFacet } from './appsDiscovery.ts';
import { useApps } from './useApps';
import { useAppDetail } from './useAppDetail';
import { useCollections } from './useCollections';
import { submitUrlImport } from './jobsApi';
import { searchCatalog, type SearchFilters as LegacySearchFilters } from './researchApi';
import { navigate, updateLocation, useRoute } from './router';
import { loadSubscription, type SubscriptionView } from './billingApi';
import type { CatalogSearchResult } from '../catalogResearch';
import type { SearchResultItem } from '../searchTypes.ts';
import type { SearchFilters as AdvancedSearchFilters, SearchScope } from '../searchTypes.ts';
import { defaultSearchState, readRecentSearches } from './searchState.ts';
import { createSearchSession } from './searchSession.ts';
import { activeFilterCount } from '../searchScope.ts';

const AppsDiscoveryPage = lazy(() => import('./components/AppsDiscoveryPage.tsx').then((module) => ({ default: module.AppsDiscoveryPage })));
const ScreenDetail = lazy(() => import('./components/ScreenDetail').then((module) => ({ default: module.ScreenDetail })));
const ResearchProjectsPage = lazy(() => import('./components/ResearchProjectsPage').then((module) => ({ default: module.ResearchProjectsPage })));
const ResearchProjectPage = lazy(() => import('./components/ResearchProjectPage').then((module) => ({ default: module.ResearchProjectPage })));
const SitesPage = lazy(() => import('./components/SitesPage').then((module) => ({ default: module.SitesPage })));
const SiteVersionPage = lazy(() => import('./components/SiteVersionPage').then((module) => ({ default: module.SiteVersionPage })));
const FeatureDocumentPage = lazy(() => import('./components/FeatureDocumentPage.tsx').then((module) => ({ default: module.FeatureDocumentPage })));
const AdvancedSearchPage = lazy(() => import('./components/AdvancedSearchPage.tsx').then((module) => ({ default: module.AdvancedSearchPage })));

export function App() {
  const { user, authenticate, register, completeLogin, logout } = useAuth();
  const isGuest = user === null;
  const route = useRoute();
  const isAdmin = user?.role === 'admin';
  const [importOpen, setImportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [appFacet, setAppFacet] = useState<AppsFacet | null>(null);
  const [siteQuery, setSiteQuery] = useState('');
  // Seed the search from a query handed off by the marketing landing (Home) across sign-in.
  const [q, setQ] = useState(() => {
    const seed = sessionStorage.getItem('astryx:q') ?? sessionStorage.getItem('vitrine:q');
    if (seed) { sessionStorage.removeItem('astryx:q'); sessionStorage.removeItem('vitrine:q'); }
    return seed ?? '';
  });
  const [filters, setFilters] = useState<LegacySearchFilters>({ kind: 'all' });
  const [searchResult, setSearchResult] = useState<CatalogSearchResult | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const { collections, loaded: collectionsLoaded, ensureCollections, setCollections } = useCollections();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchSession] = useState(() => createSearchSession({
    ...defaultSearchState,
    query: q,
  }));
  const searchSnapshot = useSyncExternalStore(
    searchSession.subscribe,
    searchSession.snapshot,
    searchSession.snapshot,
  );
  const [advancedPreview, setAdvancedPreview] = useState<SearchResultItem | null>(null);
  const [comparison, setComparison] = useState<SearchResultItem[]>([]);
  const [entitlements, setEntitlements] = useState<SubscriptionView | null>(null);
  const [entitlementsResolved, setEntitlementsResolved] = useState(isAdmin);
  const [entitlementsError, setEntitlementsError] = useState('');
  const [entitlementsRevision, setEntitlementsRevision] = useState(0);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const appsSentinelRef = useRef<HTMLDivElement>(null);
  const researchProjectsEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RESEARCH_PROJECTS_ENABLED === 'true';
  const advancedSearchEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_ADVANCED_SEARCH_ENABLED === 'true';
  const customerPlan: 'free' | 'pro' = isAdmin ? 'pro' : entitlements?.plan ?? 'free';
  const canUseProResearch = isAdmin || customerPlan === 'pro';
  const canUseAdvancedSearch = advancedSearchEnabled && user !== null;
  const openPricing = () => navigate({ name: 'pricing' });
  const paletteCollections = isGuest ? [] : collections;
  const palettePlan = isGuest ? 'free' : customerPlan;
  const paletteUpgrade = isGuest ? () => setLoginOpen(true) : openPricing;
  const closeSettings = () => {
    setSettingsOpen(false);
    if (route.name === 'settings-billing') navigate({ name: 'apps' });
  };

  const isFreeGated = (appId: string) =>
    user?.role !== 'admin' && entitlements?.plan === 'free' && !entitlements.freeUnlocks.includes(appId);
  const detailGateLoading = route.name === 'app' && !entitlementsResolved;
  const detailLocked = route.name === 'app' && isFreeGated(route.appId);
  const {
    apps,
    totalApps,
    loading: appsLoading,
    loadingMore,
    hasMore,
    error: appsError,
    loadMoreError,
    refresh: refreshApps,
    loadMore,
  } = useApps(user?.role, route.name === 'apps');
  const { detail, loading: detailLoading, error: detailError } = useAppDetail(
    route.name === 'app' ? route.appId : undefined,
    route.name === 'app' && !detailGateLoading && !entitlementsError && !detailLocked,
  );

  useEffect(() => {
    if (user?.role !== 'user') {
      setEntitlements(null);
      setEntitlementsResolved(true);
      setEntitlementsError('');
      return;
    }
    setEntitlementsResolved(false);
    setEntitlementsError('');
    void loadSubscription()
      .then(setEntitlements)
      .catch((reason: Error) => { setEntitlements(null); setEntitlementsError(reason.message); })
      .finally(() => setEntitlementsResolved(true));
  }, [entitlementsRevision, user?.id, user?.role]);

  const retryEntitlements = () => setEntitlementsRevision((value) => value + 1);

  const openCollections = async () => {
    await ensureCollections().catch(() => []);
    setCollectionsOpen(true);
  };

  const openPalette = async (
    scope: SearchScope,
    seed: Partial<AdvancedSearchFilters> = {},
  ) => {
    if (user) await ensureCollections().catch(() => []);
    searchSession.open(scope, seed);
  };

  const closeDiscoveryOverlays = () => {
    setCollectionsOpen(false);
    setSettingsOpen(false);
    setLoginOpen(false);
    setImportOpen(false);
    setAdvancedPreview(null);
    searchSession.close();
  };

  useEffect(() => {
    if (advancedSearchEnabled) {
      setSearchResult(null);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    if (!canUseProResearch) {
      setSearchResult(null);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    if (!q.trim()) {
      setSearchResult(null);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      searchCatalog(q, filters, controller.signal)
        .then((result) => { setSearchResult(result); setSearchError(''); })
        .catch((error: Error) => { if (error.name !== 'AbortError') setSearchError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [advancedSearchEnabled, canUseProResearch, q, filters, searchRetry]);

  useEffect(() => {
    if (route.name === 'app' || !hasMore || loadingMore) return;
    const sentinel = appsSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: '900px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, route.name]);

  const openApp = async (appId: string) => {
    closeDiscoveryOverlays();
    if (isFreeGated(appId)) {
      setUnlockTarget(appId);
      return;
    }
    navigate({ name: 'app', appId });
    setUnlockTarget(null);
  };

  const confirmUnlock = async () => {
    if (!unlockTarget || !entitlements) return;
    const response = await fetch(`/api/apps/${unlockTarget}/unlock`, { method: 'POST' });
    if (!response.ok) return;
    const result = await response.json() as { remaining: number };
    setEntitlements({ ...entitlements, freeUnlocks: [...entitlements.freeUnlocks, unlockTarget], freeUnlocksRemaining: result.remaining });
    const appId = unlockTarget;
    closeDiscoveryOverlays();
    setUnlockTarget(null);
    navigate({ name: 'app', appId });
  };

  // Landing straight on a locked app URL skips the catalog click handler.
  useEffect(() => {
    if (route.name === 'app' && isFreeGated(route.appId)) setUnlockTarget(route.appId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name, route.name === 'app' ? route.appId : undefined, entitlements]);
  const accountControls = user ? (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      <DropdownMenu
        button={{ label: user.email, size: 'sm', variant: 'ghost' }}
        hasChevron
        items={[
          ...(researchProjectsEnabled ? [{ label: 'Research projects', onClick: () => navigate({ name: 'projects' }) }] : []),
          { label: `Collections${collectionsLoaded && collections.length ? ` (${collections.length})` : ''}`, onClick: () => void openCollections() },
          { label: 'Settings', onClick: () => setSettingsOpen(true) },
          { type: 'divider' },
          { label: 'Log out', onClick: logout },
        ]}
      />
    </div>
  ) : (
    <GuestCatalogControls onLogin={() => setLoginOpen(true)} />
  );
  const catalogLoginDialog = isGuest ? (
    <LoginDialog
      isOpen={loginOpen}
      onClose={() => setLoginOpen(false)}
      authenticate={authenticate}
      register={register}
      onSignedIn={completeLogin}
    />
  ) : null;

  const discoveryOverlays = (
    <AnimatePresence>
      {user && collectionsOpen && <CollectionsPanel collections={collections} plan={customerPlan} onUpgrade={openPricing} onChange={setCollections} onClose={() => setCollectionsOpen(false)} onOpenApp={(appId) => void openApp(appId)} />}
      {(settingsOpen || route.name === 'settings-billing') && user && <SettingsPanel user={user} subscription={entitlements} onUpgrade={() => { setSettingsOpen(false); navigate({ name: 'pricing' }); }} onEntitlementsChanged={retryEntitlements} onClose={closeSettings} />}
      {searchSnapshot.open && (
        canUseAdvancedSearch ? (
          <QuickSearch
            state={searchSnapshot.state}
            recent={typeof window === 'undefined' ? [] : readRecentSearches(window.localStorage)}
            onStateChange={searchSession.update}
            onClose={searchSession.close}
            onPreview={(item) => {
              searchSession.close();
              setAdvancedPreview(item);
            }}
            onViewAll={(state) => {
              const handoff = quickSearchHandoff(state);
              searchSession.close();
              updateLocation(`/search${handoff.search ? `?${handoff.search}` : ''}`);
            }}
          />
        ) : (
          <CommandPalette
            apps={apps ?? []}
            query={q}
            result={searchResult}
            searchLoading={searchLoading}
            searchError={searchError}
            collections={paletteCollections}
            plan={palettePlan}
            publicBrowse={isGuest}
            onUpgrade={paletteUpgrade}
            onCollectionsChange={user ? setCollections : () => undefined}
            onQueryChange={setQ}
            onRetrySearch={() => setSearchRetry((value) => value + 1)}
            onClose={searchSession.close}
            onSelectApp={(appId) => void openApp(appId)}
            onSelectScreen={(appId) => {
              closeDiscoveryOverlays();
              navigate({ name: 'app', appId, section: 'screens' });
            }}
            onSelectFlow={(appId) => {
              closeDiscoveryOverlays();
              navigate({ name: 'app', appId, section: 'flows' });
            }}
            onSelectCategory={(value) => setAppFacet(
              value === 'All' ? null : { group: 'categories', value },
            )}
          />
        )
      )}
      {canUseAdvancedSearch && advancedPreview ? (
        <AdvancedSearchPreview
          item={advancedPreview}
          onClose={() => setAdvancedPreview(null)}
          collections={collections}
          onCollectionsChange={setCollections}
          plan={customerPlan}
          comparison={comparison}
          onComparisonChange={setComparison}
        />
      ) : null}
    </AnimatePresence>
  );

  let page: ReactNode;

  switch (route.name) {
    case 'sites':
      page = (
        <SitesPage
          isAdmin={isAdmin}
          query={siteQuery}
          onQueryChange={setSiteQuery}
          onOpenSearch={(seed) => void openPalette('sites', seed)}
          searchMode={canUseAdvancedSearch ? 'advanced' : 'legacy'}
          activeFilterCount={activeFilterCount(searchSnapshot.state.filters)}
          memberControls={accountControls}
        />
      );
      break;
    case 'site-version':
      page = (
        <SiteVersionPage
          siteId={route.siteId}
          versionId={route.versionId}
          isAdmin={isAdmin}
          query={siteQuery}
          onQueryChange={setSiteQuery}
          accountControls={accountControls}
          initialSection={route.section}
          onSectionChange={(section) => navigate({
            name: 'site-version',
            siteId: route.siteId,
            versionId: route.versionId,
            section,
          })}
        />
      );
      break;
    case 'projects':
      page = researchProjectsEnabled
        ? <ResearchProjectsPage />
        : <ApplicationStatusPage title="Research projects are unavailable" />;
      break;
    case 'project':
      page = researchProjectsEnabled
        ? <ResearchProjectPage projectId={route.projectId} />
        : <ApplicationStatusPage title="Research projects are unavailable" />;
      break;
    case 'feature-document':
      page = <FeatureDocumentPage documentId={route.documentId} />;
      break;
    case 'search':
      page = advancedSearchEnabled ? (
        <AdvancedSearchPage
          onPreview={setAdvancedPreview}
          comparison={comparison}
          onComparisonChange={setComparison}
        />
      ) : <ApplicationStatusPage title="Search is unavailable" />;
      break;
    case 'app':
      if (detailGateLoading || detailLoading) {
        page = (
          <AppDetailLoadingPage
            isAdmin={isAdmin}
            accountControls={accountControls}
            onOpenSearch={() => void openPalette('apps')}
            onImport={() => setImportOpen(true)}
          />
        );
      } else if (entitlementsError) {
        page = (
          <ApplicationStatusPage
            title="Could not load account access"
            description={entitlementsError}
            role="alert"
            actions={<Button label="Retry" variant="primary" clickAction={retryEntitlements} />}
          />
        );
      } else if (detailLocked) {
        page = <div data-app-detail-locked="true" style={{ minHeight: '100vh' }} />;
      } else if (detailError || !detail) {
        page = (
          <ApplicationStatusPage
            title="Could not load app details"
            description={detailError ? `The app could not be loaded: ${detailError}` : 'No app detail data was returned.'}
          />
        );
      } else {
        page = (
          <AnimatePresence mode="wait">
            <ScreenDetail
              key={`detail-${detail.id}`}
              app={detail}
              role={user?.role ?? 'user'}
              initialSection={route.section}
              initialPlatform={route.platform}
              initialVersion={route.version}
              initialEvidence={route.evidence}
              initialFlow={route.flow}
              initialStep={route.step}
              initialFlowView={route.flowView}
              onSectionChange={(section, platform, version) => navigate({
                name: 'app',
                appId: detail.id,
                section,
                platform,
                version,
              })}
              onFlowChange={(flow, step, flowView, platform, version) => navigate({
                name: 'app',
                appId: detail.id,
                section: 'flows',
                platform,
                version,
                ...(flow ? { flow } : {}),
                ...(step ? { step } : {}),
                ...(flowView ? { flowView } : {}),
              })}
              onBack={() => navigate({ name: 'apps' })}
              accountControls={accountControls}
              onOpenSearch={() => void openPalette('apps')}
              onImport={() => setImportOpen(true)}
              collections={collections}
              onCollectionsChange={setCollections}
            />
          </AnimatePresence>
        );
      }
      break;
    case 'apps':
      page = (
        <AppsDiscoveryPage
          apps={appsLoading ? null : apps}
          isAdmin={isAdmin}
          query={q}
          facet={appFacet}
          onFacetChange={setAppFacet}
          onOpenSearch={(seed) => void openPalette('apps', seed)}
          searchMode={canUseAdvancedSearch ? 'advanced' : 'legacy'}
          activeFilterCount={activeFilterCount(searchSnapshot.state.filters)}
          onImport={() => setImportOpen(true)}
          onOpenApp={(appId) => void openApp(appId)}
          onRetry={() => void refreshApps()}
          totalApps={totalApps}
          error={appsError}
          loadMoreError={loadMoreError}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onRetryLoadMore={() => void loadMore()}
          sentinelRef={appsSentinelRef}
          accountControls={accountControls}
          beforeGrid={(
            <>
              {isAdmin ? <ProgressBanner /> : null}
              {searchError
                ? <div role="alert" className="apps-discovery__search-error">{searchError}</div>
                : null}
              {q.trim() && searchResult ? (
                <SearchResults
                  result={searchResult}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onOpen={(appId) => void openApp(appId)}
                  collections={collections}
                  onCollectionsChange={setCollections}
                />
              ) : null}
            </>
          )}
        />
      );
      break;
    case 'settings-billing':
      page = <div data-settings-backdrop="true" className="vitrine-page" style={{ minHeight: '100vh' }} />;
      break;
    case 'admin':
    case 'landing':
    case 'not-found':
    case 'build-in-public':
    case 'pricing':
    case 'billing-success':
    case 'signin':
    case 'feature-document-share':
      page = <ApplicationStatusPage title="This page is outside the application" />;
      break;
    default:
      page = assertNeverRoute(route);
  }

  const dialogs = (
    <>
      {catalogLoginDialog}
      {isAdmin && importOpen ? (
        <ImportDialog
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          submitImport={submitUrlImport}
        />
      ) : null}
      {unlockTarget && entitlements ? (
        <UnlockModal
          appId={unlockTarget}
          remaining={entitlements.freeUnlocksRemaining}
          onConfirm={confirmUnlock}
          onClose={() => {
            setUnlockTarget(null);
            if (route.name === 'app' && detailLocked) navigate({ name: 'apps' });
          }}
          onUpgrade={() => { setUnlockTarget(null); navigate({ name: 'pricing' }); }}
        />
      ) : null}
    </>
  );

  return (
    <ApplicationSurface
      page={<Suspense fallback={<ApplicationPageSpinner />}>{page}</Suspense>}
      overlays={discoveryOverlays}
      dialogs={dialogs}
    />
  );
}

function ApplicationPageSpinner() {
  return (
    <main
      className="vitrine-page"
      style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}
      role="status"
      aria-label="Loading page"
    >
      <Spinner size="lg" />
    </main>
  );
}

function ApplicationStatusPage({
  title,
  description,
  actions,
  role,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <main
      className="vitrine-page"
      style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}
      role={role}
    >
      <EmptyState title={title} description={description} actions={actions} />
    </main>
  );
}

function assertNeverRoute(value: never): never {
  throw new Error(`Unhandled application route: ${JSON.stringify(value)}`);
}
