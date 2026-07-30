import {
  AlertDialog,
  Dialog,
} from '@astryxdesign/core';
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
} from 'react';

type AstryxModalPresentation =
  | 'dialog'
  | 'fullscreen'
  | 'drawer-left'
  | 'drawer-right';

export type AstryxModalProps = ComponentProps<typeof Dialog> & {
  presentation?: AstryxModalPresentation;
};

export type AstryxAlertModalProps = ComponentProps<typeof AlertDialog>;

function classNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function AstryxModal({
  className,
  presentation,
  variant,
  ...props
}: AstryxModalProps) {
  const resolvedPresentation = presentation
    ?? (variant === 'fullscreen' ? 'fullscreen' : 'dialog');

  return (
    <Dialog
      {...props}
      variant={variant}
      className={classNames(
        'astryx-modal',
        `astryx-modal--${resolvedPresentation}`,
        className,
      )}
    />
  );
}

export function AstryxAlertModal({
  className,
  ...props
}: AstryxAlertModalProps) {
  return (
    <AlertDialog
      {...props}
      className={classNames(
        'astryx-modal',
        'astryx-modal--dialog',
        'astryx-modal--alert',
        className,
      )}
    />
  );
}

export function AstryxModalSurface({
  className,
  ...props
}: ComponentPropsWithoutRef<'article'>) {
  return (
    <article
      {...props}
      className={classNames('astryx-modal__surface', className)}
    />
  );
}
