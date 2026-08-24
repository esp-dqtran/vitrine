# Craft page component inventory

Source: `https://craft.wild.as/`

Evidence basis: downloaded public HTML, CSS, JavaScript, fonts, images, videos, hydrated desktop/mobile DOM snapshots, small-step screenshots, and captured interaction states. The source mirror is the reference; screenshots are visual validation only.

## React page composition

The first reconstruction pass exposes 13 React components in page order:

1. `GlobalChrome`
2. `HeroSection`
3. `IntroLeadSection`
4. `WorkCarouselSection`
5. `OriginStorySection`
6. `AiLimitSection`
7. `ProcessFlowSection`
8. `BrandProtocolStorySection`
9. `BrandProtocolFlowSection`
10. `AiAdoptionSection`
11. `ExperimentsCarouselSection`
12. `ContactSection`
13. `FooterTetrisSection`

These components preserve the captured DOM exactly. They are assembled by `App` and use the source CSS and source runtime without card-level style overrides.

## Reusable component candidates

### Primitives

- `SneakText`: source font family with light, regular, and medium weights.
- `MonoLabel`: uppercase metadata and step labels.
- `PixelButton`: label plus the source pixel-flicker overlay.
- `ArrowIcon`: source inline SVG arrows used by links and sliders.
- `WildLogo`: downloaded source logo asset.
- `TagChip`: experiment technology tags.
- `MediaSurface`: image/video slot with source crop and playback behavior.
- `RevealBlock`: IntersectionObserver entrance state.

### Composites

- `PixelControlPanel`: cell-size and brush-size controls for the hero canvas.
- `HeroHeader`: split headline, studio logo, description, and supporting copy.
- `CaseStudyCard`: media, title, description, link, and hover crumble effect.
- `ExperimentCard`: case-study anatomy plus technology tags.
- `MomentumCarousel`: draggable track, velocity, spring bounds, snap target, and desktop arrows.
- `EditorialHeading`: large heading plus mono eyebrow.
- `SmileyComparison`: generated SVG face, cursor-following eyes, blink, and hover response.
- `ProcessStep`: numbered title, description, and pointer-tracked pixel line.
- `AiLevelList`: L1, L3, and L5 content rows.
- `ContactBlock`: CTA, studio description, optional nearest-person copy, and address.
- `TetrisControls`: keyboard and touch controls plus close/game-over states.

## Significant visual systems

- `HeroPixelField`: full-viewport canvas, decoded headline field, pointer heat, press-and-hold detonation, touch scroll path, and responsive cell controls.
- `ProcessHelixCanvas`: generative double helix with pointer displacement and active-step emphasis.
- `BrandConstellationCanvas`: continuous four-stage constellation flow.
- `CarouselCrumbleCanvas`: pointer-only media crumble overlay.
- `FooterCityCanvas`: idle auto-building skyline.
- `FooterTetrisGame`: expanded playable canvas with keyboard and touch input.

## Page state machines

### Momentum carousel

- Initial state: first slide aligned; previous disabled; next enabled.
- Pointer drag: captures pointer, applies direct translation, records velocity, and suppresses navigation after movement.
- Release: applies momentum and spring bounds; coarse pointers snap to slide steps.
- Arrow click: moves by one measured card step.
- Keyboard activation: keeps native link navigation.

### Media playback

- Videos are muted, looping, inline, and metadata-preloaded.
- IntersectionObserver plays near-visible videos and pauses off-screen videos.
- The first touch, pointer, or click retries muted playback for iOS.

### Scroll reveal

- `.reveal` elements become `.in` once at a 0.1 threshold.
- Intro copy is split into rendered lines and recalculated after resize.
- The fixed top link appears only after the hero header leaves the viewport.
- Pixel controls hide as the footer approaches.

### Footer game

- Idle: auto-building skyline and animated tetromino teaser.
- Playing: footer expands, game canvas activates, teaser hides, keyboard/touch controls appear.
- Input: left, right, rotate, hard drop, and keyboard equivalents.
- Terminal: game-over overlay and play-again state.
- Close: returns to the idle skyline state.

## Responsive contract

- Desktop reference: `1280 × 720`, captured document height about `7306px`.
- Mobile reference: `390 × 844`, captured document height about `8235px`.
- Root gutter changes from `56px` to `28px` at `680px`.
- Pointer-only hover effects are guarded by `(hover: hover) and (pointer: fine)`.
- Touch uses native momentum, carousel snapping, scroll-following hero motion, and gesture-unlocked media.
- Reduced-motion branches disable reveal motion and decorative animation where the source provides a fallback.

## Verification gates

- Desktop and mobile DOM landmarks match: 11 major `<section>` nodes.
- Desktop and mobile top-of-page comparisons match in layout, type, spacing, and color. The hero canvas is intentionally stochastic, so pixel placement changes while its rules remain identical.
- Both reconstructed carousel next/previous transitions were exercised.
- Reconstructed Tetris enters the playing state and exposes a visible close control.
- All named source assets are stored locally. The off-screen Nutrafol image remains lazy until its horizontal slide enters view, matching the source loading behavior.

