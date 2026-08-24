# Pricing section evidence

Components: `pricing-section`, `trusted-row`, `pricing-card`, and
`included-features`

Reconstruction:
`react-demo/src/components/PricingSection.jsx`

## Downloaded evidence

- DOM anchor: `[data-page-builder-section="pricingSection"]`
- Downloaded HTML:
  `../../../2026-08-18T09-36-04-737Z/index.source.html`
- Downloaded CSS:
  `../../../2026-08-18T09-36-04-737Z/assets/700c04d97e014d11711bb107.css`,
  `../../../2026-08-18T09-36-04-737Z/assets/d2ed906b7813000307abcbd3.css`,
  and `../../../2026-08-18T09-36-04-737Z/assets/dfc466a93f24484dbcff6d42.css`
- Pricing, status, odometer, and viewport behavior evidence:
  `../../../2026-08-18T09-36-04-737Z/network-assets/3b1404194dab861afe57d62a.js`,
  `../../../2026-08-18T09-36-04-737Z/network-assets/48ef6040a1f791a105273355.js`,
  `../../../2026-08-18T09-36-04-737Z/network-assets/4eccbd99aba5cb1301f766bf.js`,
  `../../../2026-08-18T09-36-04-737Z/network-assets/5c2d1f0fb0e0bed6fa3a757c.js`,
  and `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`

## Recovered component structure

- one responsive 12-column pricing grid;
- one three-line heading and one trusted-engineers row;
- five overlapping, locally served 32px avatars;
- two instances of a shared `PricingCard` private component;
- each card contains a label/status header, two odometer prices, two indexed
  detail rows, two 4px connectors, and the shared `SplitButton` component;
- one shared included-features block with nine indexed rows;
- exact checkout URLs and external-link metadata for both editions.

The previous reconstruction only happened to match the downloaded section
height at one desktop width. It used a fixed card height, 12px mobile gutters,
28px mobile gaps, 7px captions, a two-column mobile feature list, and a fixed
included-panel height. Those compensating approximations produced a visibly
wrong mobile section. The replacement uses the downloaded intrinsic layout,
fluid type scale, and breakpoint-specific padding and columns.

## Responsive geometry

Downloaded source and React direct-child geometry matched at all required
widths. Values are CSS pixels; small top-coordinate differences below 0.2px
are browser subpixel scroll alignment.

| Viewport width | Section height | Heading | Cards | Included panel |
|---:|---:|---:|---:|---:|
| 390 | 1329.664 | 358 x 106.242 | 358 x 562.188 | 358 x 295.234 |
| 1024 | 1184.586 | 424 x 133.570 | 864 x 374.047 | 864 x 228.969 |
| 1159 | 1176.477 | 491.5 x 139.383 | 999 x 358.484 | 999 x 230.609 |
| 1280 | 1183.813 | 552 x 144.586 | 1120 x 359.164 | 1120 x 232.063 |

At 390px, direct-child coordinates match as well: heading at `x=16, y=72`,
trusted row at `y=242.422`, cards at `y=338.422`, and included features at
`y=964.609`.

## Behavior, accessibility, and assets

- price digits remain at zero before the section enters the viewport and roll
  to their target values on first intersection;
- the source status badge's 6px steady dot, expanding ping, 8px internal gap,
  tracking, dimensions, and reduced-motion suppression are reproduced;
- hovering the trusted row changes the local avatar filter from
  `grayscale(1)` to `grayscale(0)` after the 300ms transition;
- reduced motion intentionally preserves the downloaded rendered behavior:
  visual prices remain `€000` while the screen-reader labels remain `€399`
  and `€549`;
- both `Get access` anchors expose the correct accessible name, checkout URL,
  `_blank` target, and `noopener noreferrer` relationship;
- all five local avatar requests completed with 64 x 64 intrinsic images and
  empty alternative text because the image stack is decorative;
- avatar SHA-256 values are recorded by the immutable capture and local asset
  validation; no image is hotlinked from the React reconstruction.

## Result

The pricing section and all three manifested child component groups pass their
DOM, style, responsive, behavior, accessibility, asset, and lifecycle gates.
The section now lives in its own React file and no longer depends on fixed
desktop measurements embedded in `App.jsx`.
