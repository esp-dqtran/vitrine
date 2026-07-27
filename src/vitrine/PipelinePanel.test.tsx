import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelinePanel } from './components/PipelinePanel.tsx';

test('renders monitoring without import controls when there are no jobs', () => {
  const html = renderToStaticMarkup(<PipelinePanel onPipelineDone={() => {}} />);
  assert.match(html, /Pipeline activity/);
  assert.match(html, /Monitor and cancel existing processing jobs/);
  assert.doesNotMatch(html, /App name|Mobbin screens URL|Import app/);
});
