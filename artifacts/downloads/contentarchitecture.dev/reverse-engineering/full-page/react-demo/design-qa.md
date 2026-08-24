# Design QA

## Source of truth

- Live reference: `https://www.contentarchitecture.dev/`
- Source evidence: immutable capture under
  `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/contentarchitecture.dev/2026-08-18T09-36-04-737Z/`
- Current implementation evidence: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/contentarchitecture.dev/reverse-engineering/full-page/react-demo/evidence`
- Equal-viewport hero comparison: `evidence/source-vs-implementation-hero-equal-viewport.png`

## Current capture matrix

| Surface | Viewport | Density | State | Result |
| --- | --- | --- | --- | --- |
| Hero desktop | 1159 x 863 | 1 | Default | Passed |
| Hero desktop | 1159 x 863 | 1 | Scroll cue activated | Passed |
| Hero CTA | 896 x 863 | 1 | Default and hover | Passed |
| Studio minimap | 1159 x 863 | 1 | Default, focus, open | Passed |
| Studio panel | 1159 x 863 | 1 | Page, Content, SEO, Agents | Passed |
| Studio panel | 390 x 844 | 1 | Open | Passed |
| Hero mobile | 390 x 844 | 1 | Default | Passed |
| Full page | 1159 x 863 | 1 | DOM/control inventory | Passed |
| Hero desktop | 1280 x 720 | 1 | Equal viewport and pointer state | Passed |
| Repository desktop | 1280 x 720 | 1 | Equal page and editor scroll state | Passed |

## Findings

No actionable P0, P1, or P2 fidelity differences remain for the immutable
single-page capture.

- The earlier repository blocker is closed. `RepoExplorer` now includes both
  editions, the full file tree, search, editable source, minimap, terminal,
  commit graph, resizers, status strip, and keyboard states.
- The current live source reports 128 commits while the reconstruction retains
  the immutable capture's 119. The current live page also has one added FAQ,
  producing the documented 73px shift after Pricing. Both are accepted
  `live-only` content drift, not implementation defects.

## Final normalized evidence

- Hero source: `evidence/final-source-hero-1280.png`.
- Hero implementation: `evidence/final-implementation-hero-1280.png`.
- Hero combined comparison: `evidence/final-compare-hero-1280.png`.
- Repository source: `evidence/final-source-repository-1280.png`.
- Repository implementation: `evidence/final-implementation-repository-1280.png`.
- Repository combined comparison:
  `evidence/final-compare-repository-1280.png`.
- Each source and implementation capture is `1280 x 720` CSS pixels at density
  1. Each combined side-by-side comparison is `2560 x 720` with no scaling.
- The hero comparison used a normalized non-hover pointer position. The
  repository comparison used document scroll `4239`, Next.js active, terminal
  visible, and `README.md` editor scroll `0` in both pages.
- Focused comparison was required because the full-page image cannot make dense
  IDE typography, minimap, terminal, and status-strip geometry readable.

## Hero comparison history

The user-reported first-section mismatch revealed four earlier P1/P2 issues: a fixed `720px` hero instead of `100svh`, a 50/50 split instead of the source 12-column grid, incorrect headline/status/CTA anatomy, and a missing scroll cue.

Fixes applied:

- Rebuilt the desktop hero as a 12-column grid: copy spans five columns, column six remains open, and the visual spans columns seven through twelve.
- Restored viewport-height behavior while preserving the source mobile `1223px` composition at `390 x 844`.
- Restored source text balancing, responsive typography, two-row status data, CTA connector, and orange status dot.
- Rebuilt the shared CTA text as a staggered per-character odometer and restored the pulsing status indicator.
- Added the animated, labelled scroll cue and matched its observed scroll destination.

Post-fix evidence:

- Source and implementation hero rectangles are both `1159 x 863`.
- Source and implementation scroll-cue rectangles are both `22 x 68` at `x=576.5`, `y=755`.
- At `896 x 863`, source and implementation CTA rectangles are both `164.2265625 x 48`; both connectors are `6 x 26`, vertically centered, square, and near-black.
- CTA source and implementation widths also match at `390px` (`159.7265625`), `1159px` (`182.546875`), and `1440px` (`185.0078125`).
- CTA static comparison: `evidence/source-vs-implementation-hero-cta-896.png`; hover comparison: `evidence/source-vs-implementation-hero-cta-hover-896.png`.
- Mobile hero height remains `1223px`; the visual still begins at `548px`; total mobile document height remains `12832px`.

## Studio Mode comparison

- Source and implementation desktop minimaps are both `96 x 54` at `x=1047`, `y=16`; both expose `Inspect this page in Studio mode` and reveal the `INSPECT ↗` label.
- Source panel: `400 x 414.6` at `x=743`, `y=86`; implementation panel: `400 x 413.6` at the same position.
- Page controls reproduce drawer, header, footer, and minimap visibility switches. Password protection remains a deliberately inactive demo setting, matching the source.
- Content mode highlights the three editable hero fields. Selecting a field opens local eyebrow, title, and text controls and applies edits live.
- SEO reproduces the title, description, no-index switch, and copied `1200 x 630` source image. Agents reproduces the Markdown switch and content preview.
- The panel supports drag, exit/reset, keyboard focus, internal scrolling, and a non-overflowing `374px` mobile layout.
- Equal-viewport comparison: `evidence/source-vs-implementation-studio-dialog-1159.png`.
- Additional evidence: `evidence/source-studio-field-edit-1159.png`, `evidence/implementation-studio-field-edit-1159.png`, and `evidence/implementation-studio-open-390.png`.

## Required fidelity surfaces

- Fonts and typography: local Geist faces match family, responsive size,
  weight, line height, wrapping, and mono hierarchy at all required viewports.
- Spacing and layout: section boundaries match through Pricing at mobile,
  breakpoint, tall desktop, and wide desktop. Hero grid, component internals,
  sticky footer, header, minimap, drawer, and Studio panel follow recovered
  source geometry.
- Colors and tokens: off-white, near-black, grey hierarchy, dotted frames,
  orange status accents, focus rings, and overlay opacity match.
- Image quality and assets: source fonts, raster media, author portraits, AVIF
  showcase media, SVG marks, WebGL shaders, and canvas data are local. No final
  component hotlinks source assets or substitutes a visible asset with a
  temporary drawing.
- Copy and content: the React reconstruction follows the immutable capture;
  live-only FAQ and commit-count drift is documented separately.

## Final runtime verification

- All nine `data-page-builder-section` markers render in source order.
- Studio activation created 80 current visible field controls. `Edit Eyebrow`
  opened the `Main Hero` editor with one textarea and one rich-text editor;
  exiting removed all overlays.
- The repository interactions and complex Studio schema paths are recorded in
  `../evidence/repository-section.md` and `../evidence/studio-chrome.md`.
- Local browser console errors: none.
- `npm run build`: passed. `npm run test:sites`: 4/4 passed.
- Studio supplement manifest parsed and all 9/9 SHA-256 hashes matched.

## Final comparison history

The earlier repository P1 was fixed by reconstructing every captured control
and re-running the equal-state focused comparison. A later false mismatch came
from comparing a `1280 x 720` source tab with a claimed `737 x 863` local tab,
then scrolling the nested code editors to different lines. The final pass read
the effective viewport per tab, used equal-context tabs, normalized document
and editor scroll state, repeated the screenshots, and added that failure mode
to `REVERSE_ENGINEERING_RULES.md`.

## Blog route and transition supplement

| Surface | Viewport | State | Result |
| --- | --- | --- | --- |
| Blog index | 1280 x 720 | Top and article list | Passed |
| Blog index | 390 x 844 | Top and article list | Passed |
| Blog mobile menu | 390 x 844 | Open, Blog current | Passed |
| Blog sticky footer | 1280 x 720 | Fully revealed | Passed |
| ASCII route curtain | 1280 x 720 | Cover, commit, reveal, idle | Passed |
| Navigation | 1280 x 720 | Home, Blog, browser back | Passed |

- The source and implementation Blog title, intro, rules, article headings,
  descriptions, metadata, section padding, centered width, and sticky footer
  align in the combined equal-viewport comparisons.
- At `390 x 844`, both source and implementation have a 1369px document and no
  horizontal overflow.
- The implementation uses the downloaded transition's grid equations, glyph
  atlas, procedural offsets, flicker, 720ms phases, DPR cap, resize lifecycle,
  and 180ms reduced-motion fade.
- Evidence lives under
  `../../2026-08-20-blog-route/evidence/`; forensic notes are in
  `../evidence/page-transition.md` and `../evidence/blog-page.md`.
- `npm run build`: passed after the Blog route and transition were added.

final result: passed
