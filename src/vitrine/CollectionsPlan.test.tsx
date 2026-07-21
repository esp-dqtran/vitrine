import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollectionsPanel } from './components/CollectionsPanel.tsx';

const collection = {
  id: 1,
  name: 'Checkout research',
  description: '',
  created_at: '',
  updated_at: '',
  items: [{
    id: 9,
    collection_id: 1,
    kind: 'screen' as const,
    app: 'linear',
    reference_id: 'checkout',
    title: 'Checkout',
    notes: 'Existing Pro note',
    position: 0,
    created_at: '',
    updated_at: '',
  }],
};

test('locks additional collections and note editing for Free users', () => {
  const html = renderToStaticMarkup(<CollectionsPanel
    collections={[collection]}
    plan="free"
    onUpgrade={() => undefined}
    onChange={() => undefined}
    onClose={() => undefined}
    onOpenApp={() => undefined}
  />);

  assert.match(html, /Upgrade for more collections/);
  assert.match(html, /Notes require Pro/);
  assert.match(html, /Existing Pro note/);
  assert.doesNotMatch(html, /New collection name/);
  assert.doesNotMatch(html, /Add a research note/);
});

test('keeps collection creation and note editing available to Pro users', () => {
  const html = renderToStaticMarkup(<CollectionsPanel
    collections={[collection]}
    plan="pro"
    onUpgrade={() => undefined}
    onChange={() => undefined}
    onClose={() => undefined}
    onOpenApp={() => undefined}
  />);

  assert.match(html, /New collection name/);
  assert.match(html, /Add a research note/);
  assert.doesNotMatch(html, /Notes require Pro/);
});
