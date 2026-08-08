import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

const sizes = {
  sm: 14,
  md: 20,
  lg: 24,
  xl: 36,
} as const;

export type SpinnerSize = keyof typeof sizes;
export type SpinnerShade = 'default' | 'onMedia' | 'subtle' | 'inherit';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: SpinnerSize;
  shade?: SpinnerShade;
  label?: ReactNode;
}

const shadeColor: Record<SpinnerShade, string> = {
  default: 'var(--color-accent)',
  onMedia: 'var(--color-on-dark)',
  subtle: 'var(--color-text-secondary)',
  inherit: 'currentColor',
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner({
  size = 'md',
  shade = 'default',
  label,
  className,
  style,
  'aria-label': ariaLabel,
  ...rest
}, ref) {
  const frameSize = sizes[size];
  const accessibleLabel = ariaLabel ?? (typeof label === 'string' ? label : undefined) ?? 'Loading';
  const rootClassName = ['vitrine-spinner', label != null && 'vitrine-spinner--labeled', className]
    .filter(Boolean)
    .join(' ');
  const rootStyle = {
    '--vitrine-spinner-color': shadeColor[shade],
    ...style,
  } as CSSProperties;

  return (
    <span
      {...rest}
      ref={ref}
      className={rootClassName}
      style={rootStyle}
      role="status"
      aria-label={accessibleLabel}
      data-vitrine-spinner="comet"
    >
      <svg
        className="vitrine-spinner__graphic"
        width={frameSize}
        height={frameSize}
        viewBox="0 0 52 52"
        aria-hidden="true"
        focusable="false"
      >
        <path className="vitrine-spinner__track" d="M26 7 A19 19 0 1 1 7 26 A19 19 0 0 1 26 7" />
        <path data-comet-arc="head" className="vitrine-spinner__arc vitrine-spinner__arc--head" d="M26 7 A19 19 0 0 1 44.6 31" />
        <path data-comet-arc="body" className="vitrine-spinner__arc vitrine-spinner__arc--body" d="M42.5 36.8 A19 19 0 0 1 20 44.2" />
        <path data-comet-arc="tail" className="vitrine-spinner__arc vitrine-spinner__arc--tail" d="M15.2 41 A19 19 0 0 1 7.5 23" />
      </svg>
      {label != null ? <span className="vitrine-spinner__label">{label}</span> : null}
    </span>
  );
});
