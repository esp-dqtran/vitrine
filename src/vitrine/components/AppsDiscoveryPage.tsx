import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import {
  APPS_DISCOVERY_FACETS,
  filterAndSortApps,
  type AppsFacet,
  type AppsPlatform,
  type AppsSort,
} from '../appsDiscovery.ts';
import type { App } from '../types.ts';
import { AppCard } from './AppCard.tsx';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface AppsDiscoveryPageProps {
  apps: App[] | null;
  isAdmin: boolean;
  query: string;
  facet: AppsFacet | null;
  onFacetChange: (facet: AppsFacet | null) => void;
  onOpenSearch: () => void;
  searchMode: 'legacy' | 'advanced';
  onImport: () => void;
  onOpenApp: (appId: string) => void;
  onRetry: () => void;
  totalApps: number | null;
  error?: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  accountControls?: ReactNode;
  beforeGrid?: ReactNode;
}

export function AppsDiscoveryPage(props: AppsDiscoveryPageProps) {
  const [platform, setPlatform] = useState<AppsPlatform>('web');
  const [sort, setSort] = useState<AppsSort>('latest');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const visibleApps = useMemo(
    () => filterAndSortApps(props.apps ?? [], {
      query: props.query,
      facet: props.facet,
      platform,
      sort,
    }),
    [platform, props.apps, props.facet, props.query, sort],
  );
  const state = props.error
    ? {
        title: 'Could not load crawled screens',
        description: `The catalog could not be loaded: ${props.error}`,
        role: 'alert' as const,
      }
    : props.apps !== null && props.apps.length === 0
      ? {
          title: 'No screens crawled yet',
          description: props.isAdmin
            ? 'Import captured web screens to build the first observed design system.'
            : 'No curated web apps have been published yet.',
          role: 'status' as const,
        }
      : props.apps !== null && visibleApps.length === 0
        ? {
            title: 'No Apps match these filters',
            description: 'Try a different search, taxonomy, or platform.',
            role: 'status' as const,
          }
        : null;
  const countLabel = props.isAdmin && !props.query.trim() && !props.facet && props.totalApps !== null
    ? `Showing ${visibleApps.length} of ${props.totalApps} apps`
    : `${visibleApps.length} apps`;

  return (
    <main data-apps-discovery="true" data-reference-gallery-shell="apps" className="apps-discovery">
      <ReferenceDiscoveryTopNav
        active="apps"
        className="apps-top-nav"
        search={(
          <SearchTrigger
            label={props.query || props.facet ? `${visibleApps.length} apps · search or filter…` : 'Search on Web...'}
            activeCategory={props.facet?.value ?? 'All'}
            onOpen={props.onOpenSearch}
            onClearCategory={() => props.onFacetChange(null)}
            mode={props.searchMode}
          />
        )}
        isAdmin={props.isAdmin}
        importLabel="Import App"
        onImport={props.onImport}
        accountControls={props.accountControls}
      />
      <div className="apps-discovery__content">
        {filtersOpen ? (
          <div className="apps-discovery__taxonomy" aria-label="App discovery filters">
            {APPS_DISCOVERY_FACETS.map((group) => (
              <section
                key={group.group}
                className={`apps-discovery__facet apps-discovery__facet--${group.group}`}
              >
                <h2>{group.label}</h2>
                <div>
                  {group.values.map((value) => {
                    const selected = props.facet?.group === group.group && props.facet.value === value;
                    return (
                      <Button
                        key={value}
                        label={value}
                        variant="ghost"
                        size="sm"
                        aria-pressed={selected}
                        onClick={() => props.onFacetChange(
                          selected ? null : { group: group.group, value },
                        )}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        <div className="apps-discovery__toolbar">
          <div role="radiogroup" aria-label="App platform" className="apps-discovery__platform">
            {(['ios', 'web'] as const).map((value) => (
              <Button
                key={value}
                label={value === 'ios' ? 'iOS' : 'Web'}
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={platform === value}
                onClick={() => setPlatform(value)}
              />
            ))}
          </div>
          <div role="tablist" aria-label="App ordering" className="apps-discovery__sort">
            {([
              ['latest', 'Latest'],
              ['popular', 'Most popular'],
              ['rated', 'Top rated'],
              ['animations', 'Animations'],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                label={label}
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            label="Filter"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          />
        </div>

        {props.beforeGrid}
        {props.apps !== null && !state ? <div className="apps-discovery__count">{countLabel}</div> : null}
        {state ? (
          <div className="apps-discovery__state" role={state.role}>
            <EmptyState
              title={state.title}
              description={state.description}
              actions={props.error
                ? <Button variant="primary" label="Retry" onClick={props.onRetry} />
                : undefined}
            />
          </div>
        ) : props.apps === null ? (
          <div className="apps-discovery__loading" role="status" aria-label="Loading Apps">
            {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
          </div>
        ) : (
          <>
            <div data-apps-discovery-grid="true" className="apps-discovery__grid">
              {visibleApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onOpen={() => props.onOpenApp(app.id)}
                  status={props.isAdmin
                    ? (app.analyzedScreens ?? 0) >= app.totalScreens ? 'Complete' : 'In progress'
                    : undefined}
                  progressLabel={`${app.analyzedScreens ?? 0}/${app.totalScreens} analyzed`}
                />
              ))}
            </div>
            {props.hasMore
              ? <div ref={props.sentinelRef} aria-hidden="true" className="apps-discovery__sentinel" />
              : null}
            {props.loadingMore ? (
              <div role="status" aria-label="Loading" className="apps-discovery__loading-more">
                <Spinner size="sm" aria-hidden="true" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
