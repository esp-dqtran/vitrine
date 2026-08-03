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
// Pinned scrollytelling: the container pins to the viewport and its children
// (matching the selector) crossfade-swap one per scroll segment. Children are
// stacked absolutely; the container keeps the tallest child's height so the
// page doesn't jump when pinning engages. Pass `disabled` on mobile — small
// screens read better as a plain stack.
export function usePinnedSwap(
  ref: RefObject<HTMLElement | null>,
  options: { selector: string; key?: unknown; disabled?: boolean },
) {
  useLayoutEffect(() => {
    if (options.disabled) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(options.selector));
    if (items.length < 2) return;

    const ctx = gsap.context(() => {
      const height = Math.max(
        520,
        ...items.map((item) => item.getBoundingClientRect().height),
      );
      gsap.set(el, { position: 'relative', display: 'block', height });
      items.forEach((item, index) => {
        gsap.set(item, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          autoAlpha: index === 0 ? 1 : 0,
          y: index === 0 ? 0 : 60,
        });
      });
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top 15%',
          end: `+=${(items.length - 1) * 90}%`,
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
        },
      });
      items.slice(1).forEach((item, index) => {
        timeline
          .to(items[index], { autoAlpha: 0, y: -60, duration: 1 }, index)
          .to(item, { autoAlpha: 1, y: 0, duration: 1 }, index + 0.18);
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.selector, options.key, options.disabled]);
}

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
  options: { stagger?: string; key?: unknown; disabled?: boolean } = {},
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
  }, [ref, options.stagger, options.key, options.disabled]);
}
