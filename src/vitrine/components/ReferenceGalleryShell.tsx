import type { ReactNode } from 'react';
import { EmptyState } from '@astryxdesign/core';
import { GalleryCardSkeleton, GalleryToolbar } from './GalleryToolbar.tsx';
import { PageHeader } from './PageHeader.tsx';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ReferenceGalleryState {
  title: string;
  description: string;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}

interface ReferenceGalleryShellProps {
  active: ReferenceType;
  isAdmin: boolean;
  headerAction?: ReactNode;
  toolbar: ReactNode;
  memberControls?: ReactNode;
  beforeCount?: ReactNode;
  countLabel?: string;
  loading?: boolean;
  state?: ReferenceGalleryState;
  children?: ReactNode;
  trailing?: ReactNode;
}

export function ReferenceGalleryShell({
  active,
  isAdmin,
  headerAction,
  toolbar,
  memberControls,
  beforeCount,
  countLabel,
  loading = false,
  state,
  children,
  trailing,
}: ReferenceGalleryShellProps) {
  const label = active === 'apps' ? 'Apps' : 'Sites';

  return (
    <main
      data-reference-gallery-shell={active}
      style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px 72px' }}
    >
      {isAdmin ? (
        <PageHeader
          title="References"
          description="Browse app and website design references."
          action={headerAction}
        />
      ) : null}
      <ReferenceTypeTabs active={active} />
      <GalleryToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {!isAdmin ? (
            <div
              data-reference-gallery-identity="true"
              style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 11, height: 11, borderRadius: 3, background: '#FFFFFF' }} />
              </div>
              <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Vitrine
              </span>
            </div>
          ) : null}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>{toolbar}</div>
          {!isAdmin ? memberControls : null}
        </div>
      </GalleryToolbar>
      {beforeCount}
      {countLabel ? (
        <div style={{ padding: '6px 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {countLabel}
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-label={`Loading ${label}`}>
          <div
            data-reference-gallery-grid="true"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}
          >
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} data-reference-gallery-skeleton="true">
                <GalleryCardSkeleton index={index} />
              </div>
            ))}
          </div>
        </div>
      ) : state ? (
        <div role={state.role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, padding: 24 }}>
          <EmptyState title={state.title} description={state.description} actions={state.actions} />
        </div>
      ) : (
        <>
          <div
            data-reference-gallery-grid="true"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 22, paddingBottom: 72 }}
          >
            {children}
          </div>
          {trailing}
        </>
      )}
    </main>
  );
}
