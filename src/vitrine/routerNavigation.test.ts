import assert from 'node:assert/strict';
import test from 'node:test';
import { updateLocation } from './router.ts';

function target(pathname = '/apps', search = '') {
  const writes: Array<{ mode: 'push' | 'replace'; path: string }> = [];
  const events: string[] = [];
  const scrolls: ScrollToOptions[] = [];
  return {
    writes,
    events,
    scrolls,
    value: {
      location: { pathname, search },
      history: {
        pushState(_state: unknown, _title: string, path: string) {
          writes.push({ mode: 'push', path });
        },
        replaceState(_state: unknown, _title: string, path: string) {
          writes.push({ mode: 'replace', path });
        },
      },
      dispatchEvent(event: Event) {
        events.push(event.type);
        return true;
      },
      scrollTo(options: ScrollToOptions) {
        scrolls.push(options);
      },
    },
  };
}

test('writes a new location and notifies all location subscribers', () => {
  const fake = target();
  updateLocation('/search?q=checkout', { target: fake.value });
  assert.deepEqual(fake.writes, [{ mode: 'push', path: '/search?q=checkout' }]);
  assert.deepEqual(fake.events, ['popstate']);
  assert.deepEqual(fake.scrolls, [{ top: 0, left: 0, behavior: 'auto' }]);
});

test('supports replace updates and ignores the already-current location', () => {
  const fake = target('/search', '?q=checkout');
  updateLocation('/search?q=checkout', { target: fake.value, replace: true });
  assert.deepEqual(fake.writes, []);
  assert.deepEqual(fake.events, []);

  updateLocation('/search?q=pricing', { target: fake.value, replace: true });
  assert.deepEqual(fake.writes, [{ mode: 'replace', path: '/search?q=pricing' }]);
  assert.deepEqual(fake.events, ['popstate']);
  assert.deepEqual(fake.scrolls, []);
});

test('preserves scroll for query-only updates on the current page', () => {
  const fake = target('/flows', '?platform=web');
  updateLocation('/flows?platform=ios', { target: fake.value });
  assert.deepEqual(fake.writes, [{ mode: 'push', path: '/flows?platform=ios' }]);
  assert.deepEqual(fake.events, ['popstate']);
  assert.deepEqual(fake.scrolls, []);
});
