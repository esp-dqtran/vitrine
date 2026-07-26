import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

type DiscoveryCardKind = 'app' | 'site';

interface DiscoveryCardProps {
  kind: DiscoveryCardKind;
  ariaLabel: string;
  onOpen: () => void;
  href?: string;
  media: ReactNode;
  logo: ReactNode;
  title: ReactNode;
  description: ReactNode;
  metadata?: ReactNode;
  articleProps?: HTMLAttributes<HTMLElement>;
}

export function DiscoveryCard({
  kind,
  ariaLabel,
  onOpen,
  href,
  media,
  logo,
  title,
  description,
  metadata,
  articleProps,
}: DiscoveryCardProps) {
  const content = (
    <>
      <span className={`discovery-card__media ${kind}-discovery-card__media`}>
        {media}
      </span>
      <span className={`discovery-card__identity ${kind}-discovery-card__identity`}>
        <span className={`discovery-card__logo ${kind}-discovery-card__logo`} aria-hidden="true">
          {logo}
        </span>
        <span className={`discovery-card__copy ${kind}-discovery-card__copy`}>
          <strong>{title}</strong>
          <span>{description}</span>
          {metadata ? <small>{metadata}</small> : null}
        </span>
      </span>
    </>
  );

  const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen();
  };

  return (
    <article
      {...articleProps}
      data-reference-component="card"
      data-discovery-card="true"
      data-app-discovery-card={kind === 'app' ? 'true' : undefined}
      data-site-discovery-card={kind === 'site' ? 'true' : undefined}
      className={`discovery-card ${kind}-discovery-card`}
      role={href ? undefined : 'link'}
      tabIndex={href ? undefined : 0}
      aria-label={href ? undefined : ariaLabel}
      onClick={href ? articleProps?.onClick : onOpen}
      onKeyDown={href ? articleProps?.onKeyDown : openFromKeyboard}
    >
      {href ? (
        <a
          href={href}
          className={`discovery-card__link ${kind}-discovery-card__link`}
          aria-label={ariaLabel}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            onOpen();
          }}
        >
          {content}
        </a>
      ) : content}
    </article>
  );
}
