import { useState } from 'react';
import { Badge, Icon, Text } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        padding: 20,
        borderRadius: 'var(--radius-container)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-background-surface)',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        cursor: 'pointer',
        transition: 'transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18, overflow: 'hidden' }}>
        {flow.steps.map((step, index) => (
          <div key={`${step.label}-${step.evidence[0]?.imageId ?? index}`} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              aria-label={step.label}
              style={{
                position: 'relative',
                flex: '0 0 108px',
                aspectRatio: '16/10',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--color-background-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              <PlaceholderImage src={step.evidence[0]?.imageUrl} />
            </div>
            {index < flow.steps.length - 1 && (
              <div style={{ flex: '0 0 auto', padding: '0 8px' }}>
                <Icon icon="chevronRight" size="sm" color="secondary" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>{flow.title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {flow.tags.map((tag) => <Badge key={tag} variant="neutral" label={tag} />)}
      </div>
      <Text type="body" color="secondary" style={{ maxWidth: 640 }}>{flow.description}</Text>
    </div>
  );
}
