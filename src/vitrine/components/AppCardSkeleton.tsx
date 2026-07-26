import { Skeleton } from '@astryxdesign/core';

export function AppCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <article
      className="discovery-card app-discovery-card app-card-skeleton"
      data-app-card-skeleton="true"
      aria-hidden="true"
    >
      <span className="discovery-card__media app-discovery-card__media app-card-skeleton__media">
        <Skeleton width="100%" height="100%" radius="rounded" index={index} />
      </span>
      <span className="discovery-card__identity app-discovery-card__identity">
        <span className="discovery-card__logo app-discovery-card__logo app-card-skeleton__logo">
          <Skeleton width="100%" height="100%" radius="rounded" index={index} />
        </span>
        <span className="discovery-card__copy app-discovery-card__copy">
          <span className="app-card-skeleton__title">
            <Skeleton width="44%" height={16} radius={2} index={index} />
          </span>
          <span className="app-card-skeleton__description">
            <Skeleton width="76%" height={14} radius={2} index={index} />
          </span>
          <span className="app-card-skeleton__metadata">
            <Skeleton width="58%" height={12} radius={2} index={index} />
          </span>
        </span>
      </span>
    </article>
  );
}
