import { Badge, Icon, Text } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';

export function FlowViewer({
  flow,
  onBack,
}: {
  flow: DesignFlow<EvidenceView>;
  onBack: () => void;
}) {
  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 6px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        <Icon icon="chevronLeft" size="sm" /> Back to flows
      </button>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10 }}>{flow.title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {flow.tags.map((tag) => <Badge key={tag} variant="neutral" label={tag} />)}
      </div>
      <Text type="body" color="secondary" style={{ maxWidth: 640, marginBottom: 32, display: 'block' }}>{flow.description}</Text>
      <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
        {flow.steps.map((step, index) => (
          <div key={`${step.label}-${step.evidence[0]?.imageId ?? index}`} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 'var(--radius-container)', overflow: 'hidden', background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-low)' }}>
                <PlaceholderImage src={step.evidence[0]?.imageUrl} />
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 22, height: 22, borderRadius: 11, background: '#18181b', color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{index + 1}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{step.label}</div>
            </div>
            {index < flow.steps.length - 1 && <div style={{ height: 146, padding: '0 10px', display: 'flex', alignItems: 'center' }}><Icon icon="chevronRight" size="sm" color="secondary" /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
