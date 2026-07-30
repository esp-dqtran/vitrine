import type { ReactNode } from 'react';
import {
  ReferenceDetailShell,
  type ReferenceDetailShellProps,
} from './ReferenceDetailShell.tsx';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

export type ReferenceDetailKind = 'app' | 'site';

export interface ReferenceDetailNavigationProps {
  kind: ReferenceDetailKind;
  searchLabel: string;
  activeCategory?: string | null;
  onClearCategory?: () => void;
  onOpenSearch?: () => void;
  searchMode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
  accountControls?: ReactNode;
}

export type ReferenceDetailPageProps<T extends string> =
  ReferenceDetailNavigationProps
  & Omit<ReferenceDetailShellProps<T>, 'dataDetailKind'>;

const noOp = () => undefined;

export function ReferenceDetailNavigation({
  kind,
  searchLabel,
  activeCategory = null,
  onClearCategory = noOp,
  onOpenSearch = noOp,
  searchMode = 'legacy',
  activeFilterCount,
  accountControls,
}: ReferenceDetailNavigationProps) {
  const active = kind === 'app' ? 'apps' : 'sites';
  const className = `${active}-top-nav`;

  return (
    <ReferenceDiscoveryTopNav
      active={active}
      className={className}
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

export function ReferenceDetailPage<T extends string>({
  kind,
  searchLabel,
  activeCategory,
  onClearCategory,
  onOpenSearch,
  searchMode,
  activeFilterCount,
  accountControls,
  ...detailProps
}: ReferenceDetailPageProps<T>) {
  return (
    <>
      <ReferenceDetailNavigation
        kind={kind}
        searchLabel={searchLabel}
        activeCategory={activeCategory}
        onClearCategory={onClearCategory}
        onOpenSearch={onOpenSearch}
        searchMode={searchMode}
        activeFilterCount={activeFilterCount}
        accountControls={accountControls}
      />
      <ReferenceDetailShell
        {...detailProps}
        dataDetailKind={kind}
      />
    </>
  );
}
