import { useState } from 'react';
import { Badge, ClickableCard } from '@astryxdesign/core';
import { PlaceholderImage } from './PlaceholderImage';
import type { Screen } from '../types';
import { screenAspectRatio } from '../screenAspect';

interface ScreenGridCardProps {
  screen: Screen;
  accent: string;
  delay: number;
  onOpen: () => void;
}

export function ScreenGridCard({ screen, accent, delay, onOpen }: ScreenGridCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <ClickableCard
      label={`Open ${screen.type} screen`}
      onClick={onOpen}
      padding={0}
      variant="muted"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: screenAspectRatio(screen.platform),
        overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
        transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <PlaceholderImage
        src={screen.thumbnailUrl ?? screen.url}
        accent={accent}
        style={{ transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
      />
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 2, display: 'flex', gap: 5, flexWrap: 'wrap', pointerEvents: 'none' }}>
        {[screen.productArea, ...(screen.visibleStates ?? []).slice(0, 1)].filter((label) => Boolean(label) && label !== 'Unclassified').map((label) => <Badge key={label} label={label} variant="neutral" style={{ background: 'rgba(24,24,27,.72)', color: '#fff', backdropFilter: 'blur(4px)' }} />)}
      </div>
    </ClickableCard>
  );
}
