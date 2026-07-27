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
  return (
    <header
      data-reference-component="top-nav"
      className={`reference-discovery-nav ${className}`}
    >
      <div className={`reference-discovery-nav__left ${className}__left`}>
        <a
          href={active === 'apps' ? '/apps' : '/sites'}
          aria-label={`Vitrine ${active === 'apps' ? 'Apps' : 'Sites'}`}
          className={`reference-discovery-nav__brand ${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(active === 'apps' ? { name: 'apps' } : { name: 'sites' });
          }}
        >
          <img src="/favicon.svg" alt="" aria-hidden="true" width="32" height="32" />
        </a>
        <ReferenceTypeTabs
          active={active}
          className={`reference-discovery-nav__types ${className}__types`}
        />
      </div>
      <div className={`reference-discovery-nav__search ${className}__search`}>{search}</div>
      <div className={`reference-discovery-nav__actions ${className}__actions`}>
        {accountControls}
      </div>
    </header>
  );
}
