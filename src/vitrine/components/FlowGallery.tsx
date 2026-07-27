import { useEffect, useRef, useState } from 'react';
import type { FlowTreeGroup } from '../flowTree.ts';
import { FlowCard } from './FlowCard.tsx';
import { ReferenceGallerySection } from './ReferenceGallerySection.tsx';

const FLOW_BATCH_SIZE = 8;

export function FlowGallery({
  groups,
  onSelectFlow,
}: {
  groups: FlowTreeGroup[];
  onSelectFlow(flowId: string): void;
}) {
  const [visibleCount, setVisibleCount] = useState(FLOW_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const ordered = groups.flatMap(({ flows }) => flows);
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
