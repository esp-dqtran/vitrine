import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoutePath, routeToPath } from './router.ts';

test('round-trips the billing success route', () => {
  assert.deepEqual(parseRoutePath('/billing/success'), { name: 'billing-success' });
  assert.equal(routeToPath({ name: 'billing-success' }), '/billing/success');
});

test('round-trips the billing settings route used by the Stripe customer portal', () => {
  assert.deepEqual(parseRoutePath('/settings/billing'), { name: 'settings-billing' });
  assert.equal(routeToPath({ name: 'settings-billing' }), '/settings/billing');
});

test('round-trips authenticated documents and public share routes', () => {
  assert.deepEqual(parseRoutePath('/feature-documents/12'), { name: 'feature-document', documentId: 12 });
  assert.equal(routeToPath({ name: 'feature-document', documentId: 12 }), '/feature-documents/12');
  assert.deepEqual(parseRoutePath('/feature-document-shares/token_abc'), { name: 'feature-document-share', token: 'token_abc' });
  assert.equal(routeToPath({ name: 'feature-document-share', token: 'token_abc' }), '/feature-document-shares/token_abc');
});

test('round-trips current and legacy Site detail tabs while keeping the base route stable', () => {
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/preview'), { name: 'site-version', siteId: 1, versionId: 2, section: 'preview' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/pages'), { name: 'site-version', siteId: 1, versionId: 2, section: 'pages' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections'), { name: 'site-version', siteId: 1, versionId: 2, section: 'sections' });
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2, section: 'preview' }), '/sites/1/versions/2/preview');
});
