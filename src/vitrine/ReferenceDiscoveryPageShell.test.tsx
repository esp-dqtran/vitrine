import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceDiscoveryPageShell } from './components/ReferenceDiscoveryPageShell.tsx';

test('composes an Apps discovery page from shared regions', () => {
  const html = renderToStaticMarkup(
    <ReferenceDiscoveryPageShell
      kind="apps"
      header={<header data-region="header" />}
      taxonomyLabel="App discovery filters"
      taxonomy={<span data-region="taxonomy" />}
      preview={<div data-region="preview" />}
      toolbar={<div data-region="toolbar" />}
    >
      <div data-region="body" />
    </ReferenceDiscoveryPageShell>,
  );

  assert.match(html, /data-apps-discovery="true"/);
  assert.match(html, /data-reference-gallery-shell="apps"/);
  assert.match(html, /class="[^\"]*reference-discovery[^\"]*reference-discovery--apps[^\"]*apps-discovery[^\"]*"/);
  assert.match(html, /aria-label="App discovery filters"/);
  assert.ok(
    html.indexOf('data-region="header"') < html.indexOf('data-region="taxonomy"')
      && html.indexOf('data-region="taxonomy"') < html.indexOf('data-region="preview"')
      && html.indexOf('data-region="preview"') < html.indexOf('data-region="toolbar"')
      && html.indexOf('data-region="toolbar"') < html.indexOf('data-region="body"'),
  );
});
