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
    evidence: [{
      imageId: 1,
      imageUrl: '/flow.png',
      thumbnailUrl: '/flow-thumb.webp',
      description: null,
    }],
  }],
};

test('renders a flow strip with responsive observed screen media', () => {
  const html = renderToStaticMarkup(<FlowCard flow={flow} onOpen={() => {}} />);
  assert.match(html, /data-flow-strip-card="true"/);
  assert.match(html, /aria-label="Open Login flow"/);
  assert.match(html, /src="\/flow-thumb.webp"/);
  assert.doesNotMatch(html, /src="\/flow.png"/);
  assert.match(html, /srcSet="\/flow-thumb\.webp 1x,\/flow\.png 2x"/);
  assert.match(html, /<h2>Login<\/h2>/);
  assert.match(html, />1 screen</);
  assert.match(html, />Save</);
  assert.match(html, />Copy</);
});

test('uses the captured-preview fallback when a flow has no evidence image', () => {
  const html = renderToStaticMarkup(
    <FlowCard flow={{ ...flow, steps: [{ label: 'Submit', evidence: [] }] }} onOpen={() => {}} />,
  );
  assert.match(html, /aria-label="Captured preview unavailable"/);
  assert.doesNotMatch(html, /<img/);
});
