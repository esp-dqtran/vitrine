import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import type { DesignSystemSnapshot, EvidenceView } from '../../designSystem';
import type { CuratorAction } from '../../curatorReview';
import type { Platform } from '../../platformFromUrl';
import { applyReviewAction } from '../researchApi';
import { loadDesignSystem } from '../useDesignSystem';
import { AppKnowledgeReviewWorkspace } from './AppKnowledgeReviewPanel';

export function CuratorReviewPanel({
  app,
  platform,
  version,
  snapshot,
}: {
  app: string;
  platform: Platform;
  version?: number;
  snapshot: DesignSystemSnapshot<EvidenceView> | null;
}) {
  const [working, setWorking] = useState(snapshot);
  const [message, setMessage] = useState('');
  const [workspace, setWorkspace] = useState<'design-system' | 'app-knowledge'>('design-system');
  useEffect(() => setWorking(snapshot), [snapshot]);
  const act = async (action: CuratorAction) => { try { await applyReviewAction(app, platform, action); setWorking(await loadDesignSystem(app, platform)); setMessage('Saved without changing evidence links.'); } catch (error) { setMessage((error as Error).message); } };
  const rename = (kind: 'token' | 'component' | 'variant' | 'rule', id: string, current: string, componentId?: string) => { const name = window.prompt('Reviewed name', current)?.trim(); if (name) void act({ type: 'rename', kind, id, name, componentId }); };
  const reject = (kind: 'token' | 'component' | 'variant' | 'rule', id: string, componentId?: string) => { if (window.confirm('Reject this extracted item? Its source screen remains in the version.')) void act({ type: 'reject', kind, id, componentId }); };
  const merge = () => { const ids = window.prompt('Component ids to merge, comma separated')?.split(',').map((value) => value.trim()).filter(Boolean); if (!ids || ids.length < 2) return; const targetId = window.prompt('Merged component id', ids[0])?.trim(); const name = window.prompt('Merged component name')?.trim(); if (targetId && name) void act({ type: 'merge-components', ids, targetId, name }); };
  const split = (id: string) => { const variantIds = window.prompt('Variant ids to move, comma separated')?.split(',').map((value) => value.trim()).filter(Boolean); const newId = window.prompt('New component id')?.trim(); const name = window.prompt('New component name')?.trim(); if (variantIds?.length && newId && name) void act({ type: 'split-component', id, variantIds, newId, name }); };
  return (
    <div style={{ display: 'grid', gap: 22, paddingTop: 28 }}>
      <SegmentedControl value={workspace} onChange={(value) => setWorkspace(value as typeof workspace)} label="Review workspace" size="sm">
        <SegmentedControlItem value="design-system" label="Design System" />
        <SegmentedControlItem value="app-knowledge" label="App Knowledge" />
      </SegmentedControl>
      {workspace === 'app-knowledge' ? (
        <AppKnowledgeReviewWorkspace app={app} platform={platform} version={version} />
      ) : !working ? (
        <EmptyState title="No design system to review" description="Generate a working design system before opening curator review." />
      ) : (
        <>
          <div><h2 style={{ margin: 0 }}>Curator review</h2><p style={{ color: 'var(--color-text-secondary)' }}>Rename, reject, merge, or split extracted entities. These actions preserve captured screens and retained evidence IDs.</p></div>
          <section>
            <h3>Foundation tokens</h3>
            {working.tokens.map((token) => <Card key={token.id} padding={2} style={rowStyle}><span style={{ flex: 1 }}><strong>{token.name}</strong> · {token.id} · {token.evidence.length} sources</span><Button label="Rename" size="sm" onClick={() => rename('token', token.id, token.name)} /><Button label="Reject" variant="destructive" size="sm" onClick={() => reject('token', token.id)} /></Card>)}
          </section>
          <section>
            <div style={{ display: 'flex', alignItems: 'center' }}><h3 style={{ flex: 1 }}>Components and variants</h3><Button label="Merge components" size="sm" onClick={merge} /></div>
            {working.components.map((component) => <Card key={component.id} padding={2} style={{ marginTop: 7 }}><div style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ flex: 1 }}><strong>{component.name}</strong> · {component.id}</span><Button label="Rename" size="sm" onClick={() => rename('component', component.id, component.name)} /><Button label="Split" size="sm" onClick={() => split(component.id)} /><Button label="Reject" variant="destructive" size="sm" onClick={() => reject('component', component.id)} /></div>{component.variants.map((variant) => <div key={variant.id} style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 8, paddingLeft: 16, fontSize: 12 }}><span style={{ flex: 1 }}>{variant.name} · {variant.id} · evidence {variant.evidence.map((item) => item.imageId).join(', ')}</span><Button label="Rename" size="sm" onClick={() => rename('variant', variant.id, variant.name, component.id)} /><Button label="Reject" variant="destructive" size="sm" onClick={() => reject('variant', variant.id, component.id)} /></div>)}</Card>)}
          </section>
          {message && <div role="status">{message}</div>}
        </>
      )}
    </div>
  );
}
const rowStyle = { display: 'flex', gap: 7, alignItems: 'center', marginTop: 7, fontSize: 12.5 };
