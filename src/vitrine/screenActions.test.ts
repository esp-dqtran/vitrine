import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResearchCollection } from '../db.ts';
import {
  areReferencesSaved,
  copyShareLink,
  dedupeSaveReferences,
  flowShareUrl,
  isReferenceSaved,
  isSavedCollection,
  matchingCollectionItems,
  screenImageCopyUrl,
} from './screenActions.ts';
import type { SaveReference } from './researchApi.ts';

const reference: SaveReference = {
  kind: 'screen',
  app: 'amazon-shopping',
  referenceId: '42',
  title: 'Checkout',
};

const collections: ResearchCollection[] = [
  {
    id: 1,
    name: 'Saved',
    description: '',
    created_at: '',
    updated_at: '',
    items: [{
      id: 10,
      kind: 'screen',
      app: 'amazon-shopping',
      reference_id: '42',
      title: 'Checkout',
      notes: '',
      created_at: '',
      updated_at: '',
    }],
  },
  {
    id: 2,
    name: 'Checkout research',
    description: '',
    created_at: '',
    updated_at: '',
    items: [{
      id: 11,
      kind: 'screen',
      app: 'amazon-shopping',
      reference_id: '42',
      title: 'Checkout',
      notes: '',
      created_at: '',
      updated_at: '',
    }],
  },
];

test('finds saved screen membership across every collection', () => {
  assert.equal(isReferenceSaved(collections, reference), true);
  assert.equal(matchingCollectionItems(collections, reference).length, 2);
  assert.equal(
    isReferenceSaved(collections, { ...reference, referenceId: '99' }),
    false,
  );
});

test('recognizes the system Saved collection without consuming custom collection semantics', () => {
  assert.equal(isSavedCollection(collections[0]), true);
  assert.equal(isSavedCollection({ name: 'All saved' }), true);
  assert.equal(isSavedCollection(collections[1]), false);
});

test('requires every distinct selected screen to be saved', () => {
  assert.equal(areReferencesSaved(collections, [reference]), true);
  assert.equal(areReferencesSaved(collections, [
    reference,
    { ...reference, referenceId: '99' },
  ]), false);
  assert.equal(areReferencesSaved(collections, []), false);
});

test('deduplicates repeated screen references used by Highlights and All screens', () => {
  assert.deepEqual(
    dedupeSaveReferences([
      reference,
      reference,
      { ...reference, referenceId: '43' },
    ]).map(({ referenceId }) => referenceId),
    ['42', '43'],
  );
});

test('requests same-origin media bytes without changing external URLs', () => {
  assert.equal(
    screenImageCopyUrl('/api/media/amazon-shopping/0123456789abcdef?variant=thumb'),
    '/api/media/amazon-shopping/0123456789abcdef?variant=thumb&delivery=inline',
  );
  assert.equal(
    screenImageCopyUrl('https://objects.example/screen.png'),
    'https://objects.example/screen.png',
  );
});

test('builds a canonical share URL for a selected Flow screen', () => {
  assert.equal(
    flowShareUrl(
      'http://127.0.0.1:5173/flows?platform=web&sort=popular',
      'account:delete',
      2,
    ),
    'http://127.0.0.1:5173/flows?platform=web&sort=popular&flow=account%3Adelete&tab=screens&screen=2',
  );
});

test('writes text through the guarded shared clipboard action', async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied = '';
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          copied = value;
        },
      },
    },
  });
  try {
    await copyShareLink('https://astryx.example/flows/checkout');
    assert.equal(copied, 'https://astryx.example/flows/checkout');
  } finally {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }
  }
});
