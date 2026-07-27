type VisibilityObserver = Pick<IntersectionObserver, 'observe' | 'disconnect'>;
type VisibilityObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => VisibilityObserver;

export function observeNearViewportMedia(
  target: Element,
  onVisible: () => void,
  createObserver: VisibilityObserverFactory = (callback, options) =>
    new IntersectionObserver(callback, options),
) {
  const observer = createObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    onVisible();
    observer.disconnect();
  }, { rootMargin: '320px 0px', threshold: 0.01 });
  observer.observe(target);
  return () => observer.disconnect();
}
