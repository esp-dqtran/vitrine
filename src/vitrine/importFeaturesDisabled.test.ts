import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('removes every product import and recapture entry point', () => {
  const productSources = [
    './App.tsx',
    './components/ReferenceDiscoveryTopNav.tsx',
    './components/AppsDiscoveryPage.tsx',
    './components/AppDetailLoadingPage.tsx',
    './components/ScreenDetail.tsx',
    './components/SitesTopNav.tsx',
    './components/SitesPage.tsx',
    './components/SiteVersionPage.tsx',
    './components/PipelinePanel.tsx',
    './components/VersionPanel.tsx',
    './researchApi.ts',
    './sitesApi.ts',
    './useJobs.ts',
  ].map(read).join('\n');

  assert.doesNotMatch(
    productSources,
    /ImportDialog|SiteImportDialog|Import App|Import Site|Import app|Start recapture|submitUrlImport|submitSiteImport|submitImportJob|createAppVersion|setImportOpen|onImport/,
  );
  assert.equal(
    existsSync(new URL('./components/ImportDialog.tsx', import.meta.url)),
    false,
  );
  assert.equal(
    existsSync(new URL('./components/SiteImportDialog.tsx', import.meta.url)),
    false,
  );
});
