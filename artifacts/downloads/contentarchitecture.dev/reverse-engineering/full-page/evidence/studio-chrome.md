# Studio chrome evidence packet

Component IDs: `page-minimap`, `studio-field-overlay`, `studio-panel`,
`studio-section-editor`

Status:

- `page-minimap`: verified
- `studio-field-overlay`: verified for selection, labels, geometry updates, and
  the downloaded desktop/non-touch availability gate
- `studio-panel`: shell, entrance, drag, focus return, tabs, Escape behavior,
  and page-chrome controls verified
- `studio-section-editor`: verified for the downloaded section manifest,
  editable text and rich text, media/image previews, link/radio option pills,
  static booleans, arrays, focus synchronization, and item reordering

## Downloaded sources

- minimap renderer and Studio toggle event:
  `../../../2026-08-18T09-36-04-737Z/network-assets/5c2d1f0fb0e0bed6fa3a757c.js`
- Studio controller, desktop/non-touch gate, Escape state machine, and lazy
  dependency URLs:
  `../../../2026-08-18T09-36-04-737Z/network-assets/471bb6565233dea39d0bd204.js`
- deferred field overlay:
  `../../../2026-08-20-studio-overlay/network-assets/2_i-c-emqkkqu.js`
- deferred panel and section editor:
  `../../../2026-08-20-studio-overlay/network-assets/12ltxp8b9pgux.js`
- supplement manifest:
  `../../../2026-08-20-studio-overlay/capture-manifest.json`

The original capture contained the controller and all deferred URLs but had not
activated the minimap. Nine public lazy chunks were therefore recovered into a
separately dated supplement without modifying the immutable capture.

## Minimap renderer

The source does not use a fixed miniature or screenshot. It:

1. inventories leaf headings, paragraphs, list items, blockquotes, media,
   canvases, buttons, and fields inside every `[data-page-builder-section]`;
2. expands text into `Range.getClientRects()` and caps the overview at 1,500
   rectangles;
3. classifies rectangles as `text`, `media`, or `accent`;
4. derives `sx` from minimap width / page width and `sy` from minimap height /
   viewport height;
5. sizes each canvas to `ceil(documentHeight * sy)`;
6. draws white and accent layers at the downloaded alpha values;
7. translates both layers by `-scrollY * sy` and counter-animates the accent
   layer inside the moving scanner;
8. remeasures after fonts, body resize, viewport resize, and delayed layout
   settling.

At `1280 x 720`, both pages place the minimap at `x=1168`, `y=16`, with a
`96 x 54` root. The source document is `12693 px` tall and produces a `952 px`
canvas; the current React assembly is `12617 px` tall and produces a `947 px`
canvas. Both values equal `ceil(documentHeight * 54 / 720)`. The five-pixel
difference is an assembly-height delta, not a minimap scaling deviation.

## Panel geometry

At `1280 x 720`, the downloaded panel and React panel have the same settled
boxes:

| Box | Downloaded | React |
|---|---|---|
| dialog | `864,86 400x414.84375` | `864,86 400x414.84375` |
| inner shell | `872,94 384x398.84375` | `872,94 384x398.84375` |
| terminal header | `384x34` | `384x34` |
| intro + tabs | `384x102.84375` | `384x102.84375` |
| page controls | `384x262` | `384x262` |

The responsive caption font uses the downloaded equation
`12 + (14 - 12) * ((100vw - 375) / (1600 - 375))`, yielding `13.4776 px` at
1280 px. Recovering that equation removed the final panel-height mismatch.

## Behavior verification

- The original controller is active only at the `lg` breakpoint on a
  non-touch device outside draft mode. At a local `390 x 844` viewport, the
  minimap remains visible but activating it creates no dialog or field overlay.
- Opening at desktop exposes the page, content, SEO, and agents tabs and the
  same accessible dialog label and control text as the downloaded panel.
- The overlay produced 80 local field buttons at the fresh desktop state. The
  source produced 63 at that state because offscreen content-visibility and
  collapsed/inert fields have zero geometry; both implementations exclude
  inert and zero-size fields and remeasure on scroll and resize.
- Activating `Edit Eyebrow` opened section `#1`, selected `mainHeroSection`,
  marked exactly one overlay field active, and exposed the eyebrow editor.
- Editing the eyebrow changed the React hero to `STUDIO EDIT VERIFICATION` and
  restoring the input restored `BUILT FOR AGENTIC DEVELOPMENT.`.
- First Escape while a section is open returns the panel to its page state.
  Second Escape disarms Studio, removes all field controls, and returns focus to
  `Inspect this page in Studio mode`.
- Drawer, header, footer, and minimap switches each changed `aria-checked` to
  `false`, removed exactly one owned component, then restored it with
  `aria-checked="true"`.
- A real pointer drag moved the panel from `864,86` to `784,126`, producing
  `translate(-80px, 40px)`. Release retained that position, matching the
  downloaded zero-elastic, no-momentum free panel drag.

## Section-editor reconstruction

`react-demo/src/components/StudioSectionEditor.jsx` now contains the recovered
page-section manifest from module `682007` and the type renderer from module
`570641`. DOM markers determine whether a field is present and which array
indices exist; the downloaded manifest determines title, type, editability,
options, and array children.

The reconstructed field paths are:

- `string` / `text`: downloaded normalization, one-line input or three-row
  textarea, focus synchronization, and direct local page writeback;
- `richText`: downloaded style/decorator/link toolbar, editable local content,
  focus behavior, and reload reset;
- `media` / `image`: exact nested `currentSrc` preview with source dimensions,
  option pills when a preview is absent, and `No preview` fallback;
- `link` / `radio`: downloaded option order, label, sublabel, first-option
  accent state, wrapping, and non-mutating display behavior;
- `boolean`: downloaded static off switch;
- `array`: indices derived from `data-studio-field`, child fields filtered by
  exact marker, and reorder handles only when every corresponding
  `data-studio-item` exists.

The clean reconstruction does not send Sanity patches. The captured page has no
Sanity dataset or authoring session, so rich edits use the same documented
local-demo boundary as the rest of the panel: visible client behavior works and
reload restores the snapshot, while external CMS persistence is intentionally
absent.

## Complex-path verification

At `1280 x 720`, source and React produced the same selected Main Hero editor:

| Box | Downloaded | React |
|---|---|---|
| dialog width | `400` | `400` |
| field controls | `352` wide | `352` wide |
| title textarea | `352 x 88` | `352 x 88` |
| rich-text editor | `350 x 90.09375` | `350 x 90.09375` |
| style select | `70.5 x 20` | `70.5 x 20` |

Opening the first Showcase media marker produced eleven array cards in both
pages. Each card measured `352 x 323.75`; its local/source image preview measured
`316 x 177.75`; and its title input measured `330 x 36.5234375`. The React
preview uses the downloaded local AVIF while the source uses the corresponding
Sanity CDN response.

A real pointer drag on the first React reorder handle changed the page order
from `items.0, items.1, items.2` to `items.1, items.2, items.3, ...` and changed
the panel's first inputs to `House of Honey`, `Aspen Search`, and `Anuc Home`.
Reload restored `Good Fella` first, proving both DOM reordering and local reset.

The captured page does not instantiate top-level link, radio, or boolean fields
in visible section DOM. Their recovered marker contracts were therefore
exercised without changing project files: temporary browser-only markers were
applied to the same source and React nodes. Source and React then produced the
same Action and CTA text, option order, wrapping, active colors, and exact pill
geometry. The `Email Capture` pill was `123.109375 x 26.84375`; the Internal
Link pill was `144.6953125 x 26.84375`. A temporary `showCta` marker produced
the same `352 x 16` static boolean row and off switch in both pages.

The shared SplitButton was rechecked from a clean page state as part of this
pass. Source and React matched at `183.6015625 x 48`, including the two word
boxes, 6 x 26 connector, 6px status dot, and all nine hover tracks settling at
approximately `translateY(-77.39px)`.

## Result

The panel and section editor pass all applicable DOM, style, behavior,
accessibility, asset, and local-lifecycle gates for the immutable page capture.
