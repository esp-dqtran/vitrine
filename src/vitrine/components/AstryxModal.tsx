import {
  AlertDialog,
  Dialog,
} from '@astryxdesign/core';
import {
  useCallback,
  useEffect,
  useRef,
  type Ref,
  type ComponentProps,
  type ComponentPropsWithoutRef,
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

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export function AstryxModal({
  className,
  presentation,
  variant,
  purpose,
  ...props
}: AstryxModalProps) {
  const resolvedPresentation = presentation
    ?? (variant === 'fullscreen' ? 'fullscreen' : 'dialog');

  return (
    <Dialog
      {...props}
      variant={variant}
      purpose={purpose}
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
  ref,
  isOpen,
  onOpenChange,
  ...props
}: AstryxAlertModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    assignRef(ref, node);
  }, [ref]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    const closeFromBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) onOpenChange(false);
    };
    dialog.addEventListener('click', closeFromBackdrop);
    return () => dialog.removeEventListener('click', closeFromBackdrop);
  }, [isOpen, onOpenChange]);

  return (
    <AlertDialog
      {...props}
      ref={setDialogRef}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
