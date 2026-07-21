import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoutePath, routeToPath } from './router.ts';

test('round-trips current and legacy Site detail tabs while keeping the base route stable', () => {
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/preview'), { name: 'site-version', siteId: 1, versionId: 2, section: 'preview' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/pages'), { name: 'site-version', siteId: 1, versionId: 2, section: 'pages' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections'), { name: 'site-version', siteId: 1, versionId: 2, section: 'sections' });
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2, section: 'preview' }), '/sites/1/versions/2/preview');
});
