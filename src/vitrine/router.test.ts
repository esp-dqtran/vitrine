import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRouteLocation, parseRoutePath, routeToPath } from './router.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

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

test('round-trips the first-class Flows catalog route', () => {
  assert.deepEqual(parseRoutePath('/flows'), { name: 'flows' });
  assert.equal(routeToPath({ name: 'flows' }), '/flows');
});

test('round-trips the public build-in-public route', () => {
  assert.deepEqual(parseRoutePath('/build-in-public'), { name: 'build-in-public' });
  assert.deepEqual(parseRoutePath('/build-in-public/'), { name: 'build-in-public' });
  assert.equal(routeToPath({ name: 'build-in-public' }), '/build-in-public');
});

test('round-trips authenticated feature documents and public share routes', () => {
  assert.deepEqual(parseRoutePath('/feature-documents/12'), { name: 'feature-document', documentId: 12 });
  assert.equal(routeToPath({ name: 'feature-document', documentId: 12 }), '/feature-documents/12');
  assert.deepEqual(parseRoutePath('/feature-document-shares/token_abc'), { name: 'feature-document-share', token: 'token_abc' });
  assert.equal(routeToPath({ name: 'feature-document-share', token: 'token_abc' }), '/feature-document-shares/token_abc');
});

test('round-trips the Designer Project Playground with a UUID', () => {
  const route = { name: 'project-playground' as const, projectId: PROJECT_ID };
  assert.equal(routeToPath(route), `/projects/${PROJECT_ID}/playground`);
  assert.deepEqual(parseRoutePath(`/projects/${PROJECT_ID}/playground`), route);
  assert.deepEqual(parseRoutePath('/projects/7/playground'), {
    name: 'not-found',
    pathname: '/projects/7/playground',
  });
  assert.deepEqual(parseRoutePath(`/projects/${PROJECT_ID}/docs`), {
    name: 'not-found',
    pathname: `/projects/${PROJECT_ID}/docs`,
  });
});

test('round-trips the collaborative Project Document with a UUID', () => {
  const route = { name: 'project-document' as const, projectId: PROJECT_ID };
  assert.equal(routeToPath(route), `/projects/${PROJECT_ID}/document`);
  assert.deepEqual(parseRoutePath(`/projects/${PROJECT_ID}/document`), route);
  assert.deepEqual(parseRoutePath('/projects/7/document'), {
    name: 'not-found',
    pathname: '/projects/7/document',
  });
});

test('round-trips current and legacy Site detail tabs while keeping the base route stable', () => {
  assert.deepEqual(parseRoutePath('/sites/typeform'), {
    name: 'site-version',
    siteSlug: 'typeform',
  });
  assert.deepEqual(parseRoutePath('/sites/typeform/sections'), {
    name: 'site-version',
    siteSlug: 'typeform',
    section: 'sections',
  });
  assert.deepEqual(parseRoutePath('/sites/typeform/sections/42'), {
    name: 'site-version',
    siteSlug: 'typeform',
    section: 'sections',
    sectionId: 42,
  });
  assert.equal(
    routeToPath({ name: 'site-version', siteSlug: 'typeform' }),
    '/sites/typeform',
  );
  assert.equal(
    routeToPath({ name: 'site-version', siteSlug: 'typeform', section: 'sections' }),
    '/sites/typeform/sections',
  );
  assert.deepEqual(
    parseRouteLocation('/sites/typeform/sections', '?version=454'),
    { name: 'site-version', siteSlug: 'typeform', section: 'sections', version: 454 },
  );
  assert.equal(
    routeToPath({ name: 'site-version', siteSlug: 'typeform', section: 'sections', version: 454 }),
    '/sites/typeform/sections?version=454',
  );
  assert.equal(
    routeToPath({
      name: 'site-version',
      siteSlug: 'typeform',
      section: 'sections',
      sectionId: 42,
    }),
    '/sites/typeform/sections/42',
  );
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/preview'), { name: 'site-version', siteId: 1, versionId: 2, section: 'preview' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/pages'), { name: 'site-version', siteId: 1, versionId: 2, section: 'pages' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections'), { name: 'site-version', siteId: 1, versionId: 2, section: 'sections' });
  assert.deepEqual(parseRoutePath('/sites/1/versions/2/sections/42'), { name: 'site-version', siteId: 1, versionId: 2, section: 'sections', sectionId: 42 });
  assert.deepEqual(parseRoutePath('/sites/typeform/preview/42'), { name: 'not-found', pathname: '/sites/typeform/preview/42' });
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2 }), '/sites/1/versions/2');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2, section: 'preview' }), '/sites/1/versions/2/preview');
  assert.equal(routeToPath({ name: 'site-version', siteId: 1, versionId: 2, section: 'sections', sectionId: 42 }), '/sites/1/versions/2/sections/42');
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

test('normalizes legacy App Overview routes to Screens while preserving valid context', () => {
  assert.deepEqual(
    parseRouteLocation('/apps/linear/overview', '?platform=web&version=3'),
    {
      name: 'app',
      appId: 'linear',
      section: 'screens',
      platform: 'web',
      version: 3,
    },
  );
});

test('round-trips the selected Flow representation and drops invalid values', () => {
  const documentFlow = {
    name: 'app' as const,
    appId: 'linear',
    section: 'flows',
    platform: 'web' as const,
    version: 3,
    flow: 'checkout',
    step: 2,
    flowView: 'document' as const,
  };
  assert.equal(
    routeToPath(documentFlow),
    '/apps/linear/flows?platform=web&version=3&flow=checkout&step=2&flowView=document',
  );
  assert.deepEqual(
    parseRouteLocation(
      '/apps/linear/flows',
      '?platform=web&version=3&flow=checkout&step=2&flowView=document',
    ),
    documentFlow,
  );
  assert.deepEqual(
    parseRouteLocation(
      '/apps/linear/flows',
      '?platform=web&version=3&flow=checkout&flowView=split',
    ),
    {
      name: 'app',
      appId: 'linear',
      section: 'flows',
      platform: 'web',
      version: 3,
      flow: 'checkout',
    },
  );
});

test('drops unknown or invalid App selection parameters', () => {
  assert.deepEqual(
    parseRouteLocation('/apps/linear/analysis', '?platform=windows&version=-1&secret=x'),
    { name: 'app', appId: 'linear', section: 'analysis' },
  );
});

test('preserves unknown paths as an explicit not-found route', () => {
  assert.deepEqual(
    parseRoutePath('/missing/page'),
    { name: 'not-found', pathname: '/missing/page' },
  );
});

test('treats malformed encoded route segments as not found instead of throwing', () => {
  assert.doesNotThrow(() => parseRoutePath('/apps/%E0%A4%A'));
  assert.deepEqual(
    parseRoutePath('/apps/%E0%A4%A'),
    { name: 'not-found', pathname: '/apps/%E0%A4%A' },
  );
});
