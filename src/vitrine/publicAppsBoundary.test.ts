import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('keeps guest Apps discovery on public catalog capabilities', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const isGuest = user === null/);
  assert.match(source, /const canUseAdvancedSearch = advancedSearchEnabled && user !== null/);
  assert.match(source, /if \(user\) await ensureCollections\(\)/);
  assert.match(source, /mode=\{canUseAdvancedSearch \? 'advanced' : 'legacy'\}/);
  assert.match(source, /canUseAdvancedSearch \? \(\s*<QuickSearch/);
  assert.match(source, /\{user && collectionsOpen && <CollectionsPanel/);
  assert.match(source, /\{canUseAdvancedSearch && advancedPreview \?/);
});

test('keeps Landing implementation outside the public Apps change', async () => {
  const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');

  assert.match(home, /export function Home/);
  assert.doesNotMatch(home, /GuestCatalogControls|requiresAuthentication|isGuest/);
});
