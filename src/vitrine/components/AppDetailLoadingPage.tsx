import type { ReactNode } from 'react';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { ReferenceDetailLoading } from './ReferenceDetailLoading.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface AppDetailLoadingPageProps {
  accountControls?: ReactNode;
  onOpenSearch: () => void;
}

export function AppDetailLoadingPage({
  accountControls,
  onOpenSearch,
}: AppDetailLoadingPageProps) {
  return (
    <>
      <ReferenceDiscoveryTopNav
        active="apps"
        className="apps-top-nav"
        search={(
          <SearchTrigger
            label="Search on Web..."
            activeCategory={null}
            onOpen={onOpenSearch}
            onClearCategory={() => undefined}
          />
        )}
        accountControls={accountControls}
      />
      <ReferenceDetailLoading kind="app" label="Loading App details" />
    </>
  );
}
