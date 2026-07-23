import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRouteLocation, parseRoutePath, routeToPath } from './router.ts';

test('round-trips the billing success route', () => {
  assert.deepEqual(parseRoutePath('/billing/success'), { name: 'billing-success' });
  assert.equal(routeToPath({ name: 'billing-success' }), '/billing/success');
});

test('round-trips the billing settings route used by the Stripe customer portal', () => {
  assert.deepEqual(parseRoutePath('/settings/billing'), { name: 'settings-billing' });
  assert.equal(routeToPath({ name: 'settings-billing' }), '/settings/billing');
});

test('round-trips the advanced search route without owning its query parameters', () => {
  assert.deepEqual(parseRoutePath('/search'), { name: 'search' });
  assert.equal(routeToPath({ name: 'search' }), '/search');
});

test('round-trips the public build-in-public route', () => {
  assert.deepEqual(parseRoutePath('/build-in-public'), { name: 'build-in-public' });
  assert.deepEqual(parseRoutePath('/build-in-public/'), { name: 'build-in-public' });
  assert.equal(routeToPath({ name: 'build-in-public' }), '/build-in-public');
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

test('round-trips allowlisted App evidence selections', () => {
  const screen = {
    name: 'app' as const,
    appId: '15five',
    section: 'screens',
    platform: 'web' as const,
    version: 1,
    evidence: 'SCREEN-42',
  };
  assert.equal(
    routeToPath(screen),
    '/apps/15five/screens?platform=web&version=1&evidence=SCREEN-42',
  );
  assert.deepEqual(
    parseRouteLocation('/apps/15five/screens', '?platform=web&version=1&evidence=SCREEN-42'),
    screen,
  );
  const flow = {
    name: 'app' as const,
    appId: '15five',
    section: 'flows',
    platform: 'web' as const,
    version: 1,
    flow: 'onboarding',
    step: 3,
  };
  assert.equal(
    routeToPath(flow),
    '/apps/15five/flows?platform=web&version=1&flow=onboarding&step=3',
  );
  assert.deepEqual(
    parseRouteLocation('/apps/15five/flows', '?platform=web&version=1&flow=onboarding&step=3'),
    flow,
  );
});

test('drops unknown or invalid App selection parameters', () => {
  assert.deepEqual(
    parseRouteLocation('/apps/linear/analysis', '?platform=windows&version=-1&secret=x'),
    { name: 'app', appId: 'linear', section: 'analysis' },
  );
});
