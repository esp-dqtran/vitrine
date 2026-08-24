# Flim selected components — design QA

- Source: `https://flim.ai/`
- Source selectors: `#hero-search-inner > .container:nth-of-type(2)`, `#intro-what-is-flim`, and `#intro-scroll` (the live replacement for the captured GSAP `.pin-spacer` wrapper).
- Source evidence: DOM/computed trees, CDP matched styles, related inline scripts, desktop/mobile scroll states, font responses, and 54 downloaded source assets under this artifact.
- Implementation: three isolated React components mounted through shadow-root previews in the Vitrines component library.

## Visual comparison

The source and prototype were compared together at the same 1057 × 863 viewport:

- `evidence/qa/compare-hero-final.png`
- `evidence/qa/compare-what-is-flim-final.png`
- `evidence/qa/compare-database-final.png`
- `evidence/qa/compare-all-final.png`

The final pass checked typography, grid density, search-pill proportions, image crop and density, headline line breaks, platform media placement, physics-object scale, spacing, borders, and responsive card readability.

## Behavior verification

- Hero input accepts text, hides the floating image groups while focused, and restores the source-style visual cycle after blur.
- Four captured hero image sets cycle at the observed five-second interval.
- The What is Flim images transition between the floating and platform composition states.
- Database objects drop with staggered motion; the eye irises follow pointer position.
- The full database preview pins its stage and translates to the second platform panel as the preview scrolls.
- Mobile component dimensions resolve to 390 × 520, 390 × 1077, and 390 × 1800 in the full preview.

## Engineering verification

- `npx tsx --test src/vitrine/componentLibraryCatalog.test.ts src/vitrine/CatalogComponentsPage.test.tsx`: 5 passed, 0 failed.
- `npm run build`: passed; all captured Flim images and fonts were emitted into the production bundle.
- In-app browser console: no Flim-specific errors. Existing React `contentEditable` development warnings originate elsewhere in the component catalog and are unrelated to these components.

## Component-card annotation update — 2026-08-23

- Source visual truth: `evidence/desktop/matched-01539.png`, `evidence/desktop/matched-02915.png`, and `evidence/desktop/matched-04123.png`.
- Browser-rendered implementation: `evidence/qa/component-card-update-what-final.png` and `evidence/qa/component-card-update-database-final.png`.
- Viewport: 846 × 863 CSS pixels at device scale 1. Source captures are 1057 × 863 and were normalized only for the side-by-side card-state comparison.
- Full-view comparison evidence: `evidence/qa/compare-component-card-what-final.png` and `evidence/qa/compare-component-card-database-final.png`.
- Focused comparison was not needed after the full card media became completely visible; the source fonts, imagery, copy, controls, and both database sequence panels remain legible in the normalized comparisons.

### Findings and comparison history

1. The annotated database card exposed only the first pinned viewport and cropped the lower content because the generic card preview reserved an unnecessary 50px top inset.
2. The annotated What Is Flim card entered a phase that removed its four source images and used the same inset, leaving an incomplete and visually weak thumbnail.
3. Flim cards now use a component-specific 12px preview inset. Their intrinsic ratios include the complete scaled section, so the rendered host and viewport heights match without clipping.
4. The What Is Flim card holds the source's aligned four-image state above the platform composition. The full preview retains its animated phase behavior.
5. The database card now renders a 2114 × 900 overview containing both 1057px pinned states. The full preview remains the 2200px scroll-driven interactive sequence.
6. The database object field was raised into the visible frame and the platform panel was corrected to the source's light surface and dark typography.

### Required fidelity surfaces

- Fonts and typography: captured Swizzy and PP Neue Montreal Mono fonts remain loaded locally; source headline, kicker, stat, and search-control hierarchy is preserved.
- Spacing and layout rhythm: both thumbnails now show their complete scaled hosts with the source section proportions and no generic catalog crop.
- Colors and visual tokens: the database surface uses the captured pale background; the platform panel uses the source white/black treatment.
- Image quality and assets: all imagery remains the downloaded source AVIF/SVG assets with source crops; no screenshot or placeholder replaces the React component.
- Copy and content: the source headings, descriptive copy, statistics, labels, and calls to action are unchanged.

No actionable P0, P1, or P2 card-preview differences remain. The expected difference is that the database card places its two scroll states side by side so the complete component can be understood without scrolling inside a thumbnail.

final result: passed

## What Is Flim source-position correction — 2026-08-23

- Source visual truth: the live `#intro-what-is-flim` section at the annotated 846 × 863 CSS-pixel viewport.
- Source states: `evidence/qa/source-what-position-enter.jpg` and `evidence/qa/source-what-position-merge.jpg`.
- Browser-rendered React states: `evidence/qa/component-card-what-position-enter.jpg` and `evidence/qa/component-card-what-position-merge.jpg`.
- Combined comparisons: `evidence/qa/compare-what-position-enter.jpg` and `evidence/qa/compare-what-position-merge.jpg`.

### Findings and fixes

1. **P1 — The component used the wrong intrinsic stage height.** The catalog preview compressed the source's 846 × 1913 section into a 1046px stage, which shifted the copy, floating images, platform header, and platform collage upward.
2. **P1 — Floating media used approximate compact-layout positions.** The four assets now use the live source's responsive anchors and aspect ratios for both the entry and merged states.
3. **P1 — The desktop platform image still affected the responsive layout.** Component-qualified display rules now hide it at this breakpoint and use only the downloaded mobile platform composition, matching the source DOM.
4. The card keeps the complete 846 × 1913 React surface and scales it uniformly inside the catalog. The apparent catalog scale is intentional; normalized positions match the live source to subpixel rounding.

### Verification

- Entry-state anchors, dimensions, copy baseline, platform start, and platform-header span match the source section.
- After the one-second transition settles, all four media tiles land at the same platform-grid anchors and proportions as the source.
- All images load with non-zero natural dimensions; the desktop platform image is hidden and the mobile platform composition is visible at the annotated viewport.
- Focused component tests and the production build pass after the geometry correction.

No actionable P0, P1, or P2 position differences remain for the annotated component.

final result: passed

## Animation and asset correction — 2026-08-23

- Source visual truth: the live `#intro-what-is-flim` transition and `#intro-scroll` physics/platform sequence, plus the captured source runtime scripts and `evidence/desktop/matched-02915.png`.
- Browser-rendered implementation: `evidence/qa/component-card-what-animation-final.jpg` and `evidence/qa/component-card-database-assets-final.jpg`.
- Same-viewport comparisons: `evidence/qa/compare-what-animation-current.jpg` and `evidence/qa/compare-database-assets-current.jpg` at 846 × 863 CSS pixels and device scale 1.

### Findings and fixes

1. **P1 — What Is Flim motion was invisible in the catalog card.** The card initialized in its merged end state. It now replays the source sequence: the four captured media tiles scale in at their floating positions, then transition into the final platform grid. Reduced-motion users receive the stable merged composition.
2. **P1 — Database assets were duplicated.** The shared image display rule overrode the mobile-image hidden state, so desktop and mobile panels rendered together. Component-qualified rules now show exactly one responsive asset set.
3. **P2 — Physics-object colors differed from the source.** Statistic pills now use the captured black/white palette, the 1.5M pill uses the source orange/white treatment, and the eye shell uses the source light gray.

### Verification

- The What Is Flim preview reports changing `reset`, `enter`, and `merge` phases and loops in both card and full-preview modes.
- The database desktop panel is `display: block`; its mobile counterpart is `display: none` at the annotated desktop viewport.
- Every image in both component shadow roots completes with a non-zero natural width.
- Computed database colors match the live source: black statistic pills, orange feature pill, white text, and a light-gray eye shell.

No actionable P0, P1, or P2 differences remain for the two annotated defects.

final result: passed
