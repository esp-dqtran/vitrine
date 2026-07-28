import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs.tsx';

test('renders Apps, Sites, and Flows as accessible reference-type tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs active="flows" onChange={() => undefined} />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /Apps/);
  assert.match(html, /Sites/);
  assert.match(html, /Flows/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>.*?Flows/s);
});
