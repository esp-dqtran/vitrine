import type { ReactNode } from 'react';
import { Skeleton } from '@astryxdesign/core';
import { ReferenceDiscoveryTopNav } from './ReferenceDiscoveryTopNav.tsx';
import { ReferenceDetailShell } from './ReferenceDetailShell.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

interface AppDetailLoadingPageProps {
  isAdmin: boolean;
  accountControls?: ReactNode;
  onOpenSearch: () => void;
  onImport: () => void;
}

const loadingTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'screens', label: 'Screens' },
  { id: 'elements', label: 'UI Elements' },
  { id: 'flows', label: 'Flows' },
  { id: 'design-system', label: 'Design System' },
] as const;

export function AppDetailLoadingPage({
  isAdmin,
  accountControls,
  onOpenSearch,
  onImport,
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
        isAdmin={isAdmin}
        importLabel="Import App"
        onImport={onImport}
        accountControls={accountControls}
      />
      <div data-app-detail-loading="true" style={{ display: 'contents' }}>
        <ReferenceDetailShell
          dataDetailKind="app"
          className="app-detail app-detail--loading"
          title={<Skeleton width={240} height={58} radius={2} />}
          ariaLabel="Loading app detail"
          identityKey="app-detail-loading"
          identityLabel=""
          identityContent={<Skeleton width={120} height={120} radius={30} />}
          metadata={['Platform', 'Category', 'Screens', 'Last updated'].map((label, index) => ({
            label,
            value: '',
            content: <Skeleton width={index === 3 ? 124 : 86} height={26} radius={2} />,
          }))}
          actions={<Skeleton width={176} height={48} radius={999} />}
          tabs={[...loadingTabs]}
          activeTab="overview"
          onTabChange={() => undefined}
          loading
        >
          <div className="app-detail-loading__overview" aria-hidden="true">
            <Skeleton width={180} height={34} radius={2} />
            <Skeleton width={540} height={22} radius={2} />
            <div className="app-detail-loading__cards">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="app-detail-loading__card" key={index}>
                  <Skeleton width={92} height={18} radius={2} />
                  <Skeleton width={78} height={46} radius={2} />
                </div>
              ))}
            </div>
          </div>
        </ReferenceDetailShell>
      </div>
    </>
  );
}
