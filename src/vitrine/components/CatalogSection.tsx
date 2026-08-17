import { useRef, type ReactNode } from 'react';

export interface CatalogBannerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/*
 * The band at the top of the content column. The reference sells this space;
 * with no advertisers it carries the catalog's own claim instead — the scale
 * of what has been captured, and the one action a signed-out reader can take.
 */
export function CatalogBanner({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: CatalogBannerProps) {
  return (
    <section className="catalog-banner" aria-label={title}>
      <div className="catalog-banner__copy">
        {eyebrow ? <span className="catalog-banner__eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="catalog-banner__action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export interface CatalogSectionProps {
  title: string;
  /* A short qualifier beside the title — what the row is ordered by, or when
     it was last refreshed. */
  note?: string;
  icon?: ReactNode;
  onViewAll?: () => void;
  /* A rail scrolls horizontally and shows arrows; a grid wraps. Rails are for
     rows where the crop at the edge is the affordance. */
  layout?: 'rail' | 'grid';
  children: ReactNode;
}

export function CatalogSection({
  title,
  note,
  icon,
  onViewAll,
  layout = 'rail',
  children,
}: CatalogSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  /* Scroll by roughly a card, not a fixed pixel guess, so the arrows land on
     a card boundary at any width. */
  const nudge = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  return (
    <section className="catalog-section" aria-label={title}>
      <div className="catalog-section__head">
        {icon ? <span className="catalog-section__icon">{icon}</span> : null}
        <h2>{title}</h2>
        {note ? <span className="catalog-section__note">{note}</span> : null}
        <div className="catalog-section__controls">
          {layout === 'rail' ? (
            <>
              <button
                type="button"
                aria-label={`Scroll ${title} left`}
                onClick={() => nudge(-1)}
              >
                &#8249;
              </button>
              <button
                type="button"
                aria-label={`Scroll ${title} right`}
                onClick={() => nudge(1)}
              >
                &#8250;
              </button>
            </>
          ) : null}
          {onViewAll ? (
            <button
              type="button"
              className="catalog-section__viewall"
              onClick={onViewAll}
            >
              View all
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={trackRef}
        className={layout === 'rail' ? 'catalog-section__rail' : 'catalog-section__grid'}
      >
        {children}
      </div>
    </section>
  );
}

