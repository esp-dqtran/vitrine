import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, ClickableCard, Dialog, Icon, IconButton, Spinner, TextInput, ToggleButton, type IconName } from '@astryxdesign/core';
import type { CatalogComparison, CatalogSearchResult, CatalogSearchResultItem } from '../../catalogResearch';
import type { ResearchCollection } from '../../db';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { Platform } from '../../platformFromUrl';
import type { App } from '../types';
import { compareCatalogApps, searchRelatedCatalog } from '../researchApi';
import { groupInspirationResults, moveSelection } from '../inspirationSearch';
import { loadDesignSystem } from '../useDesignSystem';
import { InspirationComparison } from './InspirationComparison';
import { InspirationPreview } from './InspirationPreview';
import { InspirationPrompts } from './InspirationPrompts';
import { InspirationResults } from './InspirationResults';
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
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderRadius: 12, background: 'transparent', border: 'none' }}
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
      style={{ border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-muted)', textAlign: 'left', overflow: 'hidden' }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', padding: '10px 12px 8px' }}>{screen.type}</div>
      <div style={{ position: 'relative', aspectRatio: '4/3', margin: 8, borderRadius: 8, overflow: 'hidden', background: 'var(--color-background-muted)' }}>
        <PlaceholderImage src={screen.thumbnailUrl ?? screen.url} accent={app.accent} />
      </div>
    </ClickableCard>
  );
}

interface CommandPaletteProps {
  apps: App[];
  query: string;
  result: CatalogSearchResult | null;
  searchLoading: boolean;
  searchError: string;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  onQueryChange: (value: string) => void;
  onRetrySearch: () => void;
  onClose: () => void;
  onSelectApp: (appId: string) => void;
  onSelectScreen: (appId: string, evidenceId?: number) => void;
  onSelectCategory: (cat: string) => void;
  onSelectFlow: (appId: string) => void;
}

export function CommandPalette({
  apps,
  query,
  result,
  searchLoading,
  searchError,
  collections,
  onCollectionsChange,
  onQueryChange,
  onRetrySearch,
  onClose,
  onSelectApp,
  onSelectScreen,
  onSelectCategory,
  onSelectFlow,
}: CommandPaletteProps) {
  const [nav, setNav] = useState<Nav>('trending');
  const inputRef = useRef<HTMLInputElement>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const [closing, setClosing] = useState(false);
  const [selected, setSelected] = useState<CatalogSearchResultItem | null>(null);
  const [related, setRelated] = useState<CatalogSearchResultItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [relatedRetry, setRelatedRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [compareApps, setCompareApps] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CatalogComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [flowsByApp, setFlowsByApp] = useState<Record<string, DesignFlow<EvidenceView>[]> | null>(null);
  const [flowsLoading, setFlowsLoading] = useState(false);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of apps) counts.set(app.cat, (counts.get(app.cat) ?? 0) + 1);
    return Array.from(counts.entries());
  }, [apps]);
  const screenSamples = useMemo(() => apps.flatMap((app) => app.screens.map((_, index) => ({ app, index }))), [apps]);
  const elementChips = useMemo(() => {
    const names = new Set<string>();
    for (const app of apps) for (const screen of app.screens) for (const name of screen.componentNames ?? []) names.add(name);
    return Array.from(names);
  }, [apps]);
  const visibleItems = useMemo(() => groupInspirationResults(result?.items ?? []).flatMap((group) => group.items), [result]);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { setActiveIndex(0); }, [result]);

  useEffect(() => {
    if (nav !== 'flows' || flowsByApp || flowsLoading) return;
    setFlowsLoading(true);
    Promise.all(apps.map((app) => {
      const platform = (app.screens.find((screen) => screen.platform === 'ios' || screen.platform === 'android' || screen.platform === 'web')?.platform ?? 'web') as Platform;
      return loadDesignSystem(app.id, platform)
        .then((snapshot) => [app.id, snapshot?.flows ?? []] as const)
        .catch(() => [app.id, []] as const);
    }))
      .then((pairs) => setFlowsByApp(Object.fromEntries(pairs)))
      .finally(() => setFlowsLoading(false));
  }, [nav, apps, flowsByApp, flowsLoading]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setRelatedLoading(true);
    setRelatedError('');
    searchRelatedCatalog(selected, controller.signal)
      .then(setRelated)
      .catch((error: Error) => { if (error.name !== 'AbortError') setRelatedError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setRelatedLoading(false); });
    return () => controller.abort();
  }, [selected, relatedRetry]);

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

  const openPreview = (item: CatalogSearchResultItem) => {
    if (!selected) savedScrollTopRef.current = resultsScrollRef.current?.scrollTop ?? 0;
    setSelected(item);
  };

  const backToResults = () => {
    setSelected(null);
    setComparison(null);
    window.requestAnimationFrame(() => {
      if (resultsScrollRef.current) resultsScrollRef.current.scrollTop = savedScrollTopRef.current;
    });
  };

  const openResult = (item: CatalogSearchResultItem) => {
    if (item.kind === 'screen') requestClose(() => onSelectScreen(item.app, item.evidenceIds[0]));
    else if (item.kind === 'flow') requestClose(() => onSelectFlow(item.app));
    else requestClose(() => onSelectApp(item.app));
  };

  const loadComparison = async (appsToCompare: string[]) => {
    setComparisonLoading(true);
    setComparisonError('');
    try {
      setComparison(await compareCatalogApps(appsToCompare));
    } catch (error) {
      setComparisonError((error as Error).message);
    } finally {
      setComparisonLoading(false);
    }
  };

  const addToComparison = (item: CatalogSearchResultItem) => {
    const nextApps = [...new Set([...compareApps, item.app])].slice(0, 2);
    setCompareApps(nextApps);
    if (nextApps.length === 2) void loadComparison(nextApps);
  };

  const onPaletteKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && comparison) {
      event.preventDefault();
      event.stopPropagation();
      setComparison(null);
      return;
    }
    if (event.key === 'Escape' && selected) {
      event.preventDefault();
      event.stopPropagation();
      backToResults();
      return;
    }
    if (selected || comparison || !visibleItems.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => moveSelection(index, event.key === 'ArrowDown' ? 1 : -1, visibleItems.length));
    }
    if (event.key === 'Enter') {
      const item = visibleItems[activeIndex];
      if (item) {
        event.preventDefault();
        openPreview(item);
      }
    }
  };

  const handleQueryChange = (value: string) => {
    setSelected(null);
    setComparison(null);
    setCompareApps([]);
    onQueryChange(value);
  };

  const selectApp = (appId: string) => requestClose(() => onSelectApp(appId));
  const selectScreen = (app: App, index: number) => requestClose(() => onSelectScreen(app.id, app.screens[index].id));
  const selectCategory = (cat: string) => { onQueryChange(''); requestClose(() => onSelectCategory(cat)); };
  const selectFlow = (appId: string) => requestClose(() => onSelectFlow(appId));

  const browseContent = nav === 'categories' ? (
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
        {screenSamples.slice(0, 30).map(({ app, index }) => <ScreenCard key={`${app.id}-${index}`} app={app} index={index} onSelect={() => selectScreen(app, index)} />)}
      </div>
    </>
  ) : nav === 'elements' ? (
    <>
      <div style={SECTION_LABEL}>UI Elements</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {elementChips.length
          ? elementChips.map((name) => <span key={name} style={{ padding: '8px 14px', borderRadius: 999, background: 'var(--color-background-muted)', color: 'var(--color-text-primary)', fontSize: 13.5, fontWeight: 600 }}>{name}</span>)
          : <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>No UI elements observed yet.</div>}
      </div>
    </>
  ) : nav === 'flows' ? (
    <>
      <div style={SECTION_LABEL}>Flows</div>
      {flowsLoading ? (
        <Spinner size="sm" aria-label="Loading flows" />
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
          {flowsByApp && Object.values(flowsByApp).every((flows) => flows.length === 0) ? <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>No flows observed yet.</div> : null}
        </div>
      )}
    </>
  ) : null;

  return (
    <Dialog
      isOpen
      className="command-palette-dialog"
      data-closing={closing ? 'true' : undefined}
      onAnimationEnd={(event) => { if (closing && event.animationName === 'vitrine-command-palette-out') finishClose(); }}
      onOpenChange={(open) => { if (!open) requestClose(); }}
      purpose="info"
      width="min(1040px, calc(100vw - 40px))"
      maxHeight="82vh"
      padding={0}
    >
      <div
        className="command-palette-shell"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDownCapture={onPaletteKeyDown}
        style={{ width: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-surface)', border: '1px solid var(--color-border)', borderRadius: 20, boxShadow: 'var(--shadow-high)', overflow: 'hidden' }}
      >
        <div className="command-palette-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1 }}>
            <TextInput
              ref={inputRef}
              label="Search catalog"
              isLabelHidden
              value={query}
              onChange={handleQueryChange}
              placeholder="Search apps, screens, UI elements, flows or keywords…"
              startIcon={<Icon icon="search" size="sm" />}
              hasClear={Boolean(query)}
              width="100%"
            />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '3px 7px' }}>Esc</span>
          <IconButton label="Close" icon={<Icon icon="close" size="sm" />} variant="ghost" size="sm" onClick={() => requestClose()} />
        </div>

        <div className="command-palette-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div className="command-palette-sidebar" style={{ width: 200, flex: '0 0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 2, borderRight: '1px solid var(--color-border)', overflowY: 'auto' }}>
            {NAV_ITEMS.map((item) => (
              <ToggleButton
                key={item.id}
                label={item.label}
                icon={<Icon icon={item.icon} size="sm" />}
                isPressed={nav === item.id}
                onPressedChange={() => { setNav(item.id); handleQueryChange(''); }}
                size="sm"
                style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 9 }}
              />
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
              <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-emphasized)', borderRadius: 999, padding: '3px 9px', marginBottom: 10 }}>NEW</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>Every result cites its source</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>Screens and elements link back to the exact captured evidence.</div>
            </div>
          </div>

          <div ref={resultsScrollRef} className="inspiration-modal-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px 28px' }}>
            {comparison ? (
              <InspirationComparison comparison={comparison} onBack={() => setComparison(null)} />
            ) : selected ? (
              <>
                <InspirationPreview
                  item={selected}
                  related={related}
                  relatedLoading={relatedLoading}
                  relatedError={relatedError}
                  collections={collections}
                  onCollectionsChange={onCollectionsChange}
                  onBack={backToResults}
                  onOpen={openResult}
                  onCompare={addToComparison}
                  onSelectRelated={openPreview}
                  onRetryRelated={() => setRelatedRetry((value) => value + 1)}
                />
                {compareApps.length === 1 ? <div role="status">Choose one more app to compare with {compareApps[0]}.</div> : null}
                {comparisonLoading ? <Spinner size="sm" aria-label="Building comparison" /> : null}
                {comparisonError ? <div role="alert"><span>{comparisonError}</span><Button label="Retry comparison" size="sm" onClick={() => void loadComparison(compareApps)} /></div> : null}
              </>
            ) : query.trim() ? (
              <div className="inspiration-search-state">
                {searchError ? <div role="alert"><span>{searchError}</span><Button label="Retry search" size="sm" onClick={onRetrySearch} /></div> : null}
                {searchLoading ? <Spinner size="sm" aria-label="Searching catalog" /> : null}
                {visibleItems.length ? (
                  <InspirationResults items={result?.items ?? []} activeId={visibleItems[activeIndex]?.id} onPreview={openPreview} />
                ) : !searchLoading && !searchError ? (
                  <div><p>No observed evidence matches “{query}”. Try a nearby intent.</p><InspirationPrompts onSelect={handleQueryChange} /></div>
                ) : null}
              </div>
            ) : nav === 'trending' ? (
              <>
                <InspirationPrompts onSelect={handleQueryChange} />
                <div style={SECTION_LABEL}>Trending apps</div>
                <div style={TILE_GRID}>{apps.slice(0, 7).map((app) => <AppTile key={app.id} app={app} onSelect={() => selectApp(app.id)} />)}</div>
              </>
            ) : browseContent}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
