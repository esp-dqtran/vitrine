import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs.tsx';

test('renders Apps, Sites, Flows, and Colors in navigation order', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs active="flows" onChange={() => undefined} />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /Apps/);
  assert.match(html, /Sites/);
  assert.match(html, /Colors/);
  assert.match(html, /Flows/);
  assert.ok(html.indexOf('Flows') < html.indexOf('Colors'));
  assert.doesNotMatch(html, /Projects/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>.*?Flows/s);
});

test('can render Projects as the only workspace tab', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs
      active="projects"
      values={['projects']}
      onChange={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /Apps|Sites|Colors|Flows/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>.*?Projects/s);
});
