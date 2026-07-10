import { useState } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { FlowCard } from './FlowCard';
import { FlowViewer } from './FlowViewer';

export function FlowsPanel({ flows }: { flows: DesignFlow<EvidenceView>[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = flows.find((flow) => flow.id === selectedId);
  if (selected) return <FlowViewer flow={selected} onBack={() => setSelectedId(null)} />;
  if (flows.length === 0) {
    return <EmptyState title="No captured flows yet" description="Import a curator-reviewed flow manifest to publish ordered evidence." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {flows.map((flow) => <FlowCard key={flow.id} flow={flow} onOpen={() => setSelectedId(flow.id)} />)}
    </div>
  );
}
