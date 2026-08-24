import { useState } from 'react';

export interface AppIconProps {
  /** App name — used for the fallback initial and as the accessible label. */
  name: string;
  iconUrl?: string | null;
  /** Brand accent color, used as the fallback tile background. */
  accent?: string | null;
  /** Square size in px. Radius scales with it, matching the landing page mark. */
  size?: number;
  className?: string;
  /** Fallback initial color — override on light/accent-colored backgrounds. */
  fallbackTextColor?: string;
  /**
   * App icons are square, so they fill the tile. Site logos are often wordmarks
   * and have to be letterboxed instead of cropped.
   */
  fit?: 'cover' | 'contain';
  /** Optional source-type marker used by mixed App/Site catalog surfaces. */
  'data-component-source-type'?: 'app' | 'site';
}

// Shared app logo tile: renders the icon image, and falls back to an
// accent-colored initial if there's no iconUrl or the image fails to load
// (catalog icon URLs are hotlinked from app stores and sometimes 403/block
// direct <img> loads — this is what silently went blank for Deliveroo).
export function AppIcon({
  name,
  iconUrl,
  accent,
  size = 52,
  className,
  fallbackTextColor = '#fff',
  fit = 'cover',
  'data-component-source-type': componentSourceType,
}: AppIconProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(iconUrl) && !failed;
  const radius = Math.round(size * 0.25);

  return (
    <span
      className={['app-icon', className].filter(Boolean).join(' ')}
      data-component-source-type={componentSourceType}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: radius,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: showImage ? undefined : (accent || 'var(--color-background-muted)'),
      }}
    >
      {showImage ? (
        <img
          src={iconUrl ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: fit }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ fontSize: Math.round(size * 0.4), fontWeight: 700, color: fallbackTextColor, lineHeight: 1 }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
