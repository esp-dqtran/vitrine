import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps the Apps shell independent from job-list loading', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"]\.\/useJobs['"]/);
  assert.doesNotMatch(source, /\buseJobs\s*\(/);
  assert.doesNotMatch(source, /fetch\(\s*['"]\/api\/jobs['"]/);
});

test('uses the shared Astryx dropdown for authenticated account actions', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /from ['"]\.\/components\/AstryxDropdown\.tsx['"]/);
  assert.match(source, /<AstryxDropdown[\s\S]*ariaLabel=\{`Account menu: \$\{user\.email\}`\}/);
  assert.match(source, /<AstryxDropdownItem[\s\S]*label="Settings"/);
  assert.match(source, /<AstryxDropdownDivider/);
  assert.match(source, /<AstryxDropdownItem[\s\S]*label="Log out"/);
  assert.doesNotMatch(source, /<DropdownMenu/);
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
  assert.match(source, /lazy\(\(\) =>\s*import\(['"]\.\/components\/ResearchProjectsPage['"]\)/);
  assert.match(source, /lazy\(\(\) =>\s*import\(['"]\.\/components\/ProjectPlaygroundPage['"]\)/);
  assert.match(source, /lazy\(\(\) =>\s*import\(['"]\.\/components\/ProjectDocumentPage['"]\)/);
  assert.doesNotMatch(source, /VITE_PROJECT_DOCUMENTS_ENABLED/);
  assert.match(source, /case ['"]project-playground['"]:/);
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
  assert.match(
    appSource,
    /searchSnapshot\.open && \(!canUseAdvancedSearch \|\| route\.name === 'flows'\)/,
  );
  assert.doesNotMatch(appSource, /useApps\(user\?\.role, route\.name === 'apps'\)/);
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

test('opens legacy Flow search in Flow mode and keeps selections on the Flows route', async () => {
  const [appSource, paletteSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/CommandPalette.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /route\.name !== 'flows'/);
  assert.match(appSource, /initialNav=\{route\.name === 'flows' \? 'flows' : undefined\}/);
  assert.match(appSource, /initialFlowQuery=\{route\.name === 'flows'/);
  assert.match(appSource, /initialPlatform=\{route\.name === 'flows'/);
  assert.match(appSource, /selectedFlowDiscoverySearch/);
  assert.match(appSource, /updateLocation\(`\/flows\?\$\{nextSearch\}`\)/);
  assert.match(paletteSource, /useCommandPaletteFlowCatalog/);
  assert.doesNotMatch(paletteSource, /\/api\/design-systems/);
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
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /platform: \[appsDiscoveryHeaderState\.platform\]/);
  assert.match(source, /categories: 'appCategory'/);
  assert.match(source, /screens: 'pageType'/);
  assert.match(source, /elements: 'component'/);
  assert.match(source, /flows: 'flow'/);
  assert.match(source, /sections: 'siteSection'/);
  assert.match(source, /styles: 'siteStyle'/);
  assert.match(source, /openPalette\([\s\S]*discoverySearchSeed/);
});

test('keeps Apps retry and terminal no-results states inside its discovery page', async () => {
  const [appSource, pageSource, controllerSource, layoutSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useDiscoveryController.ts', import.meta.url), 'utf8'),
    readFile(new URL('./components/DiscoveryPageLayout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(appSource, /refreshApps|onRetryLoadMore|loadMoreError/);
  assert.match(controllerSource, /retryLoadMore/);
  assert.match(pageSource, /onRetry=\{controller\.retry\}/);
  assert.match(pageSource, /onRetryLoadMore=\{controller\.retryLoadMore\}/);
  assert.match(layoutSource, /Could not load \{resultLabel\}/);
  assert.match(layoutSource, /No \{resultLabel\} found/);
  assert.match(layoutSource, /label="Retry"/);
});

test('keeps the sticky Apps search container background transparent', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(
    source,
    /background:\s*['"]color-mix\(in srgb, var\(--color-background-body\) 92%, transparent\)['"]/,
  );
});

test('loads additional app pages only when the gallery sentinel approaches the viewport', async () => {
  const [appSource, pageSource, controllerSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useDiscoveryController.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(controllerSource, /requestNextFromSentinel/);
  assert.match(controllerSource, /nextCursor/);
  assert.match(controllerSource, /IntersectionObserver/);
  assert.doesNotMatch(appSource, /appsSentinelRef|new IntersectionObserver/);
  assert.match(pageSource, /sentinelRef=\{controller\.sentinelRef\}/);
  assert.match(pageSource, /loadingMore=\{controller\.loadingMore\}/);
  assert.doesNotMatch(pageSource, /<AppCardSkeleton/);
  assert.doesNotMatch(`${appSource}\n${pageSource}`, /fetch\(\s*['"]\/api\/jobs['"]/);
});

test('loads the member catalog one page at a time near the gallery viewport', async () => {
  const [appSource, pageSource, adapterSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./appsDiscoveryAdapter.ts', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(adapterSource, /do\s*\{/);
  assert.match(adapterSource, /params\.set\('cursor', cursor\)/);
  assert.match(
    adapterSource,
    /`\/api\/\$\{source === 'admin' \? 'apps' : 'catalog'\}\?\$\{params\.toString\(\)\}`/,
  );
  assert.doesNotMatch(appSource, /hasMore=\{hasMore\}|appsSentinelRef/);
  assert.match(pageSource, /sentinelRef=\{controller\.sentinelRef\}/);
});

test('separates gallery and detail route loaders', async () => {
  const [appSource, gallerySource, detailSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./appsDiscoveryAdapter.ts', import.meta.url), 'utf8'),
    readFile(new URL('./useAppDetail.ts', import.meta.url), 'utf8').catch(() => ''),
  ]);

  assert.match(
    appSource,
    /searchSnapshot\.open && \(!canUseAdvancedSearch \|\| route\.name === 'flows'\)/,
  );
  assert.match(gallerySource, /fetchCatalogPage/);
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
  const source = await readFile(new URL('./useDiscoveryController.ts', import.meta.url), 'utf8');
  assert.match(source, /completedFirstPage\?\.canonical === canonical/);
  assert.match(source, /items: completedFirstPage\.items/);
});

test('passes the complete catalog total into the Apps discovery boundary', async () => {
  const [appSource, pageSource, controllerSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useDiscoveryController.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(controllerSource, /totalCount: page\.totalCount/);
  assert.doesNotMatch(appSource, /totalApps=\{totalApps\}/);
  assert.match(pageSource, /controller\.totalCount/);
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
  assert.match(source, /const \[appFacet, setAppFacet\] = useState<AppsFacet \| null>\(null\)/);
  assert.match(source, /active=\{discoveryRoute\}/);
  assert.match(source, /query=\{siteQuery\}/);
  assert.match(
    source.match(/case 'sites':[\s\S]*?break;/)?.[0] ?? '',
    /query=\{siteQuery\}[\s\S]*onQueryChange=\{setSiteQuery\}/,
  );
});

test('owns one persistent discovery header above galleries and Projects', async () => {
  const [source, appsSource, sitesSource, flowsSource, projectsSource] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AppsDiscoveryPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/SitesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/FlowsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/ResearchProjectsPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /data-persistent-discovery-frame="true"/);
  assert.doesNotMatch(source, /data-project-document-frame/);
  assert.equal((source.match(/<ReferenceDiscoveryTopNav/g) ?? []).length, 1);
  assert.match(source, /route\.name === ["']project-playground["'][\s\S]*\? ["']projects["']/);
  assert.match(source, /route\.name === ["']apps["'][\s\S]*route\.name === ["']sites["'][\s\S]*route\.name === ["']flows["'][\s\S]*route\.name === ["']projects["']/);
  assert.match(source, /className="apps-top-nav"/);
  assert.match(source, /activeCategory=\{\s*discoveryRoute === ["']flows["']/);
  assert.doesNotMatch(`${appsSource}\n${sitesSource}\n${flowsSource}\n${projectsSource}`, /<ReferenceDiscoveryTopNav|<SitesTopNav/);
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
