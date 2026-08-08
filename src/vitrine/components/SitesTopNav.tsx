import type { ReactNode } from 'react';
import { ApplicationHeader } from './ApplicationHeader.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface SitesTopNavProps {
  searchLabel: string;
  activeCategory: string | null;
  onClearCategory: () => void;
  onOpenSearch: () => void;
  searchMode: 'legacy' | 'advanced';
  activeFilterCount?: number;
  accountControls?: ReactNode;
}

export function SitesTopNav({
  searchLabel,
  activeCategory,
  onClearCategory,
  onOpenSearch,
  searchMode,
  activeFilterCount,
  accountControls,
}: SitesTopNavProps) {
  return (
    <ApplicationHeader
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
      accountControls={accountControls}
    />
  );
}
