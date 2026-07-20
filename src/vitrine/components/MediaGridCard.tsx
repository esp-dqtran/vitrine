import { useState } from 'react';
import { Badge, ClickableCard } from '@astryxdesign/core';

interface MediaGridCardProps {
  label: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  posterUrl?: string;
  accent?: string;
  aspectRatio?: string | number;
  badges?: string[];
  delay?: number;
  onOpen: () => void;
}

export function MediaGridCard({
  label,
  kind,
  url,
  thumbnailUrl,
  posterUrl,
  accent,
  aspectRatio = '16 / 10',
  badges = [],
  delay = 0,
  onOpen,
}: MediaGridCardProps) {
  const [hovered, setHovered] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  return (
    <ClickableCard
      label={label}
      onClick={onOpen}
      padding={0}
      variant="muted"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio,
        overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
        transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      {mediaFailed ? (
        <div role="img" aria-label="Preview unavailable" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', background: `linear-gradient(135deg, ${accent ? `${accent}22` : 'var(--color-background-muted)'}, var(--color-background-surface))` }}>
          Preview unavailable
        </div>
      ) : kind === 'video' ? (
        <video
          src={url}
          poster={posterUrl}
          controls
          muted
          playsInline
          preload="metadata"
          onError={() => setMediaFailed(true)}
          onClick={(event) => event.stopPropagation()}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}
        />
      ) : (
        <img
          src={thumbnailUrl ?? url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setMediaFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: accent ? `${accent}22` : 'var(--color-background-muted)', transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
        />
      )}
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 2, display: 'flex', gap: 5, flexWrap: 'wrap', pointerEvents: 'none' }}>
        {badges.filter(Boolean).map((badge) => <Badge key={badge} label={badge} variant="neutral" style={{ background: 'rgba(24,24,27,.72)', color: '#fff', backdropFilter: 'blur(4px)' }} />)}
      </div>
    </ClickableCard>
  );
}
