# Reverse-engineering record

## Source boundaries

| Selection | Source selector | React component | React behavior hook |
| --- | --- | --- | --- |
| Hero | `section#hero` | `HeroSection` | `useHeroField`, `useReveal` |
| Work carousel | `section#work > div.track-wrap` | `WorkCarouselSection`, `CarouselSection` | `useCarousel` |
| Process flow | `section#process > div.wrap` | `ProcessFlowSection` | React canvas effects inside the component |
| Protocol panel | `section#protocol-parts > div.wrap > div.reveal.in` | `ProtocolPartsSection` | `useProtocolFlow` |
| Experiments carousel | `section#lab > div.track-wrap:nth-of-type(2)` | `ExperimentsCarouselSection`, `CarouselSection` | `useCarousel` |
| Contact | `section#contact` | `ContactSection`, `PixelButton` | `useAmbientField`, `useNearestWildling`, `useReveal` |
| Footer | `html > body > footer` | `TetrisFooter`, `PixelButton` | `useTetrisFooter`, `useTeaserPieces` |

The source snapshot used for extraction is stored outside this prototype at:

`../selected-components-source-evidence/`

The wider saved mirror and hydrated runtime are stored at:

- `../../../mirror/index.html`
- `../../../mirror/assets/footer-tetris.js`
- `../../../react-reconstruction/public/craft-runtime.js`

## What was extracted from the DOM

- Exact text, element hierarchy, classes, IDs, canvas hooks, links, and button semantics.
- Computed spacing, widths, section heights, type sizes, breakpoints, colors, and clipped button shapes.
- Hero entrance motion, responsive masthead, local logo, pixel-grid field, and cursor response.
- Work and experiment slide content, media crops, hover labels, arrow controls, drag/swipe momentum, and disabled states.
- Process flow helix, pointer repulsion, step emphasis, and pixel-line tracking.
- Protocol canvas initialization and step-card hover state.
- The ambient pixel canvas required by the contact section, including its cursor/Pac-Man field.
- Contact-button pixel hover behavior.
- Footer idle animation, score/game DOM, keyboard controls, touch controls, replay, and close behavior.
- Local Sneak font files already present in the downloaded source artifacts.
- All downloaded carousel videos and images copied into `public/assets/work/`
  and `public/assets/experiments/`; the React suite does not hotlink media.

The first reconstruction preserved the source scripts as injected public
runtimes. That intermediate architecture has been removed. Canvas drawing is
now initialized and cleaned up by React effects, hover and game state are
exposed through React event handlers/state, Tetris HUD markup is rendered by
React, and the nearest-location request uses a React hook with abort cleanup.

No `public/*-runtime.js` files, dynamic `<script>` creation, runtime DOM
injection, or global `window.__pxHover` bridge remain.

## Measured responsive contract

| Viewport | Hero | Work | Process | Protocol | Experiments | Contact | Footer idle/playing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 883×863 | 883×863 | 883×805 | 883×814.039 | 883×524.711 | 883×1031.078 | 883×672.5 | 883×126 / 883×390 |
| 390×844 | 390×844 | 390×721 | 390×724.547 | 390×527.578 | 390×1011.438 | 390×556.5 | 390×126 / 390×460 |

Both process-card grids use four columns from 840px upward and two columns below
that breakpoint. Carousels use 420px slides on desktop and 90vw slides on
mobile. The mobile Tetris controls change to a four-column 52px pad.

## Expected nondeterminism

The source canvas animations are time-seeded. Individual pixel positions,
the Pac-Man location, the tiny footer piece, and the active Tetris board can
differ between two captures while their geometry, palette, density, motion,
and state machine remain the same.
