import { useState, type ReactNode } from 'react';

interface HeroButtonProps {
  primary?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

// ponytail: bespoke translucent CTA for the dark hero backdrop — Astryx Button
// reads theme tokens, which don't give a legible result over a fixed-dark image
// hero. Kept intentionally outside the design system for this one surface.
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
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.25)',
        background: primary ? (hover ? '#f2f2f2' : '#fff') : hover ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: primary ? '#18181b' : '#fff',
      }}
    >
      {children}
    </button>
  );
}
