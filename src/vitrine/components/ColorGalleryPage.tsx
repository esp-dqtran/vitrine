import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core';
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
import { navigate } from '../router.ts';

export const colorPalettes = defaultColorPalettes;
export const colorCollections = defaultColorCollections;
export const COLOR_PALETTE_BATCH_SIZE = 12;

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

function PaletteHeader({
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
        <span className="color-gallery__palette-mood">{palette.mood}</span>
      </div>
      <CopyButton
        action={() => navigator.clipboard.writeText(copyText)}
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
  const searchInput = useRef<HTMLInputElement>(null);
  const [palettes, setPalettes] = useState<readonly ColorPalette[]>(colorPalettes);
  const [collections, setCollections] = useState<readonly ColorCollection[]>(colorCollections);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<readonly string[]>([]);
  const [selectedKinds, setSelectedKinds] = useState<readonly ColorPaletteKind[]>(['solid']);
  const [renderedPaletteCount, setRenderedPaletteCount] = useState(COLOR_PALETTE_BATCH_SIZE);
  const paletteSentinelRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
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
    if (searchActive) searchInput.current?.focus();
  }, [searchActive]);

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
    <DiscoveryPageLayout
      kind="colors"
      header={null}
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
              return;
            }
            const collection = collections.find((candidate) => candidate.name === value);
            if (collection) toggleCollection(collection.id);
          }}
          onClearFilter={(groupId) => {
            if (groupId === 'color-types') setSelectedKinds(['solid']);
            if (groupId === 'color-collections') setSelectedCollectionIds([]);
          }}
          actions={(
            <Button
              label="Create post"
              variant="primary"
              onClick={() => navigate({
                name: 'color-create',
                ...(visiblePalettes[0] ? { paletteId: visiblePalettes[0].id } : {}),
              })}
            />
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
      beforeResults={(
        <>
          {searchActive ? (
            <section className="color-gallery__search-panel" aria-label="Palette search">
              <p className="color-gallery__count">
                {normalizedQuery
                  ? `${visiblePalettes.length} of ${typedPalettes.length} palettes`
                  : `${typedPalettes.length} palettes · ${typedPalettes.reduce((total, palette) => total + palette.cards.length, 0)} colors`}
              </p>
              <div className="color-gallery__search" role="search">
                <label htmlFor="color-gallery-search">Search the palette library</label>
                <div>
                  <input
                    id="color-gallery-search"
                    ref={searchInput}
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.currentTarget.value)}
                    placeholder="Search palette, color, or hex…"
                  />
                  <Button label="Done" variant="secondary" onClick={onSearchClose} />
                </div>
              </div>
            </section>
          ) : null}
          {selectedCollectionCards}
        </>
      )}
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
                />
              </article>
            )}
          </ViewportPaletteCard>
        ))}
      </div>
    </DiscoveryPageLayout>
  );
}
