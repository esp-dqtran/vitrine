import type { DesignSystemSnapshot, EvidenceView } from '../../designSystem';
import type { Screen } from '../types';

export function OverviewPanel({ snapshot, screens }: { snapshot: DesignSystemSnapshot<EvidenceView> | null; screens: Screen[] }) {
  const tokens = snapshot?.tokens ?? [];
  const colors = tokens.filter(({ kind }) => kind === 'color').slice(0, 6);
  const typography = tokens.filter(({ kind }) => kind === 'typography').slice(0, 4);
  const rhythm = tokens.filter(({ kind }) => kind === 'spacing' || kind === 'radius').slice(0, 6);
  const layouts = [...new Set(screens.flatMap(({ layoutPatterns }) => layoutPatterns ?? []))].slice(0, 8);
  const card = (title: string, values: Array<{ id: string; name: string; value?: string }>) => (
    <section style={{ padding: 18, border: '1px solid var(--color-border)', borderRadius: 13 }}><h3 style={{ margin: '0 0 12px', fontSize: 14 }}>{title}</h3>{values.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{values.map((value) => <span key={value.id} style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--color-background-muted)', fontSize: 12 }}>{value.name}{value.value ? ` · ${value.value}` : ''}</span>)}</div> : <span style={{ color: 'var(--color-text-disabled)', fontSize: 12 }}>Not observed in captured screens</span>}</section>
  );
  return (
    <div style={{ display: 'grid', gap: 18, paddingTop: 28 }}>
      <div><h2 style={{ margin: 0 }}>Complete observed design system</h2><p style={{ margin: '7px 0 0', color: 'var(--color-text-secondary)' }}>Reconstructed from {screens.length} captured web screen{screens.length === 1 ? '' : 's'}. Uncaptured patterns and states are unavailable, not inferred.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {card('Primary colors', colors)}{card('Typography preview', typography)}{card('Spacing and radii', rhythm)}
        {card('Key components', (snapshot?.components ?? []).slice(0, 8).map(({ id, name }) => ({ id, name })))}
        {card('Main layout patterns', layouts.map((name) => ({ id: name, name })))}
      </div>
      <div style={{ display: 'flex', gap: 22, color: 'var(--color-text-secondary)', fontSize: 12.5 }}><span>{screens.length} analyzed screens</span><span>{snapshot?.flows.length ?? 0} curated flows</span><span>{snapshot?.components.length ?? 0} components</span></div>
    </div>
  );
}
