import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultColorCollections, defaultColorPalettes } from '../colorPalettes.ts';
import { parseColorCollections, parseColorPalettes } from './colorPalettesApi.ts';

test('validates the database palette response', () => {
  const databasePalettes = defaultColorPalettes.filter(({ cards }) => cards.length === 3);
  const gradientPalette = {
    ...databasePalettes[0]!,
    id: 'database-gradient',
    kind: 'gradient' as const,
    cards: databasePalettes[0]!.cards.map((card) => ({
      ...card,
      gradient: { angle: 135, endHex: '#11162C' },
    })),
  };
  const palettes = parseColorPalettes({ items: [databasePalettes[0], gradientPalette] });
  assert.equal(palettes.length, 2);
  assert.equal(palettes[0]?.cards.length, 3);
  assert.equal(palettes[0]?.cards[0]?.color, '#151311');
  assert.equal(palettes.at(-1)?.kind, 'gradient');
  assert.equal(palettes.at(-1)?.cards[0]?.gradient?.endHex, '#11162C');
  assert.match(palettes.at(-1)?.cards[0]?.color ?? '', /^linear-gradient/);
});

test('validates collection metadata and palette membership', () => {
  const collections = parseColorCollections({ collections: defaultColorCollections });
  assert.equal(collections.length, 8);
  assert.equal(collections[0]?.name, '2026 — Cloud Dancer');
  assert.equal(collections[0]?.featuredColors[0]?.hex, '#F0EEE9');
  assert.equal(collections[0]?.paletteIds.length, 4);
  assert.equal(collections[5]?.featuredColors.length, 2);
  assert.equal(collections[7]?.name, '2019 — Living Coral');
  assert.equal(collections[7]?.paletteIds.length, 4);
});

test('rejects malformed palettes before rendering them', () => {
  assert.throws(() => parseColorPalettes({ items: [{ id: 'broken', name: 'Broken', mood: 'Missing colors', cards: [] }] }), /invalid/);
  assert.throws(() => parseColorPalettes({ items: 'nope' }), /invalid/);
  assert.throws(() => parseColorCollections({ collections: [{ id: 'broken' }] }), /invalid/);
});
