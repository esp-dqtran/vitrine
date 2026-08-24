import { Icon } from '@astryxdesign/core';
import {
  ArrowDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DragIcon,
  ExpandIcon,
  LockIcon,
  PaintBrushIcon,
  PlusIcon,
  ShareIcon,
  TransferIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon,
} from '@storybook/icons';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type ColorHarmony =
  | 'custom'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'square'
  | 'compound'
  | 'shades'
  | 'monochromatic';

export type ComposerColor = {
  role: 'Lead' | 'Companion' | 'Accent';
  weight: '60%' | '30%' | '10%';
  hex: string;
};

type WheelColor = {
  id: string;
  hex: string;
  locked: boolean;
};

type PaletteSnapshot = {
  colors: readonly WheelColor[];
  baseColorId: string;
  harmony: ColorHarmony;
};

const DEFAULT_HEX = '#424242';
const DEFAULT_WHEEL_COLORS: readonly WheelColor[] = [
  { id: 'color-1', hex: '#424242', locked: false },
  { id: 'color-2', hex: '#FF98BB', locked: false },
  { id: 'color-3', hex: '#BA1650', locked: false },
  { id: 'color-4', hex: '#CCCCCC', locked: false },
  { id: 'color-5', hex: '#056C5C', locked: false },
];

const HARMONIES: Array<{ id: ColorHarmony; label: string }> = [
  { id: 'custom', label: 'Custom' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'split-complementary', label: 'Split complementary' },
  { id: 'triadic', label: 'Triad' },
  { id: 'square', label: 'Square' },
  { id: 'compound', label: 'Compound' },
  { id: 'shades', label: 'Shades' },
  { id: 'monochromatic', label: 'Monochromatic' },
];

export function normalizeComposerHex(value: string) {
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

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

const WHEEL_HUE_STOPS = [
  { hue: 0, phase: 0 },
  { hue: 30, phase: 52 },
  { hue: 60, phase: 122 },
  { hue: 120, phase: 165 },
  { hue: 150, phase: 192 },
  { hue: 180, phase: 218 },
  { hue: 240, phase: 275 },
  { hue: 300, phase: 330 },
  { hue: 360, phase: 360 },
] as const;

function hexToHsv(hex: string): HsvColor {
  const normalized = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(
    normalized.slice(offset, offset + 2),
    16,
  ) / 255);
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  const delta = high - low;
  let hue = 0;
  if (delta) {
    if (high === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (high === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  return {
    hue: (hue + 360) % 360,
    saturation: high ? (delta / high) * 100 : 0,
    value: high * 100,
  };
}

function interpolateStop(value: number, inputKey: 'hue' | 'phase', outputKey: 'hue' | 'phase') {
  const normalized = ((value % 360) + 360) % 360;
  const input = normalized === 0 && value > 0 ? 360 : normalized;
  const rightIndex = WHEEL_HUE_STOPS.findIndex((stop) => stop[inputKey] >= input);
  const right = WHEEL_HUE_STOPS[Math.max(1, rightIndex)]!;
  const left = WHEEL_HUE_STOPS[Math.max(0, rightIndex - 1)]!;
  const progress = (input - left[inputKey]) / Math.max(1, right[inputKey] - left[inputKey]);
  return left[outputKey] + (right[outputKey] - left[outputKey]) * progress;
}

export function getComposerWheelAngle(hex: string) {
  const { hue } = hexToHsv(hex);
  return (360 - interpolateStop(hue, 'hue', 'phase')) % 360;
}

function wheelAngleToHue(angle: number) {
  const phase = (360 - angle) % 360;
  return interpolateStop(phase, 'phase', 'hue');
}

function hsvToRgb(hue: number, saturation: number, value: number) {
  const nextHue = ((hue % 360) + 360) % 360;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs(((nextHue / 60) % 2) - 1));
  const offset = value - chroma;
  const [red, green, blue] = nextHue < 60 ? [chroma, secondary, 0]
    : nextHue < 120 ? [secondary, chroma, 0]
      : nextHue < 180 ? [0, chroma, secondary]
        : nextHue < 240 ? [0, secondary, chroma]
          : nextHue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return [red + offset, green + offset, blue + offset] as const;
}

function hsvToHex(hue: number, saturation: number, value: number) {
  return `#${hsvToRgb(hue, saturation, value).map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function getComposerWheelColor(angle: number, saturation: number, value: number) {
  return hsvToHex(wheelAngleToHue(angle), clamp(saturation, 0, 1), clamp(value, 0, 1));
}

export function getComposerWheelMarker(hex: string) {
  const { saturation } = hexToHsv(hex);
  const angle = getComposerWheelAngle(hex);
  const radius = saturation / 2;
  const radians = angle * Math.PI / 180;
  return {
    angle,
    left: 50 + Math.cos(radians) * radius,
    top: 50 + Math.sin(radians) * radius,
  };
}

function drawComposerWheel(canvas: HTMLCanvasElement, value: number) {
  const size = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const pixelSize = Math.max(1, Math.round(size * density));
  const renderKey = `${pixelSize}:${value.toFixed(4)}`;
  if (canvas.dataset.renderKey === renderKey) return;
  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const image = context.createImageData(pixelSize, pixelSize);
  const center = (pixelSize - 1) / 2;
  const radius = pixelSize / 2;
  for (let y = 0; y < pixelSize; y += 1) {
    for (let x = 0; x < pixelSize; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const saturation = clamp(distance / radius, 0, 1);
      const [red, green, blue] = hsvToRgb(wheelAngleToHue(angle), saturation, value);
      const offset = (y * pixelSize + x) * 4;
      image.data[offset] = Math.round(red * 255);
      image.data[offset + 1] = Math.round(green * 255);
      image.data[offset + 2] = Math.round(blue * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  canvas.dataset.renderKey = renderKey;
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rotateHue(hue: number, offset: number) {
  return (hue + offset + 360) % 360;
}

export function getHarmonyPalette(hex: string, harmony: Extract<ColorHarmony, 'monochromatic' | 'analogous' | 'complementary' | 'triadic'>): readonly ComposerColor[] {
  const anchor = normalizeComposerHex(hex) ?? DEFAULT_HEX;
  const { hue, saturation, lightness } = hexToHsl(anchor);
  const isDark = lightness < 56;
  const companionLightness = isDark ? 94 : 15;
  const companionSaturation = clamp(saturation * 0.22, 8, 24);
  const accentLightness = clamp(isDark ? 58 : 46, 38, 62);
  const accentSaturation = clamp(Math.max(saturation, 62), 62, 84);
  const accentHue = harmony === 'analogous'
    ? rotateHue(hue, 30)
    : harmony === 'triadic'
      ? rotateHue(hue, 240)
      : harmony === 'complementary'
        ? rotateHue(hue, 180)
        : hue;
  const companionHue = harmony === 'analogous'
    ? rotateHue(hue, -28)
    : harmony === 'triadic'
      ? rotateHue(hue, 120)
      : hue;

  return [
    { role: 'Lead', weight: '60%', hex: anchor },
    { role: 'Companion', weight: '30%', hex: hslToHex(companionHue, companionSaturation / 100, companionLightness / 100) },
    {
      role: 'Accent',
      weight: '10%',
      hex: hslToHex(
        accentHue,
        harmony === 'monochromatic' ? clamp(saturation + 8, 44, 88) / 100 : accentSaturation / 100,
        harmony === 'monochromatic'
          ? clamp(isDark ? lightness + 18 : lightness - 18, 25, 72) / 100
          : accentLightness / 100,
      ),
    },
  ];
}

function relativeLuminance(hex: string) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function foregroundFor(hex: string) {
  const background = relativeLuminance(hex);
  const darkRatio = (Math.max(background, relativeLuminance('#151311')) + 0.05)
    / (Math.min(background, relativeLuminance('#151311')) + 0.05);
  const lightRatio = (Math.max(background, 1) + 0.05) / (Math.min(background, 1) + 0.05);
  return darkRatio >= lightRatio ? '#151311' : '#FFFFFF';
}

export function contrastRatio(hex: string, foreground = foregroundFor(hex)) {
  const [light, dark] = [relativeLuminance(hex), relativeLuminance(foreground)].sort((left, right) => right - left);
  return (light + 0.05) / (dark + 0.05);
}

function getWheelHexes(baseHex: string, harmony: ColorHarmony) {
  const { hue, saturation, lightness } = hexToHsl(baseHex);
  const swatch = (offset: number, nextSaturation = saturation, nextLightness = lightness) => hslToHex(
    rotateHue(hue, offset),
    clamp(nextSaturation, 14, 100) / 100,
    clamp(nextLightness, 8, 92) / 100,
  );
  switch (harmony) {
    case 'analogous': return [swatch(0), swatch(-24), swatch(24), swatch(-48), swatch(48)];
    case 'complementary': return [swatch(0), swatch(-18), swatch(18), swatch(180), swatch(198)];
    case 'split-complementary': return [swatch(0), swatch(150), swatch(210), swatch(180), swatch(30)];
    case 'triadic': return [swatch(0), swatch(120), swatch(240), swatch(120, saturation * 0.55, lightness + 22), swatch(240, saturation * 0.55, lightness - 18)];
    case 'square': return [swatch(0), swatch(90), swatch(180), swatch(270), swatch(45, saturation * 0.56, lightness + 20)];
    case 'compound': return [swatch(0), swatch(28), swatch(152), swatch(180), swatch(208)];
    case 'shades': return [swatch(0, saturation, lightness), swatch(0, saturation, lightness + 28), swatch(0, saturation, lightness + 14), swatch(0, saturation, lightness - 16), swatch(0, saturation, lightness - 30)];
    case 'monochromatic': return [swatch(0, saturation, lightness), swatch(0, saturation * 0.58, lightness + 30), swatch(0, saturation * 0.76, lightness + 15), swatch(0, saturation * 1.06, lightness - 15), swatch(0, saturation * 0.85, lightness - 30)];
    case 'custom': return [baseHex, '#F9ECE5', '#68150A', '#0B78B3', '#1F0062'];
  }
}

export function getTintOptions(hex: string) {
  const normalized = normalizeComposerHex(hex) ?? DEFAULT_HEX;
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const encode = (values: readonly number[]) => `#${values.map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const tint = (amount: number) => encode(channels.map((channel) => channel + (255 - channel) * amount));
  const shade = (amount: number) => encode(channels.map((channel) => channel * amount));
  return [tint(0.8), tint(0.6), tint(0.3), normalized, shade(0.76), shade(0.55), shade(0.35)];
}

function PaletteWheel({
  colors,
  baseColorId,
  onSelect,
  onMove,
}: {
  colors: readonly WheelColor[];
  baseColorId: string;
  onSelect: (id: string) => void;
  onMove: (id: string, hex: string) => void;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeColorIdRef = useRef<string | null>(null);
  const baseColor = colors.find((color) => color.id === baseColorId) ?? colors[0]!;
  const wheelValue = hexToHsv(baseColor.hex).value / 100;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = () => drawComposerWheel(canvas, wheelValue);
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [wheelValue]);
  const colorFromPointer = (event: Pick<PointerEvent<HTMLElement>, 'clientX' | 'clientY'>) => {
    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const x = event.clientX - centerX;
    const y = event.clientY - centerY;
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const saturation = clamp(Math.hypot(x, y) / radius, 0, 1);
    return getComposerWheelColor(angle, saturation, wheelValue);
  };
  const closestColorId = (event: Pick<PointerEvent<HTMLElement>, 'clientX' | 'clientY'>) => {
    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return colors.reduce<{ id: string; distance: number } | null>((closest, color) => {
      const marker = getComposerWheelMarker(color.hex);
      const markerX = bounds.left + bounds.width * marker.left / 100;
      const markerY = bounds.top + bounds.height * marker.top / 100;
      const distance = Math.hypot(event.clientX - markerX, event.clientY - markerY);
      return !closest || distance < closest.distance ? { id: color.id, distance } : closest;
    }, null)?.id ?? null;
  };
  const moveActiveColor = (event: Pick<PointerEvent<HTMLElement>, 'clientX' | 'clientY'>) => {
    const id = activeColorIdRef.current;
    const next = colorFromPointer(event);
    if (id && next) onMove(id, next);
  };

  return (
    <div
      ref={wheelRef}
      className="color-composer__wheel"
      aria-label="Color wheel"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const id = closestColorId(event);
        if (!id) return;
        activeColorIdRef.current = id;
        onSelect(id);
        event.currentTarget.setPointerCapture(event.pointerId);
        moveActiveColor(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons & 1) moveActiveColor(event);
      }}
      onPointerUp={() => { activeColorIdRef.current = null; }}
    >
      <canvas ref={canvasRef} className="color-composer__wheel-canvas" aria-hidden="true" />
      {colors.map((color) => {
        const marker = getComposerWheelMarker(color.hex);
        return (
          <button
            type="button"
            className="color-composer__wheel-marker"
            data-base={color.id === baseColorId || undefined}
            aria-label={`${color.hex}, use arrow keys to move`}
            key={color.id}
            style={{
              left: `${marker.left}%`,
              top: `${marker.top}%`,
              backgroundColor: color.hex,
              zIndex: color.id === baseColorId ? colors.length + 2 : colors.length - colors.indexOf(color),
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              activeColorIdRef.current = color.id;
              onSelect(color.id);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onClick={() => onSelect(color.id)}
            onPointerMove={(event) => {
              if (!(event.buttons & 1)) return;
              const next = colorFromPointer(event);
              if (next) onMove(color.id, next);
            }}
            onPointerUp={() => { activeColorIdRef.current = null; }}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const { hue, saturation, value } = hexToHsv(color.hex);
              const hueOffset = event.key === 'ArrowLeft' ? -3 : event.key === 'ArrowRight' ? 3 : 0;
              const saturationOffset = event.key === 'ArrowUp' ? 4 : event.key === 'ArrowDown' ? -4 : 0;
              onSelect(color.id);
              onMove(color.id, hsvToHex(rotateHue(hue, hueOffset), clamp(saturation + saturationOffset, 0, 100) / 100, value / 100));
            }}
          />
        );
      })}
    </div>
  );
}

export function ColorPaletteComposer({
  onBack = () => undefined,
  onCreate = () => undefined,
}: {
  onBack?: () => void;
  onCreate?: (palette: { name: string; colors: readonly string[] }) => void;
}) {
  const composerRef = useRef<HTMLElement>(null);
  const harmonyRailRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<readonly WheelColor[]>(DEFAULT_WHEEL_COLORS);
  const [baseColorId, setBaseColorId] = useState('color-1');
  const [harmony, setHarmony] = useState<ColorHarmony>('custom');
  const [paletteName, setPaletteName] = useState('My Color Theme');
  const [history, setHistory] = useState<readonly PaletteSnapshot[]>([]);
  const [future, setFuture] = useState<readonly PaletteSnapshot[]>([]);
  const [copiedColorId, setCopiedColorId] = useState<string | null>(null);
  const [copiedPalette, setCopiedPalette] = useState(false);
  const [tintColorId, setTintColorId] = useState<string | null>(null);
  const [draggingColorId, setDraggingColorId] = useState<string | null>(null);

  const baseColor = colors.find((color) => color.id === baseColorId) ?? colors[0]!;
  const paletteSummary = useMemo(() => colors.map((color) => color.hex).join(', '), [colors]);
  const snapshot = (): PaletteSnapshot => ({ colors, baseColorId, harmony });
  const commit = (next: PaletteSnapshot) => {
    setHistory((current) => [...current, snapshot()]);
    setFuture([]);
    setColors(next.colors);
    setBaseColorId(next.baseColorId);
    setHarmony(next.harmony);
  };
  const updateColors = (nextColors: readonly WheelColor[], nextHarmony = 'custom' as ColorHarmony) => {
    commit({ colors: nextColors, baseColorId, harmony: nextHarmony });
  };
  const setColor = (id: string, value: string, shouldCommit = true) => {
    const hex = normalizeComposerHex(value);
    if (!hex) return;
    const next = colors.map((color) => color.id === id ? { ...color, hex } : color);
    if (shouldCommit) updateColors(next);
    else setColors(next);
  };
  const moveWheelColor = (id: string, value: string) => {
    const hex = normalizeComposerHex(value);
    if (!hex) return;
    commit({
      colors: colors.map((color) => color.id === id ? { ...color, hex } : color),
      baseColorId: id,
      harmony: 'custom',
    });
  };
  const applyHarmony = (nextHarmony: ColorHarmony) => {
    if (nextHarmony === 'custom') {
      commit({ colors, baseColorId, harmony: nextHarmony });
      return;
    }
    const hexes = getWheelHexes(baseColor.hex, nextHarmony);
    const nextColors = colors.map((color, index) => color.locked ? color : { ...color, hex: hexes[index % hexes.length]! });
    commit({ colors: nextColors, baseColorId, harmony: nextHarmony });
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((current) => [snapshot(), ...current]);
    setHistory((current) => current.slice(0, -1));
    setColors(previous.colors);
    setBaseColorId(previous.baseColorId);
    setHarmony(previous.harmony);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, snapshot()]);
    setFuture((current) => current.slice(1));
    setColors(next.colors);
    setBaseColorId(next.baseColorId);
    setHarmony(next.harmony);
  };
  const generateRandom = () => {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 62 + Math.floor(Math.random() * 26);
    const lightness = 38 + Math.floor(Math.random() * 18);
    const nextBase = hslToHex(hue, saturation / 100, lightness / 100);
    const hexes = getWheelHexes(nextBase, harmony === 'custom' ? 'analogous' : harmony);
    commit({
      colors: colors.map((color, index) => color.locked ? color : { ...color, hex: hexes[index % hexes.length]! }),
      baseColorId,
      harmony: harmony === 'custom' ? 'analogous' : harmony,
    });
  };
  const toggleLock = (id: string) => updateColors(colors.map((color) => color.id === id ? { ...color, locked: !color.locked } : color), harmony);
  const deleteColor = (id: string) => {
    if (colors.length <= 2) return;
    const next = colors.filter((color) => color.id !== id);
    commit({ colors: next, baseColorId: baseColorId === id ? next[0]!.id : baseColorId, harmony });
  };
  const insertColorAt = (index: number) => {
    if (colors.length >= 8) return;
    const nextId = `color-${Date.now()}`;
    const neighbour = colors[Math.max(0, Math.min(colors.length - 1, index - 1))] ?? baseColor;
    const { hue, saturation, lightness } = hexToHsl(neighbour.hex);
    const next = [...colors];
    next.splice(index, 0, {
      id: nextId,
      hex: hslToHex(rotateHue(hue, 24), saturation / 100, lightness / 100),
      locked: false,
    });
    commit({
      colors: next,
      baseColorId,
      harmony: 'custom',
    });
  };
  const copyHex = async (color: WheelColor) => {
    await navigator.clipboard?.writeText(color.hex);
    setCopiedColorId(color.id);
    window.setTimeout(() => setCopiedColorId(null), 1500);
  };
  const copyPalette = async () => {
    await navigator.clipboard?.writeText(colors.map((color) => color.hex).join(' · '));
    setCopiedPalette(true);
    window.setTimeout(() => setCopiedPalette(false), 1500);
  };
  const sharePalette = async () => {
    const text = `${paletteName}: ${colors.map((color) => color.hex).join(' · ')}`;
    if (navigator.share) await navigator.share({ title: paletteName, text });
    else await navigator.clipboard?.writeText(text);
  };
  const moveColor = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = colors.findIndex((color) => color.id === fromId);
    const toIndex = colors.findIndex((color) => color.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...colors];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    commit({ colors: next, baseColorId, harmony: 'custom' });
  };
  const downloadPalette = () => {
    const blob = new Blob([JSON.stringify({ name: paletteName, colors: colors.map(({ hex }) => hex) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${paletteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'palette'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await composerRef.current?.requestFullscreen();
  };
  return (
    <main className="color-composer-page">
      <section ref={composerRef} className="color-composer" aria-label="Color palette generator">
        <div className="color-composer__workspace">
          <aside className="color-composer__sidepanel">
            <div className="color-composer__intro">
              <button type="button" className="color-composer__back" onClick={onBack}>
                <span className="color-composer__brand">V</span>
                <strong>Vitrines Color</strong>
              </button>
              <h1>Color palette generator and color wheel tool.</h1>
              <p>Use the color palette generator to create harmonious color schemes for any project. Choose a base color, apply a color harmony, and generate a balanced palette instantly.</p>
            </div>
            <div className="color-composer__wheel-panel" aria-label="Color wheel">
              <PaletteWheel
                colors={colors}
                baseColorId={baseColorId}
                onSelect={setBaseColorId}
                onMove={moveWheelColor}
              />
              <div className="color-composer__harmony-label">Color harmonies: <strong>{HARMONIES.find((item) => item.id === harmony)?.label}</strong></div>
              <div className="color-composer__harmonies-wrap">
                <div ref={harmonyRailRef} className="color-composer__harmonies" role="radiogroup" aria-label="Color harmonies">
                  {HARMONIES.map((option) => {
                    const thumbnail = option.id === 'custom'
                      ? '/color-wheel/harmony-thumbnails/custom.png'
                      : option.id === 'analogous'
                        ? '/color-wheel/harmony-thumbnails/analogous.png'
                        : option.id === 'complementary'
                          ? '/color-wheel/harmony-thumbnails/complementary.png'
                          : option.id === 'split-complementary'
                            ? '/color-wheel/harmony-thumbnails/split-complementary.png'
                            : option.id === 'triadic'
                              ? '/color-wheel/harmony-thumbnails/triad.png'
                              : option.id === 'square'
                                ? '/color-wheel/harmony-thumbnails/square.png'
                                : option.id === 'compound'
                                  ? '/color-wheel/harmony-thumbnails/compound.png'
                                  : option.id === 'shades'
                                    ? '/color-wheel/harmony-thumbnails/shades.png'
                                    : '/color-wheel/harmony-thumbnails/monochromatic.png';
                    return (
                      <button
                        type="button"
                        key={option.id}
                        role="radio"
                        aria-label={`${option.label} color harmony`}
                        aria-checked={harmony === option.id}
                        className={harmony === option.id ? 'is-active' : undefined}
                        title={option.label}
                        onClick={() => applyHarmony(option.id)}
                      >
                        <img src={thumbnail} alt="" />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="color-composer__harmony-next"
                  aria-label="Scroll right"
                  onClick={() => harmonyRailRef.current?.scrollBy({ left: 164, behavior: 'smooth' })}
                >
                  <ChevronRightIcon size={18} aria-hidden />
                </button>
              </div>
            </div>
          </aside>

          <div className="color-composer__canvas-toolbar">
            <div className="color-composer__canvas-actions">
              <div className="color-composer__history-actions">
                <button type="button" aria-label="Undo" title="Undo" onClick={undo} disabled={!history.length}><UndoIcon size={18} aria-hidden /></button>
                <button type="button" className="is-redo" aria-label="Redo" title="Redo" onClick={redo} disabled={!future.length}><UndoIcon size={18} aria-hidden /></button>
              </div>
              <button type="button" className="color-composer__random" aria-label="Generate random" onClick={generateRandom}><TransferIcon size={18} aria-hidden /><span>Generate random</span></button>
              <button type="button" className="color-composer__fullscreen" aria-label="Maximize" title="Maximize" onClick={() => void toggleFullscreen()}><ExpandIcon size={18} aria-hidden /></button>
            </div>
          </div>

          <section className="color-composer__canvas" aria-label={`Palette: ${paletteSummary}`}>
            <div className="color-composer__swatches" style={{ gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))` }}>
              {colors.map((color, index) => {
                const foreground = foregroundFor(color.hex);
                const isBase = color.id === baseColorId;
                const tintOptions = getTintOptions(color.hex);
                return (
                  <article
                    className="color-composer__swatch"
                    data-base={isBase || undefined}
                    key={color.id}
                    style={{ backgroundColor: color.hex, color: foreground }}
                    aria-label={`Color ${index + 1}, ${color.hex}`}
                    draggable
                    onDragStart={() => setDraggingColorId(color.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingColorId) moveColor(draggingColorId, color.id);
                      setDraggingColorId(null);
                    }}
                    onClick={(event) => {
                      if (event.target === event.currentTarget) setBaseColorId(color.id);
                    }}
                  >
                    {tintColorId === color.id ? (
                      <div className="color-composer__tint-options" role="radiogroup" aria-label={`Tint and shade options for color ${index + 1}`}>
                        {tintOptions.map((option, optionIndex) => (
                          <button
                            type="button"
                            key={`${color.id}-${option}`}
                            role="radio"
                            aria-label={`${optionIndex < 3 ? `Tint ${optionIndex + 1}` : optionIndex === 3 ? 'Base color' : `Shade ${optionIndex - 3}`}, ${option}`}
                            aria-checked={optionIndex === 3}
                            className={optionIndex === 3 ? 'is-selected' : undefined}
                            style={{ backgroundColor: option }}
                            onClick={() => {
                              setColor(color.id, option);
                              setTintColorId(null);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                      <div className="color-composer__swatch-rail" aria-label="Color controls">
                        <button type="button" aria-label={color.locked ? 'Unlock color' : 'Lock color'} aria-pressed={color.locked} onClick={() => toggleLock(color.id)}>{color.locked ? <UnlockIcon size={17} aria-hidden /> : <LockIcon size={17} aria-hidden />}</button>
                        <button type="button" aria-label="Edit tint" aria-pressed={false} onClick={() => setTintColorId(color.id)}><PaintBrushIcon size={17} aria-hidden /></button>
                        <button type="button" aria-label="Drag to reorder" draggable onDragStart={() => setDraggingColorId(color.id)}><DragIcon size={17} aria-hidden /></button>
                        <button type="button" aria-label="Delete color" onClick={() => deleteColor(color.id)} disabled={colors.length <= 2}><TrashIcon size={17} aria-hidden /></button>
                      </div>
                      {colors.length < 8 ? (
                        <>
                          <button type="button" className="color-composer__insert color-composer__insert--left" aria-label="Add color left" onClick={() => insertColorAt(index)}><PlusIcon size={15} aria-hidden /></button>
                          <button type="button" className="color-composer__insert color-composer__insert--right" aria-label="Add color right" onClick={() => insertColorAt(index + 1)}><PlusIcon size={15} aria-hidden /></button>
                        </>
                      ) : null}
                    <div className="color-composer__swatch-footer">
                      <label>
                        <span className="sr-only">Edit color {index + 1}</span>
                        <input
                          value={color.hex}
                          spellCheck={false}
                          onFocus={() => setBaseColorId(color.id)}
                          onChange={(event) => setColor(color.id, event.target.value, false)}
                          onBlur={(event) => setColor(color.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                          }}
                        />
                      </label>
                      <button type="button" onClick={() => void copyHex(color)} aria-label={`Copy ${color.hex}`}>
                        <Icon icon={copiedColorId === color.id ? 'check' : 'copy'} size="sm" />
                      </button>
                    </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
            {colors.length < 8 ? (
              <div className="color-composer__compact-add">
                <button type="button" aria-label="Add color" onClick={() => insertColorAt(colors.length)}><PlusIcon size={17} aria-hidden /></button>
              </div>
            ) : null}
            <footer className="color-composer__footer">
              <div className="color-composer__mini-swatches" aria-label="Current palette">{colors.map((color) => <span key={color.id} style={{ backgroundColor: color.hex }} />)}</div>
              <div className="color-composer__footer-actions">
                <button type="button" aria-label="Share palette" onClick={() => void sharePalette()}><ShareIcon size={18} aria-hidden /></button>
                <button type="button" aria-label="Download palette" onClick={downloadPalette}><ArrowDownIcon size={18} aria-hidden /></button>
                <button type="button" aria-label={copiedPalette ? 'Palette saved' : 'Save palette to library'} onClick={() => void copyPalette()}>{copiedPalette ? <Icon icon="check" size="sm" /> : <CopyIcon size={18} aria-hidden />}</button>
              </div>
              <label>Palette name<input value={paletteName} onChange={(event) => setPaletteName(event.target.value)} /></label>
              <button type="button" className="color-composer__create" onClick={() => onCreate({ name: paletteName, colors: colors.map((color) => color.hex) })}>Create with my color palette</button>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}
