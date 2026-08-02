import assert from 'node:assert/strict';
import test from 'node:test';
import type { Route } from './router.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const privateRoutes: Route[] = [
  { name: 'signin' },
  { name: 'billing-success' },
  { name: 'settings-billing' },
  { name: 'search' },
  { name: 'app', appId: 'linear' },
  { name: 'site-version', siteSlug: 'linear' },
  { name: 'projects' },
  { name: 'project', projectId: PROJECT_ID },
  { name: 'project-document', projectId: PROJECT_ID },
  { name: 'project-playground', projectId: PROJECT_ID },
  { name: 'feature-document', documentId: 1 },
  { name: 'admin' },
];

const publicRoutes: Route[] = [
  { name: 'landing' },
  { name: 'build-in-public' },
  { name: 'pricing' },
  { name: 'apps' },
  { name: 'sites' },
  { name: 'flows' },
  { name: 'feature-document-share', token: 'public-token' },
];

test('keeps Apps, Sites, and Flows catalogs public while detail and member routes require authentication', async () => {
  const policy = await import('./routeAccess.ts').catch(() => null);
  assert.ok(policy, 'route access policy must exist');

  for (const route of privateRoutes) {
    assert.equal(policy.requiresAuthentication(route), true, route.name);
  }
  for (const route of publicRoutes) {
    assert.equal(policy.requiresAuthentication(route), false, route.name);
  }
});
