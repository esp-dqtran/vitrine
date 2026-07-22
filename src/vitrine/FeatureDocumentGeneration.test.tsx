import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeatureDocumentSetupDialog } from './components/FeatureDocumentSetupDialog.tsx';
import { FeatureDocumentProgress } from './components/FeatureDocumentProgress.tsx';

const flow = {
  id: 'checkout',
  title: 'Checkout',
  description: 'Complete checkout',
  tags: [],
  steps: [
    { label: 'Cart', evidence: [{ imageId: 42, imageUrl: '/42', description: 'Cart' }, { imageId: 43, imageUrl: '/43', description: 'Cart detail' }] },
    { label: 'Payment', evidence: [{ imageId: 44, imageUrl: '/44', description: 'Payment' }] },
  ],
};

test('shows every evidence image count and focus instruction', () => {
  const html = renderToStaticMarkup(
    <FeatureDocumentSetupDialog
      isOpen
      onClose={() => {}}
      flow={flow}
      app="linear"
      platform="web"
      version={3}
    />,
  );
  assert.match(html, /3 images across 2 steps/);
  assert.match(html, /Focus instruction/);
  assert.match(html, /Analyze Flow/);
});

test('progress renders durable stage counts and cancellation without polling', async () => {
  const html = renderToStaticMarkup(<FeatureDocumentProgress job={{
    id: 31,
    documentId: 12,
    status: 'running',
    stage: 'analyzing',
    doneCount: 1,
    totalCount: 3,
    updatedAt: '2026-07-22T00:00:00.000Z',
  }} onCancel={() => {}} />);
  assert.match(html, /Analyzing image 2 of 3/);
  assert.match(html, /Cancel generation/);

  const sources = await Promise.all([
    readFile(new URL('./components/FeatureDocumentProgress.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/FeatureDocumentSetupDialog.tsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(sources.join('\n'), /setInterval|\/api\/jobs/);
});
