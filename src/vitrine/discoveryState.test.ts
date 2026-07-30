import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseDiscoveryState,
  serializeDiscoveryState,
  type DiscoveryState,
  type DiscoveryStateDefinition,
} from './discoveryState.ts';

type Sort = 'latest' | 'trending';

const defaults: DiscoveryState<Sort> = {
  platform: 'web',
  sort: 'latest',
  query: '',
  filters: [],
};

const definition: DiscoveryStateDefinition<Sort> = {
  platforms: ['web', 'ios', 'android'],
  sorts: ['latest', 'trending'],
  filterGroups: ['categories', 'flows', 'screens'],
};

test('round trips repeated filters in stable group/value order', () => {
  const state = parseDiscoveryState(
    '?platform=web&filter=flows.Logging%20out&filter=categories.Finance&filter=flows.Logging%20out',
    defaults,
    definition,
  );
  assert.equal(
    serializeDiscoveryState(state, definition),
    'platform=web&sort=latest&filter=categories.Finance&filter=flows.Logging+out',
  );
});

test('serializes distinct values alphabetically within each group', () => {
  assert.equal(
    serializeDiscoveryState(
      {
        ...defaults,
        filters: [
          { group: 'flows', value: 'Zeta' },
          { group: 'categories', value: 'Zeta' },
          { group: 'flows', value: 'Alpha' },
          { group: 'categories', value: 'Alpha' },
        ],
      },
      definition,
    ),
    'platform=web&sort=latest&filter=categories.Alpha&filter=categories.Zeta&filter=flows.Alpha&filter=flows.Zeta',
  );
});

test('parses canonical query values and removes duplicate filters', () => {
  assert.deepEqual(
    parseDiscoveryState(
      '?platform=ios&sort=trending&query=%20mobile%20banking%20&filter=categories.Finance&filter=flows.Checkout&filter=categories.Finance',
      defaults,
      definition,
    ),
    {
      platform: 'ios',
      sort: 'trending',
      query: 'mobile banking',
      filters: [
        { group: 'categories', value: 'Finance' },
        { group: 'flows', value: 'Checkout' },
      ],
    },
  );
});

test('ignores invalid URL values while retaining defaults', () => {
  assert.deepEqual(
    parseDiscoveryState(
      '?platform=desktop&sort=popular&query=%20%20&filter=unknown.Value&filter=flows&filter=.Checkout&filter=flows.%20%20',
      { ...defaults, query: 'fallback', filters: [{ group: 'categories', value: 'Finance' }] },
      definition,
    ),
    { ...defaults, query: '', filters: [{ group: 'categories', value: 'Finance' }] },
  );
});

test('trims queries, discards overlong values, and omits empty queries when serializing', () => {
  const longValue = 'x'.repeat(121);
  assert.deepEqual(
    parseDiscoveryState(
      `?query=${longValue}&filter=flows.${longValue}`,
      { ...defaults, query: 'fallback' },
      definition,
    ),
    { ...defaults, query: 'fallback' },
  );
  assert.equal(
    serializeDiscoveryState(
      {
        platform: 'web',
        sort: 'latest',
        query: '   ',
        filters: [
          { group: 'flows', value: ' Checkout ' },
          { group: 'flows', value: 'Checkout' },
          { group: 'unknown', value: 'Ignored' },
          { group: 'categories', value: longValue },
        ],
      },
      definition,
    ),
    'platform=web&sort=latest&filter=flows.Checkout',
  );
});

test('honors a custom query-length boundary when parsing and serializing', () => {
  const shortQueryDefinition = { ...definition, maxQueryLength: 3 };
  const fallback = { ...defaults, query: 'fallback' };

  assert.equal(
    parseDiscoveryState('?query=abc', fallback, shortQueryDefinition).query,
    'abc',
  );
  assert.equal(
    parseDiscoveryState('?query=abcd', fallback, shortQueryDefinition).query,
    'fallback',
  );
  assert.equal(
    serializeDiscoveryState({ ...defaults, query: 'abc' }, shortQueryDefinition),
    'platform=web&sort=latest&query=abc',
  );
  assert.equal(
    serializeDiscoveryState({ ...defaults, query: 'abcd' }, shortQueryDefinition),
    'platform=web&sort=latest',
  );
});
