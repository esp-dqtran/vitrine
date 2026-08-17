import type { ColorPalette } from './colorPalettes.ts';
import { GRADIENTS } from './vendor/aura/gradients.ts';

export const AURA_SOURCE_URL = 'https://github.com/CristianOlivera1/Aura';
export const AURA_SOURCE_COMMIT = '276792e97c1482159e928b39c2725e3c0eee946c';

function getCardHex(base: string, dark: boolean) {
  return /^#[0-9a-f]{6}$/i.test(base) ? base.toUpperCase() : dark ? '#100E0B' : '#FAF8F2';
}

export const auraColorPalettes: readonly ColorPalette[] = GRADIENTS.map((gradient) => {
  const hex = getCardHex(gradient.base, gradient.dark);
  return {
    id: `aura-${gradient.id}`,
    name: gradient.name,
    mood: gradient.desc,
    kind: 'gradient',
    cards: [{
      id: `aura-${gradient.id}-base`,
      name: gradient.name,
      hex,
      color: gradient.base,
      foreground: gradient.cardText ?? gradient.text,
      role: 'lead',
    }],
    gradientRecipe: {
      source: 'aura',
      sourceUrl: AURA_SOURCE_URL,
      sourceCommit: AURA_SOURCE_COMMIT,
      category: gradient.category,
      mood: gradient.mood,
      dark: gradient.dark,
      text: gradient.text,
      ...(gradient.cardText ? { cardText: gradient.cardText } : {}),
      base: gradient.base,
      layers: gradient.layers.map((layer) => ({
        background: layer.background,
        blendMode: layer.blendMode,
        blur: layer.blur,
        ...(layer.opacity === undefined ? {} : { opacity: layer.opacity }),
        ...(layer.backgroundSize === undefined ? {} : { backgroundSize: layer.backgroundSize }),
      })),
      ...(gradient.grain ? { grain: true } : {}),
    },
  };
});
