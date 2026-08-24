# Melius Footer — downloaded-source reverse-engineering spec

## Evidence boundary

This component was reconstructed from the downloaded Melius home capture only.

- Hydrated HTML and CMS data: `2026-08-20-home/raw.html`
- Footer runtime module `58261`: `2026-08-20-home/network-assets/18496ddd88e776d5853e.js`
- Newsletter runtime module `91842`: same downloaded bundle
- Easter-egg runtime module `11445`: same downloaded bundle
- Compiled styles: `2026-08-20-home/network-assets/33937522490f8ff3aa27.css`
- Asset URL-to-file mapping: `2026-08-20-home/capture-manifest.json`

Screenshots were not used as implementation truth. Geometry and behavior were verified from the source and reconstructed DOM, computed styles, element boxes, attributes, and event state.

## React breakup

```text
MeliusFooter
├── dotted background layer
├── scroll target
│   └── inner layout
│       ├── FooterWordmark
│       └── panel
│           ├── newsletter
│           │   └── NewsletterForm
│           ├── footer navigation
│           │   └── FooterLinkGroup × 3
│           │       ├── mobile accordion
│           │       └── desktop link column
│           └── FooterMeta
│               ├── FooterStatus
│               ├── copyright
│               ├── legal links
│               └── Cookie Preferences action
└── FooterEasterEgg
```

Implemented files:

- `react-demo/src/components/MeliusFooter.jsx`
- `react-demo/src/components/FooterWordmark.jsx`
- `react-demo/src/components/NewsletterForm.jsx`
- `react-demo/src/components/FooterLinkGroup.jsx`
- `react-demo/src/components/FooterMeta.jsx`
- `react-demo/src/components/primitives/FooterStatus.jsx`
- `react-demo/src/components/FooterEasterEgg.jsx`
- `react-demo/src/styles.css`

## Source content

Newsletter:

- Title: `Don't miss out`
- Description: `Enter your email for news and updates`
- Form id suffix: `footer-newsletter`
- Success: `Thanks for subscribing!`
- Error: `Something went wrong. Please try again.`
- Request: `POST /api/newsletter`, JSON `{ email }`

Link columns:

- Product: Web App, Desktop App, Pricing, Models, Enterprise, Docs, MCP
- Company: About, Blog, Manifesto, Brand, Contact, Careers
- Community: X, LinkedIn, Instagram, Discord
- Legal: Terms of Service, Privacy Policy, Cookie Preferences
- Copyright: `© 2026 Melius AI, Inc.`

The reconstructed hrefs and `_blank` targets match the downloaded CMS payload. In particular, Pricing and Models are `/pricing` and `/models`; they are not in-page hash links.

## Desktop layout contract

Verified at 1280 × 720:

| Node | x | y relative to footer | width | height |
|---|---:|---:|---:|---:|
| Footer | 0 | 0 | 1280 | 671.8828 |
| Scroll target | 0 | 0 | 1280 | 671.8828 |
| Inner/panel | 64 | 200 | 1152 | 407.8828 |
| Newsletter | 100 | 232 | 360 | 270.5625 |
| Link groups | 520 | 252 | 644 | 250.5625 |
| Meta | 100 | 538.5625 | 1080 | 37.3203 |
| Wordmark | 179.2031 | 62.7578 | 921.5938 | 165.3516 |

Desktop rules:

- Outer horizontal padding: `5vw`
- Top padding: `200px` from 768px; `280px` at 1536px and above
- Bottom padding: `5vw`
- Panel max width: `1280px`; radius `8px`; background `#2a2a2a`
- Panel padding: `32px 36px`
- Newsletter form width: `360px`
- Groups: row, `76px` gap, margins `20px 16px 0 60px`
- Meta: `36px` top margin, `20px` top padding, row layout

## Mobile layout contract

Verified at 390 × 844 with all groups closed:

| Node | x | y relative to footer | width | height |
|---|---:|---:|---:|---:|
| Footer | 0 | 0 | 390 | 640.8203 |
| Panel | 19.5 | 100 | 351 | 521.3203 |
| Wordmark | 54.6016 | 58.1875 | 280.7969 | 50.3750 |
| Main | 39.5 | 128 | 311 | 303.0391 |
| Newsletter | 39.5 | 128 | 311 | 113.8438 |
| Groups | 39.5 | 297.8438 | 311 | 133.1953 |
| Meta | 39.5 | 463.0391 | 311 | 130.2813 |

Mobile rules:

- Scroll target padding: `100px 5vw 5vw`
- Panel padding: `28px 20px`
- Groups: column, `56px` top margin, `36px` gap
- Meta: `32px` top margin, `24px` top padding, column layout
- Desktop link columns are hidden; each mobile column has its own collapsible accordion.

## Interaction state machines

### Wordmark

1. Footer enters at 30% intersection.
2. Wordmark changes from `translateY(100%) scale(.95)` to its shown state.
3. Duration is `600ms`; easing is cubic-out.
4. Non-touch pointer entry starts a radial reveal through the downloaded horizontal-lockup mask.
5. The reveal radius is clamped from `90px` to `180px` and tracks pointer coordinates.
6. Reduced-motion disables the animated reveal.

### Newsletter

```text
idle -> loading -> success
              └-> error -> Try Again -> idle
```

- Email is required and uses the source email input semantics.
- Submit is disabled while loading.
- Production behavior posts JSON to `/api/newsletter`.
- Success and error content replace the input field, matching the source presence transition.

### Mobile link group

```text
closed -> opening -> open -> closing -> closed/hidden
```

- Each column owns independent state.
- `aria-expanded`, `aria-controls`, `aria-labelledby`, `data-state`, and region semantics are present.
- Measured content height drives the animation.
- Open/close duration: `300ms`.
- Timing: `cubic-bezier(.76, 0, .24, 1)`.
- Product open height: `254.2422px`; group height becomes `274.6406px`.
- Footer height becomes `895.0625px` when Product is open at 390px.

### Cookie Preferences

- Footer action is a button, not a link.
- It calls the parent consent-dialog controller.
- Isolated `/footer` route includes the same React dialog so this interaction can be verified without loading the whole page.

### Status

- Source requests `/api/status` and maps ongoing incidents to `issue`; failures fall back to `operational`.
- The reconstructed primitive accepts the status as data so the two visual states are independently renderable without coupling the reusable component to the source API.

### Bottom-scroll easter egg

1. Root exists at `height: 0`.
2. Positive wheel/touch delta counts only while the document is at the bottom.
3. Leaving the bottom or reversing direction resets accumulated delta.
4. At `240px` accumulated delta the root expands to `100svh`.
5. The coin, masked color shape, looping carousel, and signup CTA enter in sequence.
6. All 36 downloaded easter-egg images form the shuffled source pool; the DOM renders only enough cards to cover the current viewport.
7. At 1280px the source and reconstruction render 25 cards (`134 × 166px`, `67px` step). At 390px both render 22 cards (`75 × 93px`, `26.25px` step).
8. The carousel moves right at `42px/s` on desktop and `28px/s` on mobile, wraps continuously, and recomputes each card's vertical sine-curve position while moving.
9. Hovering a card eases the stream to a stop, adds pointer-directed displacement, bob/rotation, and scales nearby cards up to `1.3`; moving away resumes playback.
10. Reduced-motion removes transition timing and continuous playback while preserving the revealed state and CTA.

## Verification record

DOM/runtime verification completed on the isolated React route `/footer`:

- Desktop boxes match the source at 1280 × 720.
- Mobile closed boxes match the source at 390 × 844.
- Product accordion matches source expanded height, footer height, state attributes, duration, and easing.
- All 17 links are present in both responsive render branches with source hrefs.
- Cookie Preferences opens the React privacy dialog.
- Wordmark pointer state updates its x/y/radius variables.
- Newsletter input id, required state, and email validity behavior match source semantics.
- Easter egg remains zero-height until bottom overscroll, then expands to exactly `100svh`.
- Source and React both render 25 carousel cards at 1280px from the 36-image local pool.
- React playback measured `42.9px` over one second against the source's approximately `43px` sample.
- Hover reduced movement to `0.03px` over one second and scaled the hovered card to approximately `1.29`; pointer exit resumed at `44.4px` over one second.
- The final source coin geometry matches at `71.68 × 25.585px`, including the shared `0.7` step scale and the coin's `0.32 × 0.16` transform.
- Vite production build passes.

## Known external boundaries

- `/api/newsletter` and `/api/status` are source service endpoints, not downloaded static assets.
- The exact source wordmark reveal uses a procedural WebGL mesh. The reconstruction preserves the downloaded mask, pointer state, radius contract, four source colors, and reduced-motion behavior with a CSS gradient renderer.
- The source easter egg uses GSAP and a procedural mesh. The reconstruction preserves the activation threshold, exact card-count formula, looping speed, sine path, seeded bob/rotation, hover pause/scale, asset inventory, coin geometry, CTA, responsive sizing, and timing order without adding those runtime dependencies.
