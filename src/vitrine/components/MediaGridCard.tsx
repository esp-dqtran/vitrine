import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { ClickableCard } from '@astryxdesign/core';
import { observeNearViewportMedia } from './deferredMedia.ts';
import { useDeliveredImageUrl } from '../mediaDelivery.ts';

interface MediaGridCardBaseProps {
  label: string;
  kind: 'image' | 'video';
  url?: string;
  thumbnailUrl?: string | null;
  posterUrl?: string;
  accent?: string;
  aspectRatio?: string | number;
  imageFit?: 'cover' | 'contain';
  preserveNaturalAspectRatio?: boolean;
  preferFullImage?: boolean;
  deferMedia?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  title?: string;
  overlay?: ReactNode;
  delay?: number;
}

type MediaGridCardProps = MediaGridCardBaseProps & (
  | { href: string; onOpen?: never }
  | { href?: undefined; onOpen: () => void }
);

export function MediaGridCard({
  label,
  kind,
  url,
  thumbnailUrl,
  posterUrl,
  accent,
  aspectRatio = '16 / 10',
  imageFit = 'contain',
  preserveNaturalAspectRatio = false,
  preferFullImage = false,
  deferMedia = false,
  autoPlay = false,
  loop = false,
  title,
  overlay,
  delay = 0,
  href,
  onOpen,
}: MediaGridCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [mediaActive, setMediaActive] = useState(!deferMedia);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(null);
  const imageSrc = preferFullImage ? url : thumbnailUrl ?? url;
  const deliveredImage = useDeliveredImageUrl(imageSrc, mediaActive && kind === 'image');
  const displayedImageSrc = deliveredImage.url;
  const imageSrcSet = !preferFullImage && thumbnailUrl && url && thumbnailUrl !== url
    ? `${thumbnailUrl} 1x,${url} 2x`
    : undefined;

  useEffect(() => {
    setMediaFailed(false);
  }, [kind, url, thumbnailUrl]);

  useEffect(() => {
    const card = cardRef.current;
    if (!deferMedia || mediaActive || !card) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMediaActive(true);
      return;
    }
    return observeNearViewportMedia(card, () => setMediaActive(true));
  }, [deferMedia, mediaActive]);

  const activateMedia = () => {
    setMediaActive(true);
  };
  const captureNaturalAspectRatio = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!preserveNaturalAspectRatio) return;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setNaturalAspectRatio(naturalWidth / naturalHeight);
    }
  };
  const cardStyle = {
    position: 'relative' as const,
    aspectRatio: preserveNaturalAspectRatio && naturalAspectRatio
      ? naturalAspectRatio
      : aspectRatio,
    overflow: 'hidden',
    boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
    animation: `vtFadeUp .45s cubic-bezier(.16,1,.3,1) ${delay}s both`,
    transition: 'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1)',
    transform: hovered ? 'translateY(-4px)' : 'none',
  };
  const authenticatedImageLoading = mediaActive && deliveredImage.loading && !mediaFailed;
  const previewFailed = mediaFailed || deliveredImage.failed;
  const contents = (
    <>
      {!mediaActive || authenticatedImageLoading ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: accent ? `${accent}22` : 'var(--color-background-muted)' }} />
      ) : previewFailed || (kind === 'image' ? !displayedImageSrc : !url) ? (
        <div role="img" aria-label="Preview unavailable" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', background: `linear-gradient(135deg, ${accent ? `${accent}22` : 'var(--color-background-muted)'}, var(--color-background-surface))` }}>
          Preview unavailable
        </div>
      ) : kind === 'video' ? (
        <video
          src={url}
          poster={posterUrl}
          autoPlay={autoPlay}
          loop={loop}
          controls={!autoPlay}
          muted
          playsInline
          preload="metadata"
          onError={() => setMediaFailed(true)}
          onClick={autoPlay ? undefined : (event) => event.stopPropagation()}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imageFit, background: '#111' }}
        />
      ) : (
        <img
          src={displayedImageSrc}
          srcSet={deliveredImage.protected ? undefined : imageSrcSet}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={captureNaturalAspectRatio}
          onError={() => setMediaFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imageFit, background: accent ? `${accent}22` : 'var(--color-background-muted)', transform: hovered && imageFit === 'cover' ? 'scale(1.04)' : 'scale(1)', transition: 'transform .3s cubic-bezier(.16,1,.3,1)' }}
        />
      )}
      {title && (
        <div
          data-media-grid-card-title="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            padding: '28px 10px 10px',
            background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {title}
        </div>
      )}
      {overlay}
    </>
  );

  if (kind === 'image') {
    return (
      <ClickableCard
        ref={cardRef}
        label={label}
        href={href}
        onClick={href ? undefined : onOpen}
        padding={0}
        variant="muted"
        onMouseEnter={() => {
          setHovered(true);
          setMediaActive(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={activateMedia}
        style={cardStyle}
      >
        {contents}
      </ClickableCard>
    );
  }

  return (
    <ClickableCard
      ref={cardRef}
      label={label}
      href={href}
      onClick={href ? undefined : onOpen}
      padding={0}
      variant="muted"
      onMouseEnter={() => {
        setHovered(true);
        setMediaActive(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={activateMedia}
      style={cardStyle}
    >
      {contents}
    </ClickableCard>
  );
}
