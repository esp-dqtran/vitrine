import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps Overview free of section and design-system activation', async () => {
  const [detail, sectionHook] = await Promise.all([
    readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./useAppSectionData.ts', import.meta.url), 'utf8').catch(() => ''),
  ]);
  assert.match(detail, /<AppOverviewPanel app=\{app\}/);
  assert.match(sectionHook, /case 'overview': return \[\]/);
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
  assert.match(source, /useEffect\(\(\) => setSectionState\(resolveSection\(initialSection, role\)\), \[initialSection, role\]\)/);
});
