import { useState } from 'react';
import { Card, Heading, Text } from '@astryxdesign/core';
import { PlaceholderImage } from './PlaceholderImage';
import type { DesignComponent, EvidenceView } from '../../designSystem';

export function ElementCard({ component }: { component: DesignComponent<EvidenceView> }) {
  const [hovered, setHovered] = useState(false);
  const evidence = component.variants[0]?.evidence[0];
  return (
    <Card
      role="article"
      padding={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        transition: 'transform .22s ease, box-shadow .22s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <div style={{ aspectRatio: '16/10', background: 'var(--color-background-muted)' }}>
        <PlaceholderImage src={evidence?.imageUrl} />
      </div>
      <div style={{ padding: 14 }}>
        <Heading level={3}>{component.name}</Heading>
        <div style={{ marginTop: 4 }}><Text type="supporting" color="secondary">{component.variants.length} observed variant{component.variants.length === 1 ? '' : 's'}</Text></div>
        {component.anatomy?.length ? <div style={{ marginTop: 7 }}><Text type="supporting" color="secondary">Anatomy: {component.anatomy.join(', ')}</Text></div> : null}
        <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>{component.variants.map((variant) => <div key={variant.id}><Text type="supporting"><strong>{variant.name}</strong> · {variant.evidence.length} occurrence{variant.evidence.length === 1 ? '' : 's'}{variant.observedStates?.length ? ` · ${variant.observedStates.join(', ')}` : ''}{variant.confidence != null ? ` · ${Math.round(variant.confidence * 100)}% confidence` : ''}{variant.reviewStatus ? ` · ${variant.reviewStatus}` : ''}</Text><div style={{ display: 'flex', gap: 5 }}>{variant.evidence.map((source) => <a key={source.imageId} href={source.imageUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', fontSize: 10.5 }}>Screen {source.imageId}</a>)}</div></div>)}</div>
        {component.responsiveBehavior?.length ? <div style={{ marginTop: 7 }}><Text type="supporting" color="disabled">Responsive: {component.responsiveBehavior.join('; ')}</Text></div> : null}
      </div>
    </Card>
  );
}
