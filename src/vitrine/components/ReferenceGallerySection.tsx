import type { ReactNode } from 'react';

export function ReferenceGalleryGrid({ minCardWidth, children }: { minCardWidth: number; children: ReactNode }) {
  return (
    <div
      data-reference-gallery="grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill,minmax(${minCardWidth}px,1fr))`,
        gap: 20,
      }}
    >
      {children}
    </div>
  );
}

export function ReferenceGallerySection({
  toolbar,
  children,
  sentinel,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  sentinel?: ReactNode;
}) {
  return (
    <section
      data-reference-gallery="section"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {toolbar && (
        <div
          data-reference-gallery="toolbar"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          {toolbar}
        </div>
      )}
      <div data-reference-gallery="content">{children}</div>
      {sentinel && <div data-reference-gallery="sentinel">{sentinel}</div>}
    </section>
  );
}
