import type { CSSProperties } from 'react';

interface PlaceholderImageProps {
  /** Real image URL — pass this when there's crawled data (src/db.ts). */
  src?: string;
  /**
   * ponytail: picsum.photos placeholder for content with no real crawl behind
   * it yet (the UI Elements library). Used only when `src` is omitted.
   */
  seed?: string;
  accent?: string;
  style?: CSSProperties;
}

export function PlaceholderImage({ src, seed, accent, style }: PlaceholderImageProps) {
  return (
    <img
      src={src ?? `https://picsum.photos/seed/${encodeURIComponent(seed ?? 'vitrine')}/640/400`}
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
