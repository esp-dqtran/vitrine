import { useState } from 'react';
import { Icon } from '@astryxdesign/core';

interface ArrowButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
  visible: boolean;
}

export function ArrowButton({ direction, onClick, visible }: ArrowButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={direction === 'left' ? 'Previous screen' : 'Next screen'}
      style={{
        position: 'absolute',
        top: '50%',
        [direction === 'left' ? 'left' : 'right']: 8,
        transform: `translateY(-50%) scale(${hover ? 1.08 : 1})`,
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: hover ? 'var(--shadow-med)' : 'var(--shadow-low)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease',
        zIndex: 4,
        padding: 0,
      }}
    >
      <Icon icon={direction === 'left' ? 'chevronLeft' : 'chevronRight'} size="sm" color="primary" />
    </button>
  );
}
