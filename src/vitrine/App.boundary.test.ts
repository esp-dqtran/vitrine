import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the Apps shell independent from job-list loading', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"]\.\/useJobs['"]/);
  assert.doesNotMatch(source, /\buseJobs\s*\(/);
  assert.doesNotMatch(source, /fetch\(\s*['"]\/api\/jobs['"]/);
});

test('loads additional admin app pages only when the gallery sentinel approaches the viewport', async () => {
  const [appSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /loadMore/);
  assert.match(hookSource, /nextCursor/);
  assert.match(appSource, /IntersectionObserver/);
  assert.match(appSource, /appsSentinelRef/);
  assert.match(appSource, /void loadMore\(\)/);
  assert.match(appSource, /<Spinner size="sm"/);
  assert.doesNotMatch(appSource, /Loading more apps/);
});

test('bootstraps an admin app deep link outside the first gallery page', async () => {
  const [appSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /useApps\(\s*user\?\.role,\s*route\.name === 'app' \? route\.appId : undefined,?\s*\)/);
  assert.match(hookSource, /fetchAppDetail\(requestedAppId/);
  assert.match(hookSource, /mergeApp\(page\.apps, requestedApp\)/);
});

test('shares catalog search state with the inspiration modal', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /searchLoading/);
  assert.match(source, /searchRetry/);
  assert.match(source, /result=\{searchResult\}/);
  assert.match(source, /collections=\{collections\}/);
  assert.match(source, /onCollectionsChange=\{setCollections\}/);
});
