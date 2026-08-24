# Features section evidence

Component IDs: `features-section`, `features-intro`, `feature-item`,
`glyph-field`.

## Downloaded evidence

- Exact section invocation, responsive classes, heading, rich text, nine item
  keys, titles, body copy, and mobile spacer:
  `../../../2026-08-18T09-36-04-737Z/raw.html`.
- `GlyphFieldScene`, module `756708`, including shader programs, atlas creation,
  texture orientation, model placement, entrance, hover, click ripple,
  visibility/intersection lifecycle, resize behavior, and reduced motion:
  `../../../2026-08-18T09-36-04-737Z/network-assets/cd0b42b2283151dd51423f11.js`.
- Base 160 by 88 brightness model, module `259878`, plus the claims atlas and
  `buildOrbClaimsData`, module `42831`:
  `../../../2026-08-18T09-36-04-737Z/network-assets/3b1404194dab861afe57d62a.js`.
- Benefits phrase construction, module `404526`:
  `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`.
- Responsive caption, body, and headline tokens:
  `../../../2026-08-18T09-36-04-737Z/assets/d2ed906b7813000307abcbd3.css`.

The reconstructed brightness bytes are identical to module `259878`: 14,080
bytes with SHA-256
`83eb0d14368409c068eb9bafb4a072546cd5aef4ba21af92ba23a5f133c862e8`.

## Reconstructed component tree

```text
FeaturesSection
├── full-section glyph background
│   ├── sticky viewport-height GlyphField on desktop
│   └── 30 percent black wash
├── five-column content area
│   ├── features intro
│   │   ├── AnimatedText heading
│   │   └── AnimatedText rich text
│   └── nine feature items
│       ├── AnimatedText numbered title
│       └── AnimatedText body
└── mobile-only square spacer
```

Implementation:

- `react-demo/src/components/FeaturesSection.jsx`
- `react-demo/src/recovered/glyph/GlyphField.jsx`
- `react-demo/src/recovered/glyph/glyphData.js`
- `react-demo/src/recovered/glyph/glyphFieldCore.js`
- `react-demo/src/recovered/text/AnimatedText.jsx`
- `react-demo/src/page.css`

## DOM, content, and geometry verification

The reconstruction preserves all nine downloaded source keys and
`data-studio-item="items.N"` markers. Each title is passed to `AnimatedText` as
one string so React child coercion cannot insert commas and change line wraps.

The recovered line splitter measures atomic inline-block words while retaining
spaces as sibling text nodes, matching the downloaded SplitText implementation.
Reduced motion bypasses line splitting and keeps native text flow.

At `390 x 844`, source and reconstruction match:

- section: `390 x 2293.171875`, with `72px 0 64px` padding;
- grid and content column: `x=16`, `358px` wide;
- intro: `243.5703125px` high with a `32px` gap;
- heading: `106.2421875px` high;
- feature list: `1443.6015625px` high, `80px` top margin, `64px` gaps;
- every feature item width and all nine item heights;
- mobile-only spacer: `390px` high.

At `1159 x 863`, source and reconstruction match:

- section: `1159 x 3081.203125`, with `160px` block padding;
- twelve-column grid with `80px` inline padding;
- five-column content area: `x=80`, `406.9140625px` wide;
- intro: `342.0625px` high;
- feature list: `2339.140625px` high with the downloaded repeating
  `0%`, `20%`, `40%` horizontal offset pattern;
- all nine item widths and heights;
- mobile spacer hidden.

The required breakpoint and wide-desktop checks also match:

| Viewport and state | Section height | Intro height | List height |
|---|---:|---:|---:|
| `1024 x 768`, reduced motion | `3309.0625` | `330.9375` | `2578.125` |
| `1024 x 768`, motion enabled | `3327.890625` | `330.9375` | `2596.953125` |
| `1280 x 720`, reduced motion | `2936.90625` | `330.71875` | `2206.1875` |

At `1024 x 768`, the motion-enabled source intentionally adds one line to the
eighth title/body stack compared with its native reduced-motion flow. The React
reconstruction reproduces both states and all nine measured item rectangles.

## Glyph-field behavior verification

- Atlas texture orientation matches the downloaded renderer with
  `flipY: false`; the brightness texture independently uses `flipY: true`.
- Normal motion reproduces the radial entrance and settles to the phrase-based
  field.
- Pointer hover reveals the `CLICK` label and dims the local glyph region.
- Clicking produces the downloaded expanding bright scramble ripple.
- Reduced motion renders the fully entered static field immediately, without a
  running animation loop or a blank entrance frame.
- Font readiness rebuilds the atlas and triggers a fresh render.
- Resize, visibility, and intersection observers update or pause rendering;
  cleanup removes the canvas and releases its WebGL context.

Equal-state source and React captures were compared together at desktop and
mobile sizes. The live page was used only as a labeled hydration-gap/final
visual reference; the implementation source is the downloaded files above.
