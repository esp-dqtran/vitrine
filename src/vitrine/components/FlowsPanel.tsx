import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { Platform } from '../../platformFromUrl';
import { FlowCard } from './FlowCard';
import { FlowDocEditor } from './FlowDocEditor';
import { FlowViewer } from './FlowViewer';
import { ReferenceGalleryGrid, ReferenceGallerySection } from './ReferenceGallerySection';
import { SearchInput } from './SearchInput';

const UNCATEGORIZED = '';
const FLOW_BATCH_SIZE = 24;

function groupByCategory(flows: DesignFlow<EvidenceView>[]) {
  const byCategory = new Map<string, DesignFlow<EvidenceView>[]>();
  for (const flow of flows) {
    const key = flow.category ?? UNCATEGORIZED;
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(flow);
    else byCategory.set(key, [flow]);
  }
  const categorized = [...byCategory.entries()].filter(([key]) => key !== UNCATEGORIZED).sort(([a], [b]) => a.localeCompare(b));
  const uncategorized = byCategory.get(UNCATEGORIZED);
  return uncategorized ? [[UNCATEGORIZED, uncategorized] as const, ...categorized] : categorized;
}

export function FlowsPanel({
  flows,
  app,
  platform,
  version,
  initialFlowId,
  initialStep,
}: {
  flows: DesignFlow<EvidenceView>[];
  app?: string;
  platform?: Platform;
  version?: number;
  initialFlowId?: string;
  initialStep?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialFlowId ?? null);
  const [search, setSearch] = useState('');
  const [editingDoc, setEditingDoc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FLOW_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const query = search.trim().toLowerCase();
  const filtered = query ? flows.filter((flow) => flow.title.toLowerCase().includes(query)) : flows;
  const allGroups = groupByCategory(filtered);
  const categoryTotals = new Map(allGroups.map(([category, groupFlows]) => [category, groupFlows.length]));
  const ordered = allGroups.flatMap(([, groupFlows]) => groupFlows);
  const visibleGroups = groupByCategory(ordered.slice(0, visibleCount));
  const hasMore = visibleCount < filtered.length;

  useEffect(() => setSelectedId(initialFlowId ?? null), [initialFlowId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((current) => Math.min(current + FLOW_BATCH_SIZE, filtered.length));
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, hasMore]);

  if (editingDoc && app && platform) return <FlowDocEditor app={app} platform={platform} onBack={() => setEditingDoc(false)} />;

  const selected = flows.find((flow) => flow.id === selectedId);
  if (selected) return <FlowViewer flow={selected} app={app} platform={platform} version={version} initialStep={initialStep} onBack={() => setSelectedId(null)} />;

  if (flows.length === 0) {
    return (
      <ReferenceGallerySection>
        <EmptyState title="No captured flows yet" description="Import a curator-reviewed flow manifest to publish ordered evidence." />
      </ReferenceGallerySection>
    );
  }

  const toolbar = flows.length > 8 || (app && platform) ? (
    <>
      {flows.length > 8 ? (
        <div style={{ maxWidth: 320, flex: 1 }}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setVisibleCount(FLOW_BATCH_SIZE);
            }}
            placeholder="Search flows…"
          />
        </div>
      ) : <span />}
      {app && platform && (
        <Button label="Open FLOW.md" variant="primary" size="sm" tooltip="Open the ordered, evidence-cited product flow document to edit, preview, save, or download." onClick={() => setEditingDoc(true)} style={{ borderRadius: 999 }} />
      )}
    </>
  ) : undefined;

  return (
    <ReferenceGallerySection
      toolbar={toolbar}
      sentinel={hasMore ? <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} /> : undefined}
    >
      {filtered.length === 0 ? (
        <EmptyState title="No flows match your search" description={`Nothing found for "${search}".`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {visibleGroups.map(([category, groupFlows]) => (
            <div key={category || 'uncategorized'} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {category && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{category}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{categoryTotals.get(category)}</span>
                </div>
              )}
              <ReferenceGalleryGrid minCardWidth={220}>
                {groupFlows.map((flow) => <FlowCard key={flow.id} flow={flow} onOpen={() => setSelectedId(flow.id)} />)}
              </ReferenceGalleryGrid>
            </div>
          ))}
        </div>
      )}
    </ReferenceGallerySection>
  );
}
