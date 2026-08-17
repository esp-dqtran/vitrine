import { useEffect, useState, type ReactNode } from 'react';
import { navigate, routeToPath } from '../router.ts';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ApplicationHeaderProps {
  active: ReferenceType;
  className: string;
  search: ReactNode;
  accountControls?: ReactNode;
  contextIconUrl?: string | null;
}

export function ApplicationHeader({
  active,
  className,
  search,
  accountControls,
  contextIconUrl,
}: ApplicationHeaderProps) {
  const [showContextIcon, setShowContextIcon] = useState(false);
  useEffect(() => {
    if (!contextIconUrl) {
      setShowContextIcon(false);
      return;
    }
    const updateContextIcon = () => setShowContextIcon(window.scrollY > 16);
    updateContextIcon();
    window.addEventListener('scroll', updateContextIcon, { passive: true });
    return () => window.removeEventListener('scroll', updateContextIcon);
  }, [contextIconUrl]);
  const activeRoute = active === 'apps'
    ? { name: 'apps' } as const
    : active === 'sites'
      ? { name: 'sites' } as const
      : active === 'color'
        ? { name: 'color' } as const
      : active === 'flows'
        ? { name: 'flows' } as const
        : { name: 'projects' } as const;
  const activeLabel = active === 'apps'
    ? 'Apps'
    : active === 'sites'
      ? 'Sites'
      : active === 'color'
        ? 'Colors'
      : active === 'flows' ? 'Flows' : 'Projects';
  return (
    <header
      data-reference-component="top-nav"
      className={`reference-discovery-nav ${className}`}
    >
      <div className={`reference-discovery-nav__left ${className}__left`}>
        <a
          href={routeToPath(activeRoute)}
          aria-label={`Vitrines ${activeLabel}`}
          className={`reference-discovery-nav__brand ${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(activeRoute);
          }}
        >
          <span
            className={`reference-discovery-nav__identity${showContextIcon ? ' is-context-visible' : ''}`}
          >
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              width="32"
              className="reference-discovery-nav__brand-icon"
            />
            {contextIconUrl ? (
              <img
                src={contextIconUrl}
                alt=""
                aria-hidden="true"
                width="32"
                className="reference-discovery-nav__context-icon"
                onError={(event) => { event.currentTarget.classList.add('is-unavailable'); }}
              />
            ) : null}
          </span>
        </a>
        <ReferenceTypeTabs
          active={active}
          className={`reference-discovery-nav__types ${className}__types`}
          values={active === 'projects' ? ['projects'] : undefined}
        />
      </div>
      <div className={`reference-discovery-nav__search ${className}__search`}>{search}</div>
      <div className={`reference-discovery-nav__actions ${className}__actions`}>
        {accountControls}
      </div>
    </header>
  );
}
