import type { ReactNode } from 'react';

export interface ControlRailProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  as?: 'nav' | 'section';
  dataAttributes?: Record<`data-${string}`, string | undefined>;
}

/** Shared sticky control rail for catalog filters and detail-page navigation. */
export function ControlRail({
  ariaLabel,
  children,
  className,
  as = 'section',
  dataAttributes,
}: ControlRailProps) {
  const railClassName = `control-rail${className ? ` ${className}` : ''}`;

  if (as === 'nav') {
    return <nav className={railClassName} aria-label={ariaLabel} {...dataAttributes}>{children}</nav>;
  }

  return <section className={railClassName} aria-label={ariaLabel} {...dataAttributes}>{children}</section>;
}
