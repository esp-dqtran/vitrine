import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { auraColorPalettes, AURA_SOURCE_COMMIT, AURA_SOURCE_URL } from '../auraColorPalettes.ts';
import {
  COLOR_PALETTE_BATCH_SIZE,
  ColorCollectionFeatureCard,
  ColorGalleryPage,
  GradientPaletteCard,
  colorCollections,
  colorPalettes,
  filterPalettesByCollectionIds,
  getColorPaletteKind,
  getCollectionCardForeground,
  getGradientPaletteBackground,
  getGradientPaletteCss,
  getPaletteCopyText,
  nextColorPaletteRenderCount,
} from './components/ColorGalleryPage.tsx';

test('renders a browsable gallery of solid and layered gradient palettes', () => {
  const html = renderToStaticMarkup(<ColorGalleryPage />);

  assert.equal(colorPalettes.length, 284);
  assert.equal(colorCollections.length, 8);
  const paletteNames = new Set(colorPalettes.map((palette) => palette.name));
  const firstBatch = colorPalettes.slice(0, COLOR_PALETTE_BATCH_SIZE);
  const firstBatchSolidCount = firstBatch.filter((palette) => getColorPaletteKind(palette) === 'solid').length;
  const firstBatchGradientCount = firstBatch.length - firstBatchSolidCount;
  assert.doesNotMatch(html, /Three colors, one atmosphere|6 palettes · 18 colors/);
  assert.match(html, /Quiet Authority/);
  assert.doesNotMatch(html, /Palette 0[1-6]|color-gallery__palette-index/);
  assert.match(html, /color-gallery__palette-title/);
  assert.match(html, /color-gallery__palette-mood/);
  assert.match(html, /Violet Afterglow/);
  for (const paletteName of [
    'Desert Current',
    'Arctic Signal',
    'Saffron Paper',
    'Cobalt Horizon',
    'Cobalt Graphite',
    'Ember Editorial',
    'Digital Amethyst',
    'Lagoon Modern',
    'Linen Ritual',
    'Night Moss',
    'Blue Hour',
    'Electric Lagoon',
    'Apricot Haze',
    'Digital Lavender',
    'Moss After Rain',
    'Cobalt Mirage',
    'Cherry Static',
    'Golden Pollen',
    'Polar Silk',
    'Terracotta Storm',
    'Lime Nocturne',
    'Cloud Dancer Halo',
    'Mocha Mousse Veil',
    'Peach Fuzz Sunrise',
    'Viva Magenta Pulse',
    'Very Peri Orbit',
    'Illuminating Balance',
    'Classic Blue Tide',
    'Living Coral Bloom',
    'Candy Mesh',
    'Nebula Bloom',
    'Aurora Ribbon',
  ]) {
    assert.ok(paletteNames.has(paletteName), `Missing ${paletteName}`);
  }
  for (const removedPaletteName of [
    'Velvet Aurora',
    'Coastal Shift',
    'Solar Grove',
    'Rose Flux',
    'Desert Dawn',
    'Arctic Pulse',
    'Prism Fan',
    'Laser Lattice',
    'Frosted Horizon',
    'Duotone Split',
  ]) {
    assert.ok(!paletteNames.has(removedPaletteName), `Still includes ${removedPaletteName}`);
  }
  assert.deepEqual(
    colorCollections.map((collection) => collection.name),
    [
      '2026 — Cloud Dancer',
      '2025 — Mocha Mousse',
      '2024 — Peach Fuzz',
      '2023 — Viva Magenta',
      '2022 — Very Peri',
      '2021 — Illuminating + Ultimate Gray',
      '2020 — Classic Blue',
      '2019 — Living Coral',
    ],
  );
  assert.match(html, /data-discovery-filterbar="colors"/);
  assert.match(html, /aria-label="Color discovery controls"/);
  assert.match(html, /Open Collection filters/);
  assert.match(html, /aria-label="Type: Mono"/);
  assert.doesNotMatch(html, /Search Type|type="checkbox"[^>]*Mono/);
  assert.match(html, /apps-filterbar__filter--primary/);
  assert.doesNotMatch(html, /Color actions|reference-discovery__taxonomy--colors/);
  assert.doesNotMatch(html, />Solid palettes<|>Gradients</);
  assert.match(html, /data-reference-gallery-shell="colors"/);
  assert.match(html, /data-discovery-page-layout="colors"/);
  assert.match(html, /data-colors-discovery-grid="true"/);
  assert.match(html, /Showing/);
  assert.match(html, /52 palettes/);
  assert.doesNotMatch(html, /color-gallery__collection-tabs/);
  assert.equal((html.match(/class="color-pack-stack__hit-area"/g) ?? []).length, firstBatchSolidCount);
  assert.equal((html.match(/class="color-pack-stack__card"/g) ?? []).length, firstBatchSolidCount * 3);
  assert.equal((html.match(/class="color-gallery__gradient-card(?: color-gallery__gradient-card--aura)?"/g) ?? []).length, firstBatchGradientCount);
  assert.equal((html.match(/>Copy</g) ?? []).length, firstBatchSolidCount);
  assert.doesNotMatch(html, /Copy CSS|Preview/);
  assert.equal((html.match(/>Create post</g) ?? []).length, 1);
  assert.match(html, /aria-label="Color discovery controls"[\s\S]*>Create post</);
  assert.equal((html.match(/class="color-gallery__palette-viewport"/g) ?? []).length, COLOR_PALETTE_BATCH_SIZE);
  assert.match(html, new RegExp(`data-rendered-palette-count="${COLOR_PALETTE_BATCH_SIZE}"`));
  assert.match(html, /data-discovery-sentinel="colors"/);
  assert.doesNotMatch(html, /color-gallery__carousel|Page 1 of 87/);
});

test('unpublishes removed database-backed gradients', async () => {
  const migration = await readFile(
    new URL('../../migrations/0099_unpublish_rejected_gradient_palettes.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /SET is_published = FALSE/);
  for (const paletteId of [
    'velvet-aurora',
    'coastal-shift',
    'solar-grove',
    'rose-flux',
    'desert-dawn',
    'arctic-pulse',
  ]) {
    assert.match(migration, new RegExp(`'${paletteId}'`));
  }
});

test('filters palettes by color name and exposes the focused search surface', () => {
  const html = renderToStaticMarkup(
    <ColorGalleryPage query="orchid" searchActive onQueryChange={() => undefined} />,
  );

  assert.match(html, /Search the palette library/);
  assert.match(html, /value="orchid"/);
  assert.match(html, /\d+ of 52 palettes/);
  assert.match(html, /Violet Afterglow/);
  assert.doesNotMatch(html, /Quiet Authority/);
});

test('uses the same responsive three-up result grid as Apps', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');

  assert.match(css, /\.apps-discovery__grid,\s*\.colors-discovery__grid,\s*\.apps-discovery__screen-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /@media \(min-width:\s*721px\) and \(max-width:\s*1080px\)[\s\S]*?\.colors-discovery__grid,[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*?\.colors-discovery__grid,[\s\S]*?grid-template-columns:\s*1fr/);
});

test('uses the shared Apps discovery rail for palette type and annual collections', async () => {
  const source = await readFile(
    new URL('./components/ColorGalleryPage.tsx', import.meta.url),
    'utf8',
  );
  const sharedCss = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const spacingCss = await readFile(new URL('./productSpacing.css', import.meta.url), 'utf8');

  assert.match(source, /<DiscoveryFilterBar/);
  assert.match(source, /<DiscoveryPageLayout/);
  assert.match(source, /DiscoveryFilterGroup/);
  assert.match(source, /label: 'Type'/);
  assert.match(source, /primaryFilterId="color-types"/);
  assert.match(source, /value: 'Mono'/);
  assert.match(source, /selectionMode: 'single'/);
  assert.match(source, /allowClear: false/);
  assert.match(source, /actions=\{/);
  assert.match(source, /label: 'Collection'/);
  assert.match(source, /swatches:\s*collection\.featuredColors\.map/);
  assert.match(source, /toggleCollection/);
  assert.match(sharedCss, /\.discovery-filter-control \.apps-filterbar__filter-button/);
  assert.match(spacingCss, /\.discovery-filter-control\.discovery-filter-control/);
  assert.doesNotMatch(sharedCss, /admin-users-filter-control, \.color-gallery__collection-picker/);
  assert.doesNotMatch(spacingCss, /admin-users-filter-control, \.color-gallery__collection-picker/);
});

test('renders selected annual colors as Color Pack-style cards', () => {
  const collection = colorCollections[0];
  const html = renderToStaticMarkup(
    <ColorCollectionFeatureCard collection={collection} color={collection.featuredColors[0]} />,
  );

  assert.match(html, /color-gallery__collection-card/);
  assert.match(html, /color-gallery__collection-card-name/);
  assert.match(html, /--collection-card-color:#F0EEE9/);
  assert.match(html, /--collection-card-foreground:#151311/);
  assert.match(html, /Color of the Year 2026/);
  assert.match(html, /Cloud Dancer/);
  assert.match(html, /PANTONE 11-4201/);
  assert.match(html, /#F0EEE9/);
  assert.doesNotMatch(html, /HEX values are screen-preview approximations/);
  assert.equal(getCollectionCardForeground('#0F4C81'), '#FFFFFF');
  assert.equal(getCollectionCardForeground('#F5DF4D'), '#151311');
});

test('combines multiple annual collections without duplicate palettes', () => {
  const filtered = filterPalettesByCollectionIds(
    colorPalettes,
    colorCollections,
    ['color-of-the-year-2025', 'color-of-the-year-2024'],
  );

  assert.equal(filtered.length, 8);
  assert.equal(new Set(filtered.map((palette) => palette.id)).size, 8);
  assert.ok(filtered.some((palette) => palette.id === 'mocha-atelier'));
  assert.ok(filtered.some((palette) => palette.id === 'peach-nocturne'));
  assert.ok(filtered.some((palette) => palette.id === 'mocha-mousse-veil'));
  assert.ok(filtered.some((palette) => palette.id === 'peach-fuzz-sunrise'));
});

test('organizes solid and gradient palettes in one filterable library', () => {
  const html = renderToStaticMarkup(<ColorGalleryPage />);

  assert.match(html, /Quiet Authority/);
  assert.ok(colorPalettes.some((palette) => getColorPaletteKind(palette) === 'solid'));
  assert.ok(colorPalettes.some((palette) => getColorPaletteKind(palette) === 'gradient'));
  assert.equal((html.match(/data-discovery-page-layout="colors"/g) ?? []).length, 1);
  assert.equal((html.match(/data-colors-discovery-grid="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /solid-palettes-heading|gradient-palettes-heading/);
});

test('renders the combined library in viewport batches without page grouping', () => {
  const html = renderToStaticMarkup(<ColorGalleryPage />);

  assert.equal((html.match(/class="color-gallery__palette-viewport"/g) ?? []).length, COLOR_PALETTE_BATCH_SIZE);
  assert.match(html, /data-discovery-sentinel="colors"/);
  assert.doesNotMatch(html, /color-gallery__carousel-page|pagination/);
});

test('advances color viewport batches without exceeding the filtered result count', () => {
  assert.equal(nextColorPaletteRenderCount(12, 287), 24);
  assert.equal(nextColorPaletteRenderCount(276, 287), 287);
  assert.equal(nextColorPaletteRenderCount(6, 6), 6);
  assert.equal(nextColorPaletteRenderCount(5, 10, 3), 8);
});

test('imports the complete pinned Aura catalog with source metadata', () => {
  assert.equal(auraColorPalettes.length, 203);
  assert.equal(new Set(auraColorPalettes.map((palette) => palette.id)).size, 203);
  assert.deepEqual(
    [...new Set(auraColorPalettes.map((palette) => palette.gradientRecipe?.category))].sort(),
    ['aura', 'flux', 'glass', 'grain', 'lattice', 'mesh', 'nebula', 'prism'],
  );
  assert.equal(AURA_SOURCE_URL, 'https://github.com/CristianOlivera1/Aura');
  assert.equal(AURA_SOURCE_COMMIT, '276792e97c1482159e928b39c2725e3c0eee946c');
});

test('preserves and renders the official Aurora Beams layer recipe', () => {
  const palette = colorPalettes.find((candidate) => candidate.id === 'aura-aurora-beams');
  assert.ok(palette?.gradientRecipe);
  assert.equal(palette.gradientRecipe.category, 'lattice');
  assert.equal(palette.gradientRecipe.layers.length, 3);
  assert.equal(palette.gradientRecipe.layers[1].backgroundSize, '300% 200%');
  assert.match(palette.gradientRecipe.layers[1].background, /repeating-linear-gradient/);

  const html = renderToStaticMarkup(<GradientPaletteCard palette={palette} />);
  const css = getGradientPaletteCss(palette);
  assert.equal((html.match(/color-gallery__gradient-layer/g) ?? []).length, 3);
  assert.match(html, /color-gallery__gradient-card--aura/);
  assert.match(css, /Aura \(lattice\)/);
  assert.match(css, /background-size: 300% 200%/);
  assert.match(css, /mix-blend-mode: screen/);
  assert.match(css, /filter: blur\(30px\)/);
});

test('renders Vitrines-owned layered gradient recipes without Aura attribution', () => {
  const palette = colorPalettes.find((candidate) => candidate.id === 'electric-lagoon');
  assert.ok(palette?.gradientRecipe);
  assert.equal(palette.gradientRecipe.source, 'vitrines');
  assert.equal(palette.gradientRecipe.layers.length, 3);

  const html = renderToStaticMarkup(<GradientPaletteCard palette={palette} />);
  const css = getGradientPaletteCss(palette);
  assert.equal((html.match(/color-gallery__gradient-layer/g) ?? []).length, 3);
  assert.match(css, /Electric Lagoon — Vitrines \(flux\)/);
  assert.doesNotMatch(css, /Source:|Aura/);
  assert.match(css, /mix-blend-mode: screen/);
  assert.match(css, /filter: blur\(42px\)/);
});

test('keeps Vitrines gradient styles structurally distinct', () => {
  const recipeFor = (id: string) => {
    const recipe = colorPalettes.find((palette) => palette.id === id)?.gradientRecipe;
    assert.ok(recipe, `Missing gradient recipe for ${id}`);
    return recipe;
  };

  assert.equal((recipeFor('candy-mesh').layers[0].background.match(/radial-gradient/g) ?? []).length, 4);
  assert.ok(recipeFor('nebula-bloom').layers.every((layer) => layer.background.startsWith('radial-gradient')));
  assert.match(recipeFor('aurora-ribbon').layers[0].background, /transparent 0% 18%/);
});

test('includes the Vitrines soft aura family inspired by Champagne Fizz', () => {
  const ids = [
    'pistachio-cream',
    'strawberry-milk',
    'lavender-foam',
    'blue-porcelain',
    'honey-souffle',
    'mint-sorbet',
    'peach-bellini',
    'rose-champagne',
  ];

  for (const id of ids) {
    const palette = colorPalettes.find((candidate) => candidate.id === id);
    assert.ok(palette?.gradientRecipe, `Missing soft aura palette ${id}`);
    assert.equal(palette.gradientRecipe.source, 'vitrines');
    assert.equal(palette.gradientRecipe.category, 'aura');
    assert.equal(palette.gradientRecipe.dark, false);
    assert.equal(palette.gradientRecipe.layers.length, 2);
  }
});

test('copies usable gradient CSS instead of only the first color stop', () => {
  const gradient = colorPalettes.find((palette) => palette.id === 'electric-lagoon');
  assert.ok(gradient);
  const copied = getPaletteCopyText(gradient);

  assert.match(copied, /Electric Lagoon — Vitrines \(flux\)/);
  assert.match(copied, /background-color: #100e0b;/);
  assert.match(copied, /radial-gradient/);
  assert.match(copied, /mix-blend-mode: screen;/);
  assert.match(copied, /filter: blur\(42px\)/);
  assert.equal(copied, getGradientPaletteCss(gradient));
  assert.equal(getPaletteCopyText(colorPalettes[0]), '#151311, #4B262F, #EED3BA');
});

test('renders gradient palettes as full-bleed visual cards instead of color stacks', () => {
  const gradient = colorPalettes.find((palette) => palette.id === 'electric-lagoon');
  assert.ok(gradient);
  const html = renderToStaticMarkup(<GradientPaletteCard palette={gradient} />);

  assert.match(html, /color-gallery__gradient-card/);
  assert.match(html, /Electric Lagoon gradient palette/);
  assert.match(html, /Bioluminescent cyan surf meeting midnight violet/);
  assert.match(html, /color-gallery__palette-header[\s\S]*Electric Lagoon[\s\S]*>Copy</);
  assert.match(html, /color-gallery__palette-header[\s\S]*color-gallery__gradient-card/);
  assert.doesNotMatch(html, /Preview|Copy CSS|color-gallery__gradient-actions|gradient preview/);
  assert.doesNotMatch(html, /color-gallery__gradient-kind|Save Electric Lagoon as favorite|GRADIENT/);
  assert.match(getGradientPaletteBackground(gradient), /radial-gradient/);
  assert.doesNotMatch(html, /color-pack-stack/);
});

test('uses Aura-style card proportions with the shared palette copy interaction', async () => {
  const css = await readFile(new URL('./colorGallery.css', import.meta.url), 'utf8');

  assert.match(css, /\.color-gallery__gradient-card\s*\{[^}]*aspect-ratio:\s*1 \/ 1\.15/s);
  assert.match(css, /\.color-gallery__gradient-card\s*\{[^}]*border-radius:\s*34px/s);
  assert.match(css, /\.color-gallery__palette:hover \.color-gallery__copy\.astryx-button/);
  assert.doesNotMatch(css, /color-gallery__gradient-actions|color-gallery__gradient-preview/);
});

test('keeps palette copy buttons at a stable size while copying', async () => {
  const source = await readFile(
    new URL('./components/ColorGalleryPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /showCopyingState=\{false\}/);
});

test('reveals palette copy buttons on palette hover without shifting layout', async () => {
  const css = await readFile(new URL('./colorGallery.css', import.meta.url), 'utf8');

  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)/);
  assert.match(css, /color-gallery__copy\.astryx-button\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(css, /color-gallery__palette:hover \.color-gallery__copy\.astryx-button[\s\S]*opacity:\s*1/);
  assert.match(css, /color-gallery__palette:focus-within \.color-gallery__copy\.astryx-button/);
});

test('keeps every palette heading at a fixed two-line metadata height', async () => {
  const css = await readFile(new URL('./colorGallery.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.color-gallery__palette-header\s*\{[^}]*height:\s*72px;[^}]*min-height:\s*72px;/s,
  );
  assert.match(
    css,
    /\.color-gallery__palette-title\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
  );
  assert.match(
    css,
    /\.color-gallery__palette-mood\s*\{[^}]*-webkit-line-clamp:\s*2;/s,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.color-gallery__palette-header\s*\{[^}]*min-height:\s*0;/,
  );
});
