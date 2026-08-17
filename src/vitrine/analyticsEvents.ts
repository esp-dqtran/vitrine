import type { ColorPalette, ColorPaletteKind } from '../colorPalettes.ts';

export const analyticsEvent = {
  colorFilterChanged: 'color filter changed',
  colorPaletteCopied: 'color palette copied',
  colorPaletteExpanded: 'color palette expanded',
  colorPostEditorOpened: 'color post editor opened',
  colorPostThemeApplied: 'color post theme applied',
  colorPostImageCopied: 'color post image copied',
} as const;

export function paletteAnalyticsProperties(
  palette: Pick<ColorPalette, 'id' | 'kind'>,
): { palette_id: string; palette_type: ColorPaletteKind } {
  return {
    palette_id: palette.id,
    palette_type: palette.kind ?? 'solid',
  };
}

export function analyticsPathname(url: string): string {
  return new URL(url).pathname;
}

export function analyticsPageUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}
