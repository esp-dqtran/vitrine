import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Spinner } from './Spinner.tsx';

test('renders the selected Comet spinner with an accessible status name', () => {
  const html = renderToStaticMarkup(<Spinner size="lg" aria-label="Loading flows" />);

  assert.match(html, /data-vitrine-spinner="comet"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="Loading flows"/);
  assert.match(html, /viewBox="0 0 52 52"/);
  assert.equal((html.match(/data-comet-arc/g) ?? []).length, 3);
});

test('keeps the inherited foreground when shown inside a colored control', () => {
  const html = renderToStaticMarkup(<Spinner size="sm" shade="inherit" />);

  assert.match(html, /--vitrine-spinner-color:currentColor/);
  assert.match(html, /width="14"/);
  assert.match(html, /height="14"/);
});
