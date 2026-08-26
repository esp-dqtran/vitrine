import { useEffect, useState, type CSSProperties } from 'react';
import { EmptyState } from '@astryxdesign/core';
import { useDeliveredImageUrl } from '../mediaDelivery.ts';

interface PlaceholderImageProps {
  /** Real image URL — pass this when there's crawled data (src/db.ts). */
  src?: string;
  /** Optional density-aware alternatives for preview surfaces. */
  srcSet?: string;
  /** Stable label used only for neutral marketing/unavailable placeholders. */
  seed?: string;
  accent?: string;
  style?: CSSProperties;
}

export function PlaceholderImage({ src, srcSet, accent, style }: PlaceholderImageProps) {
  // A present-but-unservable URL (e.g. an old `capture:<hash>` scheme) should degrade to the
  // same neutral placeholder as a missing one, not a broken-image icon. Reset on src change
  // so a shared instance (e.g. the lightbox navigating) re-tries the next image.
  const [nativeFailed, setNativeFailed] = useState(false);
  const deliveredImage = useDeliveredImageUrl(src);
  useEffect(() => { setNativeFailed(false); }, [src]);
  const failed = nativeFailed || deliveredImage.failed;

  if (!src || failed) {
    return <EmptyState title="Observed preview unavailable" headingLevel={4} isCompact aria-label="Captured preview unavailable" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${accent ? `${accent}22` : 'var(--color-background-muted)'}, var(--color-background-surface))`, ...style }} />;
  }
  if (deliveredImage.loading) {
    return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: accent ? `${accent}22` : 'var(--color-background-muted)', ...style }} />;
  }
  return (
    <img
      src={deliveredImage.url}
      srcSet={deliveredImage.protected ? undefined : srcSet}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setNativeFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: accent ? `${accent}22` : 'var(--color-background-muted)',
        ...style,
      }}
    />
  );
}
