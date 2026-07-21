import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the Apps shell independent from job-list loading', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"]\.\/useJobs['"]/);
  assert.doesNotMatch(source, /\buseJobs\s*\(/);
  assert.doesNotMatch(source, /fetch\(\s*['"]\/api\/jobs['"]/);
});

test('keeps Sites routes ahead of Apps branches and free from job-list reads', async () => {
  const [appSource, sitesSource, sitesApiSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./sitesApi.ts', import.meta.url), 'utf8'),
  ]);

  assert.ok(appSource.indexOf("route.name === 'sites'") < appSource.indexOf("route.name === 'apps' && (appsError"));
  assert.ok(appSource.indexOf("route.name === 'site-version'") < appSource.indexOf("route.name === 'app' && (detailError"));
  assert.doesNotMatch(`${appSource}\n${sitesSource}\n${sitesApiSource}`, /\buseJobs\s*\(/);
  assert.doesNotMatch(`${sitesSource}\n${sitesApiSource}`, /fetch\(\s*['"]\/api\/jobs['"]\s*\)/);
  assert.doesNotMatch(sitesSource, /setInterval|setTimeout/);
});

test('keeps the sticky Apps search container background transparent', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(
    source,
    /background:\s*['"]color-mix\(in srgb, var\(--color-background-body\) 92%, transparent\)['"]/,
  );
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

test('separates gallery and detail route loaders', async () => {
  const [appSource, gallerySource, detailSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
    readFile(new URL('./useAppDetail.ts', import.meta.url), 'utf8').catch(() => ''),
  ]);

  assert.match(appSource, /useApps\(user\?\.role, route\.name === 'apps'\)/);
  assert.match(appSource, /useAppDetail\(\s*route\.name === 'app' \? route\.appId : undefined,/);
  assert.doesNotMatch(gallerySource, /requestedAppId|fetchAppDetail|mergeApp/);
  assert.match(detailSource, /fetchAppMetadata/);
  assert.doesNotMatch(detailSource, /fetchAppDetailPage|limit=48/);
  assert.doesNotMatch(detailSource, /fetch\(['"]\/api\/apps['"]/);
  assert.doesNotMatch(appSource, /initialVersion=|initialNextCursor=/);
});

test('does not reload a retained gallery merely because it is re-enabled', async () => {
  const source = await readFile(new URL('./useApps.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!enabled \|\| apps !== null\) return/);
});

test('reports the loaded admin app count against the complete catalog total', async () => {
  const [appSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /totalApps/);
  assert.match(appSource, /Showing \$\{list\.length\} of \$\{totalApps\} apps/);
});

test('shares catalog search state with the inspiration modal', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /searchLoading/);
  assert.match(source, /searchRetry/);
  assert.match(source, /result=\{searchResult\}/);
  assert.match(source, /collections=\{collections\}/);
  assert.match(source, /onCollectionsChange=\{setCollections\}/);
});

test('does not request Pro catalog research for a Free account', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const canUseProResearch = isAdmin \|\| customerPlan === 'pro'/);
  assert.ok(source.indexOf('if (!canUseProResearch)') < source.indexOf('searchCatalog(q, filters, controller.signal)'));
  assert.match(source, /plan=\{customerPlan\}/);
  assert.match(source, /onUpgrade=\{openPricing\}/);
});

test('keeps independent Apps and Sites search state under References', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[siteQuery, setSiteQuery\] = useState\(''\)/);
  assert.match(source, /<ReferenceTypeTabs active="apps"/);
  assert.match(source, /query=\{siteQuery\}/);
  assert.match(source, /onQueryChange=\{setSiteQuery\}/);
});

test('opens account settings when returning from the Stripe billing portal', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /route\.name === 'settings-billing'/);
  assert.match(source, /navigate\(\{ name: 'apps' \}\)/);
});
