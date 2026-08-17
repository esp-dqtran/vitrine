import { createHash, randomUUID } from "node:crypto";

export type ThreadsPostStatus = "draft" | "published" | "failed";

export interface ThreadsPaletteColor {
  role: "anchor" | "accent" | "companion";
  name: string;
  hex: string;
  foreground: "#151311" | "#FFFFFF";
}

export interface ThreadsPalette {
  colors: readonly ThreadsPaletteColor[];
  harmony: string;
  mood: string;
}

export interface ThreadsMarketingPost {
  id: string;
  kind: "daily" | "on-demand";
  paletteDate: string;
  palette: ThreadsPalette;
  caption: string;
  status: ThreadsPostStatus;
  threadsPostId: string | null;
  publishedAt: string | null;
  metrics: ThreadsPostMetrics;
  metricsRefreshedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface ThreadsPostMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export const emptyThreadsPostMetrics = (): ThreadsPostMetrics => ({
  views: 0,
  likes: 0,
  replies: 0,
  reposts: 0,
  quotes: 0,
  shares: 0,
});

const names = {
  anchor: ["Obsidian", "Midnight", "Sangria", "Cinder", "Velvet", "Deepwater"],
  accent: ["Orchid", "Jade", "Coral", "Saffron", "Juniper", "Indigo"],
  companion: ["Hearth", "Mist", "Vapor", "Linen", "Meadow", "Petal"],
} as const;
const endings = ["Ink", "Curfew", "Glaze", "Bloom", "Tide", "Light"] as const;
const moods = ["quietly editorial", "warmly optimistic", "bold and atmospheric", "softly expressive"] as const;
const harmonies = ["soft complementary", "analogous contrast", "split complementary", "modern triadic"] as const;

function seededNumber(input: string, offset: number): number {
  const digest = createHash("sha256").update(`${input}:${offset}`).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function pick<T>(values: readonly T[], seed: string, offset: number): T {
  return values[Math.floor(seededNumber(seed, offset) * values.length)]!;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
      : hue < 180 ? [0, c, x]
        : hue < 240 ? [0, x, c]
          : hue < 300 ? [x, 0, c]
            : [c, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Generates a repeatable three-role palette. The fixed lightness bands ensure
 * the post reads as a system (ink / colour / air), while the daily seed varies
 * hue, harmony and names without duplicating a published day on restart.
 */
export function generateDailyThreadsPalette(paletteDate: string, variant = 0): ThreadsPalette {
  const seed = `${paletteDate}:${variant}`;
  const harmonyIndex = Math.floor(seededNumber(seed, 0) * harmonies.length);
  const baseHue = Math.floor(seededNumber(seed, 1) * 360);
  const offsets = [[0, 142, 18], [0, 32, 14], [0, 150, 183], [0, 118, 235]][harmonyIndex]!;
  const hue = (index: number) => (baseHue + offsets[index]) % 360;
  const color = (role: ThreadsPaletteColor["role"], index: number, saturation: number, lightness: number, foreground: ThreadsPaletteColor["foreground"]): ThreadsPaletteColor => ({
    role,
    name: `${pick(names[role], seed, index + 2)} ${pick(endings, seed, index + 9)}`,
    hex: hslToHex(hue(index), saturation, lightness),
    foreground,
  });
  return {
    harmony: harmonies[harmonyIndex]!,
    mood: pick(moods, seed, 16),
    colors: [
      color("anchor", 0, clamp(30 + seededNumber(seed, 3) * 22, 28, 52), 11 + seededNumber(seed, 4) * 7, "#FFFFFF"),
      color("accent", 1, clamp(42 + seededNumber(seed, 5) * 25, 40, 67), 32 + seededNumber(seed, 6) * 15, "#FFFFFF"),
      color("companion", 2, clamp(42 + seededNumber(seed, 7) * 20, 40, 62), 83 + seededNumber(seed, 8) * 8, "#151311"),
    ],
  };
}

export function createThreadsCaption(palette: ThreadsPalette): string {
  const [anchor, accent, companion] = palette.colors;
  return [
    "Today’s color pack ✦",
    `${anchor.name} ${anchor.hex} · ${accent.name} ${accent.hex} · ${companion.name} ${companion.hex}`,
    `A ${palette.mood} ${palette.harmony} for your next interface, identity, or moodboard. Save it for later.`,
    "#colorpalette #designinspiration #uidesign",
  ].join("\n\n");
}

export function createThreadsMarketingPost(input: {
  kind: ThreadsMarketingPost["kind"];
  paletteDate: string;
  variant?: number;
  now?: Date;
}): ThreadsMarketingPost {
  const variant = input.variant ?? 0;
  const palette = generateDailyThreadsPalette(input.paletteDate, variant);
  return {
    id: input.kind === "daily" ? `daily-${input.paletteDate}` : `on-demand-${randomUUID()}`,
    kind: input.kind,
    paletteDate: input.paletteDate,
    palette,
    caption: createThreadsCaption(palette),
    status: "draft",
    threadsPostId: null,
    publishedAt: null,
    metrics: emptyThreadsPostMetrics(),
    metricsRefreshedAt: null,
    error: null,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}
