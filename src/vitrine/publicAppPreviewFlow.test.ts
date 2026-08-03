import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('catalog app selection opens a bounded preview modal before full detail', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
  const openApp = source.slice(
    source.indexOf('const openApp = async'),
    source.indexOf('const requestFullAppAnalysis'),
  );

  assert.match(openApp, /if \(isGuest \|\| isFreeGated\(appId\)\)/);
  assert.ok(
    openApp.indexOf('setPreviewTarget(appId)') <
      openApp.indexOf('navigate({ name: "app", appId })'),
  );
  assert.match(source, /<PublicAppPreviewModal/);
  assert.match(source, /onClose=\{\(\) => setPreviewTarget\(null\)\}/);
});
