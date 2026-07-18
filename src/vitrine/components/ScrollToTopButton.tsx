import { useEffect, useState } from 'react';
import { Icon, IconButton } from '@astryxdesign/core';

const SHOW_AFTER_PX = 400;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <IconButton
      label="Scroll to top"
      icon={<Icon icon="arrowUp" size="sm" color="primary" />}
      variant="secondary"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'var(--color-background-surface)',
        boxShadow: 'var(--shadow-med)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1)',
        zIndex: 30,
      }}
    />
  );
}
