import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('keeps persistent product chrome opaque and free of backdrop blur', async () => {
  const [discoveryCss, legacyCss, galleryToolbar, documentCss, pricing, home, settingsCss] = await Promise.all([
    read('./referenceDiscovery.css'),
    read('./styles.css'),
    read('./components/GalleryToolbar.tsx'),
    read('./components/projectDocument.css'),
    read('./Pricing.tsx'),
    read('./Home.tsx'),
    read('./settingsWorkspace.css'),
  ]);

  assert.match(discoveryCss, /\.reference-discovery-nav\s*\{[^}]*background:\s*var\(--reference-chrome-bg,\s*var\(--color-background-body\)\)/s);
  assert.match(legacyCss, /\.apps-top-nav\s*\{[^}]*background:\s*var\(--color-background-body\);[^}]*backdrop-filter:\s*none;/s);
  assert.match(legacyCss, /\.sites-top-nav\s*\{[^}]*background:\s*var\(--color-background-body\);[^}]*backdrop-filter:\s*none;/s);
  assert.match(galleryToolbar, /background:\s*'var\(--color-background-body\)'[\s\S]*backdropFilter:\s*'none'/);
  assert.match(documentCss, /--project-document-topbar:\s*var\(--vitrine-color-surface\)/);
  assert.match(documentCss, /\.project-document-page__topbar\s*\{[^}]*background:\s*var\(--project-document-topbar,\s*var\(--project-document-surface,\s*#fff\)\);[^}]*backdrop-filter:\s*none;/s);
  assert.match(pricing, /position:\s*'sticky'[\s\S]*background:\s*'var\(--color-background-body\)'[\s\S]*backdropFilter:\s*'none'/);
  assert.match(home, /position:\s*"sticky"[\s\S]*background:\s*"var\(--color-background-body\)"[\s\S]*backdropFilter:\s*"none"[\s\S]*WebkitBackdropFilter:\s*"none"/);
  assert.match(settingsCss, /\.settings-workspace__header\s*\{[^}]*background:\s*var\(--color-background-surface\)/s);
});
