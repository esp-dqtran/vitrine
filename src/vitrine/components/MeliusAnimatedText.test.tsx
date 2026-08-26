import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeliusAnimatedText } from './MeliusAnimatedText.tsx';

test('renders arbitrary text in both animation layers', () => {
  const html = renderToStaticMarkup(<MeliusAnimatedText text="VITRINES" />);

  assert.match(html, /aria-label="VITRINES"/);
  assert.match(html, /data-melius-animated-text="VITRINES"/);
  assert.equal(html.match(/>VITRINES<\/span>/g)?.length, 2);
  assert.doesNotMatch(html, /MELIUS/);
});

test('supports an accessible label that differs from the visual text', () => {
  const html = renderToStaticMarkup(<MeliusAnimatedText ariaLabel="Vitrines animated wordmark" text="VITRINES" />);

  assert.match(html, /aria-label="Vitrines animated wordmark"/);
});

test('stays out of keyboard focus and does not allow text selection', async () => {
  const html = renderToStaticMarkup(<MeliusAnimatedText text="VITRINES" />);
  const css = await readFile(new URL('../componentLibrary.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /tabindex=/i);
  assert.match(css, /\.melius-animated-text\s*\{[^}]*cursor:\s*default[^}]*user-select:\s*none/s);
});
