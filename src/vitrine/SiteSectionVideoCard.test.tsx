import assert from 'node:assert/strict';
import test from 'node:test';

test('plays at 35% visibility, pauses below it, and disconnects on cleanup', async () => {
  const module = await import('./components/SiteSectionVideoCard.tsx');
  assert.equal(typeof module.observeSiteVideoPlayback, 'function');

  let callback: IntersectionObserverCallback | undefined;
  let playCalls = 0;
  let pauseCalls = 0;
  let disconnectCalls = 0;
  const video = {
    play: async () => { playCalls += 1; },
    pause: () => { pauseCalls += 1; },
  };
  const target = {} as Element;
  const cleanup = module.observeSiteVideoPlayback(video, target, (next, options) => {
    callback = next;
    assert.deepEqual(options, { threshold: 0.35 });
    return {
      observe: (value) => assert.equal(value, target),
      disconnect: () => { disconnectCalls += 1; },
    };
  });

  callback?.(
    [{ isIntersecting: true, intersectionRatio: 0.35 } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  await Promise.resolve();
  assert.equal(playCalls, 1);

  callback?.(
    [{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  assert.equal(pauseCalls, 1);

  cleanup();
  assert.equal(disconnectCalls, 1);
});

test('consumes rejected autoplay without blocking cleanup', async () => {
  const module = await import('./components/SiteSectionVideoCard.tsx');
  assert.equal(typeof module.observeSiteVideoPlayback, 'function');

  let callback: IntersectionObserverCallback | undefined;
  let disconnectCalls = 0;
  const cleanup = module.observeSiteVideoPlayback(
    { play: async () => { throw new Error('autoplay denied'); }, pause: () => undefined },
    {} as Element,
    (next) => {
      callback = next;
      return {
        observe: () => undefined,
        disconnect: () => { disconnectCalls += 1; },
      };
    },
  );

  callback?.(
    [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  cleanup();
  assert.equal(disconnectCalls, 1);
});
