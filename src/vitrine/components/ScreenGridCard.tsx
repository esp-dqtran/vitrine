import { useState } from 'react';
import { PlaceholderImage } from './PlaceholderImage';
import type { Screen } from '../types';

interface ScreenGridCardProps {
  screen: Screen;
  accent: string;
  delay: number;
  onOpen: () => void;
}

export function ScreenGridCard({ screen, accent, delay, onOpen }: ScreenGridCardProps) {
  const [hovered, setHovered] = useState(false);
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
        animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
        transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <PlaceholderImage
        src={screen.url}
        accent={accent}
        style={{ transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
      />
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 2, display: 'flex', gap: 5, flexWrap: 'wrap', pointerEvents: 'none' }}>
        {[screen.productArea, screen.viewport, ...(screen.visibleStates ?? []).slice(0, 1)].filter(Boolean).map((label) => <span key={label} style={{ padding: '3px 7px', borderRadius: 999, background: 'rgba(24,24,27,.72)', color: '#fff', fontSize: 10.5, backdropFilter: 'blur(4px)' }}>{label}</span>)}
      </div>
    </div>
  );
}
