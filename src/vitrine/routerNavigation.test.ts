import assert from 'node:assert/strict';
import test from 'node:test';
import { updateLocation } from './router.ts';

function target(pathname = '/apps', search = '') {
  const writes: Array<{ mode: 'push' | 'replace'; path: string }> = [];
  const events: string[] = [];
  return {
    writes,
    events,
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
    },
  };
}

test('writes a new location and notifies all location subscribers', () => {
  const fake = target();
  updateLocation('/search?q=checkout', { target: fake.value });
  assert.deepEqual(fake.writes, [{ mode: 'push', path: '/search?q=checkout' }]);
  assert.deepEqual(fake.events, ['popstate']);
});

test('supports replace updates and ignores the already-current location', () => {
  const fake = target('/search', '?q=checkout');
  updateLocation('/search?q=checkout', { target: fake.value, replace: true });
  assert.deepEqual(fake.writes, []);
  assert.deepEqual(fake.events, []);

  updateLocation('/search?q=pricing', { target: fake.value, replace: true });
  assert.deepEqual(fake.writes, [{ mode: 'replace', path: '/search?q=pricing' }]);
  assert.deepEqual(fake.events, ['popstate']);
});
