# Reverse-engineering notes

## Source

- URL: `https://craft.wild.as/`
- User-selected element: `section#hero`
- Source inspection method: live DOM, computed CSS, CSSOM, loaded assets, and the
  page's hydrated JavaScript runtime
- Extraction date: 2026-08-21

## Recovered component boundary

The selected DOM node alone does not contain every visible part of the selected
composition. The source uses three cooperating siblings:

1. `canvas#hero-kv` is fixed to the viewport and renders the animated pixel field.
2. `section#hero` owns the white header and establishes a `100vh` hero stage.
3. `section.intro` starts after the hero, then overlaps it with `margin-top: -24vh`.

`HeroExperience` packages those three pieces so the extracted component preserves
the behavior visible in the source instead of reproducing only the selected node's
static markup.

## DOM and layout

The React markup keeps the source class and ID contract used by the runtime:
`#hero-kv`, `#hero`, `.hhead`, `.hgrid`, `.hl`, `.hcol`, `.hdesc`, `.hfoot`,
`.wlogo`, `.htag`, `.intro`, and `.lead`.

Key recovered rules:

- desktop gutter: `56px`; mobile gutter: `28px`
- content maximum width: `1176px`
- header grid breakpoint: `900px`
- desktop columns: `1.6fr 1fr` with a `42px` gap
- mobile footer breakpoint: `720px`
- headline: `clamp(32px, 5.2vw, 82px)`, `0.92` line-height
- intro: `98px` top padding and `-24vh` overlap
- intro lead: `clamp(26px, 3.4vw, 46px)`, `1.06` line-height

## Assets

Bundled source assets:

- `public/assets/fonts/Sneak-Regular.woff2`
- `public/assets/fonts/Sneak-Medium.woff2`
- `public/assets/wild-logo.svg`

## Runtime behavior

`public/hero-runtime.js` is the focused hero/intro portion recovered from the
downloaded hydrated page runtime. It provides:

- DPR-aware responsive canvas sizing;
- a generated 9px pixel field using the source color bands;
- pointer-follow heat and displacement;
- press/double-click detonation waves;
- idle Pac-Man behavior;
- scroll-aware field positioning and fade;
- logo spin hooks;
- rendered-line splitting and stepped intro reveal.

The field seed is intentionally randomized by the source runtime, so individual
pixel locations differ between loads while geometry, palette, density, and behavior
remain faithful.
