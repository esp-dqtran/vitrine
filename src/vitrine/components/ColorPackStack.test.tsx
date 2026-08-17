import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { ColorPackStack, type ColorPackCard } from './ColorPackStack.tsx';

const cards: readonly ColorPackCard[] = [
  { id: 'ink', name: 'Obsidian Ink', hex: '#151311', color: '#151311', foreground: '#EED3BA', role: 'lead' },
  { id: 'velvet', name: 'Velvet Curfew', hex: '#4B262F', color: '#4B262F', foreground: '#EED3BA', role: 'accent' },
  { id: 'almond', name: 'Almond Hearth', hex: '#EED3BA', color: '#EED3BA', foreground: '#151311', role: 'companion' },
];

test('renders all supplied palette cards in its reference-like open stack', () => {
  const html = renderToStaticMarkup(<ColorPackStack cards={cards} />);

  assert.match(html, /aria-label="Color pack"/);
  assert.match(html, /Obsidian Ink/);
  assert.match(html, /#151311/);
  assert.doesNotMatch(html, />HEX</);
  assert.match(html, /Velvet Curfew/);
  assert.match(html, /Almond Hearth/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-label="Collapse Color pack"/);
  assert.match(html, /data-outlined="true"/);
});

test('can begin collapsed for a compact palette summary', () => {
  const html = renderToStaticMarkup(<ColorPackStack cards={cards} initiallyExpanded={false} />);

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-label="Expand Color pack"/);
});

test('renders both stops for gradient cards', () => {
  const gradientCards: readonly ColorPackCard[] = cards.map((card, index) => ({
    ...card,
    color: `linear-gradient(135deg, ${card.hex} 0%, #773389 100%)`,
    gradient: { angle: 135 + index, endHex: '#773389' },
  }));
  const html = renderToStaticMarkup(<ColorPackStack cards={gradientCards} />);

  assert.match(html, /#151311 → #773389/);
  assert.match(html, /linear-gradient\(135deg, #151311 0%, #773389 100%\)/);
});

test('assigns a stable non-repeating icon shuffle to each palette', () => {
  const first = renderToStaticMarkup(<ColorPackStack cards={cards} label="Quiet Authority color palette" />);
  const second = renderToStaticMarkup(<ColorPackStack cards={cards} label="Violet Afterglow color palette" />);
  const indices = (html: string) => [...html.matchAll(/data-icon-index="(\d+)"/g)].map((match) => match[1]);

  assert.equal(new Set(indices(first)).size, cards.length);
  assert.notDeepEqual(indices(first), indices(second));
  assert.deepEqual(indices(first), indices(renderToStaticMarkup(
    <ColorPackStack cards={cards} label="Quiet Authority color palette" />,
  )));

  const libraryIcons = new Set(
    Array.from({ length: 64 }, (_, index) => indices(renderToStaticMarkup(
      <ColorPackStack cards={cards} label={`Palette ${index}`} />,
    ))).flat(),
  );
  assert.ok(libraryIcons.size >= 18);
});

test('keeps its Storybook typography inside the product surface', async () => {
  const componentCss = await readFile(new URL('./ColorPackStack.css', import.meta.url), 'utf8');
  const productTypography = await readFile(new URL('../productTypography.css', import.meta.url), 'utf8');

  assert.match(componentCss, /container-type:\s*inline-size/);
  assert.match(componentCss, /\.color-pack-stack__card h3\s*\{[^}]*color:\s*inherit/s);
  assert.match(componentCss, /font-size:\s*clamp\(26px,\s*7\.5cqw,\s*52px\)/);
  assert.match(productTypography, /:where\(h2, h3\):not\([\s\S]*?\.color-gallery__palette-title/);
  assert.match(productTypography, /:where\(h2, h3\):not\([\s\S]*?\.color-pack-stack \*/);
});
