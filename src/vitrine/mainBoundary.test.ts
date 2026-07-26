import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('does not replay page-load request effects in development', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\bStrictMode\b/);
});

test('delegates public, private, disabled, and redirect decisions to the exhaustive route policy', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
  assert.match(source, /decideRootRoute\(route,/);
  assert.match(source, /switch \(decision\.kind\)/);
  assert.match(source, /case 'application':[\s\S]{0,100}return <App \/>/);
  assert.match(source, /case 'admin-dashboard':[\s\S]{0,220}return user\?\.role === 'admin'/);
  assert.match(source, /<AdminDashboard user=\{user\} onLogout=\{logout\} \/>/);
  assert.match(source, /case 'redirect':[\s\S]{0,100}<RouteRedirect/);
  assert.match(source, /case 'denied':[\s\S]{0,200}<RouteStatusPage/);
});

test('loads public and application pages through route-level lazy boundaries', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/App['"]\)/);
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/AdminDashboard['"]\)/);
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/Home['"]\)/);
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/Pricing['"]\)/);
  assert.match(source, /<Suspense fallback=\{<FullPageSpinner \/>}/);
});
