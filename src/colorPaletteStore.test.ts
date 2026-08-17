import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { defaultColorCollections, defaultColorPalettes } from './colorPalettes.ts';
import { createColorPaletteStore } from './colorPaletteStore.ts';

function channelLuminance(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string) {
  return 0.2126 * channelLuminance(Number.parseInt(hex.slice(1, 3), 16))
    + 0.7152 * channelLuminance(Number.parseInt(hex.slice(3, 5), 16))
    + 0.0722 * channelLuminance(Number.parseInt(hex.slice(5, 7), 16));
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test('groups ordered database colors into three-color palettes', async () => {
  let sql = '';
  const store = createColorPaletteStore(async (statement) => {
    sql = statement;
    return { rows: [
      { palette_id: 'quiet-authority', palette_name: 'Quiet Authority', mood: 'Editorial', color_id: 'ink', color_name: 'Ink', hex: '#151311', foreground: '#EED3BA', role: 'lead', outlined: false },
      { palette_id: 'quiet-authority', palette_name: 'Quiet Authority', mood: 'Editorial', color_id: 'velvet', color_name: 'Velvet', hex: '#4B262F', foreground: '#EED3BA', role: 'accent', outlined: false },
      { palette_id: 'quiet-authority', palette_name: 'Quiet Authority', mood: 'Editorial', color_id: 'almond', color_name: 'Almond', hex: '#EED3BA', foreground: '#151311', role: 'companion', outlined: true },
    ] } as never;
  });

  const palettes = await store.list();
  assert.equal(palettes.length, 1);
  assert.deepEqual(palettes[0]?.cards.map((card) => card.hex), ['#151311', '#4B262F', '#EED3BA']);
  assert.equal(palettes[0]?.cards[2]?.outlined, true);
  assert.match(sql, /WHERE p\.is_published = TRUE/);
  assert.match(sql, /ORDER BY p\.position, c\.position/);
});

test('returns published color collections with ordered palette membership', async () => {
  const store = createColorPaletteStore(async () => ({ rows: [{
    id: 'color-of-the-year-2026',
    name: '2026 — Cloud Dancer',
    description: 'Future color direction',
    year: 2026,
    featured_colors: [{ name: 'Cloud Dancer', code: '11-4201', hex: '#F0EEE9' }],
    palette_ids: ['cloud-canvas', 'quiet-spectrum'],
  }] }) as never);

  const collections = await store.listCollections();
  assert.equal(collections.length, 1);
  assert.equal(collections[0]?.featuredColors[0]?.hex, '#F0EEE9');
  assert.deepEqual(collections[0]?.paletteIds, ['cloud-canvas', 'quiet-spectrum']);
});

test('seeds every database-backed palette in the database migration', async () => {
  const sql = [
    await readFile(new URL('../migrations/0093_color_palette_library.sql', import.meta.url), 'utf8'),
    await readFile(new URL('../migrations/0094_color_collections.sql', import.meta.url), 'utf8'),
    await readFile(new URL('../migrations/0095_color_collection_archive.sql', import.meta.url), 'utf8'),
    await readFile(new URL('../migrations/0096_expand_color_palette_library.sql', import.meta.url), 'utf8'),
    await readFile(new URL('../migrations/0097_pantone_color_year_archive.sql', import.meta.url), 'utf8'),
    await readFile(new URL('../migrations/0098_gradient_palette_library.sql', import.meta.url), 'utf8'),
  ].join('\n');

  assert.match(sql, /CREATE TABLE color_palettes/);
  assert.match(sql, /CREATE TABLE color_palette_colors/);
  assert.match(sql, /CREATE TABLE color_collections/);
  assert.match(sql, /CREATE TABLE color_collection_palettes/);
  const databasePalettes = defaultColorPalettes.filter(({ cards }) => cards.length === 3);
  const databasePaletteIds = new Set(databasePalettes.map(({ id }) => id));
  assert.equal(databasePalettes.length, 52);
  for (const palette of databasePalettes) {
    assert.match(sql, new RegExp(`'${palette.id}'`));
    for (const card of palette.cards) {
      assert.match(sql, new RegExp(`'${card.id}'`));
      assert.match(sql, new RegExp(card.hex.replace('#', '#')));
    }
  }
  for (const collection of defaultColorCollections) {
    assert.match(sql, new RegExp(`'${collection.id}'`));
    for (const paletteId of collection.paletteIds) {
      if (databasePaletteIds.has(paletteId)) assert.match(sql, new RegExp(`'${paletteId}'`));
    }
  }
});

test('keeps every palette card foreground readable', () => {
  for (const palette of defaultColorPalettes) {
    if (palette.gradientRecipe) continue;
    for (const card of palette.cards) {
      assert.ok(
        contrastRatio(card.hex, card.foreground) >= 4.5
          && (!card.gradient || contrastRatio(card.gradient.endHex, card.foreground) >= 4.5),
        `${palette.name} / ${card.name} must meet 4.5:1 contrast`,
      );
    }
  }
});
