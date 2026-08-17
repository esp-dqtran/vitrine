import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button, IconButton } from '@astryxdesign/core';
import {
  BoldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ItalicIcon,
  ListOrderedIcon,
  ListUnorderedIcon,
  UndoIcon,
} from '@storybook/icons';
import {
  defaultColorPalettes,
  type ColorPalette,
  type ColorPaletteCard,
} from '../../colorPalettes.ts';
import { fetchColorPalettes } from '../colorPalettesApi.ts';
import { navigate } from '../router.ts';
import {
  AstryxDropdown,
  AstryxDropdownItem,
  AstryxSingleSelectDropdown,
} from './AstryxDropdown.tsx';
import { useCopyAction } from './CopyButton.tsx';
import { trackAnalyticsEvent } from '../analytics.ts';
import { analyticsEvent, paletteAnalyticsProperties } from '../analyticsEvents.ts';

const POST_WIDTH = 1080;
const POST_HEIGHT = 1350;
const DEFAULT_TEXT = 'Color sets the mood before a single word is read.';

export function parseFontSizeDraft(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 18 || parsed > 180) return null;
  return Math.round(parsed);
}

export function normalizeFontSizeDraft(value: string, fallback: number) {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(clamp(parsed, 18, 180));
}

export const fontOptions = [
  { label: 'Figtree', value: 'Figtree' },
  { label: 'Bricolage Grotesque', value: 'Bricolage Grotesque Variable' },
  { label: 'Instrument Serif', value: 'Instrument Serif' },
  { label: 'Unbounded', value: 'Unbounded Variable' },
  { label: 'Fraunces', value: 'Fraunces Variable' },
] as const;

export const canvasTemplateOptions = [
  { label: 'Halo Frame', value: 'halo-frame' },
  { label: 'Editorial Edge', value: 'editorial-edge' },
  { label: 'Center Stage', value: 'center-stage' },
] as const;

const fontWeightOptions = [
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra bold', value: '800' },
] as const;

type PostAlignment = 'left' | 'center' | 'right';
type PostFontWeight = 400 | 500 | 600 | 700 | 800;
type PostFontStyle = 'normal' | 'italic';
type PostListStyle = 'none' | 'unordered' | 'ordered';
export type CanvasTemplateId = typeof canvasTemplateOptions[number]['value'];

export interface PostTextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: PostFontWeight;
  fontStyle: PostFontStyle;
  listStyle: PostListStyle;
  alignment: PostAlignment;
  color: string;
}

export interface ColorPostDocument {
  backgroundId: string;
  templateId: CanvasTemplateId;
  eventThemeId?: string;
  layers: readonly PostTextLayer[];
}

export interface CanvasEventTheme {
  id: string;
  name: string;
  date: string;
  category: string;
  note: string;
  templateId: CanvasTemplateId;
  fontFamily: string;
  themeStyle: 'contact-sheet' | 'darkroom' | 'horizon' | 'premiere' | 'peace';
  palette: ColorPalette;
}

interface EditorHistory {
  past: readonly ColorPostDocument[];
  present: ColorPostDocument;
  future: readonly ColorPostDocument[];
}

interface DragState {
  layerId: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  stageWidth: number;
  stageHeight: number;
}

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) ?? [0, 0, 0];
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveCanvasColorRoles(
  palette: ColorPalette,
  backgroundId = palette.cards[0].id,
) {
  const background = palette.cards.find((card) => card.id === backgroundId)
    ?? palette.cards[0];
  const remaining = palette.cards.filter((card) => card.id !== background.id);
  const text = [...remaining].sort((first, second) => (
    contrastRatio(second.hex, background.hex) - contrastRatio(first.hex, background.hex)
  ))[0] ?? background;
  const border = remaining.find((card) => card.id !== text.id) ?? text;
  return { background, text, border };
}

const templateLayerStyles: Record<CanvasTemplateId, Record<string, Partial<PostTextLayer>>> = {
  'halo-frame': {
    'palette-name': { x: 92, y: 92, width: 720, fontSize: 28, alignment: 'left' },
    heading: {
      x: 92,
      y: 420,
      width: 820,
      fontSize: 88,
      fontFamily: 'Instrument Serif',
      fontWeight: 400,
      alignment: 'left',
    },
  },
  'editorial-edge': {
    'palette-name': { x: 112, y: 108, width: 760, fontSize: 26, alignment: 'left' },
    heading: {
      x: 112,
      y: 330,
      width: 790,
      fontSize: 74,
      fontFamily: 'Unbounded Variable',
      fontWeight: 600,
      alignment: 'left',
    },
  },
  'center-stage': {
    'palette-name': { x: 180, y: 220, width: 720, fontSize: 24, alignment: 'center' },
    heading: {
      x: 180,
      y: 500,
      width: 720,
      fontSize: 78,
      fontFamily: 'Fraunces Variable',
      fontWeight: 600,
      alignment: 'center',
    },
  },
};

type EventColorSeed = readonly [name: string, hex: string, foreground: string];

interface EventThemeSeed extends Omit<CanvasEventTheme, 'palette'> {
  paletteName: string;
  paletteMood: string;
  colors: readonly [EventColorSeed, EventColorSeed, EventColorSeed];
}

const eventPaletteRoles = ['lead', 'accent', 'companion'] as const;

function createEventTheme(seed: EventThemeSeed): CanvasEventTheme {
  const { paletteName, paletteMood, colors, ...theme } = seed;
  return {
    ...theme,
    palette: {
      id: `event-${seed.id.replace(/-2026$/, '')}`,
      name: paletteName,
      mood: paletteMood,
      cards: colors.map(([name, hex, foreground], index) => ({
        id: `${seed.id}-color-${index + 1}`,
        name,
        hex,
        color: hex,
        foreground,
        role: eventPaletteRoles[index],
      })),
    },
  };
}

export const eventThemePresets: readonly CanvasEventTheme[] = [
  createEventTheme({
    id: 'world-photography-day-2026', name: 'World Photography Day', date: '2026-08-19',
    category: 'Creative culture', note: 'A darkroom-inspired editorial layout with a sharp signal border and bold display type.',
    templateId: 'editorial-edge', fontFamily: 'Unbounded Variable', themeStyle: 'contact-sheet',
    paletteName: 'Darkroom Signal', paletteMood: 'High-contrast editorial color for photography-led posts',
    colors: [['Darkroom Black', '#0B0B0C', '#F4F1EA'], ['Shutter Red', '#D94C3D', '#0B0B0C'], ['Print Paper', '#F4F1EA', '#0B0B0C']],
  }),
  createEventTheme({
    id: 'world-humanitarian-day-2026', name: 'World Humanitarian Day', date: '2026-08-19',
    category: 'Humanitarian', note: 'A direct, humane composition balancing crisis-blue depth with an urgent coral signal.',
    templateId: 'editorial-edge', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'darkroom',
    paletteName: 'Aid Signal', paletteMood: 'Clear humanitarian urgency with a warm human center',
    colors: [['Relief Navy', '#14213D', '#F9F5EA'], ['Human Coral', '#E76F51', '#14213D'], ['Shelter Paper', '#F9F5EA', '#14213D']],
  }),
  createEventTheme({
    id: 'victims-of-terrorism-day-2026', name: 'Victims of Terrorism Remembrance', date: '2026-08-21',
    category: 'Remembrance', note: 'A restrained memorial composition built around dignity, solidarity, and quiet light.',
    templateId: 'halo-frame', fontFamily: 'Instrument Serif', themeStyle: 'peace',
    paletteName: 'Remembrance Light', paletteMood: 'Somber depth held by a steady warm light',
    colors: [['Memorial Ink', '#161A2B', '#F3E9DC'], ['Ribbon Red', '#A33A46', '#F3E9DC'], ['Candle Paper', '#F3E9DC', '#161A2B']],
  }),
  createEventTheme({
    id: 'religious-violence-victims-day-2026', name: 'Victims of Religious Violence', date: '2026-08-22',
    category: 'Human rights', note: 'A respectful theme for messages of remembrance, belief, and shared human dignity.',
    templateId: 'halo-frame', fontFamily: 'Instrument Serif', themeStyle: 'peace',
    paletteName: 'Common Ground', paletteMood: 'Contemplative violet grounded by neutral warmth',
    colors: [['Quiet Ink', '#24212B', '#F3EDE2'], ['Vigil Violet', '#7B6AA8', '#F3EDE2'], ['Common Light', '#F3EDE2', '#24212B']],
  }),
  createEventTheme({
    id: 'slave-trade-remembrance-day-2026', name: 'Slave Trade Remembrance Day', date: '2026-08-23',
    category: 'History and remembrance', note: 'An archival composition honoring memory, resistance, and the long movement toward freedom.',
    templateId: 'editorial-edge', fontFamily: 'Fraunces Variable', themeStyle: 'premiere',
    paletteName: 'Freedom Archive', paletteMood: 'Historic earth tones with an enduring paper light',
    colors: [['Archive Ink', '#221A17', '#E8D5B5'], ['Resistance Clay', '#A45C40', '#221A17'], ['Freedom Paper', '#E8D5B5', '#221A17']],
  }),
  createEventTheme({
    id: 'world-lake-day-2026', name: 'World Lake Day', date: '2026-08-27',
    category: 'Nature', note: 'A calm horizon treatment using deep water, mist, and a clear aqua border.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'horizon',
    paletteName: 'Lake Horizon', paletteMood: 'Still water and open-air clarity',
    colors: [['Lake Depth', '#123442', '#E8F3EE'], ['Waterline', '#63A7A4', '#123442'], ['Morning Mist', '#E8F3EE', '#123442']],
  }),
  createEventTheme({
    id: 'nuclear-tests-day-2026', name: 'Day Against Nuclear Tests', date: '2026-08-29',
    category: 'Peace and security', note: 'A high-contrast campaign theme for prevention, accountability, and a safer shared future.',
    templateId: 'editorial-edge', fontFamily: 'Unbounded Variable', themeStyle: 'darkroom',
    paletteName: 'Test Ban Signal', paletteMood: 'Caution gold cutting through a stark neutral field',
    colors: [['Ground Zero', '#141414', '#F2EFE7'], ['Caution Gold', '#E3B341', '#141414'], ['Clear Future', '#F2EFE7', '#141414']],
  }),
  createEventTheme({
    id: 'enforced-disappearances-day-2026', name: 'Victims of Enforced Disappearances', date: '2026-08-30',
    category: 'Human rights', note: 'A quiet presence-and-absence composition for truth, memory, and the right to be found.',
    templateId: 'halo-frame', fontFamily: 'Instrument Serif', themeStyle: 'peace',
    paletteName: 'Absent Presence', paletteMood: 'Muted graphite and searching light',
    colors: [['Missing Ink', '#1B1D24', '#E9E5DA'], ['Search Grey', '#5A6478', '#E9E5DA'], ['Return Light', '#E9E5DA', '#1B1D24']],
  }),
  createEventTheme({
    id: 'african-descent-day-2026', name: 'International Day for People of African Descent', date: '2026-08-31',
    category: 'Culture and equality', note: 'A warm editorial theme celebrating heritage, contribution, justice, and global connection.',
    templateId: 'editorial-edge', fontFamily: 'Fraunces Variable', themeStyle: 'premiere',
    paletteName: 'Diaspora Gold', paletteMood: 'Deep umber lifted by copper and heritage gold',
    colors: [['Heritage Ink', '#1F1512', '#F0D4A4'], ['Diaspora Copper', '#B56A3C', '#1F1512'], ['Legacy Gold', '#F0D4A4', '#1F1512']],
  }),
  createEventTheme({
    id: 'venice-film-festival-2026', name: 'Venice Film Festival', date: '2026-09-02',
    category: 'Film', note: 'A cinematic title-card composition with lagoon navy, warm paper, and premiere gold.',
    templateId: 'center-stage', fontFamily: 'Fraunces Variable', themeStyle: 'premiere',
    paletteName: 'Lido Premiere', paletteMood: 'Cinematic evening color with a formal gold frame',
    colors: [['Lagoon Night', '#101B2B', '#F7E7C6'], ['Premiere Gold', '#B98A42', '#101B2B'], ['Screen Light', '#F7E7C6', '#101B2B']],
  }),
  createEventTheme({
    id: 'charity-day-2026', name: 'International Day of Charity', date: '2026-09-05',
    category: 'Community', note: 'A warm, generous composition designed for giving campaigns and community-led action.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'peace',
    paletteName: 'Generous Light', paletteMood: 'Grounded green with a warm giving glow',
    colors: [['Community Ink', '#24352B', '#F8E8CF'], ['Giving Coral', '#D97B5D', '#24352B'], ['Open Hand', '#F8E8CF', '#24352B']],
  }),
  createEventTheme({
    id: 'clean-air-day-2026', name: 'Clean Air for Blue Skies Day', date: '2026-09-07',
    category: 'Climate', note: 'An airy horizon theme for clean-air awareness, public health, and climate action.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'horizon',
    paletteName: 'Open Atmosphere', paletteMood: 'Cool air moving from deep sky to cloud light',
    colors: [['Sky Depth', '#173447', '#EAF5F5'], ['Clean Current', '#6FB7C7', '#173447'], ['Cloud Breath', '#EAF5F5', '#173447']],
  }),
  createEventTheme({
    id: 'literacy-day-2026', name: 'International Literacy Day', date: '2026-09-08',
    category: 'Education', note: 'An expressive editorial theme celebrating reading, learning, and access to knowledge.',
    templateId: 'editorial-edge', fontFamily: 'Fraunces Variable', themeStyle: 'premiere',
    paletteName: 'Living Page', paletteMood: 'Inky plum with a vivid margin note and warm paper',
    colors: [['Book Ink', '#2B1C34', '#F4E8D8'], ['Margin Rose', '#B85C84', '#F4E8D8'], ['Page Light', '#F4E8D8', '#2B1C34']],
  }),
  createEventTheme({
    id: 'democracy-day-2026', name: 'International Day of Democracy', date: '2026-09-15',
    category: 'Civic life', note: 'A centered civic composition for participation, institutions, and public voice.',
    templateId: 'center-stage', fontFamily: 'Unbounded Variable', themeStyle: 'premiere',
    paletteName: 'Civic Voice', paletteMood: 'Institutional blue balanced by public-square gold',
    colors: [['Civic Blue', '#142B45', '#F5F1E8'], ['Public Gold', '#D5A94D', '#142B45'], ['Ballot Paper', '#F5F1E8', '#142B45']],
  }),
  createEventTheme({
    id: 'patient-safety-day-2026', name: 'World Patient Safety Day', date: '2026-09-17',
    category: 'Health', note: 'A reassuring healthcare theme focused on trust, precision, and safer care for everyone.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'horizon',
    paletteName: 'Care Signal', paletteMood: 'Clinical teal softened by a calm restorative light',
    colors: [['Care Depth', '#11363A', '#E8F4EF'], ['Safety Teal', '#43A39A', '#11363A'], ['Recovery Light', '#E8F4EF', '#11363A']],
  }),
  createEventTheme({
    id: 'world-cleanup-day-2026', name: 'World Cleanup Day', date: '2026-09-20',
    category: 'Environment', note: 'A fresh, grounded theme for collective cleanup action and environmental renewal.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'horizon',
    paletteName: 'Renewal Earth', paletteMood: 'Forest depth lifted by new-growth green',
    colors: [['Forest Floor', '#173226', '#EFE7D0'], ['New Growth', '#71A65B', '#173226'], ['Clean Canvas', '#EFE7D0', '#173226']],
  }),
  createEventTheme({
    id: 'international-day-of-peace-2026', name: 'International Day of Peace', date: '2026-09-21',
    category: 'Global observance', note: 'An open, quiet composition with soft sky, grounded ink, and a restrained olive frame.',
    templateId: 'halo-frame', fontFamily: 'Bricolage Grotesque Variable', themeStyle: 'peace',
    paletteName: 'Peaceful Sky', paletteMood: 'Open-air calm with grounded natural contrast',
    colors: [['Sky Wash', '#DCECF2', '#17324A'], ['Olive Branch', '#6E8B74', '#102B22'], ['Peace Ink', '#17324A', '#DCECF2']],
  }),
  createEventTheme({
    id: 'sign-languages-day-2026', name: 'International Day of Sign Languages', date: '2026-09-23',
    category: 'Language and inclusion', note: 'A bold visual-language theme celebrating expression, access, and Deaf culture.',
    templateId: 'editorial-edge', fontFamily: 'Unbounded Variable', themeStyle: 'premiere',
    paletteName: 'Hand Signal', paletteMood: 'Confident indigo with a clear expressive accent',
    colors: [['Gesture Ink', '#1E2340', '#F6E8D7'], ['Signal Coral', '#E56B6F', '#1E2340'], ['Open Light', '#F6E8D7', '#1E2340']],
  }),
  createEventTheme({
    id: 'tourism-day-2026', name: 'World Tourism Day', date: '2026-09-27',
    category: 'Travel and culture', note: 'A cinematic horizon theme for place, exchange, discovery, and responsible travel.',
    templateId: 'center-stage', fontFamily: 'Fraunces Variable', themeStyle: 'horizon',
    paletteName: 'Far Horizon', paletteMood: 'Deep destination blue warmed by late-day amber',
    colors: [['Journey Blue', '#15344A', '#F5E7C6'], ['Sunset Marker', '#E49B45', '#15344A'], ['Map Linen', '#F5E7C6', '#15344A']],
  }),
  createEventTheme({
    id: 'translation-day-2026', name: 'International Translation Day', date: '2026-09-30',
    category: 'Language and culture', note: 'An editorial theme for language bridges, interpretation, and ideas moving across borders.',
    templateId: 'editorial-edge', fontFamily: 'Fraunces Variable', themeStyle: 'premiere',
    paletteName: 'Shared Language', paletteMood: 'Deep violet connected by a luminous interpretive accent',
    colors: [['Source Ink', '#251A36', '#F0E6D2'], ['Bridge Violet', '#8A5CC2', '#F0E6D2'], ['Meaning Paper', '#F0E6D2', '#251A36']],
  }),
];

function parseCalendarDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function calendarDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function moveCalendarDate(value: string, days: number) {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDateKey(date);
}

export function buildEventCalendarDays(startDate: string, count = 11) {
  return Array.from({ length: count }, (_, index) => {
    const date = parseCalendarDate(moveCalendarDate(startDate, index));
    return {
      key: calendarDateKey(date),
      weekday: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(date),
      day: new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'UTC' }).format(date),
      month: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date),
    };
  });
}

export function applyEventThemeToDocument(
  document: ColorPostDocument,
  eventTheme: CanvasEventTheme,
) {
  const roles = resolveCanvasColorRoles(eventTheme.palette);
  const themedDocument = applyCanvasTemplate({
    ...document,
    backgroundId: roles.background.id,
    layers: document.layers.map((layer) => ({
      ...layer,
      ...(layer.id === 'palette-name' ? { text: eventTheme.name } : {}),
    })),
  }, eventTheme.templateId, roles.text.hex);

  return {
    ...themedDocument,
    eventThemeId: eventTheme.id,
    layers: themedDocument.layers.map((layer) => layer.id === 'heading'
      ? { ...layer, fontFamily: eventTheme.fontFamily }
      : layer),
  };
}

export function applyCanvasTemplate(
  document: ColorPostDocument,
  templateId: CanvasTemplateId,
  textColor: string,
): ColorPostDocument {
  const layerStyles = templateLayerStyles[templateId];
  return {
    ...document,
    templateId,
    layers: document.layers.map((layer) => ({
      ...layer,
      ...(layerStyles[layer.id] ?? {}),
      color: textColor,
    })),
  };
}

export function createInitialPostDocument(palette: ColorPalette): ColorPostDocument {
  const roles = resolveCanvasColorRoles(palette);
  return {
    backgroundId: roles.background.id,
    templateId: 'halo-frame',
    layers: [
      {
        id: 'palette-name',
        name: 'Palette name',
        text: palette.name,
        x: 92,
        y: 92,
        width: 720,
        fontSize: 28,
        fontFamily: 'Figtree',
        fontWeight: 600,
        fontStyle: 'normal',
        listStyle: 'none',
        alignment: 'left',
        color: roles.text.hex,
      },
      {
        id: 'heading',
        name: 'Heading',
        text: DEFAULT_TEXT,
        x: 92,
        y: 420,
        width: 820,
        fontSize: 88,
        fontFamily: 'Instrument Serif',
        fontWeight: 400,
        fontStyle: 'normal',
        listStyle: 'none',
        alignment: 'left',
        color: roles.text.hex,
      },
    ],
  };
}

export function wrapCanvasText(
  text: string,
  maxWidth: number,
  measure: (value: string) => TextMetrics,
) {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    if (!words.length || paragraphIndex < paragraphs.length - 1) lines.push('');
  });
  return lines;
}

export function getTextListItems(text: string) {
  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawTextLayer(context: CanvasRenderingContext2D, layer: PostTextLayer) {
  context.fillStyle = layer.color;
  context.textAlign = layer.alignment;
  context.textBaseline = 'top';
  context.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}, sans-serif`;
  const lineHeight = layer.fontSize * 1.08;

  if (layer.listStyle !== 'none') {
    context.textAlign = 'left';
    let y = layer.y;
    getTextListItems(layer.text).forEach((item, index) => {
      const marker = layer.listStyle === 'unordered' ? '•' : `${index + 1}.`;
      const markerGap = layer.fontSize * 0.28;
      const markerWidth = context.measureText(marker).width + markerGap;
      const lines = wrapCanvasText(
        item,
        layer.width - markerWidth,
        (value) => context.measureText(value),
      );
      context.fillText(marker, layer.x, y);
      lines.forEach((line, lineIndex) => {
        context.fillText(line, layer.x + markerWidth, y + lineIndex * lineHeight);
      });
      y += Math.max(1, lines.length) * lineHeight + layer.fontSize * 0.12;
    });
    return;
  }

  const x = layer.alignment === 'center'
    ? layer.x + layer.width / 2
    : layer.alignment === 'right'
      ? layer.x + layer.width
      : layer.x;
  const lines = wrapCanvasText(
    layer.text,
    layer.width,
    (value) => context.measureText(value),
  );
  lines.forEach((line, index) => {
    context.fillText(line, x, layer.y + index * lineHeight, layer.width);
  });
}

function strokeRoundedFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  lineWidth: number,
  color: string,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.stroke();
  context.restore();
}

function drawTemplateDecoration(
  context: CanvasRenderingContext2D,
  templateId: CanvasTemplateId,
  border: string,
) {
  context.save();
  context.fillStyle = border;
  if (templateId === 'halo-frame') {
    context.globalAlpha = 0.96;
    context.beginPath();
    context.arc(970, 90, 250, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(80, 1265, 310, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    strokeRoundedFrame(context, 42, 42, 996, 1266, 58, 10, border);
  } else if (templateId === 'editorial-edge') {
    context.fillRect(0, 0, POST_WIDTH, 30);
    context.fillRect(0, 0, 30, POST_HEIGHT);
    context.fillRect(0, POST_HEIGHT - 30, POST_WIDTH, 30);
    context.fillRect(POST_WIDTH - 12, 0, 12, POST_HEIGHT);
  } else {
    context.strokeStyle = border;
    context.lineWidth = 8;
    context.beginPath();
    context.arc(540, 710, 432, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = border;
    context.beginPath();
    context.arc(540, 710, 400, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawEventCanvasTheme(
  context: CanvasRenderingContext2D,
  eventTheme: CanvasEventTheme,
  border: string,
) {
  context.save();
  context.strokeStyle = border;
  context.fillStyle = border;

  if (eventTheme.themeStyle === 'contact-sheet') {
    context.globalAlpha = 0.24;
    context.lineWidth = 6;
    context.strokeRect(672, 102, 316, 236);
    context.beginPath();
    context.moveTo(830, 102);
    context.lineTo(830, 338);
    context.moveTo(672, 220);
    context.lineTo(988, 220);
    context.stroke();

    context.globalAlpha = 0.32;
    context.font = '600 18px Figtree, sans-serif';
    context.letterSpacing = '2px';
    context.fillText('ISO 400 · 1/125 · ƒ2.8', 672, 372);

    context.globalAlpha = 0.16;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(80, 80);
    context.lineTo(132, 80);
    context.moveTo(80, 80);
    context.lineTo(80, 132);
    context.moveTo(1000, 80);
    context.lineTo(948, 80);
    context.moveTo(1000, 80);
    context.lineTo(1000, 132);
    context.moveTo(80, 1270);
    context.lineTo(132, 1270);
    context.moveTo(80, 1270);
    context.lineTo(80, 1218);
    context.moveTo(1000, 1270);
    context.lineTo(948, 1270);
    context.moveTo(1000, 1270);
    context.lineTo(1000, 1218);
    context.stroke();

    context.globalAlpha = 0.2;
    context.fillRect(92, 1080, 896, 4);
    context.font = '600 16px Figtree, sans-serif';
    context.fillText('FRAME 36  ·  AUG 19  ·  CONTACT 01', 615, 1115);
    context.letterSpacing = '0px';
  } else if (eventTheme.themeStyle === 'darkroom') {
    context.globalAlpha = 0.18;
    context.lineWidth = 8;
    context.strokeRect(690, 120, 290, 220);
    context.beginPath();
    context.moveTo(835, 120);
    context.lineTo(835, 340);
    context.moveTo(690, 230);
    context.lineTo(980, 230);
    context.stroke();
    context.globalAlpha = 0.1;
    for (let index = 0; index < 5; index += 1) {
      context.beginPath();
      context.arc(740 + index * 58, 1015, 18, 0, Math.PI * 2);
      context.fill();
    }
  } else if (eventTheme.themeStyle === 'horizon') {
    context.globalAlpha = 0.14;
    context.beginPath();
    context.arc(835, 245, 108, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.2;
    context.lineWidth = 8;
    for (let index = 0; index < 4; index += 1) {
      const y = 850 + index * 62;
      context.beginPath();
      context.moveTo(70, y);
      context.bezierCurveTo(280, y - 52, 490, y + 52, 700, y);
      context.bezierCurveTo(840, y - 34, 950, y + 18, 1010, y);
      context.stroke();
    }
  } else if (eventTheme.themeStyle === 'premiere') {
    context.globalAlpha = 0.2;
    context.fillRect(0, 92, POST_WIDTH, 18);
    context.fillRect(0, 1040, POST_WIDTH, 18);
    context.globalAlpha = 0.16;
    for (let index = 0; index < 10; index += 1) {
      roundedRect(context, 45, 150 + index * 84, 30, 48, 8);
      roundedRect(context, POST_WIDTH - 75, 150 + index * 84, 30, 48, 8);
    }
  } else {
    context.globalAlpha = 0.14;
    context.lineWidth = 10;
    [110, 185, 260].forEach((radius) => {
      context.beginPath();
      context.arc(830, 285, radius, Math.PI * 0.1, Math.PI * 1.9);
      context.stroke();
    });
    context.globalAlpha = 0.1;
    context.fillRect(92, 970, 896, 4);
  }
  context.restore();
}

export function renderColorPostCanvas(
  canvas: HTMLCanvasElement,
  palette: ColorPalette,
  document: ColorPostDocument,
) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image rendering is not supported in this browser');
  const roles = resolveCanvasColorRoles(palette, document.backgroundId);

  canvas.width = POST_WIDTH;
  canvas.height = POST_HEIGHT;
  context.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  context.fillStyle = roles.background.hex;
  context.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  drawTemplateDecoration(
    context,
    document.templateId,
    roles.border.hex,
  );

  const eventTheme = eventThemePresets.find((candidate) => candidate.id === document.eventThemeId);
  if (eventTheme) drawEventCanvasTheme(context, eventTheme, roles.border.hex);

  document.layers.forEach((layer) => drawTextLayer(context, layer));
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create the post image'));
    }, 'image/png');
  });
}

async function copyCanvasImage(canvas: HTMLCanvasElement) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image copying is not available in this browser.');
  }
  const blob = await canvasToBlob(canvas);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function layerStyle(layer: PostTextLayer): CSSProperties {
  return {
    '--layer-x': `${(layer.x / POST_WIDTH) * 100}%`,
    '--layer-y': `${(layer.y / POST_HEIGHT) * 100}%`,
    '--layer-width': `${(layer.width / POST_WIDTH) * 100}%`,
    '--layer-font-size': `${layer.fontSize / 10.8}cqw`,
    '--layer-color': layer.color,
    '--layer-font-family': `${layer.fontFamily}, sans-serif`,
    '--layer-font-weight': layer.fontWeight,
    '--layer-font-style': layer.fontStyle,
    '--layer-text-align': layer.alignment,
  } as CSSProperties;
}

export function PaletteDots({ palette }: { palette: ColorPalette }) {
  return (
    <span className="color-post-editor__palette-dots" aria-hidden="true">
      {palette.cards.map((card) => (
        <span key={card.id} style={{ background: card.hex }} />
      ))}
    </span>
  );
}

export function EventCanvasTheme({ themeStyle }: { themeStyle: CanvasEventTheme['themeStyle'] }) {
  return (
    <span
      className={`color-post-editor__event-canvas-theme color-post-editor__event-canvas-theme--${themeStyle}`}
      aria-hidden="true"
    >
      {themeStyle === 'contact-sheet' ? (
        <span className="color-post-editor__contact-metadata">
          ISO 400 · 1/125 · ƒ2.8
        </span>
      ) : null}
    </span>
  );
}

function replaceEditableText(
  editor: HTMLDivElement,
  text: string,
  listStyle: PostListStyle,
) {
  if (listStyle === 'none') {
    editor.textContent = text;
    return;
  }

  const list = editor.ownerDocument.createElement(listStyle === 'ordered' ? 'ol' : 'ul');
  getTextListItems(text).forEach((item) => {
    const listItem = editor.ownerDocument.createElement('li');
    listItem.textContent = item;
    list.append(listItem);
  });
  editor.replaceChildren(list);
}

function EditablePostText({
  layer,
  onEditStart,
  onEditEnd,
  onTextChange,
}: {
  layer: PostTextLayer;
  onEditStart: () => void;
  onEditEnd: () => void;
  onTextChange: (text: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialContent = useRef({ text: layer.text, listStyle: layer.listStyle });

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const firstChildTag = editor.firstElementChild?.tagName.toLowerCase();
    const hasExpectedStructure = layer.listStyle === 'none'
      ? firstChildTag !== 'ul' && firstChildTag !== 'ol'
      : firstChildTag === (layer.listStyle === 'ordered' ? 'ol' : 'ul');

    // The browser owns this DOM while the user types. If React replaced its
    // children on every input, the browser selection would jump to offset 0.
    if (hasExpectedStructure && editor.innerText === layer.text) return;
    replaceEditableText(editor, layer.text, layer.listStyle);
  }, [layer.listStyle, layer.text]);

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-label={`Edit ${layer.name}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-gramm="false"
      data-gramm_editor="false"
      onFocus={onEditStart}
      onBlur={onEditEnd}
      onInput={(event) => onTextChange(event.currentTarget.innerText.slice(0, 280))}
    >
      {initialContent.current.listStyle === 'unordered' ? (
        <ul>{getTextListItems(initialContent.current.text).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      ) : initialContent.current.listStyle === 'ordered' ? (
        <ol>{getTextListItems(initialContent.current.text).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
      ) : initialContent.current.text}
    </div>
  );
}

export function ColorPostStudioPage({
  initialPaletteId,
}: {
  initialPaletteId?: string;
}) {
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const editingLayerRef = useRef<string | null>(null);
  const pendingFocusLayerRef = useRef<string | null>(null);
  const [palettes, setPalettes] = useState<readonly ColorPalette[]>(defaultColorPalettes);
  const initialPalette = defaultColorPalettes.find((palette) => palette.id === initialPaletteId)
    ?? defaultColorPalettes[0];
  const [paletteId, setPaletteId] = useState(initialPalette.id);
  const [history, setHistory] = useState<EditorHistory>({
    past: [],
    present: createInitialPostDocument(initialPalette),
    future: [],
  });
  const [selectedLayerId, setSelectedLayerId] = useState('heading');
  const [fontSizeDraft, setFontSizeDraft] = useState('88');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [paletteDropdownOpen, setPaletteDropdownOpen] = useState(false);
  const [calendarStart, setCalendarStart] = useState('2026-08-17');
  const [selectedEventId, setSelectedEventId] = useState(eventThemePresets[0].id);
  const palette = palettes.find((candidate) => candidate.id === paletteId) ?? palettes[0];
  const document = history.present;
  const calendarDays = buildEventCalendarDays(calendarStart);
  const eventThemesByDate = eventThemePresets.reduce((themesByDate, eventTheme) => {
    const themes = themesByDate.get(eventTheme.date) ?? [];
    themesByDate.set(eventTheme.date, [...themes, eventTheme]);
    return themesByDate;
  }, new Map<string, CanvasEventTheme[]>());
  const visibleDateKeys = new Set(calendarDays.map((day) => day.key));
  const selectedEvent = eventThemePresets.find((eventTheme) => (
    eventTheme.id === selectedEventId && visibleDateKeys.has(eventTheme.date)
  )) ?? null;
  const selectedDateEvents = selectedEvent
    ? eventThemesByDate.get(selectedEvent.date) ?? []
    : [];
  const activeEventTheme = eventThemePresets.find(
    (eventTheme) => eventTheme.id === document.eventThemeId,
  ) ?? null;
  const colorRoles = resolveCanvasColorRoles(palette, document.backgroundId);
  const background = colorRoles.background;
  const selectedLayer = document.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const textColorOptions = useMemo(() => Array.from(new Set([
    colorRoles.text.hex,
    ...palette.cards.map((card) => card.hex),
    '#FFFFFF',
    '#151311',
  ])), [colorRoles.text.hex, palette.cards]);

  const { copy: copyImage, state: copyState } = useCopyAction({
    action: async () => {
      if (!exportCanvasRef.current) throw new Error('The post image is not ready');
      await renderColorPostCanvas(exportCanvasRef.current, palette, document);
      await copyCanvasImage(exportCanvasRef.current);
      trackAnalyticsEvent(analyticsEvent.colorPostImageCopied, paletteAnalyticsProperties(palette));
    },
    successMessage: 'Image copied. Paste it into your social post.',
  });

  useEffect(() => {
    trackAnalyticsEvent(analyticsEvent.colorPostEditorOpened, paletteAnalyticsProperties(initialPalette));
  }, [initialPalette]);

  const commit = (transform: (current: ColorPostDocument) => ColorPostDocument) => {
    setHistory((current) => ({
      past: [...current.past, current.present].slice(-50),
      present: transform(current.present),
      future: [],
    }));
  };

  const updateLayer = (
    layerId: string,
    patch: Partial<PostTextLayer>,
    record = true,
  ) => {
    const transform = (current: ColorPostDocument): ColorPostDocument => ({
      ...current,
      layers: current.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer),
    });
    if (record) commit(transform);
    else setHistory((current) => ({ ...current, present: transform(current.present) }));
  };

  const checkpoint = () => {
    setHistory((current) => ({
      past: [...current.past, current.present].slice(-50),
      present: current.present,
      future: [],
    }));
  };

  const undo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchColorPalettes(controller.signal)
      .then((items) => {
        if (!items.length) return;
        setPalettes((current) => [
          ...items,
          ...current.filter((palette) => (
            palette.id.startsWith('event-')
            && !items.some((item) => item.id === palette.id)
          )),
        ]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const draw = async () => {
      if (exportCanvasRef.current) {
        await renderColorPostCanvas(exportCanvasRef.current, palette, document);
      }
    };
    void draw();
    void globalThis.document.fonts?.ready.then(() => draw());
  }, [document, palette]);

  useEffect(() => {
    if (!drag) return undefined;
    const move = (event: PointerEvent) => {
      const nextX = drag.originX
        + ((event.clientX - drag.startClientX) / drag.stageWidth) * POST_WIDTH;
      const nextY = drag.originY
        + ((event.clientY - drag.startClientY) / drag.stageHeight) * POST_HEIGHT;
      const layer = history.present.layers.find((candidate) => candidate.id === drag.layerId);
      if (!layer) return;
      updateLayer(drag.layerId, {
        x: Math.round(clamp(nextX, 24, POST_WIDTH - layer.width - 24)),
        y: Math.round(clamp(nextY, 24, POST_HEIGHT - layer.fontSize * 1.2 - 24)),
      }, false);
    };
    const finish = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
  }, [drag, history.present.layers]);

  const selectPalette = (nextPaletteId: string) => {
    const next = palettes.find((candidate) => candidate.id === nextPaletteId);
    if (!next) return;
    const nextRoles = resolveCanvasColorRoles(next);
    setPaletteId(next.id);
    commit((current) => ({
      ...current,
      backgroundId: nextRoles.background.id,
      eventThemeId: undefined,
      layers: current.layers.map((layer) => ({
        ...layer,
        color: nextRoles.text.hex,
        ...(layer.id === 'palette-name' ? { text: next.name } : {}),
      })),
    }));
  };

  const selectBackground = (card: ColorPaletteCard) => {
    commit((current) => {
      const previousRoles = resolveCanvasColorRoles(palette, current.backgroundId);
      const nextRoles = resolveCanvasColorRoles(palette, card.id);
      return {
        ...current,
        backgroundId: card.id,
        layers: current.layers.map((layer) => ({
          ...layer,
          color: layer.color === previousRoles.text.hex ? nextRoles.text.hex : layer.color,
        })),
      };
    });
  };

  const selectTemplate = (templateId: string) => {
    commit((current) => applyCanvasTemplate(
      current,
      templateId as CanvasTemplateId,
      resolveCanvasColorRoles(palette, current.backgroundId).text.hex,
    ));
  };

  const applyEventTheme = (eventTheme: CanvasEventTheme) => {
    setPalettes((current) => current.some((item) => item.id === eventTheme.palette.id)
      ? current
      : [...current, eventTheme.palette]);
    setPaletteId(eventTheme.palette.id);
    commit((current) => applyEventThemeToDocument(current, eventTheme));
    trackAnalyticsEvent(analyticsEvent.colorPostThemeApplied, {
      ...paletteAnalyticsProperties(eventTheme.palette),
      theme_id: eventTheme.id,
    });
  };

  const changeCalendarRange = (days: number) => {
    const nextStart = moveCalendarDate(calendarStart, days);
    const visibleDates = new Set(buildEventCalendarDays(nextStart).map((day) => day.key));
    const firstVisibleEvent = eventThemePresets.find((eventTheme) => visibleDates.has(eventTheme.date));
    setCalendarStart(nextStart);
    setSelectedEventId(firstVisibleEvent?.id ?? '');
  };

  const addTextLayer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.color-post-editor__text-layer, .color-post-editor__text-toolbar')) return;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const id = `text-${Date.now()}`;
    const width = 640;
    const canvasX = ((event.clientX - bounds.left) / bounds.width) * POST_WIDTH;
    const canvasY = ((event.clientY - bounds.top) / bounds.height) * POST_HEIGHT;
    commit((current) => ({
      ...current,
      layers: [...current.layers, {
        id,
        name: `Text ${current.layers.length + 1}`,
        text: 'Type something',
        x: Math.round(clamp(canvasX, 24, POST_WIDTH - width - 24)),
        y: Math.round(clamp(canvasY, 24, POST_HEIGHT - 100)),
        width,
        fontSize: 58,
        fontFamily: 'Figtree',
        fontWeight: 600,
        fontStyle: 'normal',
        listStyle: 'none',
        alignment: 'left',
        color: colorRoles.text.hex,
      }],
    }));
    pendingFocusLayerRef.current = id;
    setSelectedLayerId(id);
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const id = `text-${Date.now()}`;
    commit((current) => ({
      ...current,
      layers: [...current.layers, {
        ...selectedLayer,
        id,
        name: `${selectedLayer.name} copy`,
        x: clamp(selectedLayer.x + 36, 24, POST_WIDTH - selectedLayer.width - 24),
        y: clamp(selectedLayer.y + 36, 24, POST_HEIGHT - selectedLayer.fontSize - 24),
      }],
    }));
    setSelectedLayerId(id);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    const remaining = document.layers.filter((layer) => layer.id !== selectedLayer.id);
    commit((current) => ({ ...current, layers: remaining }));
    setSelectedLayerId(remaining.at(-1)?.id ?? '');
  };

  const startDrag = (event: ReactPointerEvent, layer: PostTextLayer) => {
    event.preventDefault();
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setSelectedLayerId(layer.id);
    checkpoint();
    setDrag({
      layerId: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: layer.x,
      originY: layer.y,
      stageWidth: bounds.width,
      stageHeight: bounds.height,
    });
  };

  useEffect(() => {
    if (pendingFocusLayerRef.current !== selectedLayerId) return;
    const editable = stageRef.current?.querySelector<HTMLElement>(
      `[data-layer-id="${selectedLayerId}"] [contenteditable="true"]`,
    );
    if (!editable) return;
    pendingFocusLayerRef.current = null;
    editable.focus();
    const range = globalThis.document.createRange();
    range.selectNodeContents(editable);
    const selection = globalThis.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [document.layers, selectedLayerId]);

  useEffect(() => {
    setFontSizeDraft(selectedLayer ? String(selectedLayer.fontSize) : '');
  }, [selectedLayerId, selectedLayer?.fontSize]);

  const clearTextSelection = () => {
    setSelectedLayerId('');
    const activeElement = globalThis.document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
  };

  const commitFontSizeDraft = () => {
    if (!selectedLayer) return;
    const fontSize = normalizeFontSizeDraft(fontSizeDraft, selectedLayer.fontSize);
    setFontSizeDraft(String(fontSize));
    if (fontSize !== selectedLayer.fontSize) {
      updateLayer(selectedLayer.id, { fontSize });
    }
  };

  return (
    <main
      className="color-post-editor"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.color-post-editor__text-layer, .color-post-editor__text-toolbar')) return;
        clearTextSelection();
      }}
    >
      <header className="color-post-editor__header">
        <button
          type="button"
          className="color-post-editor__back"
          onClick={() => navigate({ name: 'color' })}
        >
          ← Colors
        </button>
        <div className="color-post-editor__title">
          <strong>Post editor</strong>
          <span>1080 × 1350</span>
        </div>
        <div className="color-post-editor__actions">
          <Button
            label="Copy image"
            variant="primary"
            isLoading={copyState === 'copying'}
            isDisabled={copyState === 'copying'}
            onClick={() => void copyImage()}
          />
        </div>
      </header>

      <div className="color-post-editor__workspace">
        <section className="color-post-editor__center" aria-label="Post canvas editor">
          <section className="color-post-editor__event-calendar" aria-label="Event theme calendar">
            <header className="color-post-editor__event-calendar-header">
              <div>
                <span>Event themes</span>
                <strong>
                  {calendarDays[0].month} {calendarDays[0].day}–{calendarDays.at(-1)?.month} {calendarDays.at(-1)?.day}
                </strong>
              </div>
              <div className="color-post-editor__event-calendar-nav" aria-label="Change calendar dates">
                <IconButton
                  label="Previous dates"
                  tooltip="Previous dates"
                  icon={<ChevronLeftIcon />}
                  variant="ghost"
                  size="sm"
                  clickAction={() => changeCalendarRange(-7)}
                />
                <IconButton
                  label="Next dates"
                  tooltip="Next dates"
                  icon={<ChevronRightIcon />}
                  variant="ghost"
                  size="sm"
                  clickAction={() => changeCalendarRange(7)}
                />
              </div>
            </header>

            <div className="color-post-editor__event-days" role="list" aria-label="Event dates">
              {calendarDays.map((day) => {
                const dayEvents = eventThemesByDate.get(day.key) ?? [];
                const selected = selectedEvent?.date === day.key;
                return (
                  <button
                    type="button"
                    role="listitem"
                    key={day.key}
                    className={`color-post-editor__event-day${dayEvents.length ? ' has-event' : ''}${selected ? ' is-selected' : ''}`}
                    aria-label={dayEvents.length
                      ? `${day.weekday}, ${day.month} ${day.day}: ${dayEvents.map((eventTheme) => eventTheme.name).join(', ')}`
                      : `${day.weekday}, ${day.month} ${day.day}`}
                    aria-pressed={selected}
                    onClick={() => {
                      if (!dayEvents.length) return;
                      if (!dayEvents.some((eventTheme) => eventTheme.id === selectedEventId)) {
                        setSelectedEventId(dayEvents[0].id);
                      }
                    }}
                  >
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                    {dayEvents.length ? (
                      <span
                        className="color-post-editor__event-markers"
                        aria-label={`${dayEvents.length} event ${dayEvents.length === 1 ? 'theme' : 'themes'}`}
                      >
                        {dayEvents.slice(0, 3).map((eventTheme) => (
                          <i
                            key={eventTheme.id}
                            aria-hidden="true"
                            style={{ background: eventTheme.palette.cards[1].hex }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedEvent && selectedDateEvents.length > 1 ? (
              <div
                className="color-post-editor__event-picker"
                role="tablist"
                aria-label={`Events on ${selectedEvent.date}`}
              >
                {selectedDateEvents.map((eventTheme) => (
                  <button
                    type="button"
                    role="tab"
                    key={eventTheme.id}
                    aria-selected={eventTheme.id === selectedEvent.id}
                    onClick={() => setSelectedEventId(eventTheme.id)}
                  >
                    <i aria-hidden="true" style={{ background: eventTheme.palette.cards[1].hex }} />
                    {eventTheme.name}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedEvent ? (
              <article className="color-post-editor__event-note" aria-label={`${selectedEvent.name} template note`}>
                <PaletteDots palette={selectedEvent.palette} />
                <div className="color-post-editor__event-note-copy">
                  <span>{selectedEvent.category} · {selectedEvent.templateId.replace('-', ' ')}</span>
                  <strong>{selectedEvent.name}</strong>
                  <p>{selectedEvent.note}</p>
                </div>
                <Button
                  label="Use theme"
                  variant="secondary"
                  onClick={() => applyEventTheme(selectedEvent)}
                />
              </article>
            ) : null}
          </section>

          <div className="color-post-editor__toolbar" aria-label="Canvas formatting">
            <div className="color-post-editor__palette-control">
              <AstryxDropdown
                label={palette.name}
                ariaLabel={`Palette: ${palette.name}`}
                open={paletteDropdownOpen}
                triggerClassName="color-post-editor__palette-trigger"
                triggerIcon={<PaletteDots palette={palette} />}
                menuWidth={220}
                onOpenChange={setPaletteDropdownOpen}
              >
                {palettes.map((item) => (
                  <AstryxDropdownItem
                    key={item.id}
                    label={item.name}
                    icon={<PaletteDots palette={item} />}
                    selected={item.id === palette.id}
                    onSelect={() => {
                      selectPalette(item.id);
                      setPaletteDropdownOpen(false);
                    }}
                  />
                ))}
              </AstryxDropdown>
              <AstryxSingleSelectDropdown
                ariaLabel="Template"
                value={document.templateId}
                options={canvasTemplateOptions}
                triggerClassName="color-post-editor__template-trigger"
                menuWidth={176}
                onChange={selectTemplate}
              />
            </div>
            <div className="color-post-editor__backgrounds" aria-label="Background color">
              {palette.cards.map((card) => (
                <button
                  type="button"
                  key={card.id}
                  aria-label={`Use ${card.name} ${card.hex} as background`}
                  aria-pressed={card.id === background.id}
                  title={`${card.name} · ${card.hex}`}
                  style={{ background: card.hex }}
                  onClick={() => selectBackground(card)}
                />
              ))}
            </div>
            <div className="color-post-editor__canvas-history" aria-label="Canvas history">
              <IconButton
                label="Undo"
                tooltip="Undo"
                icon={<UndoIcon />}
                variant="ghost"
                size="sm"
                isDisabled={!history.past.length}
                clickAction={undo}
              />
              <IconButton
                label="Redo"
                tooltip="Redo"
                icon={<span className="color-post-editor__redo-icon"><UndoIcon /></span>}
                variant="ghost"
                size="sm"
                isDisabled={!history.future.length}
                clickAction={redo}
              />
            </div>
          </div>

          <p className="color-post-editor__canvas-hint">Double-click anywhere on the canvas to add text</p>

          <div className="color-post-editor__canvas-frame">
            {selectedLayer ? (
              <div
                className="color-post-editor__text-toolbar"
                aria-label={`Format ${selectedLayer.name}`}
                style={{
                  '--text-toolbar-x': `${(selectedLayer.x / POST_WIDTH) * 100}%`,
                  '--text-toolbar-y': `${(selectedLayer.y / POST_HEIGHT) * 100}%`,
                } as CSSProperties}
              >
                <button
                  type="button"
                  className="color-post-editor__drag-control"
                  aria-label={`Move ${selectedLayer.name}`}
                  title="Drag to move"
                  onPointerDown={(event) => startDrag(event, selectedLayer)}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <AstryxSingleSelectDropdown
                  ariaLabel="Font"
                  value={selectedLayer.fontFamily}
                  options={fontOptions}
                  triggerClassName="color-post-editor__font-control"
                  menuWidth={180}
                  onChange={(fontFamily) => updateLayer(selectedLayer.id, { fontFamily })}
                />
                <label className="color-post-editor__size-control">
                  <input
                    aria-label="Font size"
                    type="number"
                    min="18"
                    max="180"
                    value={fontSizeDraft}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setFontSizeDraft(value);
                      const fontSize = parseFontSizeDraft(value);
                      if (fontSize !== null && fontSize !== selectedLayer.fontSize) {
                        updateLayer(selectedLayer.id, { fontSize });
                      }
                    }}
                    onBlur={commitFontSizeDraft}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  <span>px</span>
                </label>
                <AstryxSingleSelectDropdown
                  ariaLabel="Font weight"
                  value={String(selectedLayer.fontWeight)}
                  options={fontWeightOptions}
                  triggerClassName="color-post-editor__weight-control"
                  menuWidth={140}
                  onChange={(fontWeight) => updateLayer(selectedLayer.id, {
                    fontWeight: Number(fontWeight) as PostFontWeight,
                  })}
                />
                <div className="color-post-editor__text-format" aria-label="Text style">
                  <button
                    type="button"
                    aria-label="Bold"
                    aria-pressed={selectedLayer.fontWeight >= 700}
                    title="Bold"
                    onClick={() => updateLayer(selectedLayer.id, {
                      fontWeight: selectedLayer.fontWeight >= 700 ? 400 : 700,
                    })}
                  >
                    <BoldIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Italic"
                    aria-pressed={selectedLayer.fontStyle === 'italic'}
                    title="Italic"
                    onClick={() => updateLayer(selectedLayer.id, {
                      fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic',
                    })}
                  >
                    <ItalicIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bulleted list"
                    aria-pressed={selectedLayer.listStyle === 'unordered'}
                    title="Bulleted list"
                    onClick={() => updateLayer(selectedLayer.id, {
                      listStyle: selectedLayer.listStyle === 'unordered' ? 'none' : 'unordered',
                      alignment: 'left',
                    })}
                  >
                    <ListUnorderedIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Numbered list"
                    aria-pressed={selectedLayer.listStyle === 'ordered'}
                    title="Numbered list"
                    onClick={() => updateLayer(selectedLayer.id, {
                      listStyle: selectedLayer.listStyle === 'ordered' ? 'none' : 'ordered',
                      alignment: 'left',
                    })}
                  >
                    <ListOrderedIcon aria-hidden="true" />
                  </button>
                </div>
                <div className="color-post-editor__align" aria-label="Text alignment">
                  {(['left', 'center', 'right'] as const).map((alignment) => (
                    <button
                      type="button"
                      key={alignment}
                      aria-label={`Align ${alignment}`}
                      aria-pressed={selectedLayer.alignment === alignment}
                      onClick={() => updateLayer(selectedLayer.id, { alignment })}
                    >
                      <span className={`color-post-editor__align-icon is-${alignment}`} aria-hidden="true">
                        <i /><i /><i />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="color-post-editor__text-colors" aria-label="Text color">
                  {textColorOptions.slice(0, 4).map((color) => (
                    <button
                      type="button"
                      key={color}
                      aria-label={`Use ${color} for text`}
                      aria-pressed={selectedLayer.color === color}
                      style={{ background: color }}
                      onClick={() => updateLayer(selectedLayer.id, { color })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="color-post-editor__toolbar-action"
                  aria-label="Duplicate selected text"
                  title="Duplicate"
                  onClick={duplicateSelectedLayer}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="color-post-editor__toolbar-action"
                  aria-label="Delete selected text"
                  title="Delete"
                  onClick={deleteSelectedLayer}
                >
                  ×
                </button>
              </div>
            ) : null}
            <div
              ref={stageRef}
              className={`color-post-editor__stage color-post-editor__stage--${document.templateId}`}
              style={{
                background: colorRoles.background.hex,
                color: colorRoles.text.hex,
                '--template-border': colorRoles.border.hex,
                '--template-background': colorRoles.background.hex,
              } as CSSProperties}
              onDoubleClick={addTextLayer}
            >
              <span className="color-post-editor__orb color-post-editor__orb--top" style={{ background: colorRoles.border.hex }} />
              <span className="color-post-editor__orb color-post-editor__orb--bottom" style={{ background: colorRoles.border.hex }} />
              <span className="color-post-editor__template-border" aria-hidden="true" />
              {activeEventTheme ? (
                <EventCanvasTheme themeStyle={activeEventTheme.themeStyle} />
              ) : null}
              {document.layers.map((layer) => {
                const selected = layer.id === selectedLayerId;
                return (
                  <div
                    key={layer.id}
                    data-layer-id={layer.id}
                    className={`color-post-editor__text-layer${selected ? ' is-selected' : ''}`}
                    style={layerStyle(layer)}
                    onPointerDown={() => setSelectedLayerId(layer.id)}
                  >
                    <EditablePostText
                      layer={layer}
                      onEditStart={() => {
                        if (editingLayerRef.current !== layer.id) {
                          editingLayerRef.current = layer.id;
                          checkpoint();
                        }
                      }}
                      onEditEnd={() => { editingLayerRef.current = null; }}
                      onTextChange={(text) => updateLayer(layer.id, { text }, false)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <canvas
            ref={exportCanvasRef}
            className="color-post-editor__export-canvas"
            width={POST_WIDTH}
            height={POST_HEIGHT}
            aria-hidden="true"
          />
        </section>
      </div>
    </main>
  );
}
