import type { ReactNode } from 'react';
import { Skeleton } from '@astryxdesign/core';

export function GalleryToolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--color-border)',
      padding: '22px 28px 14px',
      margin: '0 -28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {children}
    </div>
  );
}

export function GalleryCardSkeleton({ index }: { index: number }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 'var(--radius-container)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <Skeleton width="100%" height="100%" radius="none" index={index} />
      <div style={{ position: 'absolute', left: 10, bottom: 10 }}>
        <Skeleton width={130} height={26} radius="rounded" index={index} />
      </div>
    </div>
  );
}
