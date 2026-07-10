import { useState } from 'react';
import { PlaceholderImage } from './PlaceholderImage';
import type { DesignComponent, EvidenceView } from '../../designSystem';

export function ElementCard({ component }: { component: DesignComponent<EvidenceView> }) {
  const [hovered, setHovered] = useState(false);
  const evidence = component.variants[0]?.evidence[0];
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        overflow: 'hidden',
        borderRadius: 'var(--radius-container)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-background-surface)',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        transition: 'transform .22s ease, box-shadow .22s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <div style={{ aspectRatio: '16/10', background: 'var(--color-background-muted)' }}>
        <PlaceholderImage src={evidence?.imageUrl} />
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 650 }}>{component.name}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          {component.variants.length} observed variant{component.variants.length === 1 ? '' : 's'}
        </div>
      </div>
    </article>
  );
}
