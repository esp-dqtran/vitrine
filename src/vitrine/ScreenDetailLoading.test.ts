import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('reuses initial detail version and cursor', async () => {
  const source = await readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /initialVersion/);
  assert.match(source, /initialNextCursor/);
  assert.match(source, /useState<number \| undefined>\(initialVersion\?\.version_number\)/);
  assert.match(source, /useState\(Boolean\(initialVersion\)\)/);
  assert.match(source, /selectedVersion === undefined && versionScreens !== null/);
});

test('loads raw UI elements only from the elements section', async () => {
  const source = await readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /section !== 'elements'/);
  assert.match(source, /designSystemStatus === 'loading'/);
  assert.doesNotMatch(source, /Promise\.all\(\[\s*fetch\([^\]]+loadElements/);
});

test('synchronizes the visible section when browser history changes the route', async () => {
  const source = await readFile(new URL('./components/ScreenDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /useEffect\(\(\) => setSectionState\(resolveSection\(initialSection, role\)\), \[initialSection, role\]\)/);
});
