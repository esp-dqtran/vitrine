import type { ReactNode } from 'react';
import { ReferenceDetailNavigation } from './ReferenceDetailPage.tsx';
import { ReferenceDetailLoading } from './ReferenceDetailLoading.tsx';

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
      <ReferenceDetailNavigation
        kind="app"
        searchLabel="Search on Web..."
        onOpenSearch={onOpenSearch}
        accountControls={accountControls}
      />
      <ReferenceDetailLoading kind="app" label="Loading App details" />
    </>
  );
}
