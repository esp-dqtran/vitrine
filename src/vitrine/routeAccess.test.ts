import assert from 'node:assert/strict';
import test from 'node:test';
import type { Route } from './router.ts';

const privateRoutes: Route[] = [
  { name: 'signin' },
  { name: 'billing-success' },
  { name: 'settings-billing' },
  { name: 'search' },
  { name: 'app', appId: 'linear' },
  { name: 'sites' },
  { name: 'site-version', siteId: 1, versionId: 1 },
  { name: 'projects' },
  { name: 'project', projectId: 1 },
  { name: 'feature-document', documentId: 1 },
  { name: 'admin' },
];

const publicRoutes: Route[] = [
  { name: 'landing' },
  { name: 'build-in-public' },
  { name: 'pricing' },
  { name: 'apps' },
  { name: 'feature-document-share', token: 'public-token' },
];

test('keeps Apps public while App details and member routes require authentication', async () => {
  const policy = await import('./routeAccess.ts').catch(() => null);
  assert.ok(policy, 'route access policy must exist');

  for (const route of privateRoutes) {
    assert.equal(policy.requiresAuthentication(route), true, route.name);
  }
  for (const route of publicRoutes) {
    assert.equal(policy.requiresAuthentication(route), false, route.name);
  }
});
