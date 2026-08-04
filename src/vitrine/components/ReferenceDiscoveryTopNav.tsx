import type { ReactNode } from 'react';
import { navigate } from '../router.ts';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ReferenceDiscoveryTopNavProps {
  active: ReferenceType;
  className: string;
  search: ReactNode;
  accountControls?: ReactNode;
}

export function ReferenceDiscoveryTopNav({
  active,
  className,
  search,
  accountControls,
}: ReferenceDiscoveryTopNavProps) {
  const activeRoute = active === 'apps'
    ? { name: 'apps' } as const
    : active === 'sites'
      ? { name: 'sites' } as const
      : active === 'flows'
        ? { name: 'flows' } as const
        : { name: 'projects' } as const;
  const activeLabel = active === 'apps'
    ? 'Apps'
    : active === 'sites'
      ? 'Sites'
      : active === 'flows' ? 'Flows' : 'Projects';
  return (
    <header
      data-reference-component="top-nav"
      className={`reference-discovery-nav ${className}`}
    >
      <div className={`reference-discovery-nav__left ${className}__left`}>
        <a
          href={`/${active}`}
          aria-label={`Vitrines ${activeLabel}`}
          className={`reference-discovery-nav__brand ${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(activeRoute);
          }}
        >
          <img src="/favicon.svg" alt="" aria-hidden="true" width="32" />
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
