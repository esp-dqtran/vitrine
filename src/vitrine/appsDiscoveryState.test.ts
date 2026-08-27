import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appsDiscoveryFacets,
  appsDiscoveryPath,
  clearAppsDiscoveryFacet,
  defaultAppsDiscoveryState,
  parseAppsDiscoveryState,
  setAppsDiscoveryFacet,
  toggleAppsDiscoveryFacet,
} from './appsDiscoveryState.ts';

test('round-trips Mobbin-style Apps filter state through the URL', () => {
  const state = {
    platform: 'web' as const,
    contentType: 'screens' as const,
    sort: 'latest' as const,
    filters: {
      categories: ['Shopping', 'Business', 'AI'],
      screens: ['My Account & Profile', 'Settings & Preferences'],
    },
  };
  const path = appsDiscoveryPath(state);

  assert.match(path, /^\/apps\?/);
  assert.match(path, /content_type=screens/);
  assert.doesNotMatch(path, /sort=/);
  assert.match(
    path,
    /filter=categories\.AI&filter=categories\.Business&filter=categories\.Shopping&filter=screens\.My\+Account\+%26\+Profile&filter=screens\.Settings\+%26\+Preferences/,
  );
  assert.deepEqual(parseAppsDiscoveryState(path.slice(path.indexOf('?'))), {
    ...state,
    filters: {
      categories: ['AI', 'Business', 'Shopping'],
      screens: ['My Account & Profile', 'Settings & Preferences'],
    },
  });
});

test('serializes Apps filter values alphabetically within each group', () => {
  assert.equal(
    appsDiscoveryPath({
      platform: 'web',
      contentType: 'apps',
      sort: 'latest',
      filters: {
        categories: ['Zeta', 'Alpha'],
        flows: ['Zeta', 'Alpha'],
      },
    }),
    '/apps?platform=web&content_type=apps&filter=categories.Alpha&filter=categories.Zeta&filter=flows.Alpha&filter=flows.Zeta',
  );
});

test('reads legacy underscore-delimited Apps filters but serializes them canonically', () => {
  const state = parseAppsDiscoveryState(
    '?platform=ios&content_type=flows&sort=trending&filter=appCategories.Finance_flows.Checkout_appCategories.Finance',
  );

  assert.deepEqual(state, {
    platform: 'ios',
    contentType: 'flows',
    sort: 'latest',
    filters: {
      categories: ['Finance'],
      flows: ['Checkout'],
    },
  });
  assert.equal(
    appsDiscoveryPath(state),
    '/apps?platform=ios&content_type=flows&filter=categories.Finance&filter=flows.Checkout',
  );
});

test('preserves underscores inside legacy Apps filter values', () => {
  assert.deepEqual(
    parseAppsDiscoveryState('?filter=appCategories.Back_office_flows.Sign_up').filters,
    {
      categories: ['Back_office'],
      flows: ['Sign_up'],
    },
  );
});

test('normalizes every Apps sort to newest', () => {
  const customSortFallback = {
    platform: 'web' as const,
    contentType: 'apps' as const,
    sort: 'trending' as const,
    filters: {},
  };

  assert.equal(parseAppsDiscoveryState('', customSortFallback).sort, 'latest');
  assert.equal(
    parseAppsDiscoveryState('?content_type=unknown', customSortFallback).sort,
    'latest',
  );
  assert.equal(
    parseAppsDiscoveryState('?content_type=flows', defaultAppsDiscoveryState()).sort,
    'latest',
  );
  assert.equal(
    parseAppsDiscoveryState('?content_type=flows&sort=latest', customSortFallback).sort,
    'latest',
  );
});

test('normalizes fallback filters into isolated group arrays', () => {
  const fallback = {
    platform: 'web' as const,
    contentType: 'apps' as const,
    sort: 'latest' as const,
    filters: { categories: [' Finance ', 'Finance'] },
  };
  const parsed = parseAppsDiscoveryState('', fallback);

  assert.deepEqual(parsed.filters, { categories: ['Finance'] });
  parsed.filters.categories?.push('Mutated');
  assert.deepEqual(fallback.filters, { categories: [' Finance ', 'Finance'] });
});

test('selecting, toggling, and clearing multiple facets keeps Apps newest-only', () => {
  const first = setAppsDiscoveryFacet(
    defaultAppsDiscoveryState('web', { group: 'categories', value: 'Shopping' }),
    { group: 'screens', value: 'My Account & Profile' },
  );
  const selected = setAppsDiscoveryFacet(
    setAppsDiscoveryFacet(first, { group: 'categories', value: 'AI' }),
    { group: 'screens', value: 'Settings & Preferences' },
  );
  const deduplicated = setAppsDiscoveryFacet(
    selected,
    { group: 'categories', value: 'AI' },
  );
  assert.equal(deduplicated.contentType, 'screens');
  assert.equal(deduplicated.sort, 'latest');
  assert.deepEqual(appsDiscoveryFacets(deduplicated), [
    { group: 'categories', value: 'Shopping' },
    { group: 'categories', value: 'AI' },
    { group: 'screens', value: 'My Account & Profile' },
    { group: 'screens', value: 'Settings & Preferences' },
  ]);

  const toggled = toggleAppsDiscoveryFacet(
    deduplicated,
    { group: 'screens', value: 'My Account & Profile' },
  );
  assert.deepEqual(toggled.filters.screens, ['Settings & Preferences']);

  const cleared = clearAppsDiscoveryFacet(toggled, 'screens');
  assert.equal(cleared.contentType, 'apps');
  assert.equal(cleared.sort, 'latest');
  assert.deepEqual(cleared.filters, { categories: ['Shopping', 'AI'] });
});

test('returns to the Apps list when the final active Screens option is toggled off', () => {
  const screens = setAppsDiscoveryFacet(
    defaultAppsDiscoveryState('web', { group: 'categories', value: 'Business' }),
    { group: 'screens', value: 'Dashboard' },
  );

  const apps = toggleAppsDiscoveryFacet(
    screens,
    { group: 'screens', value: 'Dashboard' },
  );

  assert.equal(apps.contentType, 'apps');
  assert.deepEqual(apps.filters, { categories: ['Business'] });
});
