import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('keeps guest Apps discovery on public catalog capabilities', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const isGuest = user === null/);
  assert.match(source, /const canUseAdvancedSearch = advancedSearchEnabled && user !== null/);
  assert.match(source, /if \(user\) await ensureCollections\(\)/);
  assert.match(source, /searchMode=\{canUseAdvancedSearch \? 'advanced' : 'legacy'\}/);
  assert.match(source, /canUseAdvancedSearch \? \(\s*<QuickSearch/);
  assert.match(source, /\{user && collectionsOpen && <CollectionsPanel/);
  assert.match(source, /\{canUseAdvancedSearch && advancedPreview \?/);
});

test('keeps Landing implementation outside the public Apps change', async () => {
  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(home, /export function Home/);
  assert.doesNotMatch(home, /GuestCatalogControls|requiresAuthentication|isGuest/);
});

test('keeps guest discovery overlays mounted in the persistent application surface', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  const overlays = source.indexOf('const discoveryOverlays =');
  const appsRoute = source.indexOf("case 'apps':");
  const surface = source.indexOf('<ApplicationSurface');

  assert.notEqual(overlays, -1, 'discovery overlays should be shared');
  assert.notEqual(appsRoute, -1, 'Apps route should exist');
  assert.notEqual(surface, -1, 'persistent application surface should exist');
  assert.ok(overlays < surface, 'overlays must be defined before the shared surface');
  assert.ok(appsRoute < surface, 'Apps route should resolve before the shared surface');
  assert.equal(source.match(/overlays=\{discoveryOverlays\}/g)?.length, 1);
});

test('lets guests search the public catalog without enabling member research', async () => {
  const [app, palette] = await Promise.all([
    readFile(new URL('./App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/CommandPalette.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /publicBrowse=\{isGuest\}/);
  assert.match(palette, /publicBrowse\?: boolean/);
  assert.match(palette, /isDisabled=\{plan === 'free' && !publicBrowse\}/);
  assert.match(palette, /publicBrowse \? \(/);
});
