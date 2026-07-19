import { Icon, IconButton } from '@astryxdesign/core';

interface ArrowButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
  visible: boolean;
}

export function ArrowButton({ direction, onClick, visible }: ArrowButtonProps) {
  return (
    <IconButton
      label={direction === 'left' ? 'Previous screen' : 'Next screen'}
      icon={<Icon icon={direction === 'left' ? 'chevronLeft' : 'chevronRight'} size="sm" color="primary" />}
      variant="secondary"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: 'absolute',
        top: '50%',
        [direction === 'left' ? 'left' : 'right']: 8,
        transform: 'translateY(-50%)',
        width: 30,
        height: 30,
        borderRadius: '50%',
        // Theme tokens, not a hardcoded white: the icon is `color="primary"`, which
        // resolves light in dark mode — on a fixed white pill that was white-on-white.
        // The border keeps the pill legible against arbitrary screenshot imagery.
        background: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-low)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1)',
        zIndex: 4,
      }}
    />
  );
}
