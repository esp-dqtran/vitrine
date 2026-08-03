import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, ClickableCard, Icon, IconButton, Spinner, TextInput, ToggleButton, type IconName } from '@astryxdesign/core';
import type { CatalogComparison, CatalogSearchResult, CatalogSearchResultItem } from '../../catalogResearch';
import type { ResearchCollection } from '../../db';
import type { Platform } from '../../platformFromUrl';
import type { App } from '../types';
import type { FlowCatalogItem } from '../flowCatalogApi.ts';
import { compareCatalogApps, searchRelatedCatalog } from '../researchApi';
import { useCommandPaletteFlowCatalog } from '../useCommandPaletteFlowCatalog.ts';
import { groupInspirationResults, moveSelection } from '../inspirationSearch';
import { InspirationComparison } from './InspirationComparison';
import { InspirationPreview } from './InspirationPreview';
import { InspirationPrompts } from './InspirationPrompts';
import { InspirationResults } from './InspirationResults';
import { PlaceholderImage } from './PlaceholderImage';
import { AstryxModal } from './AstryxModal.tsx';

export type CommandPaletteNav =
  'trending' | 'categories' | 'screens' | 'elements' | 'flows';

const NAV_ITEMS: Array<{ id: CommandPaletteNav; label: string; icon: IconName }> = [
  { id: 'trending', label: 'Trending', icon: 'arrowUp' },
  { id: 'categories', label: 'Categories', icon: 'viewColumns' },
  { id: 'screens', label: 'Screens', icon: 'viewColumns' },
  { id: 'elements', label: 'UI Elements', icon: 'wrench' },
  { id: 'flows', label: 'Flows', icon: 'arrowsUpDown' },
];

const SECTION_LABEL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '22px 0 12px' };
const TILE_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 14 };

export function flowIdFromSearchResult(item: CatalogSearchResultItem): string | undefined {
  if (item.kind !== 'flow') return undefined;
  return flowIdFromCatalogResultId(item.app, item.id);
}

export function flowIdFromCatalogResultId(appId: string, resultId: string): string | undefined {
  const prefix = `flow:${appId}:`;
  return resultId.startsWith(prefix) ? resultId.slice(prefix.length) || undefined : undefined;
}

function AppTile({ app, onSelect }: { app: App; onSelect: () => void }) {
  return (
    <ClickableCard
      label={`Open ${app.app}`}
      onClick={onSelect}
      padding={3}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderRadius: 12, background: 'transparent', border: 'none' }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 16, background: app.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {app.iconUrl
          ? <img src={app.iconUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{app.app[0]}</span>}
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
  plan: 'free' | 'pro';
  publicBrowse?: boolean;
  initialNav?: CommandPaletteNav;
  initialFlowQuery?: string;
  initialPlatform?: Platform;
  onUpgrade: () => void;
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  onQueryChange: (value: string) => void;
  onRetrySearch: () => void;
  onClose: () => void;
  onSelectApp: (appId: string) => void;
  onSelectScreen: (appId: string, evidenceId?: number) => void;
  onSelectCategory: (categoryName: string) => void;
  onSelectFlow: (appId: string, flowId?: string) => void;
  onSearchFlow: (flowTitle: string, platform: Platform, flowGroup?: string) => void;
}

export function CommandPalette({
  apps,
  query,
  result,
  searchLoading,
  searchError,
  collections,
  plan,
  publicBrowse = false,
  initialNav = 'trending',
  initialFlowQuery = '',
  initialPlatform = 'web',
  onUpgrade,
  onCollectionsChange,
  onQueryChange,
  onRetrySearch,
  onClose,
  onSelectApp,
  onSelectScreen,
  onSelectCategory,
  onSelectFlow,
  onSearchFlow,
}: CommandPaletteProps) {
  const [nav, setNav] = useState<CommandPaletteNav>(initialNav);
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
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [flowQuery, setFlowQuery] = useState(initialFlowQuery);
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const flowSentinelRef = useRef<HTMLDivElement>(null);
  const flowModeEnabled = plan === 'pro' || initialNav === 'flows';
  const {
    items: flowItems,
    cursor: flowCursor,
    loading: flowsLoading,
    error: flowsError,
    retry: retryFlows,
    cancel: cancelFlowRequests,
  } = useCommandPaletteFlowCatalog({
    enabled: flowModeEnabled && nav === 'flows',
    platform,
    query: flowQuery,
    rootRef: resultsScrollRef,
    sentinelRef: flowSentinelRef,
  });

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of apps) {
      for (const { name } of app.categories) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries());
  }, [apps]);
  const screenSamples = useMemo(() => apps.flatMap((app) => app.screens.map((_, index) => ({ app, index }))), [apps]);
  const elementChips = useMemo(() => {
    const names = new Set<string>();
    for (const app of apps) for (const screen of app.screens) for (const name of screen.componentNames ?? []) names.add(name);
    return Array.from(names);
  }, [apps]);
  const publicApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return apps;
    return apps.filter((app) => {
      const searchText = [
        app.app,
        ...app.categories.map(({ name }) => name),
        ...app.screens.flatMap((screen) => [
          screen.type,
          screen.productArea,
          ...(screen.componentNames ?? []),
          ...(screen.visibleText ?? []),
        ]),
      ].join(' ').toLowerCase();
      return searchText.includes(normalizedQuery);
    });
  }, [apps, query]);
  const visibleItems = useMemo(() => groupInspirationResults(result?.items ?? []).flatMap((group) => group.items), [result]);
  const flowGroups = useMemo(() => {
    const groups = new Map<string, FlowCatalogItem[]>();
    for (const item of flowItems) {
      const group = groups.get(item.category) ?? [];
      group.push(item);
      groups.set(item.category, group);
    }
    return Array.from(groups.entries());
  }, [flowItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { setActiveIndex(0); }, [result]);
  useEffect(() => { setActiveFlowIndex(0); }, [flowItems]);

  useEffect(() => {
    if (plan !== 'pro' || !selected) return;
    const controller = new AbortController();
    setRelatedLoading(true);
    setRelatedError('');
    searchRelatedCatalog(selected, controller.signal)
      .then(setRelated)
      .catch((error: Error) => { if (error.name !== 'AbortError') setRelatedError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setRelatedLoading(false); });
    return () => controller.abort();
  }, [selected, relatedRetry, plan]);

  const requestClose = (afterClose?: () => void) => {
    if (closing) return;
    cancelFlowRequests();
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
    else if (item.kind === 'flow') requestClose(() => onSelectFlow(item.app, flowIdFromSearchResult(item)));
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
    if (selected || comparison) return;
    if (nav === 'flows' && flowItems.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveFlowIndex((index) => moveSelection(
          index,
          event.key === 'ArrowDown' ? 1 : -1,
          flowItems.length,
        ));
      }
      if (event.key === 'Enter') {
        const item = flowItems[activeFlowIndex];
        if (item) {
          event.preventDefault();
          requestClose(() => onSearchFlow(item.title, platform, item.category));
        }
      }
      return;
    }
    if (!visibleItems.length) return;
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
    if (nav === 'flows') {
      setFlowQuery(value);
    } else {
      onQueryChange(value);
    }
  };
  const selectNav = (nextNav: CommandPaletteNav) => {
    setNav(nextNav);
    setSelected(null);
    setComparison(null);
    setCompareApps([]);
    setFlowQuery('');
    onQueryChange('');
  };

  const selectApp = (appId: string) => requestClose(() => onSelectApp(appId));
  const selectScreen = (app: App, index: number) => requestClose(() => onSelectScreen(app.id, app.screens[index].id));
  const selectCategory = (categoryName: string) => {
    onQueryChange('');
    requestClose(() => onSelectCategory(categoryName));
  };
  const selectFlowFacet = (item: FlowCatalogItem) => {
    requestClose(() => onSearchFlow(item.title, platform, item.category));
  };

  const browseContent = nav === 'categories' ? (
    <>
      <div style={SECTION_LABEL}>Categories</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categories.map(([categoryName, count]) => (
          <Button
            key={categoryName}
            label={categoryName}
            size="sm"
            onClick={() => selectCategory(categoryName)}
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
    <div className="command-palette-flow-browser">
      {flowGroups.map(([category, items]) => (
        <section key={category} className="command-palette-flow-group">
          <h2>{category}</h2>
          <div>
            {items.map((item) => {
              const itemIndex = flowItems.indexOf(item);
              return (
              <Button
                key={`${category}:${item.title}`}
                label={item.title}
                variant="ghost"
                className="command-palette-flow-row"
                data-highlighted={itemIndex === activeFlowIndex ? 'true' : undefined}
                onMouseEnter={() => setActiveFlowIndex(itemIndex)}
                onClick={() => selectFlowFacet(item)}
                endContent={(
                  <span data-command-flow-count="true">{item.count.toLocaleString()}</span>
                )}
              />
              );
            })}
          </div>
        </section>
      ))}
      {flowsLoading && flowItems.length === 0
        ? <div className="command-palette-flow-state"><Spinner size="sm" aria-label="Loading flows" /></div>
        : null}
      {!flowsLoading && !flowsError && flowItems.length === 0
        ? <div className="command-palette-flow-state">No flows observed yet.</div>
        : null}
      {flowsError ? (
        <div className="command-palette-flow-state" role="alert">
          <span>Could not load flows.</span>
          <Button label="Retry" size="sm" onClick={retryFlows} />
        </div>
      ) : null}
      {flowCursor ? <div ref={flowSentinelRef} className="command-palette-flow-sentinel" aria-hidden="true" /> : null}
      {flowsLoading && flowItems.length > 0
        ? <div className="command-palette-flow-state"><Spinner size="sm" aria-label="Loading more flows" /></div>
        : null}
    </div>
  ) : null;

  return (
    <AstryxModal
      isOpen
      className="command-palette-dialog"
      data-closing={closing ? 'true' : undefined}
      onAnimationEnd={(event) => { if (closing && event.animationName === 'vitrine-command-palette-out') finishClose(); }}
      onOpenChange={(open) => { if (!open) requestClose(); }}
      purpose="info"
      width="min(816px, calc(100vw - 40px))"
      maxHeight="min(594px, calc(100dvh - 48px))"
      padding={0}
    >
      <div
        className="command-palette-shell"
        data-nav={nav}
        data-querying={nav === 'flows' && Boolean(flowQuery.trim()) ? 'true' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDownCapture={onPaletteKeyDown}
      >
        <div className="command-palette-header">
          <div className="command-palette-search">
            <TextInput
              ref={inputRef}
              label="Search catalog"
              isLabelHidden
              value={nav === 'flows' ? flowQuery : query}
              onChange={handleQueryChange}
              placeholder="Web Apps, Screens, UI Elements, Flows or Keywords…"
              hasClear={Boolean(nav === 'flows' ? flowQuery : query)}
              width="100%"
              isDisabled={plan === 'free' && !publicBrowse && !flowModeEnabled}
            />
          </div>
          <div className="command-palette-platforms" aria-label="Search platform">
            {(['ios', 'web', 'android'] as Platform[]).map((value) => (
              <ToggleButton
                key={value}
                label={value === 'ios' ? 'iOS' : value === 'web' ? 'Web' : 'Android'}
                isPressed={platform === value}
                size="sm"
                onPressedChange={() => setPlatform(value)}
              />
            ))}
          </div>
          <IconButton label="Close search" icon={<Icon icon="close" size="sm" />} variant="ghost" size="sm" onClick={() => requestClose()} />
        </div>

        <div className="command-palette-app-chips" aria-label="Popular apps">
          {apps.slice(0, 6).map((app) => (
            <Button
              key={app.id}
              label={app.app}
              variant="secondary"
              onClick={() => selectApp(app.id)}
              icon={<span className="command-palette-app-logo" style={{ background: app.accent }}>
                {app.iconUrl
                  ? <img src={app.iconUrl} alt="" />
                  : <span aria-hidden="true">{app.app.slice(0, 1)}</span>}
              </span>}
            />
          ))}
        </div>

        <div className="command-palette-body">
          <div className="command-palette-sidebar">
            {NAV_ITEMS.filter((item) => (
              plan === 'pro'
              || item.id === 'trending'
              || item.id === 'categories'
              || initialNav === 'flows' && item.id === 'flows'
            )).map((item) => (
              <ToggleButton
                key={item.id}
                label={item.label}
                icon={<Icon icon={item.icon} size="sm" />}
                isPressed={nav === item.id}
                onPressedChange={() => selectNav(item.id)}
                size="sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              />
            ))}
            <div className="command-palette-sidebar-spacer" />
            <div className="command-palette-promo">
              {nav === 'flows' ? (
                <>
                  <span>FLOW SEARCH</span>
                  <strong>Search observed<br />product behaviors</strong>
                  <p>Matches Flow titles and groups across apps on the selected platform.</p>
                </>
              ) : (
                <>
                  <span>NEW</span>
                  <strong>AI Search is now<br />Deep Search</strong>
                  <p>Deep Search is automatically selected for longer, more complex queries</p>
                </>
              )}
            </div>
          </div>

          <div ref={resultsScrollRef} className="inspiration-modal-content command-palette-content">
            {nav === 'flows' && flowModeEnabled ? browseContent : publicBrowse ? (
              nav === 'categories' ? browseContent : (
                <>
                  <div style={SECTION_LABEL}>{query.trim() ? `${publicApps.length} matching apps` : 'Browse apps'}</div>
                  {publicApps.length ? (
                    <div style={TILE_GRID}>
                      {publicApps.map((app) => <AppTile key={app.id} app={app} onSelect={() => selectApp(app.id)} />)}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--color-text-disabled)', fontSize: 14 }}>No apps match this search.</div>
                  )}
                </>
              )
            ) : plan === 'free' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: 14, border: '1px solid var(--color-border)', borderRadius: 12 }}>
                  <div style={{ flex: 1 }}><strong>Search, filters, screens, elements, and flows are Pro.</strong><div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>You can still browse trending apps and categories.</div></div>
                  <Button label="Upgrade to Pro" variant="primary" size="sm" onClick={onUpgrade} />
                </div>
                {nav === 'trending' ? <><div style={SECTION_LABEL}>Trending apps</div><div style={TILE_GRID}>{apps.slice(0, 7).map((app) => <AppTile key={app.id} app={app} onSelect={() => selectApp(app.id)} />)}</div></> : browseContent}
              </>
            ) : comparison ? (
              <InspirationComparison comparison={comparison} onBack={() => setComparison(null)} />
            ) : selected ? (
              <>
                <InspirationPreview
                  item={selected}
                  related={related}
                  relatedLoading={relatedLoading}
                  relatedError={relatedError}
                  collections={collections}
                  plan={plan}
                  onUpgrade={onUpgrade}
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
    </AstryxModal>
  );
}
