import type { CSSProperties } from 'react';

interface PlaceholderImageProps {
  /** Real image URL — pass this when there's crawled data (src/db.ts). */
  src?: string;
  /** Stable label used only for neutral marketing/unavailable placeholders. */
  seed?: string;
  accent?: string;
  style?: CSSProperties;
}

export function PlaceholderImage({ src, accent, style }: PlaceholderImageProps) {
  if (!src) return <div aria-label="Captured preview unavailable" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${accent ? `${accent}22` : 'var(--color-background-muted)'}, var(--color-background-surface))`, color: 'var(--color-text-disabled)', fontSize: 11.5, letterSpacing: '.03em', ...style }}><span>Observed preview unavailable</span></div>;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: accent ? `${accent}22` : 'var(--color-background-muted)',
        ...style,
      }}
    />
  );
}
