import { useEffect, useRef, useState } from 'react';
import type { FlowTreeGroup } from '../flowTree.ts';
import { FlowCard } from './FlowCard.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';

const FLOW_BATCH_SIZE = 8;

export interface ActiveFlowIntersection {
  flowId: string;
  isIntersecting: boolean;
  top: number;
}

export function activeFlowIdFromEntries(
  entries: ActiveFlowIntersection[],
  navigationTargetFlowId?: string,
): string | undefined {
  const intersecting = entries.filter(({ isIntersecting }) => isIntersecting);
  if (navigationTargetFlowId) {
    return intersecting.some(({ flowId }) => flowId === navigationTargetFlowId)
      ? navigationTargetFlowId
      : undefined;
  }
  return intersecting
    .sort((left, right) => Math.abs(left.top) - Math.abs(right.top))[0]
    ?.flowId;
}

export function FlowGallery({
  groups,
  onSelectFlow,
  scrollTargetFlowId,
  onScrollTargetHandled,
  onActiveFlowChange,
}: {
  groups: FlowTreeGroup[];
  onSelectFlow(flowId: string): void;
  scrollTargetFlowId?: string;
  onScrollTargetHandled?(): void;
  onActiveFlowChange?(flowId: string): void;
}) {
  const ordered = groups.flatMap(({ flows }) => flows);
  const scrollTargetIndex = scrollTargetFlowId
    ? ordered.findIndex(({ id }) => id === scrollTargetFlowId)
    : -1;
  const requiredVisibleCount = scrollTargetIndex >= 0
    ? scrollTargetIndex + 1
    : FLOW_BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(
    () => Math.max(FLOW_BATCH_SIZE, requiredVisibleCount),
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleIds = new Set(
    ordered.slice(0, visibleCount).map(({ id }) => id),
  );
  const visibleGroups = groups.flatMap((group) => {
    const visibleFlows = group.flows.filter(({ id }) => visibleIds.has(id));
    return visibleFlows.length
      ? [{ ...group, flows: visibleFlows, totalCount: group.flows.length }]
      : [];
  });
  const hasMore = visibleCount < ordered.length;

  useEffect(() => setVisibleCount(FLOW_BATCH_SIZE), [groups]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((current) =>
          Math.min(current + FLOW_BATCH_SIZE, ordered.length)
        );
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, ordered.length]);
  useEffect(() => {
    if (!scrollTargetFlowId || scrollTargetIndex < 0) return;
    if (visibleCount < requiredVisibleCount) {
      setVisibleCount(requiredVisibleCount);
      return;
    }
    const target = document.getElementById(
      `flow-gallery-${scrollTargetFlowId}`,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof IntersectionObserver === 'undefined') {
      onScrollTargetHandled?.();
    }
  }, [
    onScrollTargetHandled,
    requiredVisibleCount,
    scrollTargetFlowId,
    scrollTargetIndex,
    visibleCount,
  ]);
  useEffect(() => {
    if (
      !onActiveFlowChange ||
      typeof IntersectionObserver === 'undefined'
    ) return;

    const intersecting = new Map<string, ActiveFlowIntersection>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const flowId = (entry.target as HTMLElement).dataset.flowGalleryId;
        if (!flowId) continue;
        if (entry.isIntersecting) {
          intersecting.set(flowId, {
            flowId,
            isIntersecting: true,
            top: entry.boundingClientRect.top,
          });
        } else {
          intersecting.delete(flowId);
        }
      }
      const activeFlowId = activeFlowIdFromEntries(
        [...intersecting.values()],
        scrollTargetFlowId,
      );
      if (!activeFlowId) return;
      onActiveFlowChange(activeFlowId);
      if (activeFlowId === scrollTargetFlowId) {
        onScrollTargetHandled?.();
      }
    }, {
      rootMargin: '-18% 0px -67% 0px',
      threshold: 0,
    });

    const cards = document.querySelectorAll<HTMLElement>(
      '[data-flow-gallery-id]',
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [
    onActiveFlowChange,
    onScrollTargetHandled,
    scrollTargetFlowId,
    visibleCount,
  ]);

  return (
    <ReferenceGallerySection
      sentinel={hasMore
        ? <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
        : undefined}
    >
      <div className="flow-gallery">
        {visibleGroups.map((group) => (
          <section className="flow-gallery__group" key={group.id}>
            {!group.standalone && (
              <div className="flow-gallery__heading">
                <span>{group.label}</span>
                <span>{group.totalCount}</span>
              </div>
            )}
            <div className="flow-gallery__strips">
              {group.flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  anchorId={`flow-gallery-${flow.id}`}
                  onOpen={() => onSelectFlow(flow.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ReferenceGallerySection>
  );
}
