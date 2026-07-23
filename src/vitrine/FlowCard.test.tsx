import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowCard } from './components/FlowCard.tsx';

const flow = {
  id: 'login',
  title: 'Login',
  description: '',
  tags: [],
  steps: [{
    label: 'Submit',
    evidence: [{ imageId: 1, imageUrl: '/flow.png', description: null }],
  }],
};

test('renders a flow through the shared media-card title and badge contract', () => {
  const html = renderToStaticMarkup(<FlowCard flow={flow} onOpen={() => {}} />);
  assert.match(html, /aria-label="Open Login flow"/);
  assert.match(html, /src="\/flow.png"/);
  assert.match(html, /data-media-grid-card-title="true"/);
  assert.match(html, />Login</);
  assert.match(html, />1 step</);
});

test('uses the shared preview fallback when a flow has no evidence image', () => {
  const html = renderToStaticMarkup(
    <FlowCard flow={{ ...flow, steps: [{ label: 'Submit', evidence: [] }] }} onOpen={() => {}} />,
  );
  assert.match(html, /aria-label="Preview unavailable"/);
  assert.doesNotMatch(html, /<img/);
});
