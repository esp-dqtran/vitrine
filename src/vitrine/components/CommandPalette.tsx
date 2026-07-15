import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import type { App } from '../types';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { loadDesignSystem } from '../useDesignSystem';
import type { Platform } from '../../platformFromUrl';
import { PlaceholderImage } from './PlaceholderImage';

type Nav = 'trending' | 'categories' | 'screens' | 'elements' | 'flows';

const NAV_ITEMS: Array<{ id: Nav; label: string; icon: ReactElement }> = [
  { id: 'trending', label: 'Trending', icon: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" /> },
  { id: 'categories', label: 'Categories', icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></> },
  { id: 'screens', label: 'Screens', icon: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 8h18" /></> },
  { id: 'elements', label: 'UI Elements', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></> },
  { id: 'flows', label: 'Flows', icon: <><circle cx="5" cy="12" r="3" /><circle cx="19" cy="12" r="3" /><path d="M8 12h8" /></> },
];

function NavIcon({ children }: { children: ReactElement }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const SECTION_LABEL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '22px 0 12px' };
const TILE_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 14 };

function AppTile({ app, onSelect }: { app: App; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '12px 8px', borderRadius: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 16, background: app.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{app.app}</span>
    </button>
  );
}

function ScreenCard({ app, index, onSelect }: { app: App; index: number; onSelect: () => void }) {
  const screen = app.screens[index];
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-muted)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0, overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', padding: '10px 12px 8px' }}>{screen.type}</div>
      <div style={{ position: 'relative', aspectRatio: '4/3', margin: 8, borderRadius: 8, overflow: 'hidden', background: 'var(--color-background-muted)' }}>
        <PlaceholderImage src={screen.url} accent={app.accent} />
      </div>
    </button>
  );
}

interface CommandPaletteProps {
  apps: App[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectApp: (appId: string) => void;
  onSelectScreen: (appId: string, index: number) => void;
  onSelectCategory: (cat: string) => void;
  onSelectFlow: (appId: string) => void;
}

export function CommandPalette({ apps, query, onQueryChange, onClose, onSelectApp, onSelectScreen, onSelectCategory, onSelectFlow }: CommandPaletteProps) {
  const [nav, setNav] = useState<Nav>('trending');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [flowsByApp, setFlowsByApp] = useState<Record<string, DesignFlow<EvidenceView>[]> | null>(null);
  const [flowsLoading, setFlowsLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ponytail: flows aren't attached to the catalog list apps carry, so browsing them here means
  // fetching each app's design-system snapshot on demand — fine for a handful of apps, would want
  // a bulk endpoint if the catalog grows large.
  useEffect(() => {
    if (nav !== 'flows' || flowsByApp || flowsLoading) return;
    setFlowsLoading(true);
    Promise.all(apps.map((app) => {
      // Flows are platform-scoped now — browse whichever platform this app's own screens lean on.
      const platform = (app.screens.find((s) => s.platform === 'ios' || s.platform === 'android' || s.platform === 'web')?.platform ?? 'web') as Platform;
      return loadDesignSystem(app.id, platform).then((snapshot) => [app.id, snapshot?.flows ?? []] as const).catch(() => [app.id, []] as const);
    }))
      .then((pairs) => setFlowsByApp(Object.fromEntries(pairs)))
      .finally(() => setFlowsLoading(false));
  }, [nav, apps, flowsByApp, flowsLoading]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of apps) counts.set(app.cat, (counts.get(app.cat) ?? 0) + 1);
    return Array.from(counts.entries());
  }, [apps]);

  const screenSamples = useMemo(
    () => apps.flatMap((app) => app.screens.map((_, index) => ({ app, index }))),
    [apps],
  );

  const elementChips = useMemo(() => {
    const names = new Set<string>();
    for (const app of apps) for (const screen of app.screens) for (const name of screen.componentNames ?? []) names.add(name);
    return Array.from(names);
  }, [apps]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const appMatches = searching ? apps.filter((a) => `${a.app} ${a.cat}`.toLowerCase().includes(q)) : [];
  const screenMatches = searching ? screenSamples.filter((s) => s.app.screens[s.index].type.toLowerCase().includes(q)) : [];
  const elementMatches = searching ? elementChips.filter((name) => name.toLowerCase().includes(q)) : [];
  const hasMatches = appMatches.length > 0 || screenMatches.length > 0 || elementMatches.length > 0;

  const selectApp = (appId: string) => { onClose(); onSelectApp(appId); };
  const selectScreen = (appId: string, index: number) => { onClose(); onSelectScreen(appId, index); };
  const selectCategory = (cat: string) => { onQueryChange(''); onClose(); onSelectCategory(cat); };
  const selectFlow = (appId: string) => { onClose(); onSelectFlow(appId); };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      onMouseDown={(e) => { if (!panelRef.current?.contains(e.target as Node)) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '8vh', paddingLeft: 20, paddingRight: 20,
        background: 'var(--color-overlay)', backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(1040px, 100%)', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          background: 'var(--color-background-surface)', border: '1px solid var(--color-border)', borderRadius: 20,
          boxShadow: 'var(--shadow-high)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--color-border)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search apps, screens, UI elements, flows or keywords…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 18, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '3px 7px' }}>Esc</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 200, flex: '0 0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 2, borderRight: '1px solid var(--color-border)', overflowY: 'auto' }}>
            {NAV_ITEMS.map((item) => {
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9,
                    fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? 'var(--color-background-muted)' : 'transparent',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    transition: 'background .12s ease, color .12s ease',
                  }}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  {item.label}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
              <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-emphasized)', borderRadius: 999, padding: '3px 9px', marginBottom: 10 }}>NEW</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>Every result cites its source</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>Screens and elements here link back to the exact captured screen they came from.</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px 28px' }}>
            {searching ? (
              hasMatches ? (
                <>
                  {appMatches.length > 0 && (
                    <>
                      <div style={SECTION_LABEL}>Apps</div>
                      <div style={TILE_GRID}>{appMatches.map((app) => <AppTile key={app.id} app={app} onSelect={() => selectApp(app.id)} />)}</div>
                    </>
                  )}
                  {screenMatches.length > 0 && (
                    <>
                      <div style={SECTION_LABEL}>Screens</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }}>
                        {screenMatches.map(({ app, index }) => <ScreenCard key={`${app.id}-${index}`} app={app} index={index} onSelect={() => selectScreen(app.id, index)} />)}
                      </div>
                    </>
                  )}
                  {elementMatches.length > 0 && (
                    <>
                      <div style={SECTION_LABEL}>UI Elements</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {elementMatches.map((name) => <span key={name} style={{ padding: '8px 14px', borderRadius: 999, background: 'var(--color-background-muted)', color: 'var(--color-text-primary)', fontSize: 13.5, fontWeight: 600 }}>{name}</span>)}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 14 }}>No matches for "{query}"</div>
              )
            ) : nav === 'trending' ? (
              <>
                <div style={SECTION_LABEL}>Trending</div>
                <div style={TILE_GRID}>{apps.slice(0, 7).map((app) => <AppTile key={app.id} app={app} onSelect={() => selectApp(app.id)} />)}</div>
              </>
            ) : nav === 'categories' ? (
              <>
                <div style={SECTION_LABEL}>Categories</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map(([cat, count]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => selectCategory(cat)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px 9px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-muted)', color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {cat}
                      <span style={{ fontSize: 11.5, fontWeight: 600, background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', borderRadius: 999, padding: '1px 7px' }}>{count}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : nav === 'screens' ? (
              <>
                <div style={SECTION_LABEL}>Screens</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }}>
                  {screenSamples.slice(0, 30).map(({ app, index }) => <ScreenCard key={`${app.id}-${index}`} app={app} index={index} onSelect={() => selectScreen(app.id, index)} />)}
                </div>
              </>
            ) : nav === 'elements' ? (
              <>
                <div style={SECTION_LABEL}>UI Elements</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {elementChips.length > 0
                    ? elementChips.map((name) => <span key={name} style={{ padding: '8px 14px', borderRadius: 999, background: 'var(--color-background-muted)', color: 'var(--color-text-primary)', fontSize: 13.5, fontWeight: 600 }}>{name}</span>)
                    : <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>No UI elements observed yet.</div>}
                </div>
              </>
            ) : (
              <>
                <div style={SECTION_LABEL}>Flows</div>
                {flowsLoading ? (
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>Loading flows…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(flowsByApp ?? {}).flatMap(([appId, flows]) => flows.map((flow) => (
                      <button
                        key={`${appId}-${flow.id}`}
                        type="button"
                        onClick={() => selectFlow(appId)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-muted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{flow.title}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{flow.steps.length} steps</span>
                      </button>
                    )))}
                    {flowsByApp && Object.values(flowsByApp).every((flows) => flows.length === 0) && (
                      <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>No flows observed yet.</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
