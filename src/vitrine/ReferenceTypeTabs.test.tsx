import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs.tsx';

test('renders Components next to Flows in the main reference navigation', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs active="flows" onChange={() => undefined} />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /Apps/);
  assert.match(html, /Sites/);
  assert.match(html, /Colors/);
  assert.match(html, /Flows/);
  assert.match(html, /Components/);
  assert.ok(html.indexOf('Flows') < html.indexOf('Components'));
  assert.ok(html.indexOf('Components') < html.indexOf('Colors'));
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

  assert.doesNotMatch(html, /Apps|Sites|Colors|Flows|Components/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>.*?Projects/s);
});
