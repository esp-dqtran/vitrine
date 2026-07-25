import type { ReactNode } from 'react';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { SearchInput } from './SearchInput.tsx';

interface SitesTopNavProps {
  query: string;
  onQueryChange: (value: string) => void;
  isAdmin: boolean;
  onImport: () => void;
  accountControls?: ReactNode;
}

export function SitesTopNav({
  query,
  onQueryChange,
  isAdmin,
  onImport,
  accountControls,
}: SitesTopNavProps) {
  return (
    <ReferenceDiscoveryTopNav
      active="sites"
      className="sites-top-nav"
      search={<SearchInput value={query} onChange={onQueryChange} placeholder="Search Sites" />}
      isAdmin={isAdmin}
      importLabel="Import Site"
      onImport={onImport}
      accountControls={accountControls}
    />
  );
}
