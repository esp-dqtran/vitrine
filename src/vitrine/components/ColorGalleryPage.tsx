import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Icon, IconButton, TextInput } from '@astryxdesign/core';
import {
  defaultColorCollections,
  defaultColorPalettes,
  type ColorCollection,
  type ColorCollectionFeaturedColor,
  type ColorPalette,
  type ColorPaletteKind,
} from '../../colorPalettes.ts';
import { resolveBlendMode } from '../../vendor/aura/gradients.ts';
import { fetchColorLibrary } from '../colorPalettesApi.ts';
import {
  DiscoveryFilterBar,
  type DiscoveryFilterGroup,
  type DiscoveryFilterOption,
} from './AppsFilterBar.tsx';
import { ColorPackStack } from './ColorPackStack.tsx';
import { CopyButton } from './CopyButton.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { CommandPaletteFrame } from './CommandPaletteFrame.tsx';
import { MeliusAnimatedText } from './MeliusAnimatedText.tsx';
import { navigate } from '../router.ts';
import { trackAnalyticsEvent } from '../analytics.ts';
import { analyticsEvent, paletteAnalyticsProperties } from '../analyticsEvents.ts';

export const colorPalettes = defaultColorPalettes;
export const colorCollections = defaultColorCollections;
export const COLOR_PALETTE_BATCH_SIZE = 12;

export type RelatedColor = {
  role: 'Lead' | 'Companion' | 'Accent';
  hex: string;
};

export function nextColorPaletteRenderCount(
  currentCount: number,
  totalCount: number,
  batchSize = COLOR_PALETTE_BATCH_SIZE,
) {
  return Math.min(totalCount, currentCount + batchSize);
}

function relativeLuminance(hex: string) {
  const normalized = hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) return 1;
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function normalizeColorHex(value: string) {
  const match = value.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].toUpperCase();
  return `#${hex.length === 3 ? hex.split('').map((channel) => `${channel}${channel}`).join('') : hex}`;
}

function hexToHsl(hex: string) {
  const normalized = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(
    normalized.slice(offset, offset + 2),
    16,
  ) / 255);
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  const lightness = (high + low) / 2;
  const delta = high - low;
  if (!delta) return { hue: 0, saturation: 0, lightness: lightness * 100 };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = high === red
    ? ((green - blue) / delta) % 6
    : high === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs(section % 2 - 1));
  const match = hue < 60 ? [chroma, secondary, 0]
    : hue < 120 ? [secondary, chroma, 0]
      : hue < 180 ? [0, chroma, secondary]
        : hue < 240 ? [0, secondary, chroma]
          : hue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return `#${match.map((channel) => Math.round((channel + offset) * 255)
    .toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function getRelatedColors(hex: string): readonly RelatedColor[] | null {
  const anchor = normalizeColorHex(hex);
  if (!anchor) return null;
  const { hue, saturation, lightness } = hexToHsl(anchor);
  const companionLightness = lightness < 55 ? 92 : 16;
  const accentHue = (hue + (saturation < 22 ? 35 : 180)) % 360;
  const accentSaturation = Math.min(82, Math.max(58, saturation));
  const accentLightness = lightness < 42 ? 56 : lightness > 72 ? 36 : 48;
  return [
    { role: 'Lead', hex: anchor },
    { role: 'Companion', hex: hslToHex(hue, Math.max(12, saturation * 0.35) / 100, companionLightness / 100) },
    { role: 'Accent', hex: hslToHex(accentHue, accentSaturation / 100, accentLightness / 100) },
  ];
}

export function getCollectionCardForeground(hex: string) {
  const background = relativeLuminance(hex);
  const dark = relativeLuminance('#151311');
  const darkContrast = (background + 0.05) / (dark + 0.05);
  const lightContrast = 1.05 / (background + 0.05);
  return darkContrast >= lightContrast ? '#151311' : '#FFFFFF';
}

export function ColorCollectionFeatureCard({
  collection,
  color,
}: {
  collection: ColorCollection;
  color: ColorCollectionFeaturedColor;
}) {
  const style = {
    '--collection-card-color': color.hex,
    '--collection-card-foreground': getCollectionCardForeground(color.hex),
  } as CSSProperties;

  return (
    <article
      className="color-gallery__collection-card"
      aria-label={`${collection.year} Color of the Year: ${color.name}`}
      style={style}
    >
      <span className="color-gallery__collection-card-overline">
        Color of the Year {collection.year}
      </span>
      <div className="color-gallery__collection-card-copy">
        <span className="color-gallery__collection-card-hex">{color.hex}</span>
        <strong className="color-gallery__collection-card-name">{color.name}</strong>
        <span className="color-gallery__collection-card-pantone">PANTONE {color.code}</span>
      </div>
    </article>
  );
}

interface ColorGalleryPageProps {
  query?: string;
  searchActive?: boolean;
  onQueryChange?: (query: string) => void;
  onSearchClose?: () => void;
}

function ColorPaletteSearchModal({
  isOpen,
  query,
  resultCount,
  paletteCount,
  colorCount,
  palettes,
  relatedColors,
  onQueryChange,
  onClose,
}: {
  isOpen: boolean;
  query: string;
  resultCount: number;
  paletteCount: number;
  colorCount: number;
  palettes: readonly ColorPalette[];
  relatedColors: readonly RelatedColor[] | null;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftQuery, setDraftQuery] = useState(query);
  const draftHex = normalizeColorHex(draftQuery);

  useEffect(() => {
    if (!isOpen) return;
    setDraftQuery(query);
    inputRef.current?.focus();
  }, [isOpen, query]);

  return (
    <CommandPaletteFrame
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      dataNav="colors"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="command-palette-header">
        <div className="command-palette-search">
          <TextInput
            ref={inputRef}
            className={draftHex ? 'color-palette-search-input--with-pill' : undefined}
            label="Search the palette library"
            isLabelHidden
            value={draftQuery}
            onChange={setDraftQuery}
            onEnter={() => onQueryChange(draftQuery)}
            placeholder="Search palette, color, or hex…"
            hasClear={Boolean(draftQuery)}
            startIcon={draftHex ? (
              <span
                aria-hidden="true"
                className="color-palette-search-input-pill"
                style={{
                  backgroundColor: draftHex,
                  color: getCollectionCardForeground(draftHex),
                }}
              >
                {draftHex}
              </span>
            ) : undefined}
            width="100%"
          />
        </div>
        <span className="command-palette-close">
          <IconButton
            label="Close palette search"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </span>
      </header>
      <div className="command-palette-body color-palette-search-body">
        <aside className="command-palette-sidebar" aria-label="Color search help">
          <div className="command-palette-sidebar-spacer" />
          <div className="command-palette-promo">
            <span>COLOR SEARCH</span>
            <strong>Find palettes<br />by color.</strong>
            <p>Search palette names, individual colors, and hex values.</p>
          </div>
        </aside>
        <div className="inspiration-modal-content command-palette-content color-palette-search-content">
          <p className="color-palette-search-meta" role="status">
            {query.trim()
              ? `${resultCount} of ${paletteCount} palettes`
              : `${paletteCount} palettes · ${colorCount} colors`}
          </p>
          {relatedColors ? (
            <section className="color-palette-related" aria-label={`Related colors for ${relatedColors[0].hex}`}>
              <div className="color-palette-related__heading">
                <span>FROM HEX</span>
                <strong>Related palette</strong>
              </div>
              <div className="color-palette-related__colors">
                {relatedColors.map((color) => (
                  <div
                    className="color-palette-related__color"
                    key={color.role}
                    style={{
                      backgroundColor: color.hex,
                      color: getCollectionCardForeground(color.hex),
                    }}
                  >
                    <span>{color.role}</span>
                    <strong>{color.hex}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <div className="color-palette-search-results" role="list">
            {palettes.slice(0, 18).map((palette) => (
              <article className="color-palette-search-result" key={palette.id} role="listitem">
                <strong>{palette.name}</strong>
                <span className="color-palette-search-colors">
                  {palette.cards.map((card) => (
                    <span className="color-palette-search-color" key={card.hex}>
                      <i aria-hidden="true" style={{ backgroundColor: card.hex }} />
                      <span>{card.hex}</span>
                    </span>
                  ))}
                </span>
              </article>
            ))}
          </div>
          {query.trim() && !palettes.length ? (
            <p className="color-palette-search-empty">No saved palette matches this search.</p>
          ) : null}
        </div>
      </div>
    </CommandPaletteFrame>
  );
}

export function filterPalettesByCollectionIds(
  palettes: readonly ColorPalette[],
  collections: readonly ColorCollection[],
  selectedCollectionIds: readonly string[],
) {
  if (!selectedCollectionIds.length) return palettes;
  const selectedIds = new Set(selectedCollectionIds);
  const paletteIds = new Set(
    collections
      .filter((collection) => selectedIds.has(collection.id))
      .flatMap((collection) => collection.paletteIds),
  );
  return palettes.filter((palette) => paletteIds.has(palette.id));
}

export function getColorPaletteKind(palette: ColorPalette): ColorPaletteKind {
  return palette.kind ?? 'solid';
}

function hexWithAlpha(hex: string, alpha: string) {
  return /^#[\da-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
}

function getGradientCardLayers(palette: ColorPalette) {
  if (palette.gradientRecipe) {
    return palette.gradientRecipe.layers.map((layer) => layer.background);
  }
  const [lead, accent = lead, companion = accent] = palette.cards;
  if (!lead) return [];
  const leadEnd = lead.gradient?.endHex ?? lead.hex;
  const accentEnd = accent.gradient?.endHex ?? accent.hex;
  const companionEnd = companion.gradient?.endHex ?? companion.hex;
  const beamAngle = (accent.gradient?.angle ?? 145) - 45;

  return [
    `radial-gradient(88% 74% at 8% 0%, ${hexWithAlpha(companionEnd, 'D9')} 0%, ${hexWithAlpha(companion.hex, '00')} 72%)`,
    `radial-gradient(86% 82% at 100% 100%, ${hexWithAlpha(accentEnd, 'E6')} 0%, ${hexWithAlpha(accent.hex, '00')} 74%)`,
    `repeating-linear-gradient(${beamAngle}deg, ${hexWithAlpha(accent.hex, '4D')} 0%, ${hexWithAlpha(accentEnd, '1F')} 7%, transparent 13%, transparent 23%)`,
    `linear-gradient(${lead.gradient?.angle ?? 135}deg, ${lead.hex} 0%, ${leadEnd} 100%)`,
  ];
}

export function getGradientPaletteBackground(palette: ColorPalette) {
  return getGradientCardLayers(palette).join(', ');
}

export function getGradientPaletteCss(palette: ColorPalette) {
  const recipe = palette.gradientRecipe;
  if (recipe) {
    const light = !recipe.dark;
    const backdrop = recipe.dark ? '#100e0b' : '#faf8f2';
    const sourceLabel = recipe.source === 'aura' ? `Aura (${recipe.category})` : `Vitrines (${recipe.category})`;
    const sourceComment = recipe.sourceUrl && recipe.sourceCommit
      ? `/* Source: ${recipe.sourceUrl}/tree/${recipe.sourceCommit} */`
      : null;
    const layers = recipe.layers.map((layer, index) => {
      const properties = [
        `  background: ${layer.background};`,
        layer.backgroundSize ? `  background-size: ${layer.backgroundSize};` : null,
        `  mix-blend-mode: ${resolveBlendMode(layer.blendMode, light)};`,
        layer.blur > 0 ? `  filter: blur(${layer.blur}px);` : null,
        layer.opacity !== undefined && layer.opacity !== 1 ? `  opacity: ${layer.opacity};` : null,
      ].filter(Boolean).join('\n');
      return `.aura-layer-${index + 1} {\n  position: absolute;\n  inset: 0;\n${properties}\n}`;
    }).join('\n\n');

    return [
      `/* ${palette.name} — ${sourceLabel} */`,
      sourceComment,
      `.aura-gradient {\n  position: relative;\n  overflow: hidden;\n  isolation: isolate;\n  background-color: ${backdrop};\n}`,
      layers,
    ].filter(Boolean).join('\n\n');
  }
  const lead = palette.cards[0];
  const layers = getGradientCardLayers(palette);
  if (!lead || !layers.length) return '';

  return [
    `background-color: ${lead.hex};`,
    `background-image:\n  ${layers.join(',\n  ')};`,
    'background-blend-mode: screen, screen, soft-light, normal;',
  ].join('\n');
}

export function getPaletteCopyText(palette: ColorPalette) {
  return getColorPaletteKind(palette) === 'gradient'
    ? getGradientPaletteCss(palette)
    : palette.cards.map((card) => card.hex).join(', ');
}

export function getPaletteVibe(palette: ColorPalette) {
  if (!palette.source) return palette.mood;
  const sourceType = palette.source.type === 'app' ? 'Apps' : 'Sites';
  const sourcePrefix = `From ${sourceType} · ${palette.source.name} — `;
  return palette.mood.startsWith(sourcePrefix)
    ? palette.mood.slice(sourcePrefix.length)
    : palette.mood;
}

function GradientRecipeLayers({ palette }: { palette: ColorPalette }) {
  const recipe = palette.gradientRecipe;
  if (!recipe) return null;
  const light = !recipe.dark;

  return recipe.layers.map((layer, index) => (
    <span
      className="color-gallery__gradient-layer"
      key={`${palette.id}-layer-${index}`}
      aria-hidden="true"
      style={{
        backgroundImage: layer.background,
        backgroundSize: layer.backgroundSize ?? 'cover',
        mixBlendMode: resolveBlendMode(layer.blendMode, light) as CSSProperties['mixBlendMode'],
        filter: layer.blur > 0 ? `blur(${Math.min(layer.blur, 24)}px)` : undefined,
        opacity: layer.opacity ?? 1,
      }}
    />
  ));
}

export function PaletteHeader({
  copyText,
  palette,
  successMessage,
}: {
  copyText: string;
  palette: ColorPalette;
  successMessage: string;
}) {
  return (
    <header className="color-gallery__palette-header">
      <div className="color-gallery__palette-heading">
        <div className="color-gallery__palette-title-row">
          <h3 className="color-gallery__palette-title">{palette.name}</h3>
        </div>
        {palette.source ? (
          <span className="color-gallery__palette-source">
            <span
              className="color-gallery__palette-source-icon"
              role="img"
              aria-label={`${palette.source.name} ${palette.source.type}`}
            >
              <span aria-hidden="true">{palette.source.name.slice(0, 1).toUpperCase()}</span>
              {palette.source.iconUrl ? (
                <img
                  alt=""
                  src={palette.source.iconUrl}
                  onError={(event) => { event.currentTarget.hidden = true; }}
                />
              ) : null}
            </span>
            <strong className="color-gallery__palette-source-name">{palette.source.name}</strong>
            <span aria-hidden="true">—</span>
            <span className="color-gallery__palette-source-description">{getPaletteVibe(palette)}</span>
          </span>
        ) : (
          <span className="color-gallery__palette-mood">{getPaletteVibe(palette)}</span>
        )}
      </div>
      <CopyButton
        action={async () => {
          await navigator.clipboard.writeText(copyText);
          trackAnalyticsEvent(analyticsEvent.colorPaletteCopied, paletteAnalyticsProperties(palette));
        }}
        label="Copy"
        successMessage={successMessage}
        showCopyingState={false}
        variant="ghost"
        size="sm"
        className="color-gallery__copy"
      />
    </header>
  );
}

export function GradientPaletteCard({ palette }: { palette: ColorPalette }) {
  const recipe = palette.gradientRecipe;
  const gradientCss = getGradientPaletteBackground(palette);
  const copyText = getGradientPaletteCss(palette);
  const lead = palette.cards[0];
  const style = {
    '--gradient-card-background': recipe ? 'none' : gradientCss,
    '--gradient-card-base': recipe ? (recipe.dark ? '#100e0b' : '#faf8f2') : (lead?.hex ?? '#151311'),
    '--gradient-card-foreground': recipe?.cardText ?? lead?.foreground ?? '#FFFFFF',
  } as CSSProperties;

  return (
    <article className="color-gallery__palette color-gallery__palette--gradient">
      <PaletteHeader
        copyText={copyText}
        palette={palette}
        successMessage={`${palette.name} gradient CSS copied`}
      />
      <div
        className={`color-gallery__gradient-card${recipe ? ' color-gallery__gradient-card--aura' : ''}`}
        style={style}
        aria-label={`${palette.name} gradient palette`}
      >
        <GradientRecipeLayers palette={palette} />
        {recipe?.grain || !recipe ? <span className="color-gallery__gradient-noise" aria-hidden="true" /> : null}
      </div>
    </article>
  );
}

export function ViewportPaletteCard({
  children,
  eager = false,
  kind,
}: {
  children: ReactNode;
  eager?: boolean;
  kind: ColorPaletteKind;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(eager || typeof window === 'undefined');

  useEffect(() => {
    if (loaded) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setLoaded(true);
      return undefined;
    }

    const target = viewportRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setLoaded(true);
      observer.disconnect();
    }, { rootMargin: '800px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loaded]);

  return (
    <div
      ref={viewportRef}
      className="color-gallery__palette-viewport"
      data-kind={kind}
      data-loaded={loaded ? 'true' : 'false'}
    >
      {loaded ? children : (
        <div
          className={`color-gallery__palette-placeholder color-gallery__palette-placeholder--${kind}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function ColorGalleryPage({
  query = '',
  searchActive = false,
  onQueryChange = () => undefined,
  onSearchClose = () => undefined,
}: ColorGalleryPageProps) {
  const [palettes, setPalettes] = useState<readonly ColorPalette[]>(colorPalettes);
  const [collections, setCollections] = useState<readonly ColorCollection[]>(colorCollections);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<readonly string[]>([]);
  const [selectedKinds, setSelectedKinds] = useState<readonly ColorPaletteKind[]>(['solid']);
  const [renderedPaletteCount, setRenderedPaletteCount] = useState(COLOR_PALETTE_BATCH_SIZE);
  const paletteSentinelRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const relatedColors = useMemo(() => getRelatedColors(query), [query]);
  const selectedCollectionIdSet = useMemo(
    () => new Set(selectedCollectionIds),
    [selectedCollectionIds],
  );
  const selectedCollections = useMemo(
    () => collections.filter((collection) => selectedCollectionIdSet.has(collection.id)),
    [collections, selectedCollectionIdSet],
  );
  const collectionOptions = useMemo<DiscoveryFilterOption[]>(() => collections.map((collection) => ({
    value: collection.name,
    section: 'Color of the Year',
    description: collection.description,
    aliases: [
      String(collection.year),
      ...collection.featuredColors.flatMap((color) => [color.name, color.code, color.hex]),
    ],
    swatches: collection.featuredColors.map((color) => color.hex),
  })), [collections]);
  const collectionFilterGroup = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'color-collections',
    label: 'Collection',
    selected: selectedCollections.map((collection) => collection.name),
    options: collectionOptions,
  }), [collectionOptions, selectedCollections]);
  const typeFilterGroup = useMemo<DiscoveryFilterGroup>(() => ({
    id: 'color-types',
    label: 'Type',
    selectionMode: 'single',
    allowClear: false,
    selected: selectedKinds.map((kind) => kind === 'gradient' ? 'Gradient' : 'Mono'),
    options: [
      {
        value: 'Mono',
        section: 'Palette type',
        description: 'Three coordinated mono colors',
        swatches: ['#151311', '#4B262F', '#EED3BA'],
      },
      {
        value: 'Gradient',
        section: 'Palette type',
        description: 'Layered atmospheric gradient surfaces',
        swatches: ['#1A1231', '#773389', '#E4D7F0'],
      },
    ],
  }), [selectedKinds]);
  const discoveryFilters = useMemo(
    () => [typeFilterGroup, collectionFilterGroup],
    [collectionFilterGroup, typeFilterGroup],
  );
  const collectionPalettes = useMemo(
    () => filterPalettesByCollectionIds(palettes, collections, selectedCollectionIds),
    [collections, palettes, selectedCollectionIds],
  );
  const typedPalettes = useMemo(() => {
    if (!selectedKinds.length) return collectionPalettes;
    const kinds = new Set(selectedKinds);
    return collectionPalettes.filter((palette) => kinds.has(getColorPaletteKind(palette)));
  }, [collectionPalettes, selectedKinds]);
  const visiblePalettes = useMemo(() => typedPalettes.filter((palette) => {
    if (!normalizedQuery) return true;
    return [
      palette.name,
      palette.mood,
      getColorPaletteKind(palette),
      palette.gradientRecipe?.category ?? '',
      palette.gradientRecipe?.mood ?? '',
      palette.gradientRecipe?.base ?? '',
      ...(palette.gradientRecipe?.layers.map((layer) => layer.background) ?? []),
      ...palette.cards.flatMap((card) => [card.name, card.hex, card.color, card.gradient?.endHex ?? '']),
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  }), [normalizedQuery, typedPalettes]);
  const renderedPalettes = useMemo(
    () => visiblePalettes.slice(0, renderedPaletteCount),
    [renderedPaletteCount, visiblePalettes],
  );
  const hasMorePalettes = renderedPalettes.length < visiblePalettes.length;

  useEffect(() => {
    setRenderedPaletteCount(Math.min(COLOR_PALETTE_BATCH_SIZE, visiblePalettes.length));
  }, [visiblePalettes]);

  useEffect(() => {
    if (!hasMorePalettes) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setRenderedPaletteCount(visiblePalettes.length);
      return undefined;
    }

    const target = paletteSentinelRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setRenderedPaletteCount((currentCount) => nextColorPaletteRenderCount(
        currentCount,
        visiblePalettes.length,
      ));
    }, { rootMargin: '1200px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMorePalettes, renderedPaletteCount, visiblePalettes.length]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchColorLibrary(controller.signal)
      .then((library) => {
        if (library.palettes.length) {
          const apiIds = new Set(library.palettes.map((palette) => palette.id));
          setPalettes([
            ...library.palettes,
            ...colorPalettes.filter((palette) => !apiIds.has(palette.id)),
          ]);
        }
        if (library.collections.length) setCollections(library.collections);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const toggleCollection = (collectionId: string) => {
    setSelectedCollectionIds((current) => current.includes(collectionId)
      ? current.filter((id) => id !== collectionId)
      : [...current, collectionId]);
  };

  const selectedCollectionCards = selectedCollections.length ? (
    <div className="color-gallery__collection-cards">
      {selectedCollections.flatMap((collection) => (
        collection.featuredColors.map((color) => (
          <ColorCollectionFeatureCard
            key={`${collection.id}-${color.code}`}
            collection={collection}
            color={color}
          />
        ))
      ))}
    </div>
  ) : null;

  return (
    <>
    <DiscoveryPageLayout
      kind="colors"
      header={(
        <section className="colors-discovery-hero" aria-label="Colors">
          <h1 className="visually-hidden">Colors</h1>
          <MeliusAnimatedText className="colors-discovery-hero__title" text="COLORS" />
        </section>
      )}
      toolbar={(
        <DiscoveryFilterBar
          kind="colors"
          ariaLabel="Color discovery controls"
          platform={{
            value: 'web',
            ariaLabel: 'Color library surface',
            onChange: () => undefined,
          }}
          filters={discoveryFilters}
          resultCount={visiblePalettes.length}
          resultLabels={['palette', 'palettes']}
          showPlatform={false}
          showSort={false}
          primaryFilterId="color-types"
          sort="curated"
          sortOptions={[]}
          onSortChange={() => undefined}
          onToggleFilter={(groupId, value) => {
            if (groupId === 'color-types') {
              const kind: ColorPaletteKind = value === 'Gradient' ? 'gradient' : 'solid';
              setSelectedKinds([kind]);
              trackAnalyticsEvent(analyticsEvent.colorFilterChanged, { filter: 'type', value: kind });
              return;
            }
            const collection = collections.find((candidate) => candidate.name === value);
            if (collection) {
              toggleCollection(collection.id);
              trackAnalyticsEvent(analyticsEvent.colorFilterChanged, {
                filter: 'collection',
                value: String(collection.year),
              });
            }
          }}
          onClearFilter={(groupId) => {
            if (groupId === 'color-types') {
              setSelectedKinds(['solid']);
              trackAnalyticsEvent(analyticsEvent.colorFilterChanged, { filter: 'type', value: 'solid' });
            }
            if (groupId === 'color-collections') {
              setSelectedCollectionIds([]);
              trackAnalyticsEvent(analyticsEvent.colorFilterChanged, { filter: 'collection', value: 'all' });
            }
          }}
          actions={(
            <div className="color-gallery__actions">
              <Button
                label="Build palette"
                variant="secondary"
                onClick={() => navigate({ name: 'color-compose' })}
              />
              <Button
                label="Create post"
                variant="primary"
                onClick={() => navigate({
                  name: 'color-create',
                  ...(visiblePalettes[0] ? { paletteId: visiblePalettes[0].id } : {}),
                })}
              />
            </div>
          )}
        />
      )}
      resultLabel="palettes"
      singularResultLabel="palette"
      totalCount={visiblePalettes.length}
      renderedCount={renderedPalettes.length}
      loading={false}
      loadingMore={false}
      error={null}
      loadMoreError={null}
      onRetry={() => undefined}
      onRetryLoadMore={() => undefined}
      sentinelRef={hasMorePalettes ? paletteSentinelRef : undefined}
      onReset={() => {
        setSelectedKinds(['solid']);
        setSelectedCollectionIds([]);
        onQueryChange('');
      }}
      beforeResults={selectedCollectionCards}
    >
      <div
        className="reference-discovery__grid colors-discovery__grid"
        data-colors-discovery-grid="true"
        data-rendered-palette-count={renderedPalettes.length}
      >
        {renderedPalettes.map((palette, paletteIndex) => (
          <ViewportPaletteCard
            eager={paletteIndex < 3}
            kind={getColorPaletteKind(palette)}
            key={palette.id}
          >
            {getColorPaletteKind(palette) === 'gradient' ? (
              <GradientPaletteCard palette={palette} />
            ) : (
              <article className="color-gallery__palette">
                <PaletteHeader
                  copyText={getPaletteCopyText(palette)}
                  palette={palette}
                  successMessage={`${palette.name} solid values copied`}
                />
                <ColorPackStack
                  cards={palette.cards}
                  label={`${palette.name} color palette`}
                  initiallyExpanded={false}
                  onExpandedChange={(expanded) => {
                    if (expanded) {
                      trackAnalyticsEvent(
                        analyticsEvent.colorPaletteExpanded,
                        paletteAnalyticsProperties(palette),
                      );
                    }
                  }}
                />
              </article>
            )}
          </ViewportPaletteCard>
        ))}
      </div>
    </DiscoveryPageLayout>
    <ColorPaletteSearchModal
      isOpen={searchActive}
      query={query}
      resultCount={visiblePalettes.length}
      paletteCount={typedPalettes.length}
      colorCount={typedPalettes.reduce((total, palette) => total + palette.cards.length, 0)}
      palettes={visiblePalettes}
      relatedColors={relatedColors}
      onQueryChange={onQueryChange}
      onClose={onSearchClose}
    />
    </>
  );
}
