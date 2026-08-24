# Testimonials section evidence

Components: `testimonials-section`, `testimonial-card`, and
`testimonial-controls`

Reconstruction:
`react-demo/src/components/ReviewsSection.jsx`

## Downloaded evidence

- DOM anchor: `[data-page-builder-section="testimonialsSection"]`
- Carousel role/name: `group`, `Testimonials`
- Three slides labelled `1 of 3: Julian Fella` through
  `3 of 3: Malik Kotb`
- Controls: `Previous slide`, `Next slide`, visible counter, and polite
  screen-reader status
- Downloaded HTML:
  `../../../2026-08-18T09-36-04-737Z/index.source.html`
- Downloaded CSS and behavior chunks:
  `../../../2026-08-18T09-36-04-737Z/network-assets/`

## Recovered structure and behavior

- deferred shared WebGL glyph backdrop;
- native horizontal overflow rather than a transform-only imitation;
- mandatory x-axis scroll snapping with center-aligned slides;
- 90% mobile slides with 16px edge gutters and 6px gaps;
- 55% desktop slides with 80px edge gutters and 16px gaps;
- intrinsic equal-height cards driven by the tallest quote;
- previous/next controls that clamp at the first and last slide;
- scroll-driven active-index updates for touch, wheel, trackpad, or controls;
- reduced-motion branch that replaces smooth scrolling with immediate scrolling;
- polite `Slide N of 3` status updates.

The original reconstruction used fixed heights, a translated track, looping
controls, shortened copy, incorrect figure margins, and a DOM text background.
Those approximations were removed. The exact third quote and attribution
capitalization were restored from the downloaded component evidence.

## Responsive geometry

Source and React values matched at the required viewports after font load and
reload. Values are CSS pixels.

| Viewport | Section | Track/card | First slide width | Controls top gap |
|---|---|---|---:|---:|
| 390 x 844 | 390 x 548 | 390 x 312 / 351 x 312 | 367 | 48 |
| 1024 x 768 | 1024 x 1037.758 | 1024 x 697.758 / 563.195 x 697.758 | 643.195 | 64 |
| 1159 x 863 | 1159 x 1012.609 | 1159 x 672.609 / 637.445 x 672.609 | 717.445 | 64 |
| 1280 x 720 | 1280 x 981.758 | 1280 x 641.758 / 704 x 641.758 | 784 | 64 |

## Interaction and visual checks

- initial previous control is disabled and next control is enabled;
- activating Next moves both source and React tracks to `scrollLeft: 472.5`
  at 1159 x 863;
- both announce `Slide 2 of 3` and enable both controls in the second state;
- native manual scrolling updates the same active state;
- source and React screenshots were captured together at mobile and desktop;
- card surface colors match the downloaded `#232323` figure on a `#000000`
  shell;
- avatars, role text, quote wrapping, spacing, and backdrop are local assets or
  recovered local rendering code.

## Result

The testimonial section, cards, and controls pass their DOM, style, responsive,
behavior, accessibility, asset, and lifecycle gates. The section now lives in
its own React component instead of remaining embedded in `App.jsx`.

