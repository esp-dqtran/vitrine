import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('does not replay page-load request effects in development', async () => {
  const source = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\bStrictMode\b/);
});
