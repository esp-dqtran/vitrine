import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppShell, Button, DropdownMenu, EmptyState, Skeleton } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { AppsDiscoveryPage } from './components/AppsDiscoveryPage.tsx';
import { ProgressBanner } from './components/ProgressBanner';
import { ScreenDetail } from './components/ScreenDetail';
import { CommandPalette } from './components/CommandPalette';
import { SearchResults } from './components/SearchResults';
import { CollectionsPanel } from './components/CollectionsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ImportDialog } from './components/ImportDialog';
import { PageHeader } from './components/PageHeader';
import { Sidebar } from './components/Sidebar';
import { UnlockModal } from './components/UnlockModal';
import { UsersPage } from './components/UsersPage';
import { ResearchProjectsPage } from './components/ResearchProjectsPage';
import { ResearchProjectPage } from './components/ResearchProjectPage';
import { SitesPage } from './components/SitesPage';
import { SiteVersionPage } from './components/SiteVersionPage';
import { FeatureDocumentPage } from './components/FeatureDocumentPage.tsx';
import { AdvancedSearchPage } from './components/AdvancedSearchPage.tsx';
import { AdvancedSearchPreview } from './components/AdvancedSearchPreview.tsx';
import { QuickSearch, quickSearchHandoff } from './components/QuickSearch.tsx';
import { GalleryCardSkeleton } from './components/GalleryToolbar';
import { GuestCatalogControls } from './components/GuestCatalogControls.tsx';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs';
import type { AppsFacet } from './appsDiscovery.ts';
import { useApps } from './useApps';
import { useAppDetail } from './useAppDetail';
import { useCollections } from './useCollections';
import { submitUrlImport } from './jobsApi';
import { searchCatalog, type SearchFilters } from './researchApi';
import { navigate, useRoute } from './router';
import { loadSubscription, type SubscriptionView } from './billingApi';
import type { CatalogSearchResult } from '../catalogResearch';
import type { SearchResultItem } from '../searchTypes.ts';
import { readRecentSearches } from './searchState.ts';

export function App() {
  const { user, logout } = useAuth();
  const isGuest = user === null;
  const route = useRoute();
  const isAdmin = user?.role === 'admin';
  const [importOpen, setImportOpen] = useState(false);
  const [appFacet, setAppFacet] = useState<AppsFacet | null>(null);
  const [siteQuery, setSiteQuery] = useState('');
  // Seed the search from a query handed off by the marketing landing (Home) across sign-in.
  const [q, setQ] = useState(() => {
    const seed = sessionStorage.getItem('astryx:q') ?? sessionStorage.getItem('vitrine:q');
    if (seed) { sessionStorage.removeItem('astryx:q'); sessionStorage.removeItem('vitrine:q'); }
    return seed ?? '';
  });
  const [filters, setFilters] = useState<SearchFilters>({ kind: 'all' });
  const [searchResult, setSearchResult] = useState<CatalogSearchResult | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const { collections, loaded: collectionsLoaded, ensureCollections, setCollections } = useCollections();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
  const openSignIn = () => navigate({ name: 'signin' });
  const openPricing = () => navigate({ name: 'pricing' });
  const paletteCollections = isGuest ? [] : collections;
  const palettePlan = isGuest ? 'free' : customerPlan;
  const paletteUpgrade = isGuest ? openSignIn : openPricing;
  const closeSettings = () => {
    setSettingsOpen(false);
    if (route.name === 'settings-billing') navigate({ name: 'apps' });
  };

  const isFreeGated = (appId: string) =>
    user?.role !== 'admin' && entitlements?.plan === 'free' && !entitlements.freeUnlocks.includes(appId);
  const detailGateLoading = route.name === 'app' && !entitlementsResolved;
  const detailLocked = route.name === 'app' && isFreeGated(route.appId);
  const { apps, totalApps, loading: appsLoading, loadingMore, hasMore, error: appsError, refresh: refreshApps, loadMore } = useApps(user?.role, route.name === 'apps');
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

  const openPalette = async () => {
    if (user) await ensureCollections().catch(() => []);
    setPaletteOpen(true);
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
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, route.name]);

  const openApp = async (appId: string) => {
    if (isFreeGated(appId)) {
      setUnlockTarget(appId);
      return;
    }
    navigate({ name: 'app', appId });
    setCollectionsOpen(false);
  };

  const confirmUnlock = async () => {
    if (!unlockTarget || !entitlements) return;
    const response = await fetch(`/api/apps/${unlockTarget}/unlock`, { method: 'POST' });
    if (!response.ok) return;
    const result = await response.json() as { remaining: number };
    setEntitlements({ ...entitlements, freeUnlocks: [...entitlements.freeUnlocks, unlockTarget], freeUnlocksRemaining: result.remaining });
    const appId = unlockTarget;
    setUnlockTarget(null);
    navigate({ name: 'app', appId });
    setCollectionsOpen(false);
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
    <GuestCatalogControls onSignIn={openSignIn} />
  );

  // Admins get a left sidebar to jump between screens without typing URLs. AppShell
  // collapses it behind a hamburger + drawer below its md breakpoint automatically —
  // no manual responsive logic needed here.
  const frame = (node: ReactNode) =>
    isAdmin ? (
      <AppShell
        variant="section"
        sideNav={
          <Sidebar
            email={user?.email ?? ''}
            collectionsCount={collectionsLoaded ? collections.length : undefined}
            onOpenCollections={() => void openCollections()}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={logout}
          />
        }
      >
        {node}
      </AppShell>
    ) : node;

  if (route.name === 'admin' && isAdmin) {
    return frame(<UsersPage />);
  }

  if (route.name === 'sites') {
    return frame(
      <SitesPage
        isAdmin={isAdmin}
        query={siteQuery}
        onQueryChange={setSiteQuery}
        memberControls={!isAdmin ? accountControls : undefined}
      />,
    );
  }
  if (route.name === 'site-version') {
    return frame(
      <SiteVersionPage
        siteId={route.siteId}
        versionId={route.versionId}
        isAdmin={isAdmin}
        initialSection={route.section}
        onSectionChange={(section) => navigate({ name: 'site-version', siteId: route.siteId, versionId: route.versionId, section })}
      />,
    );
  }

  if (researchProjectsEnabled && route.name === 'projects') {
    return frame(<ResearchProjectsPage />);
  }
  if (researchProjectsEnabled && route.name === 'project') {
    return frame(<ResearchProjectPage projectId={route.projectId} />);
  }
  if (route.name === 'feature-document') {
    return frame(<FeatureDocumentPage documentId={route.documentId} />);
  }
  if (advancedSearchEnabled && route.name === 'search') {
    return frame(
      <>
        <AdvancedSearchPage
          onPreview={setAdvancedPreview}
          comparison={comparison}
          onComparisonChange={setComparison}
        />
        {advancedPreview ? (
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
      </>,
    );
  }

  if (route.name === 'app' && (detailGateLoading || detailLoading)) {
    return frame(
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px' }}>
        {isAdmin && <PageHeader title="References" description="Browse app and website design references." />}
        <ReferenceTypeTabs active="apps" />
        <div style={{ padding: '22px 0 14px' }}>
          <Skeleton width={isAdmin ? 420 : 260} height={38} radius={2} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
          {Array.from({ length: 9 }, (_, i) => <GalleryCardSkeleton key={i} index={i} />)}
        </div>
      </div>,
    );
  }

  if (route.name === 'app' && entitlementsError) {
    return frame(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }} role="alert">
        <EmptyState
          title="Could not load account access"
          description={entitlementsError}
          actions={<Button label="Retry" variant="primary" clickAction={retryEntitlements} />}
        />
      </div>,
    );
  }

  if (route.name === 'app' && detailLocked) {
    return frame(
      <>
        <div style={{ minHeight: '100vh' }} />
        {unlockTarget && entitlements && (
          <UnlockModal
            appId={unlockTarget}
            remaining={entitlements.freeUnlocksRemaining}
            onConfirm={confirmUnlock}
            onClose={() => { setUnlockTarget(null); navigate({ name: 'apps' }); }}
            onUpgrade={() => { setUnlockTarget(null); navigate({ name: 'pricing' }); }}
          />
        )}
      </>,
    );
  }

  if (route.name === 'app' && (detailError || !detail)) {
    return frame(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <EmptyState
          title="Could not load app details"
          description={detailError ? `The app could not be loaded: ${detailError}` : 'No app detail data was returned.'}
        />
      </div>,
    );
  }

  const discoveryOverlays = (
    <AnimatePresence>
      {user && collectionsOpen && <CollectionsPanel collections={collections} plan={customerPlan} onUpgrade={openPricing} onChange={setCollections} onClose={() => setCollectionsOpen(false)} onOpenApp={(appId) => void openApp(appId)} />}
      {(settingsOpen || route.name === 'settings-billing') && user && <SettingsPanel user={user} subscription={entitlements} onUpgrade={() => { setSettingsOpen(false); navigate({ name: 'pricing' }); }} onEntitlementsChanged={retryEntitlements} onClose={closeSettings} />}
      {paletteOpen && (
        canUseAdvancedSearch ? (
          <QuickSearch
            initialQuery=""
            recent={typeof window === 'undefined' ? [] : readRecentSearches(window.localStorage)}
            onClose={() => setPaletteOpen(false)}
            onPreview={(item) => {
              setPaletteOpen(false);
              setAdvancedPreview(item);
            }}
            onViewAll={(value) => {
              const handoff = quickSearchHandoff(value);
              setPaletteOpen(false);
              window.history.pushState(null, '', `/search${handoff.search ? `?${handoff.search}` : ''}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
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
            onClose={() => setPaletteOpen(false)}
            onSelectApp={(appId) => void openApp(appId)}
            onSelectScreen={(appId) => navigate({ name: 'app', appId, section: 'screens' })}
            onSelectFlow={(appId) => navigate({ name: 'app', appId, section: 'flows' })}
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

  if (route.name === 'apps') {
    return (
      <>
        <AppsDiscoveryPage
          apps={appsLoading ? null : apps}
          isAdmin={isAdmin}
          query={q}
          facet={appFacet}
          onFacetChange={setAppFacet}
          onOpenSearch={() => void openPalette()}
          searchMode={canUseAdvancedSearch ? 'advanced' : 'legacy'}
          onImport={() => setImportOpen(true)}
          onOpenApp={(appId) => void openApp(appId)}
          onRetry={() => void refreshApps()}
          totalApps={totalApps}
          error={appsError}
          hasMore={hasMore}
          loadingMore={loadingMore}
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
        {isAdmin && (
          <ImportDialog
            isOpen={importOpen}
            onClose={() => setImportOpen(false)}
            submitImport={submitUrlImport}
          />
        )}
        {discoveryOverlays}
        {unlockTarget && entitlements && (
          <UnlockModal
            appId={unlockTarget}
            remaining={entitlements.freeUnlocksRemaining}
            onConfirm={confirmUnlock}
            onClose={() => setUnlockTarget(null)}
            onUpgrade={() => { setUnlockTarget(null); navigate({ name: 'pricing' }); }}
          />
        )}
      </>
    );
  }

  const detailApp = route.name === 'app' && !isFreeGated(route.appId) ? detail ?? undefined : undefined;

  return frame(
    <>
    <AnimatePresence mode="wait">
      {detailApp ? (
        <ScreenDetail
          key={`detail-${detailApp.id}`}
          app={detailApp}
          role={user?.role ?? 'user'}
          initialSection={route.name === 'app' ? route.section : undefined}
          initialPlatform={route.name === 'app' ? route.platform : undefined}
          initialVersion={route.name === 'app' ? route.version : undefined}
          initialEvidence={route.name === 'app' ? route.evidence : undefined}
          initialFlow={route.name === 'app' ? route.flow : undefined}
          initialStep={route.name === 'app' ? route.step : undefined}
          onSectionChange={(section, platform, version) => navigate({
            name: 'app',
            appId: detailApp.id,
            section,
            platform,
            version,
          })}
          onBack={() => navigate({ name: 'apps' })}
          collections={collections}
          onCollectionsChange={setCollections}
        />
      ) : null}
    </AnimatePresence>
    {discoveryOverlays}
    {unlockTarget && entitlements && (
      <UnlockModal
        appId={unlockTarget}
        remaining={entitlements.freeUnlocksRemaining}
        onConfirm={confirmUnlock}
        onClose={() => setUnlockTarget(null)}
        onUpgrade={() => { setUnlockTarget(null); navigate({ name: 'pricing' }); }}
      />
    )}
    </>
  );
}
