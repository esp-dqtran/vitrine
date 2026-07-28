import assert from 'node:assert/strict';
import test from 'node:test';
import { flowCarouselEdges } from './components/flowCarousel.ts';

test('reports only directions that remain scrollable', () => {
  assert.deepEqual(
    flowCarouselEdges({ clientWidth: 600, scrollLeft: 0, scrollWidth: 1800 }),
    { canScrollLeft: false, canScrollRight: true },
  );
  assert.deepEqual(
    flowCarouselEdges({ clientWidth: 600, scrollLeft: 600, scrollWidth: 1800 }),
    { canScrollLeft: true, canScrollRight: true },
  );
  assert.deepEqual(
    flowCarouselEdges({ clientWidth: 600, scrollLeft: 1200, scrollWidth: 1800 }),
    { canScrollLeft: true, canScrollRight: false },
  );
});

test('hides both arrows when the strip does not overflow', () => {
  assert.deepEqual(
    flowCarouselEdges({ clientWidth: 600, scrollLeft: 0, scrollWidth: 600 }),
    { canScrollLeft: false, canScrollRight: false },
  );
});
