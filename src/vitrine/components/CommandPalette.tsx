import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ClickableCard, Dialog, Icon, IconButton, TextInput, ToggleButton, type IconName } from '@astryxdesign/core';
import type { App } from '../types';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { loadDesignSystem } from '../useDesignSystem';
import type { Platform } from '../../platformFromUrl';
import { PlaceholderImage } from './PlaceholderImage';

type Nav = 'trending' | 'categories' | 'screens' | 'elements' | 'flows';

const NAV_ITEMS: Array<{ id: Nav; label: string; icon: IconName }> = [
  { id: 'trending', label: 'Trending', icon: 'arrowUp' },
  { id: 'categories', label: 'Categories', icon: 'viewColumns' },
  { id: 'screens', label: 'Screens', icon: 'viewColumns' },
  { id: 'elements', label: 'UI Elements', icon: 'wrench' },
  { id: 'flows', label: 'Flows', icon: 'arrowsUpDown' },
];

const SECTION_LABEL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '22px 0 12px' };
const TILE_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 14 };

function AppTile({ app, onSelect }: { app: App; onSelect: () => void }) {
  return (
    <ClickableCard
      label={`Open ${app.app}`}
      onClick={onSelect}
      padding={3}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        borderRadius: 12, background: 'transparent', border: 'none',
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 16, background: app.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{app.app}</span>
    </ClickableCard>
  );
}

function ScreenCard({ app, index, onSelect }: { app: App; index: number; onSelect: () => void }) {
  const screen = app.screens[index];
  return (
    <ClickableCard
      label={`Open ${screen.type}`}
      onClick={onSelect}
      padding={0}
      style={{
        border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-muted)',
        textAlign: 'left', overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', padding: '10px 12px 8px' }}>{screen.type}</div>
      <div style={{ position: 'relative', aspectRatio: '4/3', margin: 8, borderRadius: 8, overflow: 'hidden', background: 'var(--color-background-muted)' }}>
        <PlaceholderImage src={screen.url} accent={app.accent} />
      </div>
    </ClickableCard>
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
  const afterCloseRef = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);
  const [flowsByApp, setFlowsByApp] = useState<Record<string, DesignFlow<EvidenceView>[]> | null>(null);
  const [flowsLoading, setFlowsLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

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

  const requestClose = (afterClose?: () => void) => {
    if (closing) return;
    afterCloseRef.current = afterClose ?? null;
    setClosing(true);
  };
  const finishClose = () => {
    const afterClose = afterCloseRef.current;
    afterCloseRef.current = null;
    onClose();
    afterClose?.();
  };

  const selectApp = (appId: string) => requestClose(() => onSelectApp(appId));
  const selectScreen = (appId: string, index: number) => requestClose(() => onSelectScreen(appId, index));
  const selectCategory = (cat: string) => { onQueryChange(''); requestClose(() => onSelectCategory(cat)); };
  const selectFlow = (appId: string) => requestClose(() => onSelectFlow(appId));

  return (
    <Dialog
      isOpen
      className="command-palette-dialog"
      data-closing={closing ? 'true' : undefined}
      onAnimationEnd={(event) => {
        if (closing && event.animationName === 'vitrine-command-palette-out') finishClose();
      }}
      onOpenChange={(open) => { if (!open) requestClose(); }}
      purpose="info"
      width="min(1040px, calc(100vw - 40px))"
      maxHeight="82vh"
      padding={0}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          background: 'var(--color-background-surface)', border: '1px solid var(--color-border)', borderRadius: 20,
          boxShadow: 'var(--shadow-high)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1 }}><TextInput
            ref={inputRef}
            label="Search catalog"
            isLabelHidden
            value={query}
            onChange={onQueryChange}
            placeholder="Search apps, screens, UI elements, flows or keywords…"
            startIcon={<Icon icon="search" size="sm" />}
            hasClear={Boolean(query)}
            width="100%"
          /></div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '3px 7px' }}>Esc</span>
          <IconButton
            label="Close"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            onClick={() => requestClose()}
          />
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 200, flex: '0 0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 2, borderRight: '1px solid var(--color-border)', overflowY: 'auto' }}>
            {NAV_ITEMS.map((item) => {
              const active = nav === item.id;
              return (
                <ToggleButton
                  key={item.id}
                  label={item.label}
                  icon={<Icon icon={item.icon} size="sm" />}
                  isPressed={active}
                  onPressedChange={() => setNav(item.id)}
                  size="sm"
                  style={{
                    width: '100%', justifyContent: 'flex-start', borderRadius: 9,
                  }}
                />
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
                    <Button
                      key={cat}
                      label={cat}
                      size="sm"
                      onClick={() => selectCategory(cat)}
                      endContent={<span style={{ fontSize: 11.5, fontWeight: 600, background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', borderRadius: 999, padding: '1px 7px' }}>{count}</span>}
                      style={{ borderRadius: 10 }}
                    />
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
                      <Button
                        key={`${appId}-${flow.id}`}
                        label={flow.title}
                        size="sm"
                        onClick={() => selectFlow(appId)}
                        endContent={<span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{flow.steps.length} steps</span>}
                        style={{ width: '100%', justifyContent: 'space-between', borderRadius: 10 }}
                      />
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
      </div>
    </Dialog>
  );
}
