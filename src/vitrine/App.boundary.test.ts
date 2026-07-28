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
  assert.match(source, /initialFlowView=\{route\.flowView\}/);
  assert.match(source, /onFlowChange=\{\(flow, step, flowView, platform, version\) => navigate\(\{/);
  assert.match(source, /section: 'flows'/);
  assert.match(source, /\.\.\.\(flow \? \{ flow \} : \{\}\)/);
  assert.match(source, /\.\.\.\(step \? \{ step \} : \{\}\)/);
  assert.match(source, /\.\.\.\(flowView \? \{ flowView \} : \{\}\)/);
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

test('keeps primary catalogs and detail surfaces ready while lazy-loading secondary pages', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ AppsDiscoveryPage \} from ['"]\.\/components\/AppsDiscoveryPage\.tsx['"]/);
  assert.match(source, /import \{ SitesPage \} from ['"]\.\/components\/SitesPage\.tsx['"]/);
  assert.doesNotMatch(source, /lazy\(\(\) => import\(['"]\.\/components\/AppsDiscoveryPage\.tsx['"]\)/);
  assert.doesNotMatch(source, /lazy\(\(\) => import\(['"]\.\/components\/SitesPage['"]\)/);
  assert.match(source, /import \{ ScreenDetail \} from ['"]\.\/components\/ScreenDetail['"]/);
  assert.match(source, /import \{ SiteVersionPage \} from ['"]\.\/components\/SiteVersionPage['"]/);
  assert.doesNotMatch(source, /lazy\(\(\) => import\(['"]\.\/components\/ScreenDetail['"]\)/);
  assert.doesNotMatch(source, /lazy\(\(\) => import\(['"]\.\/components\/SiteVersionPage['"]\)/);
  assert.match(source, /lazy\(\(\) => import\(['"]\.\/components\/ResearchProjectsPage['"]\)/);
  assert.match(source, /<Suspense fallback=\{<ApplicationPageSpinner \/>}/);
  assert.match(source, /<ApplicationSurface/);
});

test('keeps Admin dashboard ownership out of the normal application renderer', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /components\/UsersPage/);
  assert.doesNotMatch(source, /components\/Sidebar/);
  assert.doesNotMatch(source, /\buseAdminFrame\b/);
  assert.doesNotMatch(source, /\badminSideNav\b/);
  assert.doesNotMatch(source, /<UsersPage/);
  assert.doesNotMatch(source, /sideNav=/);
});

test('keeps Sites data independent from Apps and free from job-list reads', async () => {
  const [appSource, sitesSource, sitesApiSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./sitesApi.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /case 'sites':/);
  assert.match(appSource, /case 'site-version':/);
  assert.match(appSource, /useApps\(user\?\.role, route\.name === 'apps'\)/);
  assert.doesNotMatch(`${appSource}\n${sitesSource}\n${sitesApiSource}`, /\buseJobs\s*\(/);
  assert.doesNotMatch(`${sitesSource}\n${sitesApiSource}`, /fetch\(\s*['"]\/api\/jobs['"]\s*\)/);
  assert.doesNotMatch(sitesSource, /setInterval/);
});

test('opens the shared catalog search overlay from Sites', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /onOpenSearch=\{\(seed\) => void openPalette\('sites', seed\)\}/);
  assert.match(source, /searchMode=\{canUseAdvancedSearch \? 'advanced' : 'legacy'\}/);
  assert.match(source, /<ApplicationSurface/);
  assert.match(source, /overlays=\{discoveryOverlays\}/);
});

test('owns one scoped search session and seeds it from each gallery', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /createSearchSession/);
  assert.match(source, /useSyncExternalStore/);
  assert.match(source, /updateLocation/);
  assert.match(source, /openPalette\('sites', seed\)/);
  assert.match(source, /openPalette\('apps', seed\)/);
  assert.doesNotMatch(source, /const \[paletteOpen, setPaletteOpen\]/);
  assert.doesNotMatch(source, /window\.history/);
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

  assert.match(hookSource, /return \{[\s\S]*refresh,[\s\S]*loadMore,[\s\S]*\};/);
  assert.match(hookSource, /loadMoreError/);
  assert.match(appSource, /refresh: refreshApps/);
  assert.match(appSource, /onRetry=\{\(\) => void refreshApps\(\)\}/);
  assert.match(appSource, /onRetryLoadMore=\{\(\) => void loadMore\(\)\}/);
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
  assert.match(appSource, /rootMargin: '900px 0px'/);
  assert.match(pageSource, /<ReferenceCatalogLoading label="Loading more Apps" compact/);
  assert.doesNotMatch(pageSource, /<AppCardSkeleton/);
  assert.doesNotMatch(`${appSource}\n${pageSource}`, /fetch\(\s*['"]\/api\/jobs['"]/);
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
  assert.match(detailSource, /loadAppDetail/);
  assert.doesNotMatch(detailSource, /fetchAppDetailPage|limit=48/);
  assert.doesNotMatch(detailSource, /fetch\(['"]\/api\/apps['"]/);
  assert.doesNotMatch(appSource, /initialVersion=\{detail\?\.version\}|initialNextCursor=/);
});

test('opens App detail as the only active transient surface', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  const closeHelper = source.slice(
    source.indexOf('const closeDiscoveryOverlays ='),
    source.indexOf('const openApp = async'),
  );
  const openApp = source.slice(
    source.indexOf('const openApp = async'),
    source.indexOf('const confirmUnlock = async'),
  );

  assert.match(closeHelper, /setCollectionsOpen\(false\)/);
  assert.match(closeHelper, /setSettingsOpen\(false\)/);
  assert.match(closeHelper, /setLoginOpen\(false\)/);
  assert.doesNotMatch(closeHelper, /setImportOpen/);
  assert.match(closeHelper, /setAdvancedPreview\(null\)/);
  assert.match(closeHelper, /searchSession\.close\(\)/);
  assert.ok(
    openApp.indexOf('closeDiscoveryOverlays()') < openApp.indexOf("navigate({ name: 'app', appId })"),
    'transient overlays should close before navigating to App detail',
  );
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
