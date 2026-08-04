import { type ReactNode, type RefObject } from 'react';
import { Button, EmptyState, Skeleton } from '@astryxdesign/core';
import { AppCardSkeleton } from './AppCardSkeleton.tsx';
import { ReferenceDiscoveryPageShell } from './ReferenceDiscoveryPageShell.tsx';

export interface DiscoveryPageLayoutProps {
  kind: 'apps' | 'sites' | 'flows';
  header: ReactNode;
  taxonomyLabel: string;
  taxonomy: ReactNode;
  preview?: ReactNode;
  toolbar: ReactNode;
  resultLabel: string;
  singularResultLabel: string;
  totalCount: number | null;
  renderedCount: number;
  loading: boolean;
  loadingMore?: boolean;
  error: string | null;
  loadMoreError: string | null;
  onRetry: () => void;
  onRetryLoadMore: () => void;
  onReset?: () => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  beforeResults?: ReactNode;
  children: ReactNode;
}

export function DiscoveryPageLayout({
  kind,
  header,
  taxonomyLabel,
  taxonomy,
  preview,
  toolbar,
  resultLabel,
  singularResultLabel,
  totalCount,
  renderedCount,
  loading,
  loadingMore = false,
  error,
  loadMoreError,
  onRetry,
  onRetryLoadMore,
  onReset,
  sentinelRef,
  beforeResults,
  children,
}: DiscoveryPageLayoutProps) {
  const hasResults = renderedCount > 0;
  const countLabel = totalCount === 1 ? singularResultLabel : resultLabel;
  const initialLoading = !error && loading && !hasResults;
  const empty = !error && !loading && totalCount === 0;

  return (
    <ReferenceDiscoveryPageShell
      kind={kind}
      header={header}
      taxonomyLabel={taxonomyLabel}
      taxonomy={taxonomy}
      preview={preview}
      toolbar={toolbar}
    >
      <section
        className={`discovery-page-layout discovery-page-layout--${kind}`}
        data-discovery-page-layout={kind}
        aria-label={`${resultLabel} results`}
      >
        {totalCount !== null ? (
          <p className="reference-discovery__result-meta" aria-live="polite">
            <small>Showing</small> <strong>{totalCount} {countLabel}</strong>
          </p>
        ) : null}
        {beforeResults}
        <div className="discovery-page-layout__results">
          {error ? (
            <div className="discovery-page-layout__state" role="alert">
              <EmptyState
                title={`Could not load ${resultLabel}`}
                description={error}
                actions={<Button label="Retry" variant="primary" onClick={onRetry} />}
              />
            </div>
          ) : initialLoading ? (
            <DiscoveryResultsSkeleton kind={kind} resultLabel={resultLabel} />
          ) : empty ? (
            <div className="discovery-page-layout__state" role="status">
              <EmptyState
                title={`No ${resultLabel} found`}
                description="Try another search or remove one or more filters."
                actions={onReset
                  ? <Button label="Clear filters" variant="primary" onClick={onReset} />
                  : undefined}
              />
            </div>
          ) : children}
        </div>
        {!error && hasResults && loadingMore ? (
          <div
            className="discovery-page-layout__loading-more"
            role="status"
            aria-label={`Loading more ${resultLabel}`}
          >
            Loading more {resultLabel}…
          </div>
        ) : null}
        {!error && hasResults && loadMoreError ? (
          <div className="discovery-page-layout__load-more-error" role="alert">
            <span>Could not load more {resultLabel}: {loadMoreError}</span>
            <Button label="Retry" variant="secondary" onClick={onRetryLoadMore} />
          </div>
        ) : null}
        {sentinelRef ? (
          <div
            ref={sentinelRef}
            className="discovery-page-layout__sentinel"
            data-discovery-sentinel={kind}
            aria-hidden="true"
          />
        ) : null}
      </section>
    </ReferenceDiscoveryPageShell>
  );
}

function DiscoveryResultsSkeleton({
  kind,
  resultLabel,
}: Pick<DiscoveryPageLayoutProps, 'kind' | 'resultLabel'>) {
  if (kind !== 'flows') {
    return (
      <div
        className={`reference-discovery__grid ${kind === 'apps' ? 'apps-discovery__grid' : 'sites-discovery__grid'} discovery-page-layout__skeleton-grid`}
        role="status"
        aria-label={`Loading ${resultLabel}`}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <AppCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="discovery-page-layout__flow-skeletons"
      role="status"
      aria-label={`Loading ${resultLabel}`}
    >
      {Array.from({ length: 2 }, (_, index) => (
        <article key={index} className="discovery-page-layout__flow-skeleton" aria-hidden="true">
          <Skeleton width="100%" height={160} radius={14} index={index} />
          <div className="discovery-page-layout__flow-skeleton-copy">
            <Skeleton width="34%" height={18} radius={3} index={index} />
            <Skeleton width="54%" height={14} radius={3} index={index} />
          </div>
        </article>
      ))}
    </div>
  );
}
