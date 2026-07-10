import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, EmptyState, Spinner, Text } from '@astryxdesign/core';
import { useAuth } from './AuthProvider';
import { AppCard } from './components/AppCard';
import { ProgressBanner } from './components/ProgressBanner';
import { PipelinePanel } from './components/PipelinePanel';
import { ScreenDetail } from './components/ScreenDetail';
import { SearchBox } from './components/SearchBox';
import { useApps } from './useApps';

export function App() {
  const { apps, loading, error, refresh } = useApps();
  const { user, logout } = useAuth();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<{ appId: string } | null>(null);
  const accountControls = (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
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

  if (error || !apps || apps.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 28px 0', width: '100%' }}>
          {accountControls}
          <PipelinePanel onPipelineDone={refresh} />
          <ProgressBanner />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 }}>
          <EmptyState
            title={error ? 'Could not load crawled screens' : 'No screens crawled yet'}
            description={
              error
                ? `The dev server's /api/apps endpoint failed: ${error}`
                : 'Submit a Mobbin application above to import screenshots and build its design system.'
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
        <ScreenDetail key="detail" app={detailApp} onBack={() => setDetail(null)} />
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

          <PipelinePanel onPipelineDone={refresh} />
          <ProgressBanner />

          <div style={{ padding: '6px 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{list.length} apps</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}>
            {list.map((a) => (
              <AppCard key={a.id} app={a} onOpen={() => setDetail({ appId: a.id })} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
