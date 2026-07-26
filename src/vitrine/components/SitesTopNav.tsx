import type { ReactNode } from 'react';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface SitesTopNavProps {
  searchLabel: string;
  activeCategory: string | null;
  onClearCategory: () => void;
  onOpenSearch: () => void;
  searchMode: 'legacy' | 'advanced';
  activeFilterCount?: number;
  isAdmin: boolean;
  onImport: () => void;
  accountControls?: ReactNode;
}

export function SitesTopNav({
  searchLabel,
  activeCategory,
  onClearCategory,
  onOpenSearch,
  searchMode,
  activeFilterCount,
  isAdmin,
  onImport,
  accountControls,
}: SitesTopNavProps) {
  return (
    <ReferenceDiscoveryTopNav
      active="sites"
      className="sites-top-nav"
      search={(
        <SearchTrigger
          label={searchLabel}
          activeCategory={activeCategory}
          onOpen={onOpenSearch}
          onClearCategory={onClearCategory}
          mode={searchMode}
          activeFilterCount={activeFilterCount}
        />
      )}
      isAdmin={isAdmin}
      importLabel="Import Site"
      onImport={onImport}
      accountControls={accountControls}
    />
  );
}
