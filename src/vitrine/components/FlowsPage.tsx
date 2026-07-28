import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import {
  loadFlowCatalogPage,
  type FlowCatalogItem,
} from '../flowCatalogApi.ts';
import { AppsPlatformSwitcher } from './AppsPlatformSwitcher.tsx';
import { FlowCard } from './FlowCard.tsx';
import { ReferenceCatalogLoading } from './ReferenceCatalogLoading.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';
import { ReferenceDiscoveryPageShell } from './ReferenceDiscoveryPageShell.tsx';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { ReferenceDiscoveryToolbar } from './ReferenceDiscoveryToolbar.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

type FlowCatalogOrder = 'browse' | 'grouped';

function catalogFlowTitle(item: FlowCatalogItem): string {
  if (
    item.category === 'Other Flows'
    || item.category.trim().toLowerCase() === item.title.trim().toLowerCase()
  ) {
    return item.title;
  }
  return `${item.title} from ${item.category}`;
}

interface FlowsPageViewProps {
  items: FlowCatalogItem[];
  platform: Platform;
  query: string;
  loading: boolean;
  loadingMore?: boolean;
  error: string;
  hasMore: boolean;
  order: FlowCatalogOrder;
  onPlatformChange: (platform: Platform) => void;
  onQueryChange: (value: string) => void;
  onOrderChange: (value: FlowCatalogOrder) => void;
  onOpenSearch: () => void;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  accountControls?: ReactNode;
}

export function FlowsPageView({
  items,
  platform,
  query,
  loading,
  loadingMore = false,
  error,
  hasMore,
  order,
  onPlatformChange,
  onQueryChange,
  onOrderChange,
  onOpenSearch,
  onSelectFlow,
  onSelectApp,
  onRetry,
  onLoadMore,
  accountControls,
}: FlowsPageViewProps) {
  const groups = [...new Set(items.map(({ category }) => category))].slice(0, 12);
  const empty = !loading && !error && items.length === 0;

  return (
    <ReferenceDiscoveryPageShell
      kind="flows"
      header={(
        <ReferenceDiscoveryTopNav
          active="flows"
          className="apps-top-nav"
          search={(
            <SearchTrigger
              label={query ? `${items.length} flows · search or filter…` : 'Search on Web...'}
              activeCategory={null}
              onOpen={onOpenSearch}
              onClearCategory={() => onQueryChange('')}
            />
          )}
          accountControls={accountControls}
        />
      )}
      taxonomyLabel="Flow discovery filters"
      taxonomy={(
        <ReferenceDiscoveryFacetGroup
          label="Flow groups"
          wide
          className="flows-discovery__facet"
        >
          {groups.map((group) => (
            <Button
              key={group}
              label={group}
              variant="ghost"
              size="sm"
              aria-pressed={query === group}
              onClick={() => onQueryChange(query === group ? '' : group)}
            />
          ))}
        </ReferenceDiscoveryFacetGroup>
      )}
      preview={null}
      toolbar={(
        <ReferenceDiscoveryToolbar
          label="Flow ordering"
          value={order}
          options={[
            { value: 'browse', label: 'Popular' },
            { value: 'grouped', label: 'Grouped' },
          ]}
          onChange={onOrderChange}
          leading={(
            <AppsPlatformSwitcher
              value={platform}
              onChange={onPlatformChange}
            />
          )}
        />
      )}
    >
      {loading ? (
          <ReferenceCatalogLoading label="Loading Flows" />
        ) : error ? (
          <div className="flows-discovery__state" role="alert">
            <EmptyState
              title="Could not load Flows"
              description={error}
              actions={<Button label="Retry" variant="primary" onClick={onRetry} />}
            />
          </div>
        ) : empty ? (
          <div className="flows-discovery__state" role="status">
            <EmptyState
              title={query ? 'No Flows match this search' : 'No Flows available yet'}
              description={query
                ? 'Try another Flow name or group.'
                : 'Published Apps do not contain normalized Flows for this platform yet.'}
            />
          </div>
        ) : (
          <>
            <div className="flows-discovery__gallery" aria-label="Flow catalog">
              {items.map((item) => (
                <section
                  key={`${item.category}:${item.title}`}
                  className="flows-discovery__flow"
                >
                  <FlowCard
                    flow={{
                      ...item.preview.flow,
                      title: catalogFlowTitle(item),
                    }}
                    screenCount={item.preview.screenCount}
                    metaLabel={`${item.preview.screenCount} ${item.preview.screenCount === 1 ? 'screen' : 'screens'} · observed in ${item.count} ${item.count === 1 ? 'app' : 'apps'}`}
                    sourceAppName={item.preview.appName}
                    sourceAppIconUrl={item.preview.appIconUrl}
                    onOpenSourceApp={() => onSelectApp(item.preview.appId)}
                    onOpen={() => onSelectFlow(item.title, platform)}
                  />
                </section>
              ))}
            </div>
            {hasMore ? (
              <div className="flows-discovery__load-more">
                <Button
                  label={loadingMore ? 'Loading more…' : 'Load more Flows'}
                  variant="secondary"
                  isDisabled={loadingMore}
                  onClick={onLoadMore}
                />
              </div>
            ) : null}
          </>
        )}
    </ReferenceDiscoveryPageShell>
  );
}

interface FlowsPageProps {
  onOpenSearch: () => void;
  onSelectFlow: (title: string, platform: Platform) => void;
  onSelectApp: (appId: string) => void;
  accountControls?: ReactNode;
}

export function FlowsPage({
  onOpenSearch,
  onSelectFlow,
  onSelectApp,
  accountControls,
}: FlowsPageProps) {
  const [platform, setPlatform] = useState<Platform>('web');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<FlowCatalogOrder>('browse');
  const [items, setItems] = useState<FlowCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setNextCursor(null);

    const timer = window.setTimeout(() => {
      void loadFlowCatalogPage(
        { platform, query: query.trim() || undefined, limit: 12, order },
        controller.signal,
      ).then((page) => {
        if (generation !== generationRef.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      }).catch((reason: Error) => {
        if (reason.name !== 'AbortError' && generation === generationRef.current) {
          setItems([]);
          setError(reason.message);
        }
      }).finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
    }, query ? 180 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [order, platform, query, revision]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const generation = generationRef.current;
    setLoadingMore(true);
    setError('');
    try {
      const page = await loadFlowCatalogPage({
        platform,
        query: query.trim() || undefined,
        cursor: nextCursor,
        limit: 12,
        order,
      });
      if (generation !== generationRef.current) return;
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (generation === generationRef.current) setError((reason as Error).message);
    } finally {
      if (generation === generationRef.current) setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, order, platform, query]);

  return (
    <FlowsPageView
      items={items}
      platform={platform}
      query={query}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      hasMore={nextCursor !== null}
      order={order}
      onPlatformChange={setPlatform}
      onQueryChange={setQuery}
      onOrderChange={setOrder}
      onOpenSearch={onOpenSearch}
      onSelectFlow={onSelectFlow}
      onSelectApp={onSelectApp}
      onRetry={() => setRevision((value) => value + 1)}
      onLoadMore={() => void loadMore()}
      accountControls={accountControls}
    />
  );
}
