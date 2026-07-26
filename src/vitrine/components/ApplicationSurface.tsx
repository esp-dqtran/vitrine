import type { ReactNode } from 'react';

interface ApplicationSurfaceProps {
  page: ReactNode;
  overlays: ReactNode;
  dialogs: ReactNode;
}

export function ApplicationSurface({
  page,
  overlays,
  dialogs,
}: ApplicationSurfaceProps) {
  return (
    <div data-application-surface="true" style={{ display: 'contents' }}>
      {page}
      {overlays}
      {dialogs}
    </div>
  );
}
