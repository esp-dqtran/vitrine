import { useState } from 'react';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const thumb = flow.steps[0]?.evidence[0];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        position: 'relative',
        aspectRatio: '16/10',
        borderRadius: 'var(--radius-container)',
        overflow: 'hidden',
        background: 'var(--color-background-muted)',
        border: '1px solid var(--color-border)',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        cursor: 'pointer',
        transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <PlaceholderImage
        src={thumb?.imageUrl}
        style={{ transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgba(24,24,27,.72)',
          color: '#fff',
          fontSize: 10.5,
          fontWeight: 600,
          backdropFilter: 'blur(4px)',
        }}
      >
        {flow.steps.length} {flow.steps.length === 1 ? 'step' : 'steps'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          padding: '24px 10px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {flow.title}
        </div>
      </div>
    </div>
  );
}
