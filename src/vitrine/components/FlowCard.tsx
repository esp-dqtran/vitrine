import { useState } from 'react';
import { Badge, ClickableCard, Text } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const thumb = flow.steps[0]?.evidence[0];
  return (
    <ClickableCard
      label={`Open ${flow.title} flow`}
      onClick={onOpen}
      padding={0}
      variant="muted"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '16/10',
        overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <PlaceholderImage
        src={thumb?.imageUrl}
        style={{ transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
      />
      <Badge label={`${flow.steps.length} ${flow.steps.length === 1 ? 'step' : 'steps'}`} variant="neutral" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: '#fff', background: 'rgba(24,24,27,.72)', backdropFilter: 'blur(4px)' }} />
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
        <Text type="supporting" weight="semibold"><span style={{ color: '#fff' }}>{flow.title}</span></Text>
      </div>
    </ClickableCard>
  );
}
