import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('defines one Apps-led color foundation for every Vitrine page', async () => {
  const css = await read('./styles.css');

  assert.match(
    css,
    /\.vitrine-page\s*\{[^}]*background:\s*var\(--color-background-body\)[^}]*color:\s*var\(--color-text-primary\)[^}]*font-family:\s*var\(--reference-font-family,\s*'Figtree',\s*system-ui,\s*sans-serif\)/s,
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
    read('./components/ResearchProjectsPage.tsx'),
    read('./components/ResearchProjectPage.tsx'),
    read('./components/FeatureDocumentPage.tsx'),
    read('./components/FeatureDocumentSharePage.tsx'),
    read('./components/UsersPage.tsx'),
    read('./components/SiteVersionPage.tsx'),
    read('./components/ReferenceDetailShell.tsx'),
  ]);

  routes.forEach((source) => assert.match(source, /vitrine-page/));
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
