import assert from 'node:assert/strict';
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
