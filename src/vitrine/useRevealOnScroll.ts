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
// Word-mask rise for section headings, scroll-triggered: inside `[data-split]`
// containers, each `.hm-word-scroll` clip's inner span slides up when the
// heading enters the viewport. Initial offset is set here, not in CSS, so the
// text is fully visible without JS and under reduced motion.
export function useWordRise(
  ref: RefObject<HTMLElement | null>,
  options: { key?: unknown } = {},
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const heads = Array.from(el.querySelectorAll<HTMLElement>('[data-split]'));
    const triggers = heads.flatMap((head) => {
      const words = head.querySelectorAll('.hm-word-scroll > span');
      if (words.length === 0) return [];
      gsap.set(words, { yPercent: 115 });
      return [
        ScrollTrigger.create({
          trigger: head,
          start: 'top 88%',
          once: true,
          onEnter: () =>
            gsap.to(words, {
              yPercent: 0,
              duration: 0.75,
              ease: 'power3.out',
              stagger: 0.05,
            }),
        }),
      ];
    });
    return () => {
      for (const trigger of triggers) trigger.kill();
      for (const head of heads) {
        gsap.set(head.querySelectorAll('.hm-word-scroll > span'), {
          yPercent: 0,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.key]);
}

// Scroll-scrubbed vertical drift: children matching the selector translate a
// few px against scroll direction while their section crosses the viewport.
// Reads as depth, not as an effect — amplitude stays small on purpose.
export function useParallaxDrift(
  ref: RefObject<HTMLElement | null>,
  options: {
    selector: string;
    amplitude?: number;
    key?: unknown;
    disabled?: boolean;
  },
) {
  useLayoutEffect(() => {
    if (options.disabled) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const amp = options.amplitude ?? 26;
    const tweens = Array.from(el.querySelectorAll(options.selector)).map(
      (target, index) =>
        gsap.fromTo(
          target,
          { y: amp * (index % 2 ? -1 : 1) },
          {
            y: -amp * (index % 2 ? -1 : 1),
            ease: 'none',
            scrollTrigger: {
              trigger: target,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.6,
            },
          },
        ),
    );
    return () => {
      for (const tween of tweens) {
        tween.scrollTrigger?.kill();
        tween.kill();
      }
      gsap.set(el.querySelectorAll(options.selector), { y: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.selector, options.amplitude, options.key, options.disabled]);
}

export function useRevealOnScroll(
  ref: RefObject<HTMLElement | null>,
  options: {
    stagger?: string;
    // 'alternate-x' slides staggered children in from alternating sides —
    // scroll stays in normal flow, entrances only decorate it (framer.com
    // pattern: animation never owns the scrollbar).
    axis?: 'y' | 'alternate-x';
    key?: unknown;
    disabled?: boolean;
  } = {},
) {
  useLayoutEffect(() => {
    if (options.disabled) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = options.stagger
      ? Array.from(el.querySelectorAll(options.stagger))
      : [el];
    if (targets.length === 0) return;

    const sideways = options.axis === 'alternate-x';
    if (sideways) {
      targets.forEach((target, index) =>
        gsap.set(target, { opacity: 0, x: index % 2 ? 72 : -72 }),
      );
    } else {
      gsap.set(targets, { opacity: 0, y: 28 });
    }
    // Each child gets its own trigger when sliding sideways, so a story
    // animates when IT arrives, not when the section's top passed long ago.
    const triggers = (sideways ? targets : [el]).map((trigger) =>
      ScrollTrigger.create({
        trigger,
        start: 'top 85%',
        once: true,
        onEnter: () =>
          gsap.to(sideways ? trigger : targets, {
            opacity: 1,
            x: 0,
            y: 0,
            duration: sideways ? 0.85 : 0.65,
            ease: 'power3.out',
            stagger: !sideways && options.stagger ? 0.08 : 0,
          }),
      }),
    );
    return () => {
      for (const trigger of triggers) trigger.kill();
      // Re-armed runs re-set opacity; never leave content stuck invisible.
      gsap.set(targets, { opacity: 1, x: 0, y: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.stagger, options.axis, options.key, options.disabled]);
}
