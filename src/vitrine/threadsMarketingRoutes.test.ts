import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoutePath, routeToPath } from './router.ts';

test('Threads marketing is a canonical Admin route', () => {
  assert.deepEqual(parseRoutePath('/admin/threads'), { name: 'admin', section: 'threads' });
  assert.equal(routeToPath({ name: 'admin', section: 'threads' }), '/admin/threads');
});
