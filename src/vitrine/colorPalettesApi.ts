import type {
  ColorCollection,
  ColorCollectionFeaturedColor,
  ColorPalette,
  ColorPaletteCard,
  ColorPaletteGradient,
  ColorPaletteKind,
  ColorPaletteRole,
} from '../colorPalettes.ts';
import { isRetiredColorPaletteId } from '../colorPalettes.ts';
import { apiFetch } from './apiFetch.ts';

const roles = new Set<ColorPaletteRole>(['lead', 'accent', 'companion']);
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);

function parseFeaturedColor(value: unknown): ColorCollectionFeaturedColor | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const color = value as Record<string, unknown>;
  if (typeof color.name !== 'string' || typeof color.code !== 'string' || !isHex(color.hex)) return undefined;
  return { name: color.name, code: color.code, hex: color.hex.toUpperCase() };
}

function parseGradient(value: unknown): ColorPaletteGradient | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const gradient = value as Record<string, unknown>;
  if (!Number.isInteger(gradient.angle) || (gradient.angle as number) < 0
    || (gradient.angle as number) > 359 || !isHex(gradient.endHex)) return undefined;
  return { angle: gradient.angle as number, endHex: gradient.endHex.toUpperCase() };
}

function parseCard(value: unknown): ColorPaletteCard | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const card = value as Record<string, unknown>;
  const gradient = card.gradient === undefined ? undefined : parseGradient(card.gradient);
  if (typeof card.id !== 'string' || typeof card.name !== 'string' || !isHex(card.hex)
    || !isHex(card.foreground) || typeof card.role !== 'string'
    || !roles.has(card.role as ColorPaletteRole)
    || (card.gradient !== undefined && !gradient)) return undefined;
  const hex = card.hex.toUpperCase();
  return {
    id: card.id,
    name: card.name,
    hex,
    color: gradient
      ? `linear-gradient(${gradient.angle}deg, ${hex} 0%, ${gradient.endHex} 100%)`
      : hex,
    foreground: card.foreground.toUpperCase(),
    role: card.role as ColorPaletteRole,
    ...(gradient ? { gradient } : {}),
    ...(card.outlined === true ? { outlined: true } : {}),
  };
}

export function parseColorPalettes(value: unknown): ColorPalette[] {
  const items = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { items?: unknown }).items
    : undefined;
  if (!Array.isArray(items)) throw new Error('Color palette response is invalid');
  return items.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Color palette is invalid');
    const palette = value as Record<string, unknown>;
    const kind: ColorPaletteKind = palette.kind === undefined || palette.kind === 'solid'
      ? 'solid'
      : palette.kind === 'gradient'
        ? 'gradient'
        : (() => { throw new Error('Color palette is invalid'); })();
    const cards = Array.isArray(palette.cards) ? palette.cards.map(parseCard) : [];
    if (typeof palette.id !== 'string' || typeof palette.name !== 'string' || typeof palette.mood !== 'string'
      || cards.length !== 3 || cards.some((card) => !card)
      || (kind === 'gradient' && cards.some((card) => !card?.gradient))
      || (kind === 'solid' && cards.some((card) => card?.gradient))) {
      throw new Error('Color palette is invalid');
    }
    return { id: palette.id, name: palette.name, mood: palette.mood, kind, cards: cards as ColorPaletteCard[] };
  });
}

export function parseColorCollections(value: unknown): ColorCollection[] {
  const collections = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { collections?: unknown }).collections
    : undefined;
  if (!Array.isArray(collections)) throw new Error('Color collection response is invalid');
  return collections.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Color collection is invalid');
    const collection = value as Record<string, unknown>;
    const rawPaletteIds = Array.isArray(collection.paletteIds) ? collection.paletteIds : [];
    const paletteIds = rawPaletteIds.filter((id): id is string => typeof id === 'string');
    const rawFeaturedColors = Array.isArray(collection.featuredColors) ? collection.featuredColors : [];
    const featuredColors = rawFeaturedColors.map(parseFeaturedColor);
    if (typeof collection.id !== 'string' || typeof collection.name !== 'string'
      || typeof collection.description !== 'string' || !paletteIds.length
      || paletteIds.length !== rawPaletteIds.length
      || typeof collection.year !== 'number' || !featuredColors.length
      || featuredColors.some((color) => !color)) {
      throw new Error('Color collection is invalid');
    }
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      year: collection.year,
      featuredColors: featuredColors as ColorCollectionFeaturedColor[],
      paletteIds,
    };
  });
}

export interface ColorLibraryResponse {
  palettes: ColorPalette[];
  collections: ColorCollection[];
}

export async function fetchColorLibrary(signal?: AbortSignal): Promise<ColorLibraryResponse> {
  const response = await apiFetch('/api/color-palettes', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Color palettes returned ${response.status}`);
  const value: unknown = await response.json();
  return {
    palettes: parseColorPalettes(value).filter((palette) => !isRetiredColorPaletteId(palette.id)),
    collections: parseColorCollections(value),
  };
}

export async function fetchColorPalettes(signal?: AbortSignal): Promise<ColorPalette[]> {
  const response = await apiFetch('/api/color-palettes', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Color palettes returned ${response.status}`);
  return parseColorPalettes(await response.json())
    .filter((palette) => !isRetiredColorPaletteId(palette.id));
}
