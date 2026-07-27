export function scrollToAdjacentFlowScreen(
  track: HTMLElement,
  direction: -1 | 1,
) {
  const screens = Array.from(
    track.querySelectorAll<HTMLElement>('[data-flow-carousel-item]'),
  );
  if (screens.length === 0) return;

  const firstLeft = screens[0].getBoundingClientRect().left;
  const offsets = screens.map(
    (screen) => screen.getBoundingClientRect().left - firstLeft,
  );
  const currentIndex = offsets.reduce((nearest, offset, index) =>
    Math.abs(offset - track.scrollLeft)
      < Math.abs(offsets[nearest] - track.scrollLeft)
      ? index
      : nearest, 0);
  const nextIndex = Math.min(
    Math.max(currentIndex + direction, 0),
    screens.length - 1,
  );

  track.scrollTo({ left: offsets[nextIndex], behavior: 'smooth' });
}
