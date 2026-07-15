import { useState, type ReactNode } from 'react';

interface HeroButtonProps {
  primary?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function HeroButton({ primary, onClick, children }: HeroButtonProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: '10px 22px',
        borderRadius: 999,
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform .18s cubic-bezier(.16,1,.3,1), background .15s ease',
        transform: active ? 'scale(0.96)' : hover ? 'scale(1.03)' : 'scale(1)',
        border: primary ? 'none' : '1px solid var(--color-border-emphasized)',
        background: primary ? (hover ? 'var(--color-text-secondary)' : 'var(--color-text-primary)') : hover ? 'var(--color-background-muted)' : 'transparent',
        color: primary ? 'var(--color-background-surface)' : 'var(--color-text-primary)',
      }}
    >
      {children}
    </button>
  );
}
