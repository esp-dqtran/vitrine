import { type ReactNode, type RefObject } from 'react';
import { Button } from '@astryxdesign/core';
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
  sentinelRef: RefObject<HTMLDivElement | null>;
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
              <p>Could not load {resultLabel}: {error}</p>
              <Button label="Retry" variant="primary" onClick={onRetry} />
            </div>
          ) : initialLoading ? (
            <div className="discovery-page-layout__state" role="status" aria-label={`Loading ${resultLabel}`}>
              Loading {resultLabel}…
            </div>
          ) : empty ? (
            <div className="discovery-page-layout__state" role="status">
              No {resultLabel} found
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
        <div
          ref={sentinelRef}
          className="discovery-page-layout__sentinel"
          data-discovery-sentinel={kind}
          aria-hidden="true"
        />
      </section>
    </ReferenceDiscoveryPageShell>
  );
}
