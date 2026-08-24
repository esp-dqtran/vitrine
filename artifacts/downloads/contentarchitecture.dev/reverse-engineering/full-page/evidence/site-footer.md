# Site footer evidence packet

Component IDs: `site-footer`, `newsletter-form`, `footer-navigation`

Status: `verified` for structure, typography, responsive geometry, navigation,
sticky stacking, scroll reveal, shared animated background, and newsletter
client behavior. The live audience mutation is intentionally not executed.

## Downloaded sources

- DOM: `../../../2026-08-18T09-36-04-737Z/index.source.html`
- styles: `../../../2026-08-18T09-36-04-737Z/network-assets/d2ed906b7813000307abcbd3.css`
- reveal behavior:
  `../../../2026-08-18T09-36-04-737Z/network-assets/5c2d1f0fb0e0bed6fa3a757c.js`
- glyph-field scene and shader:
  `../../../2026-08-18T09-36-04-737Z/network-assets/cd0b42b2283151dd51423f11.js`
- glyph backdrop and base brightness model:
  `../../../2026-08-18T09-36-04-737Z/network-assets/3b1404194dab861afe57d62a.js`
- email capture, anti-spam, and state behavior:
  `../../../2026-08-18T09-36-04-737Z/network-assets/f73047df8a251905da257ffd.js`
- deferred email validation:
  `../../../2026-08-20-lazy-variants/network-assets/1p6253sx6d7f8.js`

## Structure

```text
footer[data-studio-chrome="showFooter"]
├── shared glyph-field background
├── reveal transform wrapper
│   └── vertical layout
│       ├── form/navigation row
│       │   ├── newsletter form
│       │   └── five-link navigation
│       └── rule and copyright metadata
└── reveal veil
```

The form retains the downloaded honeypot, hidden label, email input, paired
button labels, and responsive 448 px desktop maximum. Navigation and button
labels use the shared odometer text behavior. The `Get access` navigation item
also retains the downloaded 6 px orange status indicator and ping animation.

## Equal-viewport geometry

| Viewport | Footer height | Form width | Navigation height | Metadata height |
|---|---:|---:|---:|---:|
| 390 × 844 | 435.664 px | 358 px | 118.117 px | 61.547 px |
| 1024 × 768 | 411.430 px | 448 px | 123.273 px | 64.156 px |
| 1159 × 863 | 413.070 px | 448 px | 124.367 px | 64.703 px |
| 1280 × 720 | 414.570 px | 448 px | 125.383 px | 65.188 px |

Footer, layout, top-row, form, input, button, navigation, and metadata geometry
matched the downloaded replay at every required viewport.

## Scroll reveal

The downloaded footer computes `remaining = scrollLimit - scroll` and
`reveal = clamp(remaining / footerHeight, 0, 1)`, then applies:

- `translateY(reveal * footerHeight * 0.3)` to the content;
- `opacity = reveal * 0.7` to the black veil.

At a 436 px mobile footer height, reconstruction checks produced:

| Remaining distance | Content translate Y | Veil opacity |
|---:|---:|---:|
| 436 px | 130.8 px | 0.70 |
| 218 px | 65.4 px | 0.35 |
| 0 px | 0 px | 0 |

Reduced motion removes the transform and veil.

## Newsletter client behavior

The downloaded client validates a trimmed address with two exact messages:

- empty: `Enter your email address.`
- invalid: `Enter a valid email address.`

It starts a form timer at mount, records keyboard, mouse, touch, or click
interaction, blocks a filled `website` honeypot, blocks submissions under 1000
ms, and blocks submissions with no interaction. The exact spam messages are
retained in `NewsletterForm`. Successful state disables the input/button,
makes the input read-only, exposes `You're on the list.` through `role="status"`,
and resets the address after four seconds. Errors use `role="alert"`, red
`#dc2626`, `aria-invalid`, and `aria-describedby`.

Local browser verification covered:

- invalid address -> `Enter a valid email address.` and `aria-invalid=true`;
- valid address -> disabled/read-only input and `You're on the list.` status;
- four-second reset -> empty enabled input, no status, `aria-invalid=false`;
- success timer and listener cleanup on unmount.

The downloaded final transport is the server action `submitEmailCapture`. The
reconstruction replaces only that external list mutation with a deterministic
250 ms local success adapter; no live subscriber was created. This is an
intentional, named transport deviation rather than hidden behavior loss.

## Shared glyph-field background and stacking

The footer backdrop now uses the exact downloaded phrase data, 160 × 88
brightness model, background-only shader mode, non-interactive state, disabled
entrance, 30 FPS cap, deferred mount, and offscreen WebGL release policy. At
390 × 844 the 435.664 px footer uses a 390 × 448 buffered canvas, matching the
downloaded renderer's multiple-of-16 row allocation.

The footer is a sibling after the positioned `z-index: 1` main element, as in
the downloaded DOM. This prevents its sticky layer from painting over the FAQ
while still allowing the source reveal at the document bottom. A labeled live
check was used only for final canvas-pixel comparison because static replay
cannot serialize canvas pixels.
