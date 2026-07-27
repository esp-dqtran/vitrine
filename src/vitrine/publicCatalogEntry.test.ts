import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('boots public catalogs through the shared application surface and discovery styles', async () => {
  const [html, entry, main] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('./entry.ts', import.meta.url), 'utf8'),
    readFile(new URL('./main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /src="\/src\/vitrine\/entry\.ts"/);
  assert.doesNotMatch(html, /src="\/src\/vitrine\/main\.tsx"/);
  assert.doesNotMatch(entry, /isPublicCatalogPath|publicCatalogMain/);
  assert.match(entry, /import\(['"]\.\/main\.tsx['"]\)/);
  assert.match(main, /import ['"]\.\/styles\.css['"]/);
  assert.match(main, /import ['"]\.\/referenceDiscovery\.css['"]/);
});
