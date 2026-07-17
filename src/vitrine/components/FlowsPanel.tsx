import { useState } from 'react';
import { EmptyState } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { Platform } from '../../platformFromUrl';
import { requestExport } from '../researchApi';
import { FlowCard } from './FlowCard';
import { FlowViewer } from './FlowViewer';
import { SearchInput } from './SearchInput';

const UNCATEGORIZED = '';

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

export function FlowsPanel({ flows, app, platform }: { flows: DesignFlow<EvidenceView>[]; app?: string; platform?: Platform }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const exportFlowDoc = async () => {
    if (!app || !platform) return;
    setExporting(true); setExportMessage('');
    try {
      const { blob, filename } = await requestExport(app, platform, 'flow-md', { kind: 'design-system' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
      setExportMessage(`${filename} is ready.`);
    } catch (error) { setExportMessage((error as Error).message); }
    finally { setExporting(false); }
  };

  const selected = flows.find((flow) => flow.id === selectedId);
  if (selected) return <FlowViewer flow={selected} onBack={() => setSelectedId(null)} />;

  if (flows.length === 0) {
    return <EmptyState title="No captured flows yet" description="Import a curator-reviewed flow manifest to publish ordered evidence." />;
  }

  const query = search.trim().toLowerCase();
  const filtered = query ? flows.filter((flow) => flow.title.toLowerCase().includes(query)) : flows;
  const groups = groupByCategory(filtered);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {flows.length > 8 ? (
          <div style={{ maxWidth: 320, flex: 1 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search flows…" />
          </div>
        ) : <span />}
        {app && platform && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {exportMessage && <span role="status" style={{ fontSize: 12, color: exportMessage.includes('ready') ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{exportMessage}</span>}
            <button type="button" onClick={() => void exportFlowDoc()} disabled={exporting} title="Ordered, evidence-cited product flow documentation (Markdown) — a PRD-ready reference for product managers." style={{ border: '1px solid var(--color-border)', borderRadius: 999, padding: '9px 16px', background: 'var(--color-text-primary)', color: 'var(--color-background-surface)', cursor: exporting ? 'default' : 'pointer', font: 'inherit', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{exporting ? 'Exporting…' : 'Export FLOW.md'}</button>
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No flows match your search" description={`Nothing found for "${search}".`} />
      ) : (
        groups.map(([category, groupFlows]) => (
          <div key={category || 'uncategorized'} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {category && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{category}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{groupFlows.length}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
              {groupFlows.map((flow) => <FlowCard key={flow.id} flow={flow} onOpen={() => setSelectedId(flow.id)} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
