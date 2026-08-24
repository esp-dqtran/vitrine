import { auraColorPalettes } from './auraColorPalettes.ts';

export type ColorPaletteRole = 'lead' | 'accent' | 'companion';
export type ColorPaletteKind = 'solid' | 'gradient';

export interface ColorPaletteGradient {
  angle: number;
  endHex: string;
}

export type ColorPaletteGradientCategory =
  | 'aura'
  | 'mesh'
  | 'nebula'
  | 'prism'
  | 'lattice'
  | 'grain'
  | 'glass'
  | 'flux';

export interface ColorPaletteGradientLayer {
  background: string;
  blendMode: string;
  blur: number;
  opacity?: number;
  backgroundSize?: string;
}

export interface ColorPaletteGradientRecipe {
  source: 'aura' | 'vitrines';
  sourceUrl?: string;
  sourceCommit?: string;
  category: ColorPaletteGradientCategory;
  mood: 'warm' | 'cool' | 'vivid' | 'dark';
  dark: boolean;
  text: string;
  cardText?: string;
  base: string;
  layers: readonly ColorPaletteGradientLayer[];
  grain?: boolean;
}

export interface ColorPaletteCard {
  id: string;
  name: string;
  hex: string;
  color: string;
  foreground: string;
  role: ColorPaletteRole;
  gradient?: ColorPaletteGradient;
  outlined?: boolean;
}

export interface ColorPaletteSource {
  type: 'app' | 'site';
  name: string;
  iconUrl?: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  mood: string;
  kind?: ColorPaletteKind;
  source?: ColorPaletteSource;
  cards: readonly ColorPaletteCard[];
  gradientRecipe?: ColorPaletteGradientRecipe;
}

export interface ColorCollectionFeaturedColor {
  name: string;
  code: string;
  hex: string;
}

export interface ColorCollection {
  id: string;
  name: string;
  description: string;
  year: number;
  featuredColors: readonly ColorCollectionFeaturedColor[];
  paletteIds: readonly string[];
}

const retiredColorPaletteIds = new Set([
  'velvet-aurora',
  'coastal-shift',
  'solar-grove',
  'rose-flux',
  'desert-dawn',
  'arctic-pulse',
  'prism-fan',
  'laser-lattice',
  'frosted-horizon',
  'duotone-split',
]);

export function isRetiredColorPaletteId(paletteId: string) {
  return retiredColorPaletteIds.has(paletteId);
}

const originalColorPalettes: readonly ColorPalette[] = [
  {
    id: 'quiet-authority', name: 'Quiet Authority', mood: 'Deep, intimate, and quietly editorial',
    cards: [
      { id: 'obsidian-ink', name: 'Obsidian Ink', hex: '#151311', color: '#151311', foreground: '#EED3BA', role: 'lead' },
      { id: 'velvet-curfew', name: 'Velvet Curfew', hex: '#4B262F', color: '#4B262F', foreground: '#EED3BA', role: 'accent' },
      { id: 'almond-hearth', name: 'Almond Hearth', hex: '#EED3BA', color: '#EED3BA', foreground: '#151311', role: 'companion' },
    ],
  },
  {
    id: 'violet-afterglow', name: 'Violet Afterglow', mood: 'Cinematic violet with an electric pulse',
    cards: [
      { id: 'nocturne-ink', name: 'Nocturne Ink', hex: '#1A1231', color: '#1A1231', foreground: '#E4D7F0', role: 'lead' },
      { id: 'electric-orchid', name: 'Electric Orchid', hex: '#773389', color: '#773389', foreground: '#E4D7F0', role: 'accent' },
      { id: 'lilac-veil', name: 'Lilac Veil', hex: '#E4D7F0', color: '#E4D7F0', foreground: '#1A1231', role: 'companion' },
    ],
  },
  {
    id: 'tidal-focus', name: 'Tidal Focus', mood: 'Clear, composed, and product-minded',
    cards: [
      { id: 'harbor-ink', name: 'Harbor Ink', hex: '#102A43', color: '#102A43', foreground: '#D9F0EE', role: 'lead' },
      { id: 'tidal-glass', name: 'Tidal Glass', hex: '#2C7A7B', color: '#2C7A7B', foreground: '#FFFFFF', role: 'accent' },
      { id: 'seafoam-air', name: 'Seafoam Air', hex: '#D9F0EE', color: '#D9F0EE', foreground: '#102A43', role: 'companion' },
    ],
  },
  {
    id: 'citrus-studio', name: 'Citrus Studio', mood: 'Bright energy grounded by botanical depth',
    cards: [
      { id: 'garden-ink', name: 'Garden Ink', hex: '#24352B', color: '#24352B', foreground: '#F9E3B6', role: 'lead' },
      { id: 'burnt-citrus', name: 'Burnt Citrus', hex: '#D85B2A', color: '#D85B2A', foreground: '#151311', role: 'accent' },
      { id: 'lemon-cream', name: 'Lemon Cream', hex: '#F9E3B6', color: '#F9E3B6', foreground: '#24352B', role: 'companion' },
    ],
  },
  {
    id: 'rose-archive', name: 'Rose Archive', mood: 'Romantic color with editorial restraint',
    cards: [
      { id: 'plum-script', name: 'Plum Script', hex: '#3A1F2D', color: '#3A1F2D', foreground: '#F2D7E5', role: 'lead' },
      { id: 'archive-rose', name: 'Archive Rose', hex: '#A64D79', color: '#A64D79', foreground: '#FFFFFF', role: 'accent' },
      { id: 'petal-paper', name: 'Petal Paper', hex: '#F2D7E5', color: '#F2D7E5', foreground: '#3A1F2D', role: 'companion' },
    ],
  },
  {
    id: 'desert-current', name: 'Desert Current', mood: 'Warm, tactile, and naturally confident',
    cards: [
      { id: 'cocoa-shadow', name: 'Cocoa Shadow', hex: '#3C2A21', color: '#3C2A21', foreground: '#F5E0C3', role: 'lead' },
      { id: 'terracotta-signal', name: 'Terracotta Signal', hex: '#C36A2D', color: '#C36A2D', foreground: '#1C1511', role: 'accent' },
      { id: 'dune-linen', name: 'Dune Linen', hex: '#F5E0C3', color: '#F5E0C3', foreground: '#3C2A21', role: 'companion' },
    ],
  },
  {
    id: 'arctic-signal', name: 'Arctic Signal', mood: 'Cool clarity with a precise digital edge',
    cards: [
      { id: 'night-current', name: 'Night Current', hex: '#0B1F33', color: '#0B1F33', foreground: '#D9F4FF', role: 'lead' },
      { id: 'glacier-signal', name: 'Glacier Signal', hex: '#1D6FA3', color: '#1D6FA3', foreground: '#FFFFFF', role: 'accent' },
      { id: 'polar-mist', name: 'Polar Mist', hex: '#D9F4FF', color: '#D9F4FF', foreground: '#0B1F33', role: 'companion' },
    ],
  },
  {
    id: 'olive-atelier', name: 'Olive Atelier', mood: 'Natural restraint with crafted editorial warmth',
    cards: [
      { id: 'olive-ink', name: 'Olive Ink', hex: '#263126', color: '#263126', foreground: '#E7E3C4', role: 'lead' },
      { id: 'moss-textile', name: 'Moss Textile', hex: '#7C8B52', color: '#7C8B52', foreground: '#11170F', role: 'accent' },
      { id: 'canvas-grain', name: 'Canvas Grain', hex: '#E7E3C4', color: '#E7E3C4', foreground: '#263126', role: 'companion' },
    ],
  },
  {
    id: 'solar-clay', name: 'Solar Clay', mood: 'Sunlit craft with grounded, tactile energy',
    cards: [
      { id: 'ember-umber', name: 'Ember Umber', hex: '#3B2115', color: '#3B2115', foreground: '#F4D7A1', role: 'lead' },
      { id: 'kiln-orange', name: 'Kiln Orange', hex: '#D9773D', color: '#D9773D', foreground: '#23130C', role: 'accent' },
      { id: 'sunwashed-clay', name: 'Sunwashed Clay', hex: '#F4D7A1', color: '#F4D7A1', foreground: '#3B2115', role: 'companion' },
    ],
  },
  {
    id: 'midnight-bloom', name: 'Midnight Bloom', mood: 'Nocturnal romance with a vivid floral charge',
    cards: [
      { id: 'deep-iris', name: 'Deep Iris', hex: '#17162B', color: '#17162B', foreground: '#F2D6EA', role: 'lead' },
      { id: 'neon-peony', name: 'Neon Peony', hex: '#C0448F', color: '#C0448F', foreground: '#FFFFFF', role: 'accent' },
      { id: 'blush-static', name: 'Blush Static', hex: '#F2D6EA', color: '#F2D6EA', foreground: '#17162B', role: 'companion' },
    ],
  },
  {
    id: 'concrete-mint', name: 'Concrete Mint', mood: 'Architectural calm softened by a fresh signal',
    cards: [
      { id: 'carbon-slate', name: 'Carbon Slate', hex: '#202625', color: '#202625', foreground: '#DDF4EA', role: 'lead' },
      { id: 'mint-circuit', name: 'Mint Circuit', hex: '#61BFA5', color: '#61BFA5', foreground: '#10221D', role: 'accent' },
      { id: 'frosted-glass', name: 'Frosted Glass', hex: '#DDF4EA', color: '#DDF4EA', foreground: '#202625', role: 'companion' },
    ],
  },
  {
    id: 'saffron-paper', name: 'Saffron Paper', mood: 'Optimistic warmth with archival sophistication',
    cards: [
      { id: 'sepia-ink', name: 'Sepia Ink', hex: '#392B13', color: '#392B13', foreground: '#FFF1C7', role: 'lead' },
      { id: 'saffron-note', name: 'Saffron Note', hex: '#E3A72F', color: '#E3A72F', foreground: '#241A08', role: 'accent' },
      { id: 'cream-archive', name: 'Cream Archive', hex: '#FFF1C7', color: '#FFF1C7', foreground: '#392B13', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-horizon', name: 'Cobalt Horizon', mood: 'The defining blue of 2026, framed by midnight and light',
    cards: [
      { id: 'future-night', name: 'Future Night', hex: '#11162C', color: '#11162C', foreground: '#DCE4FF', role: 'lead' },
      { id: 'future-cobalt', name: 'Future Cobalt', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'accent' },
      { id: 'cobalt-halo', name: 'Cobalt Halo', hex: '#DCE4FF', color: '#DCE4FF', foreground: '#11162C', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-citrus', name: 'Cobalt Citrus', mood: 'Confident blue energized by a warm optimistic spark',
    cards: [
      { id: 'cobalt-field', name: 'Cobalt Field', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'lead' },
      { id: 'citrus-metal', name: 'Citrus Metal', hex: '#E7A824', color: '#E7A824', foreground: '#241B08', role: 'accent' },
      { id: 'sunlit-pulp', name: 'Sunlit Pulp', hex: '#FFF0C8', color: '#FFF0C8', foreground: '#29200C', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-petal', name: 'Cobalt Petal', mood: 'Digital confidence softened by expressive editorial pink',
    cards: [
      { id: 'blue-manuscript', name: 'Blue Manuscript', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'lead' },
      { id: 'petal-signal', name: 'Petal Signal', hex: '#C95D8E', color: '#C95D8E', foreground: '#24101A', role: 'accent' },
      { id: 'rose-vellum', name: 'Rose Vellum', hex: '#F5DCE8', color: '#F5DCE8', foreground: '#321525', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-mint', name: 'Cobalt Mint', mood: 'A precise blue balanced by restorative botanical clarity',
    cards: [
      { id: 'evergreen-code', name: 'Evergreen Code', hex: '#15372F', color: '#15372F', foreground: '#D8F3E9', role: 'lead' },
      { id: 'cobalt-current', name: 'Cobalt Current', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'accent' },
      { id: 'mint-atmosphere', name: 'Mint Atmosphere', hex: '#D8F3E9', color: '#D8F3E9', foreground: '#15372F', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-clay', name: 'Cobalt Clay', mood: 'Future-facing blue grounded with tactile earthen warmth',
    cards: [
      { id: 'cobalt-studio', name: 'Cobalt Studio', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'lead' },
      { id: 'kiln-signal', name: 'Kiln Signal', hex: '#C8623B', color: '#C8623B', foreground: '#25110B', role: 'accent' },
      { id: 'clay-veil', name: 'Clay Veil', hex: '#F1D4C7', color: '#F1D4C7', foreground: '#3D251D', role: 'companion' },
    ],
  },
  {
    id: 'cobalt-graphite', name: 'Cobalt Graphite', mood: 'A restrained product palette with one unmistakable signal',
    cards: [
      { id: 'graphite-core', name: 'Graphite Core', hex: '#171A22', color: '#171A22', foreground: '#D4D7DF', role: 'lead' },
      { id: 'cobalt-marker', name: 'Cobalt Marker', hex: '#3157D5', color: '#3157D5', foreground: '#FFFFFF', role: 'accent' },
      { id: 'alloy-paper', name: 'Alloy Paper', hex: '#D4D7DF', color: '#D4D7DF', foreground: '#171A22', role: 'companion' },
    ],
  },
  {
    id: 'ember-editorial', name: 'Ember Editorial', mood: 'Burnished warmth shaped for confident editorial moments',
    cards: [
      { id: 'charred-serif', name: 'Charred Serif', hex: '#211815', color: '#211815', foreground: '#F4D8C7', role: 'lead' },
      { id: 'citrus-press', name: 'Citrus Press', hex: '#D85B2A', color: '#D85B2A', foreground: '#1C0E09', role: 'accent' },
      { id: 'apricot-stock', name: 'Apricot Stock', hex: '#F4D8C7', color: '#F4D8C7', foreground: '#211815', role: 'companion' },
    ],
  },
  {
    id: 'persimmon-hour', name: 'Persimmon Hour', mood: 'A warm sunset palette with polished studio restraint',
    cards: [
      { id: 'afterglow-brown', name: 'Afterglow Brown', hex: '#3A2020', color: '#3A2020', foreground: '#F7E0CE', role: 'lead' },
      { id: 'persimmon-mark', name: 'Persimmon Mark', hex: '#D85B2A', color: '#D85B2A', foreground: '#1C0E09', role: 'accent' },
      { id: 'peach-horizon', name: 'Peach Horizon', hex: '#F7E0CE', color: '#F7E0CE', foreground: '#3A2020', role: 'companion' },
    ],
  },
  {
    id: 'digital-amethyst', name: 'Digital Amethyst', mood: 'Immersive violet balanced by a clear luminous surface',
    cards: [
      { id: 'amethyst-night', name: 'Amethyst Night', hex: '#181327', color: '#181327', foreground: '#E8DDF1', role: 'lead' },
      { id: 'orchid-pixel', name: 'Orchid Pixel', hex: '#773389', color: '#773389', foreground: '#F6ECFA', role: 'accent' },
      { id: 'lavender-screen', name: 'Lavender Screen', hex: '#E8DDF1', color: '#E8DDF1', foreground: '#181327', role: 'companion' },
    ],
  },
  {
    id: 'velvet-signal', name: 'Velvet Signal', mood: 'Expressive technology softened by cinematic material depth',
    cards: [
      { id: 'velvet-code', name: 'Velvet Code', hex: '#2B1830', color: '#2B1830', foreground: '#F1D6E9', role: 'lead' },
      { id: 'orchid-signal', name: 'Orchid Signal', hex: '#773389', color: '#773389', foreground: '#F8EEF8', role: 'accent' },
      { id: 'rose-interface', name: 'Rose Interface', hex: '#F1D6E9', color: '#F1D6E9', foreground: '#2B1830', role: 'companion' },
    ],
  },
  {
    id: 'lagoon-modern', name: 'Lagoon Modern', mood: 'Composed aquatic color for calm, capable interfaces',
    cards: [
      { id: 'lagoon-depth', name: 'Lagoon Depth', hex: '#10292A', color: '#10292A', foreground: '#D7ECE8', role: 'lead' },
      { id: 'tidal-marker', name: 'Tidal Marker', hex: '#2C7A7B', color: '#2C7A7B', foreground: '#FFFFFF', role: 'accent' },
      { id: 'estuary-mist', name: 'Estuary Mist', hex: '#D7ECE8', color: '#D7ECE8', foreground: '#10292A', role: 'companion' },
    ],
  },
  {
    id: 'mineral-current', name: 'Mineral Current', mood: 'Quietly technical teal grounded in softened mineral tones',
    cards: [
      { id: 'mineral-shadow', name: 'Mineral Shadow', hex: '#1A302F', color: '#1A302F', foreground: '#E1ECE7', role: 'lead' },
      { id: 'current-glass', name: 'Current Glass', hex: '#2C7A7B', color: '#2C7A7B', foreground: '#FFFFFF', role: 'accent' },
      { id: 'salted-jade', name: 'Salted Jade', hex: '#E1ECE7', color: '#E1ECE7', foreground: '#1A302F', role: 'companion' },
    ],
  },
  {
    id: 'linen-ritual', name: 'Linen Ritual', mood: 'Material calm with a grounded, handcrafted point of view',
    cards: [
      { id: 'workshop-ink', name: 'Workshop Ink', hex: '#2C2520', color: '#2C2520', foreground: '#EED3BA', role: 'lead' },
      { id: 'woven-clay', name: 'Woven Clay', hex: '#B78967', color: '#B78967', foreground: '#241711', role: 'accent' },
      { id: 'linen-hearth', name: 'Linen Hearth', hex: '#EED3BA', color: '#EED3BA', foreground: '#2C2520', role: 'companion' },
    ],
  },
  {
    id: 'warm-archive', name: 'Warm Archive', mood: 'Human warmth translated into timeless archival color',
    cards: [
      { id: 'archive-umber', name: 'Archive Umber', hex: '#35221D', color: '#35221D', foreground: '#EED3BA', role: 'lead' },
      { id: 'patina-rose', name: 'Patina Rose', hex: '#B8795F', color: '#B8795F', foreground: '#26140F', role: 'accent' },
      { id: 'hearth-paper', name: 'Hearth Paper', hex: '#EED3BA', color: '#EED3BA', foreground: '#35221D', role: 'companion' },
    ],
  },
  {
    id: 'night-moss', name: 'Night Moss', mood: 'Botanical depth with a restorative contemporary finish',
    cards: [
      { id: 'forest-negative', name: 'Forest Negative', hex: '#111D18', color: '#111D18', foreground: '#DDE9D8', role: 'lead' },
      { id: 'moss-index', name: 'Moss Index', hex: '#3D7A57', color: '#3D7A57', foreground: '#FFFFFF', role: 'accent' },
      { id: 'lichen-paper', name: 'Lichen Paper', hex: '#DDE9D8', color: '#DDE9D8', foreground: '#111D18', role: 'companion' },
    ],
  },
  {
    id: 'blue-hour', name: 'Blue Hour', mood: 'Measured evening blue with a quiet atmospheric lift',
    cards: [
      { id: 'twilight-ink', name: 'Twilight Ink', hex: '#111C38', color: '#111C38', foreground: '#DCE8F4', role: 'lead' },
      { id: 'evening-index', name: 'Evening Index', hex: '#446FA6', color: '#446FA6', foreground: '#FFFFFF', role: 'accent' },
      { id: 'clouded-blue', name: 'Clouded Blue', hex: '#DCE8F4', color: '#DCE8F4', foreground: '#111C38', role: 'companion' },
    ],
  },
] as const;

const pantoneColorPalettes: readonly ColorPalette[] = [
  {
    id: 'cloud-canvas', name: 'Cloud Canvas', mood: 'Airy restraint grounded by a graphite edge',
    cards: [
      { id: 'graphite-veil', name: 'Graphite Veil', hex: '#262729', color: '#262729', foreground: '#F0EEE9', role: 'lead' },
      { id: 'silver-air', name: 'Silver Air', hex: '#A9AFB4', color: '#A9AFB4', foreground: '#171819', role: 'accent' },
      { id: 'cloud-dancer-canvas', name: 'Cloud Dancer', hex: '#F0EEE9', color: '#F0EEE9', foreground: '#262729', role: 'companion' },
    ],
  },
  {
    id: 'quiet-spectrum', name: 'Quiet Spectrum', mood: 'Soft violet nuance framed by contemplative white',
    cards: [
      { id: 'night-plum', name: 'Night Plum', hex: '#2D2933', color: '#2D2933', foreground: '#F0EEE9', role: 'lead' },
      { id: 'mist-lavender', name: 'Mist Lavender', hex: '#C9C3D2', color: '#C9C3D2', foreground: '#241F2A', role: 'accent' },
      { id: 'cloud-dancer-spectrum', name: 'Cloud Dancer', hex: '#F0EEE9', color: '#F0EEE9', foreground: '#2D2933', role: 'companion' },
    ],
  },
  {
    id: 'coastal-cloud', name: 'Coastal Cloud', mood: 'A serene white lifted by cool aqueous depth',
    cards: [
      { id: 'deep-fjord', name: 'Deep Fjord', hex: '#173033', color: '#173033', foreground: '#F0EEE9', role: 'lead' },
      { id: 'sea-glass', name: 'Sea Glass', hex: '#8FB3AF', color: '#8FB3AF', foreground: '#142321', role: 'accent' },
      { id: 'cloud-dancer-coast', name: 'Cloud Dancer', hex: '#F0EEE9', color: '#F0EEE9', foreground: '#173033', role: 'companion' },
    ],
  },
  {
    id: 'mocha-atelier', name: 'Mocha Atelier', mood: 'Sensorial brown with a refined cream finish',
    cards: [
      { id: 'cacao-ink', name: 'Cacao Ink', hex: '#2A1B17', color: '#2A1B17', foreground: '#EFE2D8', role: 'lead' },
      { id: 'mocha-mousse-atelier', name: 'Mocha Mousse', hex: '#A47864', color: '#A47864', foreground: '#211511', role: 'accent' },
      { id: 'cream-pour', name: 'Cream Pour', hex: '#EFE2D8', color: '#EFE2D8', foreground: '#2A1B17', role: 'companion' },
    ],
  },
  {
    id: 'mocha-botanical', name: 'Mocha Botanical', mood: 'Earthy indulgence balanced by restorative green',
    cards: [
      { id: 'pine-roast', name: 'Pine Roast', hex: '#203127', color: '#203127', foreground: '#DDE3D4', role: 'lead' },
      { id: 'mocha-mousse-botanical', name: 'Mocha Mousse', hex: '#A47864', color: '#A47864', foreground: '#211511', role: 'accent' },
      { id: 'sage-foam', name: 'Sage Foam', hex: '#DDE3D4', color: '#DDE3D4', foreground: '#203127', role: 'companion' },
    ],
  },
  {
    id: 'mocha-blue', name: 'Mocha Blue', mood: 'Comforting brown contrasted with composed evening blue',
    cards: [
      { id: 'indigo-roast', name: 'Indigo Roast', hex: '#1E2638', color: '#1E2638', foreground: '#DDE5EF', role: 'lead' },
      { id: 'mocha-mousse-blue', name: 'Mocha Mousse', hex: '#A47864', color: '#A47864', foreground: '#211511', role: 'accent' },
      { id: 'powder-blue', name: 'Powder Blue', hex: '#DDE5EF', color: '#DDE5EF', foreground: '#1E2638', role: 'companion' },
    ],
  },
  {
    id: 'peach-nocturne', name: 'Peach Nocturne', mood: 'Gentle peach made cinematic with cocoa shadow',
    cards: [
      { id: 'cocoa-noir', name: 'Cocoa Noir', hex: '#2E1C19', color: '#2E1C19', foreground: '#FFF0E7', role: 'lead' },
      { id: 'peach-fuzz-nocturne', name: 'Peach Fuzz', hex: '#FFBE98', color: '#FFBE98', foreground: '#291812', role: 'accent' },
      { id: 'peach-paper', name: 'Peach Paper', hex: '#FFF0E7', color: '#FFF0E7', foreground: '#2E1C19', role: 'companion' },
    ],
  },
  {
    id: 'peach-tide', name: 'Peach Tide', mood: 'Warm softness paired with cool coastal clarity',
    cards: [
      { id: 'deep-teal', name: 'Deep Teal', hex: '#173334', color: '#173334', foreground: '#DCEAE7', role: 'lead' },
      { id: 'peach-fuzz-tide', name: 'Peach Fuzz', hex: '#FFBE98', color: '#FFBE98', foreground: '#291812', role: 'accent' },
      { id: 'sea-salt', name: 'Sea Salt', hex: '#DCEAE7', color: '#DCEAE7', foreground: '#173334', role: 'companion' },
    ],
  },
  {
    id: 'peach-plum', name: 'Peach Plum', mood: 'Nurturing peach with expressive editorial depth',
    cards: [
      { id: 'mulberry-ink', name: 'Mulberry Ink', hex: '#3B2236', color: '#3B2236', foreground: '#F2DEE5', role: 'lead' },
      { id: 'peach-fuzz-plum', name: 'Peach Fuzz', hex: '#FFBE98', color: '#FFBE98', foreground: '#291812', role: 'accent' },
      { id: 'rose-mist', name: 'Rose Mist', hex: '#F2DEE5', color: '#F2DEE5', foreground: '#3B2236', role: 'companion' },
    ],
  },
  {
    id: 'viva-noir', name: 'Viva Noir', mood: 'Fearless crimson sharpened by nocturnal contrast',
    cards: [
      { id: 'noir-petal', name: 'Noir Petal', hex: '#24151A', color: '#24151A', foreground: '#F8E3E8', role: 'lead' },
      { id: 'viva-magenta-noir', name: 'Viva Magenta', hex: '#BB2649', color: '#BB2649', foreground: '#FFFFFF', role: 'accent' },
      { id: 'petal-white', name: 'Petal White', hex: '#F8E3E8', color: '#F8E3E8', foreground: '#24151A', role: 'companion' },
    ],
  },
  {
    id: 'viva-cobalt', name: 'Viva Cobalt', mood: 'Energetic magenta anchored by confident blue',
    cards: [
      { id: 'cobalt-depth', name: 'Cobalt Depth', hex: '#14284A', color: '#14284A', foreground: '#DFE6F1', role: 'lead' },
      { id: 'viva-magenta-cobalt', name: 'Viva Magenta', hex: '#BB2649', color: '#BB2649', foreground: '#FFFFFF', role: 'accent' },
      { id: 'blue-paper', name: 'Blue Paper', hex: '#DFE6F1', color: '#DFE6F1', foreground: '#14284A', role: 'companion' },
    ],
  },
  {
    id: 'viva-garden', name: 'Viva Garden', mood: 'A natural red statement softened by botanical calm',
    cards: [
      { id: 'garden-shadow', name: 'Garden Shadow', hex: '#1F352C', color: '#1F352C', foreground: '#E0E7DC', role: 'lead' },
      { id: 'viva-magenta-garden', name: 'Viva Magenta', hex: '#BB2649', color: '#BB2649', foreground: '#FFFFFF', role: 'accent' },
      { id: 'sage-paper', name: 'Sage Paper', hex: '#E0E7DC', color: '#E0E7DC', foreground: '#1F352C', role: 'companion' },
    ],
  },
  {
    id: 'peri-night', name: 'Peri Night', mood: 'Inventive periwinkle illuminated against deep indigo',
    cards: [
      { id: 'indigo-night', name: 'Indigo Night', hex: '#191A31', color: '#191A31', foreground: '#E4E3F3', role: 'lead' },
      { id: 'very-peri-night', name: 'Very Peri', hex: '#6667AB', color: '#6667AB', foreground: '#FFFFFF', role: 'accent' },
      { id: 'peri-mist', name: 'Peri Mist', hex: '#E4E3F3', color: '#E4E3F3', foreground: '#191A31', role: 'companion' },
    ],
  },
  {
    id: 'peri-clay', name: 'Peri Clay', mood: 'Future-facing periwinkle grounded by tactile neutrals',
    cards: [
      { id: 'clay-shadow', name: 'Clay Shadow', hex: '#3A2925', color: '#3A2925', foreground: '#E9DDD3', role: 'lead' },
      { id: 'very-peri-clay', name: 'Very Peri', hex: '#6667AB', color: '#6667AB', foreground: '#FFFFFF', role: 'accent' },
      { id: 'sand-veil', name: 'Sand Veil', hex: '#E9DDD3', color: '#E9DDD3', foreground: '#3A2925', role: 'companion' },
    ],
  },
  {
    id: 'peri-mint', name: 'Peri Mint', mood: 'Playful blue-violet balanced by restorative green',
    cards: [
      { id: 'mint-shadow', name: 'Mint Shadow', hex: '#20352F', color: '#20352F', foreground: '#DCE8E2', role: 'lead' },
      { id: 'very-peri-mint', name: 'Very Peri', hex: '#6667AB', color: '#6667AB', foreground: '#FFFFFF', role: 'accent' },
      { id: 'mint-fog', name: 'Mint Fog', hex: '#DCE8E2', color: '#DCE8E2', foreground: '#20352F', role: 'companion' },
    ],
  },
  {
    id: 'sunlit-concrete', name: 'Sunlit Concrete', mood: 'Optimistic yellow supported by enduring gray',
    cards: [
      { id: 'concrete-depth', name: 'Concrete Depth', hex: '#303235', color: '#303235', foreground: '#F5DF4D', role: 'lead' },
      { id: 'illuminating-sun', name: 'Illuminating', hex: '#F5DF4D', color: '#F5DF4D', foreground: '#24230E', role: 'accent' },
      { id: 'ultimate-gray-sun', name: 'Ultimate Gray', hex: '#97999B', color: '#97999B', foreground: '#1B1C1D', role: 'companion' },
    ],
  },
  {
    id: 'solar-structure', name: 'Solar Structure', mood: 'Bright resolve expressed through cool architecture',
    cards: [
      { id: 'structural-blue', name: 'Structural Blue', hex: '#25333A', color: '#25333A', foreground: '#F5DF4D', role: 'lead' },
      { id: 'illuminating-structure', name: 'Illuminating', hex: '#F5DF4D', color: '#F5DF4D', foreground: '#24230E', role: 'accent' },
      { id: 'ultimate-gray-structure', name: 'Ultimate Gray', hex: '#97999B', color: '#97999B', foreground: '#1B1C1D', role: 'companion' },
    ],
  },
  {
    id: 'gray-daybreak', name: 'Gray Daybreak', mood: 'Dependable gray awakened by a clear solar accent',
    cards: [
      { id: 'ultimate-gray-daybreak', name: 'Ultimate Gray', hex: '#97999B', color: '#97999B', foreground: '#1B1C1D', role: 'lead' },
      { id: 'illuminating-daybreak', name: 'Illuminating', hex: '#F5DF4D', color: '#F5DF4D', foreground: '#24230E', role: 'accent' },
      { id: 'daybreak-paper', name: 'Daybreak Paper', hex: '#F5F3E8', color: '#F5F3E8', foreground: '#303235', role: 'companion' },
    ],
  },
  {
    id: 'classic-blue-night', name: 'Classic Blue Night', mood: 'Enduring blue with calm nocturnal confidence',
    cards: [
      { id: 'midnight-foundation', name: 'Midnight Foundation', hex: '#101A28', color: '#101A28', foreground: '#DCE8F1', role: 'lead' },
      { id: 'classic-blue-night-color', name: 'Classic Blue', hex: '#0F4C81', color: '#0F4C81', foreground: '#FFFFFF', role: 'accent' },
      { id: 'sky-paper', name: 'Sky Paper', hex: '#DCE8F1', color: '#DCE8F1', foreground: '#101A28', role: 'companion' },
    ],
  },
  {
    id: 'classic-blue-brass', name: 'Classic Blue Brass', mood: 'Foundational blue refined with a warm metallic note',
    cards: [
      { id: 'classic-blue-brass-color', name: 'Classic Blue', hex: '#0F4C81', color: '#0F4C81', foreground: '#FFFFFF', role: 'lead' },
      { id: 'quiet-brass', name: 'Quiet Brass', hex: '#C3A457', color: '#C3A457', foreground: '#241E0E', role: 'accent' },
      { id: 'heritage-linen', name: 'Heritage Linen', hex: '#F1E8D8', color: '#F1E8D8', foreground: '#182235', role: 'companion' },
    ],
  },
  {
    id: 'classic-blue-coral', name: 'Classic Blue Coral', mood: 'Stable blue enlivened by a human coral gesture',
    cards: [
      { id: 'classic-blue-coral-color', name: 'Classic Blue', hex: '#0F4C81', color: '#0F4C81', foreground: '#FFFFFF', role: 'lead' },
      { id: 'coral-gesture', name: 'Coral Gesture', hex: '#E37C70', color: '#E37C70', foreground: '#2B1512', role: 'accent' },
      { id: 'blush-paper', name: 'Blush Paper', hex: '#F2DFDC', color: '#F2DFDC', foreground: '#273142', role: 'companion' },
    ],
  },
  {
    id: 'coral-night', name: 'Coral Night', mood: 'Sociable coral glowing against a dramatic dark field',
    cards: [
      { id: 'coral-nocturne', name: 'Coral Nocturne', hex: '#2B1C21', color: '#2B1C21', foreground: '#FCE3DD', role: 'lead' },
      { id: 'living-coral-night', name: 'Living Coral', hex: '#FF6F61', color: '#FF6F61', foreground: '#2B1210', role: 'accent' },
      { id: 'shell-paper', name: 'Shell Paper', hex: '#FCE3DD', color: '#FCE3DD', foreground: '#2B1C21', role: 'companion' },
    ],
  },
  {
    id: 'coral-navy', name: 'Coral Navy', mood: 'Vibrant warmth balanced by poised maritime blue',
    cards: [
      { id: 'maritime-ink', name: 'Maritime Ink', hex: '#14233B', color: '#14233B', foreground: '#E5E9ED', role: 'lead' },
      { id: 'living-coral-navy', name: 'Living Coral', hex: '#FF6F61', color: '#FF6F61', foreground: '#2B1210', role: 'accent' },
      { id: 'silver-foam', name: 'Silver Foam', hex: '#E5E9ED', color: '#E5E9ED', foreground: '#14233B', role: 'companion' },
    ],
  },
  {
    id: 'coral-garden', name: 'Coral Garden', mood: 'Life-affirming coral rooted in botanical depth',
    cards: [
      { id: 'herbal-shadow', name: 'Herbal Shadow', hex: '#20352B', color: '#20352B', foreground: '#E2E8DA', role: 'lead' },
      { id: 'living-coral-garden', name: 'Living Coral', hex: '#FF6F61', color: '#FF6F61', foreground: '#2B1210', role: 'accent' },
      { id: 'herbal-paper', name: 'Herbal Paper', hex: '#E2E8DA', color: '#E2E8DA', foreground: '#20352B', role: 'companion' },
    ],
  },
] as const;

export const defaultGradientPalettes: readonly ColorPalette[] = [
  {
    id: 'electric-lagoon', name: 'Electric Lagoon', mood: 'Bioluminescent cyan surf meeting midnight violet', kind: 'gradient',
    cards: [
      { id: 'electric-lagoon-base', name: 'Electric Lagoon', hex: '#07141B', color: '#07141B', foreground: '#E4FFFB', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'flux', mood: 'cool', dark: true, text: '#E4FFFB', cardText: '#E4FFFB', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(76% 68% at 8% 18%, rgba(47, 238, 211, 0.95) 0%, rgba(15, 113, 126, 0.52) 38%, rgba(7, 20, 27, 0) 76%)', blendMode: 'screen', blur: 42, opacity: 1 },
        { background: 'radial-gradient(82% 78% at 92% 88%, rgba(116, 72, 255, 0.92) 0%, rgba(37, 47, 125, 0.58) 44%, rgba(7, 20, 27, 0) 78%)', blendMode: 'screen', blur: 68, opacity: 0.92 },
        { background: 'linear-gradient(145deg, rgba(5, 11, 21, 0.1) 0%, rgba(2, 29, 38, 0.72) 48%, rgba(5, 10, 29, 0.94) 100%)', blendMode: 'multiply', blur: 8, opacity: 1 },
      ],
    },
  },
  {
    id: 'apricot-haze', name: 'Apricot Haze', mood: 'Soft peach light melting into rose-gold air', kind: 'gradient',
    cards: [
      { id: 'apricot-haze-base', name: 'Apricot Haze', hex: '#FAF8F2', color: '#FAF8F2', foreground: '#4A2523', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#4A2523', cardText: '#4A2523', base: '#FAF8F2',
      layers: [
        { background: 'radial-gradient(74% 66% at 14% 12%, rgba(255, 188, 132, 0.88) 0%, rgba(255, 216, 180, 0.42) 46%, rgba(255, 255, 255, 0) 78%)', blendMode: 'multiply', blur: 48, opacity: 0.72 },
        { background: 'radial-gradient(80% 72% at 92% 82%, rgba(226, 111, 133, 0.72) 0%, rgba(247, 178, 159, 0.4) 44%, rgba(255, 255, 255, 0) 78%)', blendMode: 'multiply', blur: 62, opacity: 0.66 },
        { background: 'linear-gradient(132deg, rgba(255, 250, 240, 0.94) 0%, rgba(255, 213, 174, 0.28) 46%, rgba(210, 103, 128, 0.18) 100%)', blendMode: 'multiply', blur: 12, opacity: 0.7 },
      ],
    },
  },
  {
    id: 'digital-lavender', name: 'Digital Lavender', mood: 'Prismatic violet charged with a cold electric edge', kind: 'gradient',
    cards: [
      { id: 'digital-lavender-base', name: 'Digital Lavender', hex: '#120A24', color: '#120A24', foreground: '#F2E8FF', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'prism', mood: 'vivid', dark: true, text: '#F2E8FF', cardText: '#F2E8FF', base: '#100E0B', grain: true,
      layers: [
        { background: 'conic-gradient(from 215deg at 64% 42%, rgba(94, 74, 255, 0) 0deg, rgba(94, 74, 255, 0.96) 72deg, rgba(227, 91, 255, 0.88) 146deg, rgba(60, 225, 255, 0.76) 220deg, rgba(94, 74, 255, 0) 300deg)', blendMode: 'screen', blur: 38, opacity: 0.9 },
        { background: 'radial-gradient(68% 62% at 20% 78%, rgba(255, 70, 198, 0.78) 0%, rgba(87, 45, 154, 0.46) 44%, rgba(18, 10, 36, 0) 80%)', blendMode: 'screen', blur: 58, opacity: 0.82 },
        { background: 'repeating-linear-gradient(112deg, rgba(221, 205, 255, 0.16) 0%, rgba(221, 205, 255, 0.04) 3%, transparent 7%, transparent 15%)', blendMode: 'soft-light', blur: 10, opacity: 0.76, backgroundSize: '180% 180%' },
      ],
    },
  },
  {
    id: 'moss-after-rain', name: 'Moss After Rain', mood: 'Wet botanical shadow lifted by mineral green light', kind: 'gradient',
    cards: [
      { id: 'moss-after-rain-base', name: 'Moss After Rain', hex: '#0A1711', color: '#0A1711', foreground: '#E8F2D9', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'mesh', mood: 'dark', dark: true, text: '#E8F2D9', cardText: '#E8F2D9', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(72% 64% at 18% 14%, rgba(143, 185, 99, 0.9) 0%, rgba(64, 106, 72, 0.54) 42%, rgba(10, 23, 17, 0) 78%)', blendMode: 'screen', blur: 54, opacity: 0.88 },
        { background: 'radial-gradient(78% 74% at 88% 84%, rgba(37, 136, 119, 0.76) 0%, rgba(25, 76, 67, 0.48) 46%, rgba(10, 23, 17, 0) 80%)', blendMode: 'screen', blur: 70, opacity: 0.78 },
        { background: 'linear-gradient(152deg, rgba(7, 19, 12, 0.08) 0%, rgba(30, 51, 27, 0.58) 52%, rgba(5, 15, 13, 0.92) 100%)', blendMode: 'multiply', blur: 6, opacity: 1 },
      ],
    },
  },
  {
    id: 'cobalt-mirage', name: 'Cobalt Mirage', mood: 'Deep ultramarine opening into a glass-blue horizon', kind: 'gradient',
    cards: [
      { id: 'cobalt-mirage-base', name: 'Cobalt Mirage', hex: '#071126', color: '#071126', foreground: '#E7F3FF', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'glass', mood: 'cool', dark: true, text: '#E7F3FF', cardText: '#E7F3FF', base: '#100E0B',
      layers: [
        { background: 'radial-gradient(78% 70% at 12% 8%, rgba(75, 143, 255, 0.94) 0%, rgba(31, 69, 161, 0.58) 44%, rgba(7, 17, 38, 0) 80%)', blendMode: 'screen', blur: 50, opacity: 0.9 },
        { background: 'radial-gradient(72% 82% at 94% 92%, rgba(61, 224, 238, 0.72) 0%, rgba(18, 96, 150, 0.4) 48%, rgba(7, 17, 38, 0) 82%)', blendMode: 'screen', blur: 66, opacity: 0.78 },
        { background: 'linear-gradient(165deg, rgba(5, 10, 31, 0.08) 0%, rgba(12, 34, 89, 0.5) 54%, rgba(2, 8, 24, 0.96) 100%)', blendMode: 'multiply', blur: 4, opacity: 1 },
      ],
    },
  },
  {
    id: 'cherry-static', name: 'Cherry Static', mood: 'Black cherry charged with hot pink interference', kind: 'gradient',
    cards: [
      { id: 'cherry-static-base', name: 'Cherry Static', hex: '#1C0711', color: '#1C0711', foreground: '#FFE6EF', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'flux', mood: 'vivid', dark: true, text: '#FFE6EF', cardText: '#FFE6EF', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(70% 64% at 18% 22%, rgba(255, 47, 111, 0.94) 0%, rgba(133, 21, 66, 0.58) 42%, rgba(28, 7, 17, 0) 78%)', blendMode: 'screen', blur: 48, opacity: 0.9 },
        { background: 'conic-gradient(from 190deg at 78% 62%, rgba(255, 64, 158, 0) 0deg, rgba(255, 64, 158, 0.84) 82deg, rgba(160, 48, 255, 0.72) 158deg, rgba(255, 64, 158, 0) 286deg)', blendMode: 'screen', blur: 54, opacity: 0.78 },
        { background: 'repeating-linear-gradient(104deg, rgba(255, 210, 228, 0.14) 0%, transparent 2%, transparent 9%, rgba(255, 68, 132, 0.1) 12%, transparent 17%)', blendMode: 'soft-light', blur: 8, opacity: 0.72, backgroundSize: '220% 180%' },
      ],
    },
  },
  {
    id: 'golden-pollen', name: 'Golden Pollen', mood: 'Sun-warmed saffron suspended in creamy daylight', kind: 'gradient',
    cards: [
      { id: 'golden-pollen-base', name: 'Golden Pollen', hex: '#FAF8F2', color: '#FAF8F2', foreground: '#4B3211', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'grain', mood: 'warm', dark: false, text: '#4B3211', cardText: '#4B3211', base: '#FAF8F2', grain: true,
      layers: [
        { background: 'radial-gradient(72% 68% at 16% 14%, rgba(255, 202, 66, 0.86) 0%, rgba(255, 225, 142, 0.44) 46%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 46, opacity: 0.72 },
        { background: 'radial-gradient(76% 72% at 88% 86%, rgba(230, 135, 31, 0.68) 0%, rgba(244, 180, 67, 0.36) 44%, rgba(255, 255, 255, 0) 78%)', blendMode: 'multiply', blur: 60, opacity: 0.62 },
        { background: 'linear-gradient(138deg, rgba(255, 252, 231, 0.9) 0%, rgba(250, 205, 94, 0.24) 52%, rgba(188, 99, 25, 0.16) 100%)', blendMode: 'multiply', blur: 10, opacity: 0.68 },
      ],
    },
  },
  {
    id: 'polar-silk', name: 'Polar Silk', mood: 'Pearl white folding into glacial blue and lilac', kind: 'gradient',
    cards: [
      { id: 'polar-silk-base', name: 'Polar Silk', hex: '#FAF8F2', color: '#FAF8F2', foreground: '#233044', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'glass', mood: 'cool', dark: false, text: '#233044', cardText: '#233044', base: '#FAF8F2',
      layers: [
        { background: 'radial-gradient(78% 68% at 10% 12%, rgba(153, 224, 244, 0.72) 0%, rgba(206, 240, 248, 0.38) 48%, rgba(255, 255, 255, 0) 82%)', blendMode: 'multiply', blur: 54, opacity: 0.58 },
        { background: 'radial-gradient(76% 76% at 94% 88%, rgba(177, 158, 232, 0.62) 0%, rgba(219, 211, 244, 0.34) 44%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 64, opacity: 0.54 },
        { background: 'linear-gradient(118deg, rgba(255, 255, 255, 0.92) 0%, rgba(205, 234, 242, 0.2) 48%, rgba(187, 167, 229, 0.18) 100%)', blendMode: 'multiply', blur: 12, opacity: 0.62 },
      ],
    },
  },
  {
    id: 'terracotta-storm', name: 'Terracotta Storm', mood: 'Burnished clay rolling through a smoky plum sky', kind: 'gradient',
    cards: [
      { id: 'terracotta-storm-base', name: 'Terracotta Storm', hex: '#21100D', color: '#21100D', foreground: '#FFE7D0', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'nebula', mood: 'warm', dark: true, text: '#FFE7D0', cardText: '#FFE7D0', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(74% 68% at 14% 18%, rgba(224, 103, 57, 0.9) 0%, rgba(122, 54, 38, 0.6) 44%, rgba(33, 16, 13, 0) 80%)', blendMode: 'screen', blur: 56, opacity: 0.88 },
        { background: 'radial-gradient(84% 74% at 90% 82%, rgba(121, 62, 117, 0.82) 0%, rgba(72, 35, 73, 0.5) 48%, rgba(33, 16, 13, 0) 82%)', blendMode: 'screen', blur: 72, opacity: 0.76 },
        { background: 'linear-gradient(150deg, rgba(31, 12, 8, 0.08) 0%, rgba(83, 34, 27, 0.54) 48%, rgba(18, 10, 18, 0.94) 100%)', blendMode: 'multiply', blur: 6, opacity: 1 },
      ],
    },
  },
  {
    id: 'lime-nocturne', name: 'Lime Nocturne', mood: 'Acid green rhythm cutting through carbon black', kind: 'gradient',
    cards: [
      { id: 'lime-nocturne-base', name: 'Lime Nocturne', hex: '#0B1108', color: '#0B1108', foreground: '#F0FFD6', role: 'lead' },
    ],
    gradientRecipe: {
      source: 'vitrines', category: 'lattice', mood: 'vivid', dark: true, text: '#F0FFD6', cardText: '#F0FFD6', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(74% 66% at 18% 16%, rgba(181, 255, 72, 0.9) 0%, rgba(76, 137, 38, 0.52) 44%, rgba(11, 17, 8, 0) 80%)', blendMode: 'screen', blur: 48, opacity: 0.86 },
        { background: 'repeating-linear-gradient(116deg, rgba(202, 255, 111, 0.26) 0%, rgba(202, 255, 111, 0.08) 3%, transparent 7%, transparent 16%)', blendMode: 'screen', blur: 18, opacity: 0.72, backgroundSize: '240% 200%' },
        { background: 'linear-gradient(158deg, rgba(8, 15, 6, 0.04) 0%, rgba(24, 54, 18, 0.48) 50%, rgba(4, 8, 5, 0.98) 100%)', blendMode: 'multiply', blur: 4, opacity: 1 },
      ],
    },
  },
  {
    id: 'cloud-dancer-halo', name: 'Cloud Dancer Halo', mood: 'The 2026 off-white floating through silver and quiet lavender', kind: 'gradient',
    cards: [{ id: 'cloud-dancer-halo-base', name: 'Cloud Dancer', hex: '#F0EEE9', color: '#F0EEE9', foreground: '#262729', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'glass', mood: 'cool', dark: false, text: '#262729', cardText: '#262729', base: '#FAF8F2',
      layers: [
        { background: 'radial-gradient(78% 70% at 12% 10%, rgba(240, 238, 233, 0.98) 0%, rgba(215, 218, 222, 0.58) 46%, rgba(255, 255, 255, 0) 82%)', blendMode: 'multiply', blur: 48, opacity: 0.72 },
        { background: 'radial-gradient(72% 78% at 92% 88%, rgba(201, 195, 210, 0.72) 0%, rgba(229, 225, 233, 0.4) 46%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 64, opacity: 0.54 },
        { background: 'linear-gradient(128deg, rgba(255, 255, 255, 0.94) 0%, rgba(240, 238, 233, 0.36) 52%, rgba(169, 175, 180, 0.2) 100%)', blendMode: 'multiply', blur: 10, opacity: 0.66 },
      ],
    },
  },
  {
    id: 'mocha-mousse-veil', name: 'Mocha Mousse Veil', mood: 'The 2025 warming brown wrapped in cocoa and cream', kind: 'gradient',
    cards: [{ id: 'mocha-mousse-veil-base', name: 'Mocha Mousse', hex: '#A47864', color: '#A47864', foreground: '#FFF1E7', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'grain', mood: 'warm', dark: true, text: '#FFF1E7', cardText: '#FFF1E7', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(74% 68% at 14% 14%, rgba(164, 120, 100, 0.96) 0%, rgba(104, 67, 55, 0.62) 44%, rgba(27, 16, 13, 0) 80%)', blendMode: 'screen', blur: 52, opacity: 0.9 },
        { background: 'radial-gradient(78% 72% at 90% 84%, rgba(224, 180, 151, 0.76) 0%, rgba(130, 85, 69, 0.46) 48%, rgba(27, 16, 13, 0) 82%)', blendMode: 'screen', blur: 68, opacity: 0.74 },
        { background: 'linear-gradient(148deg, rgba(34, 20, 15, 0.06) 0%, rgba(89, 55, 44, 0.54) 52%, rgba(18, 11, 9, 0.96) 100%)', blendMode: 'multiply', blur: 6, opacity: 1 },
      ],
    },
  },
  {
    id: 'peach-fuzz-sunrise', name: 'Peach Fuzz Sunrise', mood: 'The 2024 peach glowing into coral and soft plum', kind: 'gradient',
    cards: [{ id: 'peach-fuzz-sunrise-base', name: 'Peach Fuzz', hex: '#FFBE98', color: '#FFBE98', foreground: '#512A32', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#512A32', cardText: '#512A32', base: '#FAF8F2', grain: true,
      layers: [
        { background: 'radial-gradient(74% 66% at 12% 14%, rgba(255, 190, 152, 0.94) 0%, rgba(255, 218, 190, 0.5) 46%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 48, opacity: 0.72 },
        { background: 'radial-gradient(80% 74% at 92% 84%, rgba(231, 134, 113, 0.72) 0%, rgba(245, 176, 151, 0.4) 44%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 62, opacity: 0.64 },
        { background: 'linear-gradient(136deg, rgba(255, 248, 235, 0.9) 0%, rgba(255, 190, 152, 0.3) 52%, rgba(90, 43, 66, 0.16) 100%)', blendMode: 'multiply', blur: 12, opacity: 0.66 },
      ],
    },
  },
  {
    id: 'viva-magenta-pulse', name: 'Viva Magenta Pulse', mood: 'The 2023 crimson vibrating against nocturnal violet', kind: 'gradient',
    cards: [{ id: 'viva-magenta-pulse-base', name: 'Viva Magenta', hex: '#BB2649', color: '#BB2649', foreground: '#FFE8EF', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'flux', mood: 'vivid', dark: true, text: '#FFE8EF', cardText: '#FFE8EF', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(70% 66% at 16% 18%, rgba(187, 38, 73, 0.98) 0%, rgba(116, 18, 52, 0.62) 44%, rgba(24, 8, 19, 0) 78%)', blendMode: 'screen', blur: 48, opacity: 0.92 },
        { background: 'conic-gradient(from 205deg at 82% 68%, rgba(236, 76, 121, 0) 0deg, rgba(236, 76, 121, 0.9) 84deg, rgba(129, 49, 156, 0.72) 168deg, rgba(236, 76, 121, 0) 292deg)', blendMode: 'screen', blur: 56, opacity: 0.82 },
        { background: 'linear-gradient(152deg, rgba(30, 7, 18, 0.06) 0%, rgba(90, 20, 58, 0.52) 52%, rgba(17, 9, 30, 0.96) 100%)', blendMode: 'multiply', blur: 6, opacity: 1 },
      ],
    },
  },
  {
    id: 'very-peri-orbit', name: 'Very Peri Orbit', mood: 'The 2022 periwinkle moving through lilac and digital teal', kind: 'gradient',
    cards: [{ id: 'very-peri-orbit-base', name: 'Very Peri', hex: '#6667AB', color: '#6667AB', foreground: '#F1EEFF', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'prism', mood: 'cool', dark: true, text: '#F1EEFF', cardText: '#F1EEFF', base: '#100E0B',
      layers: [
        { background: 'radial-gradient(76% 68% at 14% 12%, rgba(102, 103, 171, 0.98) 0%, rgba(65, 59, 130, 0.62) 44%, rgba(14, 12, 32, 0) 80%)', blendMode: 'screen', blur: 50, opacity: 0.92 },
        { background: 'radial-gradient(78% 76% at 92% 88%, rgba(75, 158, 170, 0.76) 0%, rgba(69, 77, 139, 0.48) 48%, rgba(14, 12, 32, 0) 82%)', blendMode: 'screen', blur: 68, opacity: 0.78 },
        { background: 'linear-gradient(142deg, rgba(13, 11, 30, 0.04) 0%, rgba(102, 103, 171, 0.42) 50%, rgba(36, 20, 68, 0.94) 100%)', blendMode: 'multiply', blur: 8, opacity: 1 },
      ],
    },
  },
  {
    id: 'illuminating-balance', name: 'Illuminating Balance', mood: 'The 2021 yellow and gray pair held in luminous equilibrium', kind: 'gradient',
    cards: [{ id: 'illuminating-balance-base', name: 'Illuminating + Ultimate Gray', hex: '#F5DF4D', color: '#F5DF4D', foreground: '#2F3032', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'lattice', mood: 'warm', dark: false, text: '#2F3032', cardText: '#2F3032', base: '#FAF8F2', grain: true,
      layers: [
        { background: 'radial-gradient(72% 66% at 14% 12%, rgba(245, 223, 77, 0.92) 0%, rgba(249, 235, 139, 0.5) 46%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 46, opacity: 0.7 },
        { background: 'radial-gradient(76% 74% at 90% 86%, rgba(151, 153, 155, 0.72) 0%, rgba(204, 205, 204, 0.38) 46%, rgba(255, 255, 255, 0) 82%)', blendMode: 'multiply', blur: 58, opacity: 0.56 },
        { background: 'repeating-linear-gradient(112deg, rgba(47, 48, 50, 0.12) 0%, transparent 3%, transparent 12%, rgba(245, 223, 77, 0.12) 16%, transparent 22%)', blendMode: 'multiply', blur: 8, opacity: 0.64, backgroundSize: '210% 180%' },
      ],
    },
  },
  {
    id: 'classic-blue-tide', name: 'Classic Blue Tide', mood: 'The 2020 deep blue rising toward clear sky and brass light', kind: 'gradient',
    cards: [{ id: 'classic-blue-tide-base', name: 'Classic Blue', hex: '#0F4C81', color: '#0F4C81', foreground: '#EAF6FF', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'glass', mood: 'cool', dark: true, text: '#EAF6FF', cardText: '#EAF6FF', base: '#100E0B',
      layers: [
        { background: 'radial-gradient(76% 68% at 14% 16%, rgba(15, 76, 129, 0.98) 0%, rgba(13, 51, 96, 0.66) 46%, rgba(6, 15, 31, 0) 80%)', blendMode: 'screen', blur: 50, opacity: 0.94 },
        { background: 'radial-gradient(80% 76% at 92% 84%, rgba(108, 181, 232, 0.76) 0%, rgba(44, 112, 167, 0.46) 48%, rgba(6, 15, 31, 0) 82%)', blendMode: 'screen', blur: 68, opacity: 0.78 },
        { background: 'linear-gradient(148deg, rgba(5, 13, 30, 0.04) 0%, rgba(15, 76, 129, 0.44) 50%, rgba(217, 164, 65, 0.34) 100%)', blendMode: 'screen', blur: 12, opacity: 0.78 },
      ],
    },
  },
  {
    id: 'living-coral-bloom', name: 'Living Coral Bloom', mood: 'The 2019 coral unfolding into blush and ocean green', kind: 'gradient',
    cards: [{ id: 'living-coral-bloom-base', name: 'Living Coral', hex: '#FF6F61', color: '#FF6F61', foreground: '#452421', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#452421', cardText: '#452421', base: '#FAF8F2', grain: true,
      layers: [
        { background: 'radial-gradient(74% 68% at 12% 14%, rgba(255, 111, 97, 0.9) 0%, rgba(255, 173, 158, 0.48) 46%, rgba(255, 255, 255, 0) 80%)', blendMode: 'multiply', blur: 48, opacity: 0.7 },
        { background: 'radial-gradient(78% 74% at 92% 84%, rgba(20, 125, 120, 0.62) 0%, rgba(119, 184, 169, 0.34) 46%, rgba(255, 255, 255, 0) 82%)', blendMode: 'multiply', blur: 66, opacity: 0.52 },
        { background: 'linear-gradient(136deg, rgba(255, 245, 235, 0.9) 0%, rgba(255, 111, 97, 0.26) 52%, rgba(20, 125, 120, 0.14) 100%)', blendMode: 'multiply', blur: 10, opacity: 0.64 },
      ],
    },
  },
  {
    id: 'candy-mesh', name: 'Candy Mesh', mood: 'Soft color fields overlapping like translucent ink', kind: 'gradient',
    cards: [{ id: 'candy-mesh-base', name: 'Candy Mesh', hex: '#FAF8F2', color: '#FAF8F2', foreground: '#34213D', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'mesh', mood: 'vivid', dark: false, text: '#34213D', cardText: '#34213D', base: '#FAF8F2',
      layers: [
        { background: 'radial-gradient(circle at 12% 18%, rgba(255, 104, 164, 0.82) 0%, transparent 34%), radial-gradient(circle at 86% 16%, rgba(112, 130, 255, 0.78) 0%, transparent 36%), radial-gradient(circle at 18% 88%, rgba(255, 191, 87, 0.76) 0%, transparent 38%), radial-gradient(circle at 84% 82%, rgba(74, 218, 183, 0.72) 0%, transparent 38%)', blendMode: 'multiply', blur: 34, opacity: 0.7 },
        { background: 'radial-gradient(ellipse at 52% 48%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0) 52%)', blendMode: 'soft-light', blur: 18, opacity: 0.84 },
        { background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.3) 0%, rgba(178, 119, 220, 0.12) 100%)', blendMode: 'multiply', blur: 0, opacity: 0.72 },
      ],
    },
  },
  {
    id: 'nebula-bloom', name: 'Nebula Bloom', mood: 'Diffuse cosmic clouds blooming through black violet', kind: 'gradient',
    cards: [{ id: 'nebula-bloom-base', name: 'Nebula Bloom', hex: '#090713', color: '#090713', foreground: '#FAECFF', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'nebula', mood: 'dark', dark: true, text: '#FAECFF', cardText: '#FAECFF', base: '#100E0B', grain: true,
      layers: [
        { background: 'radial-gradient(ellipse 92% 58% at 18% 32%, rgba(239, 68, 175, 0.78) 0%, rgba(119, 35, 132, 0.4) 42%, transparent 74%)', blendMode: 'screen', blur: 76, opacity: 0.88 },
        { background: 'radial-gradient(ellipse 84% 66% at 78% 70%, rgba(74, 118, 255, 0.82) 0%, rgba(44, 46, 129, 0.44) 44%, transparent 76%)', blendMode: 'screen', blur: 92, opacity: 0.82 },
        { background: 'radial-gradient(ellipse 52% 38% at 62% 22%, rgba(255, 181, 88, 0.62) 0%, rgba(255, 181, 88, 0) 68%)', blendMode: 'screen', blur: 48, opacity: 0.74 },
      ],
    },
  },
  {
    id: 'aurora-ribbon', name: 'Aurora Ribbon', mood: 'Long luminous ribbons sweeping through polar night', kind: 'gradient',
    cards: [{ id: 'aurora-ribbon-base', name: 'Aurora Ribbon', hex: '#031510', color: '#031510', foreground: '#E5FFF8', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'flux', mood: 'cool', dark: true, text: '#E5FFF8', cardText: '#E5FFF8', base: '#100E0B',
      layers: [
        { background: 'linear-gradient(118deg, transparent 0% 18%, rgba(68, 255, 191, 0.16) 24%, rgba(68, 255, 191, 0.9) 33%, rgba(67, 212, 255, 0.62) 42%, transparent 54% 100%)', blendMode: 'screen', blur: 28, opacity: 0.9 },
        { background: 'linear-gradient(132deg, transparent 0% 38%, rgba(111, 82, 255, 0.12) 44%, rgba(111, 82, 255, 0.8) 54%, rgba(230, 82, 255, 0.52) 63%, transparent 74% 100%)', blendMode: 'screen', blur: 38, opacity: 0.82 },
        { background: 'radial-gradient(ellipse at 50% 110%, rgba(28, 100, 92, 0.72) 0%, rgba(3, 21, 16, 0) 68%)', blendMode: 'screen', blur: 42, opacity: 0.76 },
      ],
    },
  },
  {
    id: 'pistachio-cream', name: 'Pistachio Cream', mood: 'Ivory light melting into soft pistachio and garden moss', kind: 'gradient',
    cards: [{ id: 'pistachio-cream-base', name: 'Pistachio Cream', hex: '#FAF9F1', color: '#FAF9F1', foreground: '#31452B', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#31452B', cardText: '#31452B', base: '#FAF9F1',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(226,235,190,0.14) 28%, rgb(255,255,250) 34%, rgb(205,224,164) 70%, rgb(130,164,102) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(239,242,208,0.24) 36%, rgb(255,255,251) 62%, rgb(215,228,179) 84%, rgb(151,178,119) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'strawberry-milk', name: 'Strawberry Milk', mood: 'Milky white dissolving into blush and ripe strawberry', kind: 'gradient',
    cards: [{ id: 'strawberry-milk-base', name: 'Strawberry Milk', hex: '#FFF8F6', color: '#FFF8F6', foreground: '#6B3040', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#6B3040', cardText: '#6B3040', base: '#FFF8F6',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,220,225,0.14) 28%, rgb(255,253,252) 34%, rgb(247,170,181) 70%, rgb(211,88,112) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,230,233,0.24) 36%, rgb(255,255,255) 62%, rgb(247,186,194) 84%, rgb(222,112,132) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'lavender-foam', name: 'Lavender Foam', mood: 'Pearl mist settling into lavender and soft violet', kind: 'gradient',
    cards: [{ id: 'lavender-foam-base', name: 'Lavender Foam', hex: '#FAF8FF', color: '#FAF8FF', foreground: '#40345E', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'cool', dark: false, text: '#40345E', cardText: '#40345E', base: '#FAF8FF',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(229,220,255,0.14) 28%, rgb(255,255,255) 34%, rgb(195,177,235) 70%, rgb(126,101,185) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(238,232,255,0.24) 36%, rgb(255,255,255) 62%, rgb(209,194,239) 84%, rgb(149,127,199) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'blue-porcelain', name: 'Blue Porcelain', mood: 'Porcelain white flowing into powder blue and cobalt glaze', kind: 'gradient',
    cards: [{ id: 'blue-porcelain-base', name: 'Blue Porcelain', hex: '#F7FAFC', color: '#F7FAFC', foreground: '#1F3F5A', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'cool', dark: false, text: '#1F3F5A', cardText: '#1F3F5A', base: '#F7FAFC',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(213,233,247,0.14) 28%, rgb(255,255,255) 34%, rgb(156,202,230) 70%, rgb(67,126,181) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(226,240,250,0.24) 36%, rgb(255,255,255) 62%, rgb(180,216,237) 84%, rgb(91,147,195) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'honey-souffle', name: 'Honey Soufflé', mood: 'Whipped cream descending into honey and toasted caramel', kind: 'gradient',
    cards: [{ id: 'honey-souffle-base', name: 'Honey Soufflé', hex: '#FFFBEF', color: '#FFFBEF', foreground: '#5B3A12', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#5B3A12', cardText: '#5B3A12', base: '#FFFBEF',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,235,181,0.14) 28%, rgb(255,255,250) 34%, rgb(244,193,92) 70%, rgb(190,119,38) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,242,205,0.24) 36%, rgb(255,255,253) 62%, rgb(247,207,126) 84%, rgb(207,143,57) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'mint-sorbet', name: 'Mint Sorbet', mood: 'Cool ivory opening into mint leaf and quiet seafoam', kind: 'gradient',
    cards: [{ id: 'mint-sorbet-base', name: 'Mint Sorbet', hex: '#F5FCF8', color: '#F5FCF8', foreground: '#245044', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'cool', dark: false, text: '#245044', cardText: '#245044', base: '#F5FCF8',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(211,242,226,0.14) 28%, rgb(255,255,253) 34%, rgb(151,213,183) 70%, rgb(70,151,125) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(229,247,238,0.24) 36%, rgb(255,255,255) 62%, rgb(178,224,202) 84%, rgb(97,169,143) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'peach-bellini', name: 'Peach Bellini', mood: 'Creamy peach brightening into coral aperitif light', kind: 'gradient',
    cards: [{ id: 'peach-bellini-base', name: 'Peach Bellini', hex: '#FFF8F1', color: '#FFF8F1', foreground: '#6A3527', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#6A3527', cardText: '#6A3527', base: '#FFF8F1',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,225,204,0.14) 28%, rgb(255,255,252) 34%, rgb(249,177,132) 70%, rgb(224,105,79) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,237,221,0.24) 36%, rgb(255,255,255) 62%, rgb(250,196,158) 84%, rgb(231,130,99) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
  {
    id: 'rose-champagne', name: 'Rose Champagne', mood: 'Pearl blush effervescing into rose gold and antique copper', kind: 'gradient',
    cards: [{ id: 'rose-champagne-base', name: 'Rose Champagne', hex: '#FFF7F5', color: '#FFF7F5', foreground: '#5C3540', role: 'lead' }],
    gradientRecipe: {
      source: 'vitrines', category: 'aura', mood: 'warm', dark: false, text: '#5C3540', cardText: '#5C3540', base: '#FFF7F5',
      layers: [
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(250,221,216,0.14) 28%, rgb(255,255,252) 34%, rgb(221,161,154) 70%, rgb(168,95,88) 100%)', blendMode: 'hard-light', blur: 36 },
        { background: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,235,231,0.24) 36%, rgb(255,255,255) 62%, rgb(231,183,177) 84%, rgb(190,121,112) 100%)', blendMode: 'soft-light', blur: 36 },
      ],
    },
  },
] as const;

export const defaultColorPalettes: readonly ColorPalette[] = [
  ...originalColorPalettes,
  ...pantoneColorPalettes,
  ...defaultGradientPalettes,
  ...auraColorPalettes,
];

export const defaultColorCollections: readonly ColorCollection[] = [
  {
    id: 'color-of-the-year-2026',
    name: '2026 — Cloud Dancer',
    description: 'A lofty off-white associated with calm, reflection, and a renewed creative canvas.',
    year: 2026,
    featuredColors: [{ name: 'Cloud Dancer', code: '11-4201', hex: '#F0EEE9' }],
    paletteIds: ['cloud-canvas', 'quiet-spectrum', 'coastal-cloud', 'cloud-dancer-halo'],
  },
  {
    id: 'color-of-the-year-2025',
    name: '2025 — Mocha Mousse',
    description: 'A warming brown shaped by comfort, thoughtful indulgence, and everyday richness.',
    year: 2025,
    featuredColors: [{ name: 'Mocha Mousse', code: '17-1230', hex: '#A47864' }],
    paletteIds: ['mocha-atelier', 'mocha-botanical', 'mocha-blue', 'mocha-mousse-veil'],
  },
  {
    id: 'color-of-the-year-2024',
    name: '2024 — Peach Fuzz',
    description: 'A gentle peach expressing warmth, care, connection, and tactile softness.',
    year: 2024,
    featuredColors: [{ name: 'Peach Fuzz', code: '13-1023', hex: '#FFBE98' }],
    paletteIds: ['peach-nocturne', 'peach-tide', 'peach-plum', 'peach-fuzz-sunrise'],
  },
  {
    id: 'color-of-the-year-2023',
    name: '2023 — Viva Magenta',
    description: 'A courageous crimson red expressing energy, optimism, and fearless self-expression.',
    year: 2023,
    featuredColors: [{ name: 'Viva Magenta', code: '18-1750', hex: '#BB2649' }],
    paletteIds: ['viva-noir', 'viva-cobalt', 'viva-garden', 'viva-magenta-pulse'],
  },
  {
    id: 'color-of-the-year-2022',
    name: '2022 — Very Peri',
    description: 'A dynamic periwinkle blue encouraging invention, curiosity, and creative confidence.',
    year: 2022,
    featuredColors: [{ name: 'Very Peri', code: '17-3938', hex: '#6667AB' }],
    paletteIds: ['peri-night', 'peri-clay', 'peri-mint', 'very-peri-orbit'],
  },
  {
    id: 'color-of-the-year-2021',
    name: '2021 — Illuminating + Ultimate Gray',
    description: 'A pairing of bright optimism and dependable resilience, designed to support one another.',
    year: 2021,
    featuredColors: [
      { name: 'Illuminating', code: '13-0647', hex: '#F5DF4D' },
      { name: 'Ultimate Gray', code: '17-5104', hex: '#97999B' },
    ],
    paletteIds: ['sunlit-concrete', 'solar-structure', 'gray-daybreak', 'illuminating-balance'],
  },
  {
    id: 'color-of-the-year-2020',
    name: '2020 — Classic Blue',
    description: 'A timeless deep blue offering calm, confidence, connection, and a stable foundation.',
    year: 2020,
    featuredColors: [{ name: 'Classic Blue', code: '19-4052', hex: '#0F4C81' }],
    paletteIds: ['classic-blue-night', 'classic-blue-brass', 'classic-blue-coral', 'classic-blue-tide'],
  },
  {
    id: 'color-of-the-year-2019',
    name: '2019 — Living Coral',
    description: 'A vibrant coral expressing sociability, warmth, optimism, and life-affirming energy.',
    year: 2019,
    featuredColors: [{ name: 'Living Coral', code: '16-1546', hex: '#FF6F61' }],
    paletteIds: ['coral-night', 'coral-navy', 'coral-garden', 'living-coral-bloom'],
  },
] as const;
