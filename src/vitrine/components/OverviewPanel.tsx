import { Badge, Card, EmptyState, Heading, Text } from '@astryxdesign/core';
import type { DesignSystemSnapshot, EvidenceView } from '../../designSystem';
import type { Screen } from '../types';

export function OverviewPanel({ snapshot, screens }: { snapshot: DesignSystemSnapshot<EvidenceView> | null; screens: Screen[] }) {
  const tokens = snapshot?.tokens ?? [];
  const colors = tokens.filter(({ kind }) => kind === 'color').slice(0, 6);
  const typography = tokens.filter(({ kind }) => kind === 'typography').slice(0, 4);
  const rhythm = tokens.filter(({ kind }) => kind === 'spacing' || kind === 'radius').slice(0, 6);
  const layouts = [...new Set(screens.flatMap(({ layoutPatterns }) => layoutPatterns ?? []))].slice(0, 8);
  const card = (title: string, values: Array<{ id: string; name: string; value?: string }>) => <Card padding={4} role="region" aria-label={title}><Heading level={3}>{title}</Heading>{values.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{values.map((value) => <Badge key={value.id} label={`${value.name}${value.value ? ` · ${value.value}` : ''}`} variant="neutral" />)}</div> : <EmptyState title="Not observed in captured screens" headingLevel={4} isCompact />}</Card>;
  return (
    <div style={{ display: 'grid', gap: 18, paddingTop: 28 }}>
      <div><Heading level={2}>Complete observed design system</Heading><div style={{ marginTop: 7 }}><Text type="body" color="secondary">Reconstructed from {screens.length} captured web screen{screens.length === 1 ? '' : 's'}. Uncaptured patterns and states are unavailable, not inferred.</Text></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {card('Primary colors', colors)}{card('Typography preview', typography)}{card('Spacing and radii', rhythm)}
        {card('Key components', (snapshot?.components ?? []).slice(0, 8).map(({ id, name }) => ({ id, name })))}
        {card('Main layout patterns', layouts.map((name) => ({ id: name, name })))}
      </div>
      <div style={{ display: 'flex', gap: 22 }}><Text type="supporting" color="secondary">{screens.length} analyzed screens</Text><Text type="supporting" color="secondary">{snapshot?.flows.length ?? 0} curated flows</Text><Text type="supporting" color="secondary">{snapshot?.components.length ?? 0} components</Text></div>
    </div>
  );
}
