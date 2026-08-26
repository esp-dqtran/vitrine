import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(html, /reference-type-tabs__indicator/);
  assert.equal((html.match(/reference-type-tabs__tab/g) ?? []).length, 5);
  assert.match(html, /role="tab"[^>]+aria-selected="true"[^>]*>.*?Flows/s);
});

test('uses a measured pill with a reduced-motion fallback for reference navigation', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('./components/ReferenceTypeTabs.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /values = DEFAULT_REFERENCE_TYPES/);
  assert.match(source, /activeRect\.left - tablistRect\.left \+ tablist\.scrollLeft/);
  assert.match(css, /\.reference-type-tabs__indicator\s*\{[^}]*transition:[^}]*width 240ms[^}]*transform 240ms/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.reference-type-tabs__indicator,[\s\S]*transition:\s*none\s*!important/);
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
