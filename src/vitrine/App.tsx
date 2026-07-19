import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell, Button, DropdownMenu, EmptyState, Skeleton, Spinner } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { AppCard } from './components/AppCard';
import { ProgressBanner } from './components/ProgressBanner';
import { ScreenDetail } from './components/ScreenDetail';
import { CommandPalette } from './components/CommandPalette';
import { SearchTrigger } from './components/SearchTrigger';
import { SearchResults } from './components/SearchResults';
import { CollectionsPanel } from './components/CollectionsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ImportDialog, appRow, knownPlatformsFor } from './components/ImportDialog';
import { PageHeader } from './components/PageHeader';
import { Sidebar } from './components/Sidebar';
import { UnlockModal } from './components/UnlockModal';
import { UsersPage } from './components/UsersPage';
import { ResearchProjectsPage } from './components/ResearchProjectsPage';
import { ResearchProjectPage } from './components/ResearchProjectPage';
import { useApps } from './useApps';
import { useAppDetail } from './useAppDetail';
import { submitImportJob } from './jobsApi';
import { listCollections, searchCatalog, type SearchFilters } from './researchApi';
import { navigate, useRoute } from './router';
import type { CatalogSearchResult } from '../catalogResearch';
import type { ResearchCollection } from '../db';

function AppCardSkeleton({ index }: { index: number }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <Skeleton width="100%" height="100%" radius="none" index={index} />
      <div style={{ position: 'absolute', left: 10, bottom: 10 }}>
        <Skeleton width={130} height={26} radius="rounded" index={index} />
      </div>
    </div>
  );
}

export function App() {
  const { user, logout } = useAuth();
  const route = useRoute();
  const isAdmin = user?.role === 'admin';
  const [importOpen, setImportOpen] = useState(false);
  const [cat, setCat] = useState('All');
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
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [entitlements, setEntitlements] = useState<{ plan: 'free' | 'pro'; freeUnlocks: string[]; freeUnlocksRemaining: number } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const appsSentinelRef = useRef<HTMLDivElement>(null);
  const researchProjectsEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RESEARCH_PROJECTS_ENABLED === 'true';

  const isFreeGated = (appId: string) =>
    user?.role !== 'admin' && entitlements?.plan === 'free' && !entitlements.freeUnlocks.includes(appId);
  const detailGateLoading = route.name === 'app' && !isAdmin && entitlements === null;
  const detailLocked = route.name === 'app' && isFreeGated(route.appId);
  const { apps, loading: appsLoading, loadingMore, hasMore, error: appsError, loadMore } = useApps(user?.role, route.name === 'apps');
  const { detail, loading: detailLoading, error: detailError } = useAppDetail(
    route.name === 'app' ? route.appId : undefined,
    route.name === 'app' && !detailGateLoading && !detailLocked,
  );

  useEffect(() => {
    void listCollections().then(setCollections).catch(() => setCollections([]));
    void fetch('/api/billing/subscription').then((response) => response.ok ? response.json() : null).then(setEntitlements).catch(() => setEntitlements(null));
  }, []);

  useEffect(() => {
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
  }, [q, filters, searchRetry]);

  useEffect(() => {
    if (!isAdmin || route.name === 'app' || !hasMore || loadingMore) return;
    const sentinel = appsSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isAdmin, loadMore, loadingMore, route.name]);

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
  const accountControls = (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      <DropdownMenu
        button={{ label: user?.email ?? '', size: 'sm', variant: 'ghost' }}
        hasChevron
        items={[
          ...(researchProjectsEnabled ? [{ label: 'Research projects', onClick: () => navigate({ name: 'projects' }) }] : []),
          { label: `Collections${collections.length ? ` (${collections.length})` : ''}`, onClick: () => setCollectionsOpen(true) },
          { label: 'Settings', onClick: () => setSettingsOpen(true) },
          { type: 'divider' },
          { label: 'Log out', onClick: logout },
        ]}
      />
    </div>
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
            collectionsCount={collections.length}
            onOpenCollections={() => setCollectionsOpen(true)}
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

  if (researchProjectsEnabled && route.name === 'projects') {
    return frame(<ResearchProjectsPage />);
  }
  if (researchProjectsEnabled && route.name === 'project') {
    return frame(<ResearchProjectPage projectId={route.projectId} />);
  }

  if ((route.name === 'app' && (detailGateLoading || detailLoading)) || (route.name === 'apps' && appsLoading)) {
    return frame(
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px' }}>
        {isAdmin && <PageHeader title="Apps" description="Browse captured screens, UI elements, and flows across every imported app." />}
        <div style={{ padding: '22px 0 14px' }}>
          <Skeleton width={isAdmin ? 420 : 260} height={38} radius={2} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
          {Array.from({ length: 9 }, (_, i) => <AppCardSkeleton key={i} index={i} />)}
        </div>
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

  if (route.name === 'apps' && (appsError || !apps || apps.length === 0)) {
    return frame(
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 28px 0', width: '100%' }}>
          {!isAdmin && accountControls}
          {isAdmin && <ProgressBanner />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
          <EmptyState
            title={appsError ? 'Could not load crawled screens' : 'No screens crawled yet'}
            description={
              appsError
                ? `The catalog could not be loaded: ${appsError}`
                : isAdmin
                  ? 'Import captured web screens to build the first observed design system.'
                  : 'No curated web apps have been published yet.'
            }
          />
        </div>
      </div>,
    );
  }

  const rows = (apps ?? []).map(appRow);
  const query = q.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      (cat === 'All' || r.cat === cat) &&
      (!query || `${r.name} ${r.cat} ${r.app?.screens.map((s) => s.type).join(' ') ?? ''}`.toLowerCase().includes(query)),
  );
  const detailApp = route.name === 'app' && !isFreeGated(route.appId) ? detail?.app : undefined;

  return frame(
    <>
    <AnimatePresence mode="wait">
      {detailApp ? (
        <ScreenDetail
          key={`detail-${detailApp.id}`}
          app={detailApp}
          role={user?.role ?? 'user'}
          initialSection={route.name === 'app' ? route.section : undefined}
          onSectionChange={(section) => navigate({ name: 'app', appId: detailApp.id, section })}
          onBack={() => navigate({ name: 'apps' })}
          collections={collections}
          onCollectionsChange={setCollections}
        />
      ) : (
        <motion.div
          key="gallery"
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px' }}
        >
          {isAdmin && (
            <PageHeader
              title="Apps"
              description="Browse captured screens, UI elements, and flows across every imported app."
              action={<Button variant="primary" label="Import from URL" clickAction={() => setImportOpen(true)} />}
            />
          )}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'color-mix(in srgb, var(--color-background-body) 92%, transparent)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid var(--color-border)',
              padding: '22px 28px 14px',
              margin: '0 -28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {!isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: '#FFFFFF' }} />
                  </div>
                  <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>Vitrine</span>
                </div>
              )}
              <SearchTrigger
                label={q.trim() || cat !== 'All' ? `${list.length} apps · search or filter…` : 'Search apps, screens, UI elements, flows…'}
                activeCategory={cat}
                onOpen={() => setPaletteOpen(true)}
                onClearCategory={() => setCat('All')}
              />
              {!isAdmin && accountControls}
            </div>
          </div>

          {isAdmin && <ProgressBanner />}

          {searchError && <div role="alert" style={{ margin: '10px 0', color: 'var(--color-text-danger)' }}>{searchError}</div>}
          {q.trim() && searchResult && (
            <SearchResults
              result={searchResult}
              filters={filters}
              onFiltersChange={setFilters}
              onOpen={(appId) => void openApp(appId)}
              collections={collections}
              onCollectionsChange={setCollections}
            />
          )}

          <div style={{ padding: '6px 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{list.length} apps</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
            {list.map((r) => (
              <AppCard
                key={r.slug}
                app={r.app!}
                onOpen={() => void openApp(r.slug)}
                status={isAdmin ? r.status : undefined}
                progressLabel={`${r.analyzed}/${r.captured} analyzed`}
              />
            ))}
          </div>
          {isAdmin && hasMore && <div ref={appsSentinelRef} aria-hidden="true" style={{ height: 1 }} />}
          {isAdmin && loadingMore && (
            <div role="status" aria-label="Loading" style={{ display: 'flex', justifyContent: 'center', padding: '0 0 40px' }}>
              <Spinner size="sm" aria-hidden="true" />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {collectionsOpen && <CollectionsPanel collections={collections} onChange={setCollections} onClose={() => setCollectionsOpen(false)} onOpenApp={(appId) => void openApp(appId)} />}
      {settingsOpen && user && <SettingsPanel user={user} onClose={() => setSettingsOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          apps={apps}
          query={q}
          result={searchResult}
          searchLoading={searchLoading}
          searchError={searchError}
          collections={collections}
          onCollectionsChange={setCollections}
          onQueryChange={setQ}
          onRetrySearch={() => setSearchRetry((value) => value + 1)}
          onClose={() => setPaletteOpen(false)}
          onSelectApp={(appId) => void openApp(appId)}
          onSelectScreen={(appId) => navigate({ name: 'app', appId, section: 'screens' })}
          onSelectFlow={(appId) => navigate({ name: 'app', appId, section: 'flows' })}
          onSelectCategory={setCat}
        />
      )}
    </AnimatePresence>
    {isAdmin && (
      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        submitImport={submitImportJob}
        knownPlatforms={knownPlatformsFor(apps ?? [])}
      />
    )}
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
