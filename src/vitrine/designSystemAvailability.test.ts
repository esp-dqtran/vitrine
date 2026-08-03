import assert from 'node:assert/strict';
import test from 'node:test';
import { hasDesignSystemContent } from './designSystemAvailability.ts';

test('requires design-system content instead of a flows-only placeholder', () => {
  assert.equal(hasDesignSystemContent(null), false);
  assert.equal(hasDesignSystemContent({ tokens: [], components: [] }), false);
  assert.equal(hasDesignSystemContent({ tokens: [], components: [], rules: [] }), false);
  assert.equal(hasDesignSystemContent({ tokens: [{}], components: [] }), true);
  assert.equal(hasDesignSystemContent({ tokens: [], components: [{}] }), true);
  assert.equal(hasDesignSystemContent({ tokens: [], components: [], rules: [{}] }), true);
});
