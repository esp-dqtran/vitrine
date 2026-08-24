# Showcase section evidence

Component: `showcase-section`

Reconstruction:
`react-demo/src/components/ShowcaseSection.jsx`

Repeated child:
`react-demo/src/components/AsciiShowcaseCard.jsx`

## Downloaded evidence

- DOM anchor: `[data-page-builder-section="showcaseSection"]`
- Root structure: glyph backdrop, intro block, eleven-card grid
- Downloaded page HTML:
  `../../../2026-08-18T09-36-04-737Z/index.source.html`
- Downloaded CSS and JavaScript responses:
  `../../../2026-08-18T09-36-04-737Z/network-assets/`
- Asset inventory:
  `../../../2026-08-18T09-36-04-737Z/network-assets-manifest.json`

The repeated card renderer and its eleven local AVIF assets were already
verified independently. This pass verified the owning section, intrinsic
layout, responsive grid, animated intro, external recognition links, and
shared WebGL backdrop.

## Corrected reconstruction failures

- removed fixed desktop and mobile section heights;
- restored intrinsic height from padding, intro, grid, and card content;
- corrected desktop grid gap from `72px 16px` to `64px 24px`;
- corrected mobile grid gap to `32px 24px`;
- restored `80px` intro separation at every viewport;
- restored `16px` intro flex gap and a `600px` copy measure;
- removed a stale broad paragraph selector that overrode the recovered copy's
  fluid type and shortened the 1280px intro by `2.8125px`;
- restored fluid `14px` to `16px` card labels and their 12px media gap;
- restored 16px mobile side padding;
- replaced the approximate DOM text texture with the recovered deferred,
  30 FPS WebGL glyph backdrop and its exact showcase phrase;
- restored the downloaded Awwwards, FWA, and CSSDA links;
- moved `ShowcaseSection` out of `App.jsx` into its own React component.

## Responsive geometry

Source and React values below matched after font load, viewport reload, section
entry, and animation settlement. Values are CSS pixels.

| Viewport | Section height | Intro height | Grid height | First card |
|---|---:|---:|---:|---|
| 390 x 844 | 3258.484 | 174.602 | 2859.883 | 358 x 230.898 |
| 1024 x 768 | 2443.414 | 120.945 | 1922.469 | 420 x 267.078 |
| 1159 x 863 | 2676.492 | 124.570 | 2151.922 | 487.5 x 305.320 |
| 1280 x 720 | 2885.320 | 127.758 | 2357.563 | 548 x 339.594 |

The immutable DOM snapshot contains line wrappers produced at its capture
viewport. Those wrappers are not used as mobile geometry evidence. Responsive
line wrapping was checked after hydration against the final live reference,
while the implementation source remained the downloaded HTML, CSS, JavaScript,
and assets.

## Visual and behavior checks

- source and React screenshots were captured together at all four required
  viewports;
- desktop and mobile card positions, aspect ratios, labels, gaps, and section
  boundaries align;
- the section background uses the recovered WebGL phrase renderer rather than
  generated placeholder text;
- heading line entry and card-title entry respect reduced motion;
- card image/ASCII hover and coarse-pointer activation remain owned by the
  already verified shared `AsciiShowcaseCard` implementation;
- all eleven links retain their real targets and local visual assets.
- the final assembly recheck matched the 1280px root, intro, copy, grid, and
  cards exactly; the 1024px and 1159px compositor delta is below `0.05px`.

## Result

`showcase-section` passes its DOM, style, responsive, asset, behavior,
accessibility, and lifecycle gates. The repeated `ascii-reveal-card` remains a
single shared React implementation.
