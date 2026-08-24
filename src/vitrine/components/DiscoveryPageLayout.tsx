import { type ReactNode, type RefObject } from 'react';
import { Button, EmptyState, Skeleton } from '@astryxdesign/core';
import { ReferenceDiscoveryPageShell } from './ReferenceDiscoveryPageShell.tsx';
import { Spinner } from './Spinner.tsx';

export interface DiscoveryPageLayoutProps {
  kind: 'apps' | 'sites' | 'flows' | 'components' | 'colors';
  header: ReactNode;
  taxonomyLabel?: string;
  taxonomy?: ReactNode;
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
  guestLimitReached?: boolean;
  onGuestLimitReached?: () => void;
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
  guestLimitReached = false,
  onGuestLimitReached,
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
          <p
            key={countLabel}
            className="reference-discovery__result-meta"
            data-discovery-result-count={countLabel}
            aria-live="polite"
          >
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
            <Spinner size="md" shade="subtle" aria-hidden="true" />
          </div>
        ) : null}
        {!error && hasResults && loadMoreError ? (
          <div className="discovery-page-layout__load-more-error" role="alert">
            <span>Could not load more {resultLabel}: {loadMoreError}</span>
            <Button label="Retry" variant="secondary" onClick={onRetryLoadMore} />
          </div>
        ) : null}
        {guestLimitReached && onGuestLimitReached ? (
          <GuestCatalogLimitPrompt onReached={onGuestLimitReached} />
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

function GuestCatalogLimitPrompt({ onReached }: { onReached: () => void }) {
  return (
    <div
      className="discovery-page-layout__guest-limit"
      data-guest-catalog-limit="true"
      role="region"
      aria-label="Continue exploring the Vitrines catalog"
    >
      <div className="discovery-page-layout__guest-limit-copy">
        <span className="discovery-page-layout__guest-limit-eyebrow">Catalog preview</span>
        <strong>Keep exploring with a free account.</strong>
        <span>Sign in or create an account to unlock the rest of Vitrines.</span>
      </div>
      <Button label="Create free account" variant="primary" onClick={onReached} />
    </div>
  );
}

function DiscoveryResultsSkeleton({
  kind,
  resultLabel,
}: Pick<DiscoveryPageLayoutProps, 'kind' | 'resultLabel'>) {
  if (kind !== 'flows') {
    return (
      <div
        className="discovery-page-layout__state"
        data-discovery-initial-loading={kind}
        role="status"
        aria-label={`Loading ${resultLabel}`}
      >
        <Spinner size="md" shade="subtle" aria-hidden="true" />
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
