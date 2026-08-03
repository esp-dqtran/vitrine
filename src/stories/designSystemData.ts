import { tokenVars } from '@astryxdesign/core/theme/tokens';

// ponytail: everything here is derived at runtime from real sources — the token module,
// the story files, the app source. No hardcoded counts to drift out of date.

// ---------------------------------------------------------------- tokens

export const tokenNames = Object.keys(tokenVars);

export const tokenGroups = tokenNames.reduce<Record<string, string[]>>((acc, name) => {
  const group = name.replace(/^--/, '').split('-')[0];
  (acc[group] ??= []).push(name);
  return acc;
}, {});

export const tokenGroupsRanked = Object.entries(tokenGroups).sort((a, b) => b[1].length - a[1].length);

// ---------------------------------------------------------------- component library

const storyFiles = Object.keys(import.meta.glob('/src/stories/**/*.stories.tsx'));

// Foundations/* documents the system (color, type, audit) — those are pages, not components.
export const library = storyFiles
  .map((path) => {
    const [, category, file] = path.match(/\/src\/stories\/([^/]+)\/([^/]+)\.stories\.tsx$/) ?? [];
    return category && file && category !== 'Foundations' ? { category, name: file } : null;
  })
  .filter((x): x is { category: string; name: string } => x !== null);

export const libraryByCategory = library.reduce<Record<string, string[]>>((acc, { category, name }) => {
  (acc[category] ??= []).push(name);
  return acc;
}, {});

// ---------------------------------------------------------------- app adoption

const sources = import.meta.glob('/src/vitrine/**/*.tsx', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const stylesheets = import.meta.glob('/src/vitrine/**/*.css', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type Row = {
  file: string;
  px: string[];
  hex: string[];
  tokens: number;
  inline: number;
  usesDS: boolean;
  loc: number;
  host: number;
  classes: number;
};

export const rows: Row[] = Object.entries(sources)
  .filter(([p]) => !p.includes('.test.') && !p.endsWith('main.tsx'))
  .map(([path, src]) => ({
    file: path.replace('/src/vitrine/', ''),
    px: src.match(/\b\d+px/g) ?? [],
    hex: src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [],
    tokens: (src.match(/var\(--[a-z-]+/g) ?? []).length,
    inline: (src.match(/style=\{\{/g) ?? []).length,
    usesDS: src.includes('@astryxdesign/core'),
    loc: src.split('\n').length,
    // raw HTML elements rendered — 0 means provider/composition, not a styling target
    host: (src.match(/<(div|span|button|input|a|img|ul|li|p|h[1-6]|nav|section|header|footer|table|form|label|textarea|select|strong|small)[\s/>]/g) ?? []).length,
    classes: (src.match(/className=/g) ?? []).length,
  }))
  .sort((a, b) => b.px.length + b.hex.length - (a.px.length + a.hex.length));

export const nonDS = rows.filter((r) => !r.usesDS && r.host > 0).sort((a, b) => b.loc - a.loc);
export const skipped = rows.filter((r) => !r.usesDS && r.host === 0);

// ---------------------------------------------------------------- buttons

export type ButtonRow = { file: string; raw: number; ds: number; tags: string[] };

export const buttonRows: ButtonRow[] = Object.entries(sources)
  .filter(([p]) => !p.includes('.test.'))
  .map(([path, src]) => ({
    file: path.replace('/src/vitrine/', ''),
    raw: (src.match(/<button[\s>]/g) ?? []).length,
    ds: (src.match(/<(Button|IconButton)[\s>]/g) ?? []).length,
    tags: (src.match(/<button[\s\S]*?>/g) ?? []).map((t) => t.replace(/\s+/g, ' ')),
  }))
  .filter((r) => r.raw > 0 || r.ds > 0)
  .sort((a, b) => b.raw - a.raw);

export const buttons = {
  raw: buttonRows.reduce((n, r) => n + r.raw, 0),
  ds: buttonRows.reduce((n, r) => n + r.ds, 0),
};

/** Why a remaining raw <button> is not a plain Button swap. */
export function rawButtonKind(tag: string) {
  if (/role="menuitem/.test(tag)) return 'DropdownMenu';
  if (/role="option"/.test(tag)) return 'Selector';
  if (/backdrop/.test(tag)) return 'bespoke overlay';
  if (/aria-current="page"|aria-label="(Previous|Next) page"/.test(tag)) return 'Pagination';
  if (/is-active|aria-current/.test(tag)) return 'TabList / SideNav';
  if (/swatch|-pin|__preset|__item|__empty/.test(tag)) return 'bespoke visual';
  if (/-trigger/.test(tag)) return 'canvas toolbar';
  return 'Button';
}

export type CssRow = { file: string; loc: number; rules: number; px: number; hex: number; tokens: number };

export const cssRows: CssRow[] = Object.entries(stylesheets)
  .map(([path, src]) => ({
    file: path.replace('/src/vitrine/', ''),
    loc: src.split('\n').length,
    rules: (src.match(/\{/g) ?? []).length,
    px: (src.match(/\b\d+px/g) ?? []).length,
    hex: (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length,
    tokens: (src.match(/var\(--[a-z-]+/g) ?? []).length,
  }))
  .sort((a, b) => b.loc - a.loc);

export const total = {
  files: rows.length,
  px: rows.reduce((n, r) => n + r.px.length, 0),
  hex: rows.reduce((n, r) => n + r.hex.length, 0),
  tokens: rows.reduce((n, r) => n + r.tokens, 0),
  inline: rows.reduce((n, r) => n + r.inline, 0),
  noDS: rows.filter((r) => !r.usesDS).length,
};

export const rawTotal = total.px + total.hex;
export const tokenShare = Math.round((total.tokens / (total.tokens + rawTotal)) * 100);

export const css = {
  files: cssRows.length,
  loc: cssRows.reduce((n, r) => n + r.loc, 0),
  rules: cssRows.reduce((n, r) => n + r.rules, 0),
  raw: cssRows.reduce((n, r) => n + r.px + r.hex, 0),
  tokens: cssRows.reduce((n, r) => n + r.tokens, 0),
};
export const cssShare = Math.round((css.tokens / (css.tokens + css.raw)) * 100);

// ---------------------------------------------------------------- scales

export const SPACING: [number, string][] = [
  [0, '--spacing-0'], [2, '--spacing-0-5'], [4, '--spacing-1'], [6, '--spacing-1-5'],
  [8, '--spacing-2'], [12, '--spacing-3'], [16, '--spacing-4'], [20, '--spacing-5'],
  [24, '--spacing-6'], [28, '--spacing-7'], [32, '--spacing-8'], [36, '--spacing-9'],
  [40, '--spacing-10'], [44, '--spacing-11'], [48, '--spacing-12'],
];

export const RADIUS: [number, string][] = [
  [0, '--radius-none'], [4, '--radius-inner'], [8, '--radius-element'],
  [12, '--radius-container'], [28, '--radius-page'],
  [999, '--radius-full'], [9999, '--radius-full'],
];

export const FONT_SIZES = ['4xs', '3xs', '2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];

export function nearest(px: number, scale: [number, string][]) {
  return scale.find(([v]) => v === px)?.[1] ?? null;
}

// 1px is overwhelmingly `1px solid` borders — that's --border-width, not off-scale drift.
export function spacingToken(px: number) {
  return px === 1 ? '--border-width' : nearest(px, SPACING);
}

export const mono = "'JetBrains Mono', ui-monospace, monospace";
