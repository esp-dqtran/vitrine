import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

// Slides a single indicator element to whichever registered item is active —
// the tab-underline pattern from ScreenDetail, generalized for reuse (chip
// pills, segmented tabs). First render snaps instantly; later changes tween.
//
// wraps: the indicator also tracks offsetTop/offsetHeight, not just x/width.
// Off by default (a fixed-height underline pinned to the row's bottom edge,
// ScreenDetail-style) — turn on for a full pill on a row that can wrap to
// multiple lines, where a plain x/width slide would cut across rows.
export function useSlidingIndicator<T extends string>(activeKey: T, { wraps = false } = {}) {
  const itemRefs = useRef(new Map<T, HTMLElement>());
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  const registerItem = (key: T) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  };

  useLayoutEffect(() => {
    const item = itemRefs.current.get(activeKey);
    const indicator = indicatorRef.current;
    if (!item || !indicator) return;
    const target = {
      x: item.offsetLeft,
      width: item.offsetWidth,
      ...(wraps ? { y: item.offsetTop, height: item.offsetHeight } : null),
    };
    if (isFirst.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(indicator, target);
      isFirst.current = false;
    } else {
      gsap.to(indicator, { ...target, duration: 0.35, ease: 'power3.out' });
    }
  }, [activeKey, wraps]);

  return { indicatorRef, registerItem };
}
