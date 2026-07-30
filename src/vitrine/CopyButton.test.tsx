import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyButton } from './components/CopyButton.tsx';

test('renders the shared secondary Copy treatment', () => {
  const html = renderToStaticMarkup(
    <CopyButton
      label="Copy image"
      successMessage="Image copied as PNG"
      action={async () => undefined}
    />,
  );

  assert.match(html, /data-variant="secondary"/);
  assert.match(html, />Copy image</);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});

test('keeps success feedback in Toast instead of changing the idle button label', () => {
  const html = renderToStaticMarkup(
    <CopyButton
      label="Copy link"
      successMessage="Link copied"
      action={async () => undefined}
    />,
  );

  assert.match(html, />Copy link</);
  assert.doesNotMatch(html, />Copied</);
  assert.doesNotMatch(html, />Link copied</);
});
