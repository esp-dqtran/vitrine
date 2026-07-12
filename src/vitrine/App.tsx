import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, EmptyState, Spinner, Text } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { AppCard } from './components/AppCard';
import { ProgressBanner } from './components/ProgressBanner';
import { ScreenDetail } from './components/ScreenDetail';
import { SearchBox } from './components/SearchBox';
import { SearchResults } from './components/SearchResults';
import { ComparisonPanel } from './components/ComparisonPanel';
import { CollectionsPanel } from './components/CollectionsPanel';
import { ImportTrackerPanel } from './components/ImportTrackerPanel';
import { useApps } from './useApps';
import { compareApps, listCollections, searchCatalog, type SearchFilters } from './researchApi';
import type { CatalogComparison, CatalogSearchResult } from '../catalogResearch';
import type { ResearchCollection } from '../db';

export function App() {
  const { user, logout } = useAuth();
  const { apps, loading, error, refresh } = useApps(user?.role);
  const [cat, setCat] = useState('All');
  // Seed the search from a query handed off by the marketing landing (Home) across sign-in.
  const [q, setQ] = useState(() => {
    const seed = sessionStorage.getItem('astryx:q') ?? sessionStorage.getItem('vitrine:q');
    if (seed) { sessionStorage.removeItem('astryx:q'); sessionStorage.removeItem('vitrine:q'); }
    return seed ?? '';
  });
  const [detail, setDetail] = useState<{ appId: string } | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ kind: 'all' });
  const [searchResult, setSearchResult] = useState<CatalogSearchResult | null>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CatalogComparison | null>(null);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [importTrackerOpen, setImportTrackerOpen] = useState(false);
  const [entitlements, setEntitlements] = useState<{ plan: 'free' | 'pro'; freeUnlocks: string[]; freeUnlocksRemaining: number } | null>(null);

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

  const toggleCompare = (appId: string) => setSelectedApps((current) =>
    current.includes(appId) ? current.filter((id) => id !== appId) : current.length < 5 ? [...current, appId] : current,
  );
  const openComparison = async () => setComparison(await compareApps(selectedApps));
  const openApp = async (appId: string) => {
    if (user?.role !== 'admin' && entitlements?.plan === 'free' && !entitlements.freeUnlocks.includes(appId)) {
      if (entitlements.freeUnlocksRemaining < 1) {
        window.alert('Your three free app unlocks are used. Upgrade to Pro to inspect this complete observed system.');
        return;
      }
      if (!window.confirm(`Unlock ${appId} for your account? This uses one of ${entitlements.freeUnlocksRemaining} remaining free app unlocks.`)) return;
      const response = await fetch(`/api/apps/${appId}/unlock`, { method: 'POST' });
      if (!response.ok) return;
      const result = await response.json() as { remaining: number };
      setEntitlements({ ...entitlements, freeUnlocks: [...entitlements.freeUnlocks, appId], freeUnlocksRemaining: result.remaining });
    }
    if (apps?.some(({ id }) => id === appId)) setDetail({ appId });
    setCollectionsOpen(false);
  };
  const accountControls = (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      {user?.role === 'admin' && <Button label="Import tracker" size="sm" variant="secondary" clickAction={() => setImportTrackerOpen(true)} />}
      <Button label={`Collections${collections.length ? ` (${collections.length})` : ''}`} size="sm" variant="secondary" clickAction={() => setCollectionsOpen(true)} />
      <Text type="supporting" color="secondary">{user?.email}</Text>
      <Button label="Log out" size="sm" variant="ghost" clickAction={logout} />
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (importTrackerOpen && user?.role === 'admin') {
    return <ImportTrackerPanel apps={apps ?? []} onBack={() => setImportTrackerOpen(false)} onRefresh={refresh} />;
  }

  if (error || !apps || apps.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 28px 0', width: '100%' }}>
          {accountControls}
          {user?.role === 'admin' && <ProgressBanner />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
          <EmptyState
            title={error ? 'Could not load crawled screens' : 'No screens crawled yet'}
            description={
              error
                ? `The catalog could not be loaded: ${error}`
                : user?.role === 'admin'
                  ? 'Import captured web screens to build the first observed design system.'
                  : 'No curated web apps have been published yet.'
            }
          />
        </div>
      </div>
    );
  }

  const CATEGORIES = ['All', ...Array.from(new Set(apps.map((a) => a.cat)))];
  const query = q.trim().toLowerCase();
  const list = apps.filter(
    (a) =>
      (cat === 'All' || a.cat === cat) &&
      (!query || `${a.app} ${a.cat} ${a.screens.map((s) => s.type).join(' ')}`.toLowerCase().includes(query)),
  );
  const countFor = (c: string) => (c === 'All' ? apps.length : apps.filter((a) => a.cat === c).length);
  const detailApp = detail ? apps.find((a) => a.id === detail.appId) : undefined;

  return (
    <AnimatePresence mode="wait">
      {detailApp ? (
        <ScreenDetail key="detail" app={detailApp} role={user?.role ?? 'user'} onBack={() => setDetail(null)} collections={collections} onCollectionsChange={setCollections} />
      ) : (
        <motion.div
          key="gallery"
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px' }}
        >
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
              <SearchBox apps={apps} value={q} onChange={setQ} />
              {accountControls}
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {CATEGORIES.map((c) => {
                  const active = cat === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCat(active && c !== 'All' ? 'All' : c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 8px 7px 14px',
                        borderRadius: 9,
                        fontSize: 13.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flex: '0 0 auto',
                        border: `1px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                        background: active ? 'var(--color-text-primary)' : 'var(--color-background-surface)',
                        color: active ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
                        fontFamily: 'inherit',
                        transition: 'background .12s ease, border-color .12s ease',
                      }}
                    >
                      {c}
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: active ? 'rgba(255,255,255,0.18)' : 'var(--color-background-muted)',
                          color: active ? 'inherit' : 'var(--color-text-disabled)',
                        }}
                      >
                        {countFor(c)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 2,
                  width: 36,
                  background: 'linear-gradient(to right, transparent, var(--color-background-body))',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {user?.role === 'admin' && <ProgressBanner />}

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

          {selectedApps.length > 0 && (
            <div style={{ position: 'sticky', bottom: 18, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, width: 'fit-content', margin: '0 auto 18px', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 999, background: 'var(--color-background-surface)', boxShadow: 'var(--shadow-med)' }}>
              <span style={{ fontSize: 13 }}>{selectedApps.length} app{selectedApps.length === 1 ? '' : 's'} selected</span>
              <Button label="Compare" size="sm" variant="primary" isDisabled={selectedApps.length < 2} clickAction={() => void openComparison()} />
              <Button label="Clear" size="sm" variant="ghost" clickAction={() => setSelectedApps([])} />
            </div>
          )}

          <div style={{ padding: '6px 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{list.length} apps</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
            {list.map((a) => (
              <AppCard key={a.id} app={a} onOpen={() => void openApp(a.id)} compareSelected={selectedApps.includes(a.id)} onToggleCompare={() => toggleCompare(a.id)} />
            ))}
          </div>
        </motion.div>
      )}
      {comparison && <ComparisonPanel comparison={comparison} onClose={() => setComparison(null)} />}
      {collectionsOpen && <CollectionsPanel collections={collections} onChange={setCollections} onClose={() => setCollectionsOpen(false)} onOpenApp={(appId) => void openApp(appId)} />}
    </AnimatePresence>
  );
}
