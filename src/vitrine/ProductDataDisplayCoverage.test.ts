import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/vitrine/main.tsx', 'utf8');
const css = readFileSync('src/vitrine/productDataDisplay.css', 'utf8');
const searchCard = readFileSync('src/vitrine/components/SearchResultCard.tsx', 'utf8');

test('loads the production Data Display layer after responsive foundations', () => {
  assert.match(
    main,
    /import '\.\/productResponsive\.css';\nimport '\.\/productDataDisplay\.css';/,
  );
});

test('uses one subtle overlay for selectable production data cards', () => {
  assert.match(css, /screen-grid-card\[data-selected="true"\][\s\S]*screen-grid-card__media::after/);
  assert.match(css, /inspiration-result-card\[aria-selected="true"\]::after/);
  assert.match(css, /advanced-search-card\[data-selected="true"\]::after/);
  assert.match(css, /color-mix\(in srgb, var\(--color-text-primary\) 10%, transparent\)/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /screen-grid-card\[data-selected="true"\] \.astryx-clickable-card[\s\S]*outline: 0/);
  assert.match(css, /inspiration-result-card\[aria-selected="true"\][\s\S]*box-shadow: none/);
  assert.match(searchCard, /data-selected=\{selected \|\| undefined\}/);
});

test('shares the approved compact 16 14 12 hierarchy with normal product rows', () => {
  assert.match(css, /data-display-list \.discovery-card/);
  assert.match(css, /data-display-list \.discovery-card__logo[\s\S]*width: 32px/);
  assert.match(css, /project-file-row__meta strong/);
  assert.match(css, /collections-workspace__card-copy strong/);
  assert.match(css, /inspiration-result-copy strong/);
  assert.match(css, /advanced-search-card__body h3/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /font-size: 14px/);
  assert.match(css, /font-size: 12px/);
});

test('does not restyle specialized evidence geometry', () => {
  assert.doesNotMatch(css, /flow-(workspace|evidence|preview)|document-|canvas-/);
});
