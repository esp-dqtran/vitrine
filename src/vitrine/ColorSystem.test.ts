import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('defines one Apps-led color foundation for every Vitrines page', async () => {
  const css = await read('./styles.css');
  const foundation = await read('./uiFoundation.css');

  assert.match(css, /@import ["']\.\/uiFoundation\.css["']/);
  assert.equal((foundation.match(/--vitrine-color-[a-z-]+:\s*/g) ?? []).length >= 13, true);
  assert.match(
    css,
    /\.vitrine-page\s*\{[^}]*background:\s*var\(--color-background-body\)[^}]*color:\s*var\(--color-text-primary\)[^}]*font-family:\s*var\(--font-family-body\)/s,
  );
  assert.match(
    css,
    /\.advanced-search-page\s*\{[^}]*background:\s*var\(--color-background-body\)/s,
  );
  assert.doesNotMatch(css, /var\(--color-focus,\s*#6c5ce7\)/);
});

test('all top-level routes opt into the Apps-led page foundation', async () => {
  const routes = await Promise.all([
    read('./Home.tsx'),
    read('./BuildInPublic.tsx'),
    read('./Pricing.tsx'),
    read('./SignIn.tsx'),
    read('./components/BillingSuccess.tsx'),
    read('./components/AdvancedSearchPage.tsx'),
    read('./components/ProjectsPage.tsx'),
    read('./components/ResearchProjectPage.tsx'),
    read('./components/FeatureDocumentSharePage.tsx'),
    read('./components/UsersPage.tsx'),
    read('./components/SiteVersionPage.tsx'),
    read('./components/ReferenceDetailShell.tsx'),
  ]);

  routes.forEach((source) =>
    assert.match(source, /vitrine-page|projects-workspace/),
  );
});

test('marketing and member chrome no longer use a separate inverse neutral palette', async () => {
  const [
    home,
    buildInPublic,
    pricing,
    signIn,
    collectionPicker,
    settings,
    collections,
    pipeline,
  ] = await Promise.all([
    read('./Home.tsx'),
    read('./BuildInPublic.tsx'),
    read('./Pricing.tsx'),
    read('./SignIn.tsx'),
    read('./components/CollectionPicker.tsx'),
    read('./components/SettingsPanel.tsx'),
    read('./components/CollectionsPanel.tsx'),
    read('./components/PipelinePanel.tsx'),
  ]);

  assert.doesNotMatch(home, /background:\s*'#171717'|color:\s*'#a1a1aa'|background:\s*'#fff',\s*color:\s*'#18181b'/);
  assert.doesNotMatch(buildInPublic, /background:\s*'#171717'|color:\s*'#a1a1aa'|background:\s*'#fff',\s*color:\s*'#18181b'/);
  assert.doesNotMatch(pricing, /var\(--color-accent-muted,\s*#eef1fd\)/);
  assert.match(signIn, /background:\s*embedded\s*\?\s*'transparent'\s*:\s*'var\(--color-background-body\)'/);
  assert.doesNotMatch(collectionPicker, /rgba\(255,255,255|color:\s*'#fff'/);
  assert.doesNotMatch(settings, /var\(--color-background-overlay,\s*rgba|var\(--color-text-success,\s*#/);
  assert.doesNotMatch(collections, /var\(--color-background-overlay,\s*rgba/);
  assert.doesNotMatch(pipeline, /var\(--color-text-danger,\s*#/);
});

test('interactive workspaces inherit the Vitrines roles without local color systems', async () => {
  const [
    styles,
    projects,
    settings,
    discovery,
    documentCss,
    documentPage,
    playground,
    modalCss,
  ] = await Promise.all([
    read('./styles.css'),
    read('./projectsWorkspace.css'),
    read('./settingsWorkspace.css'),
    read('./referenceDiscovery.css'),
    read('./components/projectDocument.css'),
    read('./components/ProjectDocumentPage.tsx'),
    read('./components/ProjectPlaygroundPage.tsx'),
    read('./components/AstryxModal.css'),
  ]);

  assert.match(styles, /--color-text-danger:\s*var\(--vitrine-color-status-error\)/);
  assert.match(styles, /--color-text-success:\s*var\(--vitrine-color-status-success\)/);
  assert.match(styles, /--project-canvas-bg:\s*var\(--vitrine-color-page\)/);
  assert.match(projects, /--color-background-body:\s*var\(--vitrine-color-page\)/);
  assert.match(settings, /--color-background-body:\s*var\(--vitrine-color-page\)/);
  assert.doesNotMatch(projects, /color-scheme:\s*light/);
  assert.match(discovery, /--reference-chrome-bg:\s*var\(--vitrine-color-page\)/);
  assert.match(documentCss, /--project-document-surface:\s*var\(--vitrine-color-surface\)/);
  assert.doesNotMatch(
    [projects, settings, discovery, documentCss].join('\n'),
    /--(?:color-background-body|reference-chrome-bg|project-document-surface):\s*light-dark\(/,
  );
  assert.match(documentPage, /theme=\{resolvedTheme\}/);
  assert.match(playground, /theme=\{canvasTheme\}/);
  assert.doesNotMatch(playground, /theme="light"/);
  assert.match(modalCss, /--astryx-modal-surface:\s*var\(--color-background-popover\)/);
});

test('screen styles cannot introduce independent semantic palettes', async () => {
  const screenStyles = await Promise.all([
    read('./styles.css'),
    read('./referenceDiscovery.css'),
    read('./settingsWorkspace.css'),
    read('./projectsWorkspace.css'),
    read('./collectionsWorkspace.css'),
    read('./components/projectDocument.css'),
    read('./flowPreviewDialog.css'),
  ]);
  const directSemanticColor = /--color-(?:background-body|background-surface|background-muted|text-primary|text-secondary|text-disabled|border|border-emphasized|accent|success|warning|error):\s*(?:light-dark\(|#|rgb|hsl)/;

  screenStyles.forEach((source) => assert.doesNotMatch(source, directSemanticColor));
});
