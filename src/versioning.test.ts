import assert from 'node:assert/strict';
import test from 'node:test';
import { isAppVersionProvider } from './versioning.ts';

test('recognizes Apple as an app-version provider', () => {
  assert.equal(isAppVersionProvider('a'), true);
  assert.equal(isAppVersionProvider('m'), true);
  assert.equal(isAppVersionProvider('f'), true);
  assert.equal(isAppVersionProvider('unknown'), false);
});
