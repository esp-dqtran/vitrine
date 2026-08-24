import type {
  AnimationEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { AstryxModal } from './AstryxModal.tsx';

export function CommandPaletteFrame({
  children,
  dataClosing,
  dataNav,
  dataQuerying,
  isOpen,
  onAnimationEnd,
  onKeyDownCapture,
  onMouseDown,
  onOpenChange,
}: {
  children: ReactNode;
  dataClosing?: string;
  dataNav?: string;
  dataQuerying?: string;
  isOpen: boolean;
  onAnimationEnd?: AnimationEventHandler<HTMLDialogElement>;
  onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AstryxModal
      isOpen={isOpen}
      className="command-palette-dialog"
      data-closing={dataClosing}
      onAnimationEnd={onAnimationEnd}
      onOpenChange={onOpenChange}
      purpose="info"
      width="min(816px, calc(100vw - 40px))"
      maxHeight="min(594px, calc(100dvh - 48px))"
      padding={0}
    >
      <div
        className="command-palette-shell"
        data-nav={dataNav}
        data-querying={dataQuerying}
        onMouseDown={onMouseDown}
        onKeyDownCapture={onKeyDownCapture}
      >
        {children}
      </div>
    </AstryxModal>
  );
}
