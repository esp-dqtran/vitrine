import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_SCREEN_TYPES,
  LEGACY_SCREEN_TYPES,
  SCREEN_CATEGORIES,
  screenCategoryForType,
} from './screenCategories.ts';
import { buildAppsFilterOptions } from './appsDiscovery.ts';

test('groups every canonical screen type beneath one parent category', () => {
  assert.equal(new Set(ALL_SCREEN_TYPES).size, ALL_SCREEN_TYPES.length);
  assert.equal(screenCategoryForType('Checkout')?.label, 'Commerce & Finance');
  assert.equal(screenCategoryForType('dashboard')?.label, 'Data');
  assert.equal(screenCategoryForType('Settings & Preferences')?.label, 'Account Management');
  assert.ok(SCREEN_CATEGORIES.every(({ children }) => children.length > 0));
  assert.equal(SCREEN_CATEGORIES.length, 12);
  assert.equal(screenCategoryForType('Preview'), undefined);
  assert.deepEqual(LEGACY_SCREEN_TYPES, ['Preview', 'Wallpaper']);
});

test('uses parent categories to group and order the Screens filter children', () => {
  const options = buildAppsFilterOptions([]).screens;
  assert.deepEqual(
    options.slice(0, 4).map(({ section, value }) => [section, value]),
    [
      ['New User Experience', 'Account Setup'],
      ['New User Experience', 'Guided Tour & Tutorial'],
      ['New User Experience', 'Signup'],
      ['New User Experience', 'Verification'],
    ],
  );
  assert.equal(options.find(({ value }) => value === 'Dashboard')?.section, 'Data');
});
