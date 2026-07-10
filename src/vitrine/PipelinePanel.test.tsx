import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelinePanel } from './components/PipelinePanel.tsx';

test('renders the import controls when there are no jobs', () => {
  const html = renderToStaticMarkup(<PipelinePanel onPipelineDone={() => {}} />);
  assert.match(html, /Import a Mobbin app/);
  assert.match(html, /App name/);
  assert.match(html, /Mobbin screens URL/);
  assert.match(html, /Import app/);
});
