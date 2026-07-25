import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the Apps shell independent from job-list loading', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"]\.\/useJobs['"]/);
  assert.doesNotMatch(source, /\buseJobs\s*\(/);
  assert.doesNotMatch(source, /fetch\(\s*['"]\/api\/jobs['"]/);
});

test('serializes Flow and step selection through the controlled App route', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /onFlowChange=\{\(flow, step, platform, version\) => navigate\(\{/);
  assert.match(source, /section: 'flows'/);
  assert.match(source, /\.\.\.\(flow \? \{ flow \} : \{\}\)/);
  assert.match(source, /\.\.\.\(step \? \{ step \} : \{\}\)/);
});

test('keeps adaptive Search and Quick Search in dedicated state boundaries', async () => {
  const [appSource, pageSource, quickSource, apiSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AdvancedSearchPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/QuickSearch.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./advancedSearchApi.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(appSource, /VITE_ADVANCED_SEARCH_ENABLED/);
  assert.match(appSource, /<AdvancedSearchPage/);
  assert.match(appSource, /<QuickSearch/);
  assert.match(appSource, /<CommandPalette/);
  assert.match(pageSource, /useAdvancedSearch/);
  assert.doesNotMatch(`${pageSource}\n${quickSource}\n${apiSource}`, /\/api\/jobs|jobsApi|useJobs/);
});

test('keeps Sites routes ahead of Apps branches and free from job-list reads', async () => {
  const [appSource, sitesSource, sitesApiSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./sitesApi.ts', import.meta.url), 'utf8'),
  ]);

  assert.ok(appSource.indexOf("route.name === 'sites'") < appSource.indexOf("if (route.name === 'apps')"));
  assert.ok(appSource.indexOf("route.name === 'site-version'") < appSource.indexOf("route.name === 'app' && (detailError"));
  assert.doesNotMatch(`${appSource}\n${sitesSource}\n${sitesApiSource}`, /\buseJobs\s*\(/);
  assert.doesNotMatch(`${sitesSource}\n${sitesApiSource}`, /fetch\(\s*['"]\/api\/jobs['"]\s*\)/);
  assert.doesNotMatch(sitesSource, /setInterval/);
});

test('renders both Sites routes outside the admin AppShell', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  const catalogBranch = source.slice(
    source.indexOf("if (route.name === 'sites')"),
    source.indexOf("if (route.name === 'site-version')"),
  );
  const detailBranch = source.slice(
    source.indexOf("if (route.name === 'site-version')"),
    source.indexOf("if (researchProjectsEnabled"),
  );

  assert.doesNotMatch(catalogBranch, /return frame\(/);
  assert.doesNotMatch(detailBranch, /return frame\(/);
});

test('renders Apps through its discovery page outside the admin AppShell', async () => {
  const [appSource, sitesSource, sitesNavSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesTopNav.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /from ['"]\.\/components\/AppsDiscoveryPage\.tsx['"]/);
  assert.match(appSource, /if \(route\.name === 'apps'\) \{[\s\S]*?<AppsDiscoveryPage/);
  assert.doesNotMatch(appSource, /if \(route\.name === 'apps'\) \{[\s\S]{0,160}?return frame\(/);
  assert.match(sitesSource, /data-sites-discovery="true"/);
  assert.match(sitesSource, /data-reference-gallery-shell="sites"/);
  assert.match(sitesSource, /<SitesTopNav/);
  assert.match(sitesNavSource, /<ReferenceDiscoveryTopNav/);
  assert.match(sitesNavSource, /<SearchTrigger/);
  assert.doesNotMatch(sitesNavSource, /<SearchInput/);
  assert.doesNotMatch(sitesSource, /<ReferenceGalleryShell/);
});

test('opens the shared catalog search overlay from Sites', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  const catalogBranch = source.slice(
    source.indexOf("if (route.name === 'sites')"),
    source.indexOf("if (route.name === 'site-version')"),
  );

  assert.match(catalogBranch, /onOpenSearch=\{\(seed\) => void openPalette\('sites', seed\)\}/);
  assert.match(catalogBranch, /searchMode=\{canUseAdvancedSearch \? 'advanced' : 'legacy'\}/);
  assert.match(catalogBranch, /\{discoveryOverlays\}/);
});

test('owns one scoped search session and seeds it from each gallery', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /createSearchSession/);
  assert.match(source, /useSyncExternalStore/);
  assert.match(source, /openPalette\('sites', seed\)/);
  assert.match(source, /openPalette\('apps', seed\)/);
  assert.doesNotMatch(source, /const \[paletteOpen, setPaletteOpen\]/);
});

test('maps each gallery taxonomy into only its compatible search filters', async () => {
  const [appSource, sitesSource] = await Promise.all([
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /platform: \[platform\]/);
  assert.match(appSource, /appCategory: \[props\.facet\.value\]/);
  assert.match(appSource, /pageType: \[props\.facet\.value\]/);
  assert.match(appSource, /component: \[props\.facet\.value\]/);
  assert.match(appSource, /flow: \[props\.facet\.value\]/);
  assert.doesNotMatch(appSource, /siteSection:|siteStyle:/);

  assert.match(sitesSource, /appCategory: \[facet\.value\]/);
  assert.match(sitesSource, /siteSection: \[facet\.value\]/);
  assert.match(sitesSource, /siteStyle: \[facet\.value\]/);
  assert.doesNotMatch(sitesSource, /platform: \[platform\]|pageType:|component: \[|flow: \[/);
});

test('keeps Apps retry and terminal no-results states inside its discovery page', async () => {
  const [appSource, pageSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /return \{[\s\S]*refresh,[\s\S]*loadMore \}/);
  assert.match(appSource, /refresh: refreshApps/);
  assert.match(appSource, /onRetry=\{\(\) => void refreshApps\(\)\}/);
  assert.match(pageSource, /title: 'Could not load crawled screens'/);
  assert.match(pageSource, /title: 'No Apps match these filters'/);
  assert.match(pageSource, /label="Retry"/);
});

test('keeps the sticky Apps search container background transparent', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(
    source,
    /background:\s*['"]color-mix\(in srgb, var\(--color-background-body\) 92%, transparent\)['"]/,
  );
});

test('loads additional app pages only when the gallery sentinel approaches the viewport', async () => {
  const [appSource, pageSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /loadMore/);
  assert.match(hookSource, /nextCursor/);
  assert.match(appSource, /IntersectionObserver/);
  assert.match(appSource, /appsSentinelRef/);
  assert.match(appSource, /void loadMore\(\)/);
  assert.match(appSource, /sentinelRef=\{appsSentinelRef\}/);
  assert.match(pageSource, /<Spinner size="sm"/);
  assert.doesNotMatch(`${appSource}\n${pageSource}`, /Loading more apps/);
});

test('loads the member catalog one page at a time near the gallery viewport', async () => {
  const [appSource, pageSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(hookSource, /do\s*\{/);
  assert.match(hookSource, /role === 'admin' \? `\/api\/apps\?cursor=/);
  assert.match(hookSource, /: `\/api\/catalog\?cursor=/);
  assert.match(appSource, /if \(route\.name === 'app' \|\| !hasMore \|\| loadingMore\) return/);
  assert.match(appSource, /hasMore=\{hasMore\}/);
  assert.match(pageSource, /props\.hasMore[\s\S]*ref=\{props\.sentinelRef\}/);
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
  assert.doesNotMatch(appSource, /initialVersion=\{detail\?\.version\}|initialNextCursor=/);
});

test('does not reload a retained gallery merely because it is re-enabled', async () => {
  const source = await readFile(new URL('./useApps.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!enabled \|\| apps !== null\) return/);
});

test('passes the complete catalog total into the Apps discovery boundary', async () => {
  const [appSource, pageSource, hookSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useApps.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /totalApps/);
  assert.match(appSource, /totalApps=\{totalApps\}/);
  assert.match(pageSource, /totalApps: number \| null/);
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
  const [source, pageSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /const \[siteQuery, setSiteQuery\] = useState\(''\)/);
  assert.match(source, /const \[appFacet, setAppFacet\] = useState<AppsFacet \| null>\(null\)/);
  assert.match(pageSource, /active="apps"/);
  assert.match(source, /query=\{siteQuery\}/);
  assert.match(source, /onQueryChange=\{setSiteQuery\}/);
});

test('opens account settings when returning from the Stripe billing portal', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /route\.name === 'settings-billing'/);
  assert.match(source, /navigate\(\{ name: 'apps' \}\)/);
});

test('opens guest catalog authentication in a modal without changing routes', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[loginOpen, setLoginOpen\] = useState\(false\)/);
  assert.match(source, /<GuestCatalogControls onLogin=\{\(\) => setLoginOpen\(true\)\} \/>/);
  assert.match(source, /<LoginDialog/);
  assert.match(source, /isOpen=\{loginOpen\}/);
  assert.match(source, /onClose=\{\(\) => setLoginOpen\(false\)\}/);
  assert.match(source, /authenticate=\{authenticate\}/);
  assert.match(source, /register=\{register\}/);
  assert.match(source, /onSignedIn=\{completeLogin\}/);
});
