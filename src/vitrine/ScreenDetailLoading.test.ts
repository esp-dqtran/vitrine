import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('removes Overview and defaults invalid App sections to Screens', async () => {
  const [detail, sectionHook] = await Promise.all([
    readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useAppSectionData.ts', import.meta.url), 'utf8').catch(() => ''),
  ]);
  assert.doesNotMatch(detail, /AppOverviewPanel|id: 'overview'|label: 'Overview'/);
  assert.doesNotMatch(sectionHook, /'overview'|case 'overview'/);
  assert.match(detail, /:\s*'screens';/);
  assert.doesNotMatch(detail, /initialNextCursor|app\.screens/);
});

test('maps visible sections to dedicated lazy dependencies', async () => {
  const source = await readFile(new URL('./useAppSectionData.ts', import.meta.url), 'utf8').catch(() => '');
  assert.match(source, /case 'screens': return \['versions', 'screens'\]/);
  assert.match(source, /case 'elements': return \['versions', 'ui-elements'\]/);
  assert.match(source, /case 'flows': return \['versions', 'flows'\]/);
  assert.match(source, /case 'export': return \['versions', 'design-system', 'screens'\]/);
});

test('synchronizes the visible section when browser history changes the route', async () => {
  const source = await readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /setSectionState\(resolveSection\(initialSection, role, selectedPlatform\)\)/);
  assert.match(source, /\[initialSection, role, selectedPlatform\]/);
});

test('streams automatic design generation without hiding an existing snapshot', async () => {
  const [detail, designSystemHook] = await Promise.all([
    readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useDesignSystem.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(detail, /useDesignSystemGeneration\(\{/);
  assert.match(detail, /enabled: role === 'admin' && section === 'design-system'/);
  assert.match(detail, /hasSnapshot: snapshot !== null/);
  assert.match(detail, /designSystemStatus === 'loading' && !snapshot/);
  assert.match(detail, /generation=\{designSystemGeneration\}/);
  assert.match(designSystemHook, /reload: \(\) => store\.reload\(key\)/);
  assert.doesNotMatch(detail, /setInterval/);
});
