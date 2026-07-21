import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceTypeTabs } from './components/ReferenceTypeTabs.tsx';

test('renders Apps and Sites as accessible reference-type tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceTypeTabs active="sites" onChange={() => undefined} />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /Apps/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /Sites/);
});

test('uses one References sidebar item for App and Site routes', () => {
  const source = readFileSync(new URL('./components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(source, /label: 'References'/);
  assert.doesNotMatch(source, /label: 'Apps'/);
  assert.doesNotMatch(source, /label: 'Sites'/);
  assert.match(source, /r\.name === 'site-version'/);
  assert.match(source, /r\.name === 'app'/);
});
