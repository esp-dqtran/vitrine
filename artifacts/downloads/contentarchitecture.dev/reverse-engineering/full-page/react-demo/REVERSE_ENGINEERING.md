# Full-page reconstruction

This project is a frontend-only React reconstruction of `https://www.contentarchitecture.dev/`, built from browser-observed structure, computed layout, responsive screenshots, interaction states, and locally recovered public assets.

## Page architecture

The page is composed in `src/App.jsx` from these sections, in source order:

1. Fixed desktop/mobile navigation and scroll minimap
2. Viewport-height hero with the animated spiral scene and scroll-to-next-section control
3. Problem statement and terminal-style diagnostic panel
4. Long-scroll feature narrative with the animated glyph field
5. Interactive Next.js/Astro repository explorer
6. Eleven-project ASCII reveal showcase
7. Three-slide customer review carousel
8. Two-edition pricing and inclusion matrix
9. Seventeen-question FAQ accordion
10. Closing call-to-action and newsletter footer

## Reusable reconstructed components

- `src/recovered/menu/`: responsive desktop and mobile navigation cards.
- `src/recovered/spiral/`: WebGL text-spiral hero scene.
- `src/recovered/glyph/`: long-scroll animated glyph field.
- `src/components/AsciiImage.jsx`: converts an arbitrary local image into a responsive ASCII canvas.
- `src/components/AsciiShowcaseCard.jsx`: reusable image/ASCII reveal card with pointer and touch behavior.
- `src/components/RepoExplorer.jsx`: edition switcher, file tree, source panel, minimap, and terminal strip.

## Assets and content

Public images and fonts used by the reconstruction are stored under `public/assets/`; the page does not hotlink its visual assets from the source site. Source copy and structured content are stored in `src/content.json`.

## Responsive contract

- Desktop reference viewport: `1280 x 720`, device pixel ratio `2`.
- Mobile reference viewport: `390 x 844`, device pixel ratio `1`.
- Desktop document height: `12694px` (source: `12693px`, one-pixel rounding difference).
- Mobile document height: `12832px`, matching the source capture.

## Interaction contract

- Navigation expands/collapses on mobile and scrolls to local sections.
- The desktop hero scroll cue reproduces the source control geometry and scrolls to the midpoint of the next section.
- Repository explorer switches between Next.js and Astro editions and updates the file tree/source panel.
- Showcase cards reveal the original image over their generated ASCII representation on pointer hover or touch activation.
- Review controls cycle through three testimonials.
- FAQ rows expand independently and expose their state through `aria-expanded`.

## Boundaries

This is a clean frontend reconstruction, not recovered proprietary source code. Commerce, account, newsletter, and external destination links remain presentation-only or point to the original public destination; no source backend was copied.

The stricter audit process is documented in `REVERSE_ENGINEERING_PROCESS.md`. The full-page QA gate remains blocked until source-only repository and Studio-mode controls are either reconstructed or explicitly removed from the requested scope.
