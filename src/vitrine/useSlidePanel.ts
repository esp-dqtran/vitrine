import { useLayoutEffect, useRef } from 'react';
import { usePresence } from 'framer-motion';
import gsap from 'gsap';

// Right-edge slide-in panel (Settings, Collections) — GSAP drives the actual
// transform/opacity tweens; framer-motion's usePresence just keeps the panel
// mounted long enough for the exit tween to finish before the parent
// AnimatePresence removes it.
export function useSlidePanel() {
  const [isPresent, safeToRemove] = usePresence();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    if (!isFirst.current) return;
    isFirst.current = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(panelRef.current, { x: '100%' });
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.to(panelRef.current, { x: 0, duration: 0.4, ease: 'power3.out' });
  }, []);

  useLayoutEffect(() => {
    if (isPresent) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      safeToRemove();
      return;
    }
    const tl = gsap.timeline({ onComplete: safeToRemove });
    tl.to(panelRef.current, { x: '100%', duration: 0.28, ease: 'power2.in' }, 0);
    tl.to(overlayRef.current, { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0);
  }, [isPresent, safeToRemove]);

  return { overlayRef, panelRef };
}
