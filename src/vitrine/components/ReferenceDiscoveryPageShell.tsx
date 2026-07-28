import type { ReactNode } from 'react';

type ReferenceDiscoveryKind = 'apps' | 'sites' | 'flows';

interface ReferenceDiscoveryPageShellProps {
  kind: ReferenceDiscoveryKind;
  header: ReactNode;
  taxonomyLabel: string;
  taxonomy: ReactNode;
  preview: ReactNode;
  toolbar: ReactNode;
  children: ReactNode;
}

export function ReferenceDiscoveryPageShell({
  kind,
  header,
  taxonomyLabel,
  taxonomy,
  preview,
  toolbar,
  children,
}: ReferenceDiscoveryPageShellProps) {
  return (
    <main
      data-apps-discovery={kind === 'apps' ? 'true' : undefined}
      data-sites-discovery={kind === 'sites' ? 'true' : undefined}
      data-flows-discovery={kind === 'flows' ? 'true' : undefined}
      data-reference-gallery-shell={kind}
      className={`reference-discovery reference-discovery--${kind} ${kind}-discovery`}
    >
      {header}
      <div className={`reference-discovery__content ${kind}-discovery__content`}>
        <div
          className={`reference-discovery__taxonomy reference-discovery__taxonomy--${kind} ${kind}-discovery__taxonomy`}
          aria-label={taxonomyLabel}
        >
          {taxonomy}
        </div>
        {preview}
        {toolbar}
        {children}
      </div>
    </main>
  );
}
