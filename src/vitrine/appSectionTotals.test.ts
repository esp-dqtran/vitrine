import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppSectionTotals } from './appSectionTotals.ts';

const appTotals = {
  totalScreens: 587,
  totalUiElements: 587,
  totalFlows: 117,
};

test('uses the selected version totals instead of app-level fallback totals', () => {
  const versions = [
    { version_number: 1, screen_count: 480, ui_element_count: 320, flow_count: 92 },
    { version_number: 2, screen_count: 610, ui_element_count: 444, flow_count: 123 },
  ];

  assert.deepEqual(resolveAppSectionTotals(appTotals, versions, 2), {
    screens: 610,
    elements: 444,
    flows: 123,
  });
});

test('falls back to app totals while selected version metadata is unavailable', () => {
  assert.deepEqual(resolveAppSectionTotals(appTotals, null, 2), {
    screens: 587,
    elements: 587,
    flows: 117,
  });
});
