# FAQ section evidence packet

Component IDs: `faq-section`, `faq-item`

Status:

- `faq-item`: verified
- `faq-section`: verified

## Downloaded sources

- DOM: `../../../2026-08-18T09-36-04-737Z/index.source.html`
- initial network document: `../../../2026-08-18T09-36-04-737Z/raw.html`
- styles: `../../../2026-08-18T09-36-04-737Z/network-assets/d2ed906b7813000307abcbd3.css`
- interaction chunk: `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`
- glyph-field scene and shader:
  `../../../2026-08-18T09-36-04-737Z/network-assets/cd0b42b2283151dd51423f11.js`
- glyph backdrop, base brightness model, and claims-data builder:
  `../../../2026-08-18T09-36-04-737Z/network-assets/3b1404194dab861afe57d62a.js`
- exact Geist Sans font SHA-256:
  `a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8`
- exact Geist Mono font SHA-256:
  `fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab`

## Structure

```text
section[data-page-builder-section="faqSection"]
├── animated background
└── twelve-column layout wrapper
    ├── sticky intro (columns 1–4)
    │   ├── h2
    │   └── CTA
    └── ul (columns 6–12)
        └── li[data-studio-item="items.N"] × 16
            ├── h3 > button[aria-expanded][aria-controls]
            └── animated answer panel
```

The reconstruction initially omitted the layout wrapper. Restoring it was
required for desktop parity.

## Content and state

- Source keys: `items.0` through `items.15`.
- Initial open key: first FAQ item.
- Clicking a closed item opens it and closes the previous item.
- Clicking the open item closes it, leaving every item collapsed.
- Closed panels are `inert`.
- The open icon rotates the vertical stroke by 90 degrees, producing a minus.
- Panel height and opacity animate for 400 ms with cubic bezier
  `[0.7, 0, 0.25, 1]`; reduced motion uses zero duration.

## Equal-viewport geometry

The downloaded offline replay and React reconstruction produced identical
measurements at all required viewports after captured font loading was fixed.

| Viewport | Section height | List width | List height | First answer height |
|---|---:|---:|---:|---:|
| 390 × 844 | 1752.164 px | 358 px | 1396.750 px | 129.328 px |
| 1024 × 768 | 1640.016 px | 497.328 px | 1320.016 px | 124.703 px |
| 1159 × 863 | 1615.516 px | 576.086 px | 1295.516 px | 127.516 px |
| 1280 × 720 | 1596.750 px | 646.664 px | 1276.750 px | 108.750 px |

At all four viewports, section height, wrapper position, heading geometry, list
position and size, button height, answer height, and CTA position matched with a
measured delta of `0 px`.

## Shared glyph-field background

The renderer was rebuilt from the downloaded WebGL scene rather than from the
blank static canvas. The FAQ phrase serialized in `raw.html` is:

`BEFORE YOU BUY · ASK ANYTHING · LIFETIME UPDATES INCLUDED · TWO EDITIONS ONE ARCHITECTURE · FOR NEXT.JS AND ASTRO · NO SUBSCRIPTION NO SEATS · PRIVATE REPO ACCESS FOR GOOD · CLONE IT RENAME IT SHIP · USE IT ON EVERY CLIENT PROJECT · STILL UNSURE JUST EMAIL ·`

The reconstruction preserves the downloaded 160 × 88 brightness model,
background-only twinkle mode, non-interactive state, disabled entrance, 30 FPS
render cap, 400 px deferred-mount margin, 100% offscreen release margin,
multiple-of-16 background row buffering, visibility/intersection pausing, and
reduced-motion behavior. At 390 × 844, the mounted canvas covered the exact
1752.164 px section and allocated a 390 × 1792 backing surface. A labeled live
site check was used only to validate the otherwise uncaptured canvas pixels;
the downloaded shader and serialized data remained the implementation source.
