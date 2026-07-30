import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationToastProvider } from './components/ApplicationToast.tsx';

test('uses the existing screen action Toast treatment as the shared host', () => {
  const html = renderToStaticMarkup(
    <ApplicationToastProvider>
      <main>Application</main>
    </ApplicationToastProvider>,
  );

  assert.match(html, /<main>Application<\/main>/);
  assert.doesNotMatch(html, /screen-action-toast/);
});

test('keeps the Toast centered throughout its entrance motion', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const animation = css.slice(
    css.indexOf('@keyframes screenActionToastIn'),
    css.indexOf('.screen-action-toast'),
  );
  const toastRule = css.match(
    /\.screen-action-toast\s*\{[\s\S]*?\n\}/,
  )?.[0] ?? '';

  assert.match(animation, /translate\(-50%, 10px\)/);
  assert.match(animation, /translate\(-50%, 0\)/);
  assert.match(toastRule, /pointer-events: none/);
  assert.match(toastRule, /max-width: calc\(100vw - 32px\)/);
});
