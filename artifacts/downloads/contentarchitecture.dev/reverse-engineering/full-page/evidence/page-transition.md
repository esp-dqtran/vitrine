# ASCII page transition evidence

## Downloaded source

- Route trigger: primary navigation link `a[href="/blog"]`.
- Canvas marker: `body > canvas[data-ascii-curtain]`.
- Download supplement: `../../../2026-08-20-blog-route/`.
- Recovered JavaScript: `network-assets/577f4f2f83ec5c78-0ieve45mzn-y0.js`.
- JavaScript SHA-256: `ac6d0bf01844c554acc35e19816c94d9807239b29d091e756d8fde9fb19b01d9`.
- Recovered CSS: `network-assets/e24a310ff09628e2.css`.
- CSS SHA-256: `30a2d8c8d337ebe6690baa1e91000ccaccff052ebab2c2d8e2c62a533adab43e`.

## Recovered behavior

- The transition owns one fixed viewport canvas at `z-index: 9990` and enables
  pointer capture only during `cover` and `reveal`.
- The canvas backing store uses `min(devicePixelRatio, 2)` while its CSS size
  remains the viewport size.
- Columns are `round(innerWidth / 12)` and rows are
  `round(innerHeight / 17)`; the cell size is derived from those integer grid
  dimensions.
- Both phases use independently generated smooth two-dimensional noise fields,
  normalized to a maximum offset of `0.88`.
- The exact glyph string is
  `01<>[]{}()/\|=+*#%&$@!?;:.~01ABCDEF0123456789`.
- Glyphs are pre-rendered to a 12-level opacity atlas using a system monospace
  stack at `0.86 * cellHeight`.
- Normal motion lasts 720 ms for cover and 720 ms for reveal. Reduced motion is
  a 180 ms black opacity cover/reveal without glyphs.
- The route is committed only after cover completes, scroll is reset, and the
  destination is then revealed. Browser back uses the same lifecycle.

## React reconstruction

- `react-demo/src/components/AsciiPageTransition.jsx`
- Route orchestration and History API integration: `react-demo/src/App.jsx`.
- Styling and phase visibility: `react-demo/src/page.css`.

## Verification

- Desktop source sequence: `../../../2026-08-20-blog-route/evidence/desktop-transition-contact-sheet.png`.
- Desktop implementation frames: `../../../2026-08-20-blog-route/evidence/local-transition-01-0ms.png`
  through `local-transition-10-1750ms.png`.
- Combined source/implementation phase comparison:
  `../../../2026-08-20-blog-route/evidence/transition-source-vs-local.png`.
- Mobile source sequence: `../../../2026-08-20-blog-route/evidence/mobile-transition-01-0ms.png`
  through `mobile-transition-09-1700ms.png`.
- Verified route commit, destination render, idle cleanup, home navigation, and
  animated browser-back navigation.

Status: verified.
