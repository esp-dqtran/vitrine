import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Fades + slides an element up the first time it scrolls into view. Sections
// below the fold currently play their entrance animation once on mount —
// which finishes long before a scrolling visitor ever sees them. This ties
// the same motion language to scroll position instead.
//
// With `stagger`, children matching the selector cascade in one after another
// instead of the section arriving as a single slab. `key` re-arms the effect
// when async content lands (the catalog loads after mount, so the children
// the selector matches don't exist on first run).
export function useRevealOnScroll(
  ref: RefObject<HTMLElement | null>,
  options: { stagger?: string; key?: unknown } = {},
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = options.stagger
      ? Array.from(el.querySelectorAll(options.stagger))
      : [el];
    if (targets.length === 0) return;

    gsap.set(targets, { opacity: 0, y: 28 });
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power3.out',
          stagger: options.stagger ? 0.08 : 0,
        }),
    });
    return () => {
      trigger.kill();
      // Re-armed runs re-set opacity; never leave content stuck invisible.
      gsap.set(targets, { opacity: 1, y: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.stagger, options.key]);
}
