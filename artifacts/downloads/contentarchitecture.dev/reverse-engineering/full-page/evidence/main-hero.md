# Main hero evidence

Component IDs: `main-hero`, `hero-copy`, `hero-stats`, `hero-scroll-cue`.

## Downloaded evidence

- DOM snapshots: `../../../2026-08-18T09-36-04-737Z/desktop.mhtml` and
  `../../../2026-08-18T09-36-04-737Z/mobile.mhtml`.
- Responsive layout and typography tokens:
  `../../../2026-08-18T09-36-04-737Z/assets/d2ed906b7813000307abcbd3.css`.
- `AnimatedText`, module `407194`, including font readiness, line splitting,
  `0.2em` masks, resize resplitting, reduced motion, duration, stagger, and
  easing:
  `../../../2026-08-18T09-36-04-737Z/network-assets/f73047df8a251905da257ffd.js`.
- `MainHeroScrollCue`, module `758593`, including one-viewport scrolling,
  1.2 second duration, cubic easing, and reduced-motion behavior:
  `../../../2026-08-18T09-36-04-737Z/network-assets/65d0ba2cf2a9fa15b8754458.js`.
- Source marker and section analytics mapping:
  `../../../2026-08-18T09-36-04-737Z/network-assets/471bb6565233dea39d0bd204.js`.
- The spiral scene is separately traced and verified in `SpiralScene`.

## Reconstructed component tree

```text
HeroSection
├── copy
│   ├── main
│   │   ├── AnimatedText eyebrow
│   │   ├── AnimatedText h1
│   │   ├── AnimatedText lede
│   │   └── SplitButton
│   └── desktop stats
├── SpiralScene
└── desktop scroll cue
```

Implementation:

- `react-demo/src/components/HeroSection.jsx`
- `react-demo/src/recovered/text/AnimatedText.jsx`
- `react-demo/src/page.css`

## Verification

At `390 x 844`, the local React reconstruction matches the hydrated reference
for:

- hero height: `1222.9375px`;
- copy height: `547.7421875px`;
- visual height: `675.1953125px` (`80svh`);
- title: `x=16`, `y=197.5234375`, `358 x 128`;
- title lines: `The Sanity` / `setup agents` / `don't reinvent.`;
- CTA: `x=16`, `y=451.7421875`, `159.7265625 x 48`.

At `1159 x 863`, the local reconstruction matches the downloaded outer
geometry for:

- hero: `1159 x 863`;
- copy: `473.578125 x 863`;
- visual: `x=587.4921875`, `571.5 x 863`;
- scroll cue: `x=576.5`, `y=755`, `22 x 68`.

The downloaded static DOM contains stale, capture-viewport line wrappers. The
downloaded `AnimatedText` implementation proves that lines are rebuilt after
fonts load and after a debounced resize. Fresh local lines match the hydrated
reference at the target viewports; the live page is labeled as a hydration-gap
reference and is not the implementation source.

The scroll cue was clicked with a direct pointer event from `scrollY=0` to avoid
automation auto-centering. After 1.3 seconds, `scrollY=863`, exactly one
viewport. Focus remained on the button and its accessible name remained
`Scroll to the next section`.

Build: `npm run build` passes. Vite emits only its existing chunk-size warning.
