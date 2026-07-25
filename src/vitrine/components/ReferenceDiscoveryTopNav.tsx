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
    <header className={className}>
      <div className={`${className}__left`}>
        <a
          href={active === 'apps' ? '/apps' : '/sites'}
          className={`${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(active === 'apps' ? { name: 'apps' } : { name: 'sites' });
          }}
        >
          <span aria-hidden="true">V</span>
          <strong>Vitrine</strong>
        </a>
        <ReferenceTypeTabs active={active} className={`${className}__types`} />
      </div>
      <div className={`${className}__search`}>{search}</div>
      <div className={`${className}__actions`}>
        {isAdmin ? <Button variant="ghost" size="sm" label={importLabel} onClick={onImport} /> : null}
        {accountControls}
      </div>
    </header>
  );
}
