import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, DropdownMenu, EmptyState, Spinner } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { AppCard } from './components/AppCard';
import { ImportingAppCard } from './components/ImportingAppCard';
import { ProgressBanner } from './components/ProgressBanner';
import { ScreenDetail } from './components/ScreenDetail';
import { CommandPalette } from './components/CommandPalette';
import { SearchTrigger } from './components/SearchTrigger';
import { SearchResults } from './components/SearchResults';
import { CollectionsPanel } from './components/CollectionsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ImportDialog, buildPipelineRows, knownPlatformsFor } from './components/ImportDialog';
import { PageHeader } from './components/PageHeader';
import { Sidebar } from './components/Sidebar';
import { UnlockModal } from './components/UnlockModal';
import { useApps } from './useApps';
import { useJobs } from './useJobs';
import { listCollections, searchCatalog, type SearchFilters } from './researchApi';
import { navigate, useRoute } from './router';
import type { CatalogSearchResult } from '../catalogResearch';
import type { ResearchCollection } from '../db';

export function App() {
  const { user, logout } = useAuth();
  const { apps, loading, error, refresh } = useApps(user?.role);
  const isAdmin = user?.role === 'admin';
  const { jobs, submitImport } = useJobs();
  const [importOpen, setImportOpen] = useState(false);
  const route = useRoute();
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
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [entitlements, setEntitlements] = useState<{ plan: 'free' | 'pro'; freeUnlocks: string[]; freeUnlocksRemaining: number } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const seenSynthesized = useRef<Set<number>>(new Set());

  // Refresh the app list when a synthesize completes (new captured/analyzed screens landed).
  useEffect(() => {
    let fresh = false;
    for (const job of jobs) {
      if (job.type === 'synthesize-app' && job.status === 'done' && !seenSynthesized.current.has(job.id)) { seenSynthesized.current.add(job.id); fresh = true; }
    }
    if (fresh) void refresh();
  }, [jobs, refresh]);

  useEffect(() => {
    void listCollections().then(setCollections).catch(() => setCollections([]));
    void fetch('/api/billing/subscription').then((response) => response.ok ? response.json() : null).then(setEntitlements).catch(() => setEntitlements(null));
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setSearchResult(null);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchCatalog(q, filters, controller.signal)
        .then((result) => { setSearchResult(result); setSearchError(''); })
        .catch((error: Error) => { if (error.name !== 'AbortError') setSearchError(error.message); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [q, filters]);

  // Free accounts only get full access to apps they've spent an unlock on; a shared
  // deep link into an app must honor the same gate, not just the catalog card click.
  const isFreeGated = (appId: string) =>
    user?.role !== 'admin' && entitlements?.plan === 'free' && !entitlements.freeUnlocks.includes(appId);
  const openApp = async (appId: string) => {
    if (isFreeGated(appId)) {
      setUnlockTarget(appId);
      return;
    }
    if (apps?.some(({ id }) => id === appId)) navigate({ name: 'app', appId });
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
    if (apps?.some(({ id }) => id === appId)) navigate({ name: 'app', appId });
    setCollectionsOpen(false);
  };

  // Landing straight on an app's URL (a shared link, a refresh) skips the click handler
  // above, so re-run the same unlock gate here once apps/entitlements are loaded.
  useEffect(() => {
    if (route.name !== 'app' || !apps) return;
    if (apps.some(({ id }) => id === route.appId) && isFreeGated(route.appId)) void openApp(route.appId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name, route.name === 'app' ? route.appId : undefined, apps, entitlements]);
  const accountControls = (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      <DropdownMenu
        button={{ label: user?.email ?? '', size: 'sm', variant: 'ghost' }}
        hasChevron
        items={[
          { label: `Collections${collections.length ? ` (${collections.length})` : ''}`, onClick: () => setCollectionsOpen(true) },
          { label: 'Settings', onClick: () => setSettingsOpen(true) },
          { type: 'divider' },
          { label: 'Log out', onClick: logout },
        ]}
      />
    </div>
  );

  // Admins get a left sidebar to jump between screens without typing URLs.
  const frame = (node: ReactNode) =>
    isAdmin ? (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          email={user?.email ?? ''}
          collectionsCount={collections.length}
          onOpenCollections={() => setCollectionsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={logout}
        />
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>{node}</div>
      </div>
    ) : node;

  if (loading) {
    return frame(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>,
    );
  }

  if (error || !apps || apps.length === 0) {
    return frame(
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 28px 0', width: '100%' }}>
          {!isAdmin && accountControls}
          {isAdmin && <ProgressBanner />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
          <EmptyState
            title={error ? 'Could not load crawled screens' : 'No screens crawled yet'}
            description={
              error
                ? `The catalog could not be loaded: ${error}`
                : isAdmin
                  ? 'Import captured web screens to build the first observed design system.'
                  : 'No curated web apps have been published yet.'
            }
          />
        </div>
      </div>,
    );
  }

  const rows = buildPipelineRows(apps, jobs);
  const query = q.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      (cat === 'All' || r.cat === cat) &&
      (!query || `${r.name} ${r.cat} ${r.app?.screens.map((s) => s.type).join(' ') ?? ''}`.toLowerCase().includes(query)),
  );
  const detailApp = route.name === 'app' && !isFreeGated(route.appId) ? apps.find((a) => a.id === route.appId) : undefined;

  return frame(
    <>
    <AnimatePresence mode="wait">
      {detailApp ? (
        <ScreenDetail
          key="detail"
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
              padding: '22px 0 14px',
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
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--color-background-surface)' }} />
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
            {list.map((r) =>
              r.app ? (
                <AppCard
                  key={r.slug}
                  app={r.app}
                  onOpen={() => void openApp(r.slug)}
                  status={isAdmin ? r.status : undefined}
                  progressLabel={`${r.analyzed}/${r.captured} analyzed`}
                />
              ) : (
                <ImportingAppCard key={r.slug} row={r} />
              ),
            )}
          </div>
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
          onQueryChange={setQ}
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
        submitImport={submitImport}
        knownPlatforms={knownPlatformsFor(apps)}
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
