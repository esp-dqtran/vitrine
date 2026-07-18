import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Fades + slides an element up the first time it scrolls into view. Sections
// below the fold currently play their entrance animation once on mount —
// which finishes long before a scrolling visitor ever sees them. This ties
// the same motion language to scroll position instead.
export function useRevealOnScroll(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.set(el, { opacity: 0, y: 28 });
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }),
    });
    return () => trigger.kill();
  }, [ref]);
}
