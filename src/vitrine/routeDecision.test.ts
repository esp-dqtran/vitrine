import assert from 'node:assert/strict';
import test from 'node:test';
import type { Route } from './router.ts';
import { decideRootRoute, type RootRouteContext } from './routeDecision.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const guest: RootRouteContext = {
  auth: 'guest',
  advancedSearchEnabled: false,
  researchProjectsEnabled: false,
};

const member: RootRouteContext = {
  auth: 'member',
  advancedSearchEnabled: true,
  researchProjectsEnabled: true,
};

const admin: RootRouteContext = {
  auth: 'admin',
  advancedSearchEnabled: true,
  researchProjectsEnabled: true,
};

test('keeps public pages available while authentication is loading', () => {
  const loading = { ...guest, auth: 'loading' as const };
  assert.deepEqual(decideRootRoute({ name: 'pricing' }, loading), { kind: 'public', page: 'pricing' });
  assert.deepEqual(decideRootRoute({ name: 'build-in-public' }, loading), { kind: 'public', page: 'build-in-public' });
  assert.deepEqual(
    decideRootRoute({ name: 'feature-document-share', token: 'share' }, loading),
    { kind: 'public', page: 'feature-document-share' },
  );
  assert.deepEqual(decideRootRoute({ name: 'apps' }, loading), { kind: 'loading' });
});

test('redirects authenticated landing and sign-in routes to Apps', () => {
  assert.deepEqual(decideRootRoute({ name: 'landing' }, member), {
    kind: 'redirect',
    route: { name: 'apps' },
  });
  assert.deepEqual(decideRootRoute({ name: 'signin' }, member), {
    kind: 'redirect',
    route: { name: 'apps' },
  });
});

test('keeps all three catalogs public and sends private guest routes to sign-in', () => {
  assert.deepEqual(decideRootRoute({ name: 'apps' }, guest), { kind: 'application' });
  assert.deepEqual(decideRootRoute({ name: 'sites' }, guest), { kind: 'application' });
  assert.deepEqual(decideRootRoute({ name: 'flows' }, guest), { kind: 'application' });
  assert.deepEqual(decideRootRoute({ name: 'app', appId: 'linear' }, guest), { kind: 'signin' });
  assert.deepEqual(
    decideRootRoute({ name: 'site-version', siteSlug: 'v7' }, guest),
    { kind: 'signin' },
  );
});

test('selects the isolated Admin dashboard only for an admin session', () => {
  assert.deepEqual(decideRootRoute({ name: 'admin' }, guest), { kind: 'signin' });
  assert.deepEqual(decideRootRoute({ name: 'admin' }, member), {
    kind: 'denied',
    title: 'Admin access required',
  });
  assert.deepEqual(decideRootRoute({ name: 'admin' }, admin), {
    kind: 'admin-dashboard',
  });
});

test('uses the same application renderer for members and admins on normal routes', () => {
  const routes: Route[] = [
    { name: 'apps' },
    { name: 'sites' },
    { name: 'flows' },
    { name: 'app', appId: 'linear' },
    { name: 'site-version', siteSlug: 'v7' },
    { name: 'search' },
    { name: 'projects' },
    { name: 'project', projectId: PROJECT_ID },
    { name: 'project-document', projectId: PROJECT_ID },
    { name: 'project-playground', projectId: PROJECT_ID },
    { name: 'feature-document', documentId: 9 },
    { name: 'settings-billing' },
  ];

  for (const route of routes) {
    assert.deepEqual(decideRootRoute(route, member), { kind: 'application' }, `member ${route.name}`);
    assert.deepEqual(decideRootRoute(route, admin), { kind: 'application' }, `admin ${route.name}`);
  }
});

test('renders an explicit unavailable state for disabled feature routes', () => {
  const disabled = { ...member, advancedSearchEnabled: false, researchProjectsEnabled: false };
  assert.deepEqual(decideRootRoute({ name: 'search' }, disabled), {
    kind: 'unavailable',
    title: 'Search is unavailable',
  });
  assert.deepEqual(decideRootRoute({ name: 'projects' }, disabled), {
    kind: 'unavailable',
    title: 'Research projects are unavailable',
  });
  assert.deepEqual(decideRootRoute({ name: 'project', projectId: PROJECT_ID }, disabled), {
    kind: 'unavailable',
    title: 'Research projects are unavailable',
  });
  assert.deepEqual(decideRootRoute({ name: 'project-playground', projectId: PROJECT_ID }, disabled), {
    kind: 'unavailable',
    title: 'Research projects are unavailable',
  });
  assert.deepEqual(decideRootRoute({ name: 'project-document', projectId: PROJECT_ID }, disabled), {
    kind: 'unavailable',
    title: 'Research projects are unavailable',
  });
});

test('renders unknown locations as an explicit public not-found page', () => {
  assert.deepEqual(decideRootRoute({ name: 'not-found', pathname: '/missing' }, guest), {
    kind: 'public',
    page: 'not-found',
  });
  assert.deepEqual(decideRootRoute({ name: 'not-found', pathname: '/missing' }, member), {
    kind: 'public',
    page: 'not-found',
  });
});

test('produces an explicit decision for every current route name', () => {
  const routes: Route[] = [
    { name: 'landing' },
    { name: 'not-found', pathname: '/missing' },
    { name: 'build-in-public' },
    { name: 'pricing' },
    { name: 'billing-success' },
    { name: 'settings-billing' },
    { name: 'signin' },
    { name: 'search' },
    { name: 'apps' },
    { name: 'flows' },
    { name: 'app', appId: 'linear' },
    { name: 'sites' },
    { name: 'site-version', siteSlug: 'v7' },
    { name: 'projects' },
    { name: 'project', projectId: PROJECT_ID },
    { name: 'project-document', projectId: PROJECT_ID },
    { name: 'project-playground', projectId: PROJECT_ID },
    { name: 'feature-document', documentId: 9 },
    { name: 'feature-document-share', token: 'share' },
    { name: 'admin' },
  ];

  for (const route of routes) {
    assert.notEqual(decideRootRoute(route, admin), undefined, route.name);
  }
});
