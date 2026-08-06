import { useEffect, useRef } from 'react';

/**
 * Slides one indicator between segments of an astryx SegmentedControl.
 *
 * The design-system control has no indicator element — the selected segment just
 * recolours — so nothing appears to move. CSS alone cannot do it either: each
 * segment has a different width, and a rule cannot read a sibling's geometry.
 * This measures the checked segment and publishes its offset/width as custom
 * properties, which `.astryx-segmented-control[data-indicator="ready"]::before`
 * animates with a transform.
 *
 * Pass the controlled value so the measurement re-runs when the selection moves.
 */
export function useSegmentedIndicator(activeValue: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const update = () => {
      const active = root.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!active) return;
      // Writing custom properties cannot reflow the row: the indicator they
      // drive is absolutely positioned, so this never feeds back into the observer.
      root.style.setProperty('--segmented-indicator-x', `${active.offsetLeft}px`);
      root.style.setProperty('--segmented-indicator-width', `${active.offsetWidth}px`);
      root.dataset.indicator = 'ready';
    };

    update();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeValue]);

  return ref;
}
