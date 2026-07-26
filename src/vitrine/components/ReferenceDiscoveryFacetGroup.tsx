import type { ReactNode } from 'react';

interface ReferenceDiscoveryFacetGroupProps {
  label: string;
  className?: string;
  wide?: boolean;
  children: ReactNode;
}

export function ReferenceDiscoveryFacetGroup({
  label,
  className,
  wide = false,
  children,
}: ReferenceDiscoveryFacetGroupProps) {
  return (
    <section
      data-reference-component="facet-group"
      className={[
        'reference-discovery__facet',
        wide ? 'reference-discovery__facet--wide' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      <h2>{label}</h2>
      <div>{children}</div>
    </section>
  );
}
