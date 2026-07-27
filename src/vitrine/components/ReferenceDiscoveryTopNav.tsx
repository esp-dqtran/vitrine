import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core';
import { navigate } from '../router.ts';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ReferenceDiscoveryTopNavProps {
  active: ReferenceType;
  className: string;
  search: ReactNode;
  isAdmin: boolean;
  importLabel: string;
  onImport: () => void;
  accountControls?: ReactNode;
}

export function ReferenceDiscoveryTopNav({
  active,
  className,
  search,
  isAdmin,
  importLabel,
  onImport,
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
          <strong>Vitrine</strong>
        </a>
        <ReferenceTypeTabs
          active={active}
          className={`reference-discovery-nav__types ${className}__types`}
        />
      </div>
      <div className={`reference-discovery-nav__search ${className}__search`}>{search}</div>
      <div className={`reference-discovery-nav__actions ${className}__actions`}>
        {isAdmin ? <Button variant="ghost" size="sm" label={importLabel} onClick={onImport} /> : null}
        {accountControls}
      </div>
    </header>
  );
}
