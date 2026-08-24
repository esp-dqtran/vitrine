# Melius Personas — downloaded-source component specification

## Scope and evidence

This is a reconstruction specification, not an implementation. Its source of
truth is the downloaded Melius capture only:

- DOM/content: `../../2026-08-20-home/raw.html`, `<section id="personas">`.
- Runtime logic: `../../2026-08-20-home/network-assets/9aa9e990ef106d45ccfc.js`.
  The relevant compiled functions are `nk` (section), `nN` (stack card), `nT`
  (desktop use-case field), `nM` (use-case card), `nO` (video lifecycle), and
  `nR` (persona selector).
- Content data: `../../2026-08-20-home/network-assets/e6722f252625ab14ea40.js`.
- Media: `../../2026-08-20-home/capture-manifest.json` and its
  `network-assets/` paths.
- Rendered evidence: the offline mirror at `http://localhost:4186/`, captured
  at 1280 × 720 and 390 × 844.

The existing `PersonaCard`, `PersonaMedia`, and `PersonaIndent` components
cover card internals only. They do **not** prove the stack, selector, wrap
state machine, desktop use-case field, or hover flip.

## Important correction: this is not scroll-driven

The personas section uses `useInView({ once: true, amount: .3 })` only to begin
its entrance and to permit media playback. It does **not** use scroll progress
to select cards or move the stack. Selection is state-driven:

1. A card click passes that card's unbounded logical position to the section.
2. A selector-button click maps its slug to the equivalent unbounded position.
3. The shared `motionPosition` animates to that position for `0.7s` with
   `circOut` easing.
4. Each card derives its stack position from `cardPosition - motionPosition`.
5. Cards that pass either end are moved out, faded, re-indexed by five, then
   re-enter at the opposite end.

Do not implement this as a scroll listener, an auto-rotating carousel, or five
fixed click tabs. Those would be a different behavior from the downloaded
source.

## Component boundary and dependency order

```text
verified PersonaIndent / PersonaMedia / PersonaCard
                         │
                         ├── PersonaStackCardMotion       (new behavior wrapper)
                         │
                         ├── PersonaStack                 (new composite)
                         ├── PersonaSelector              (new composite)
                         │
                         └── PersonaUseCaseMedia           (new primitive)
                              └── PersonaUseCaseCard       (new composite)
                                   └── PersonaUseCaseField (desktop-only composite)
                                                │
                                           PersonasSection
```

Build and verify in that order. `PersonasSection` must not be added to a page
until the stack, selector, and desktop-only use-case field have their captured
states verified separately.

## Data contract

The downloaded content has exactly five cards, in this order. The order is
behavioral data: it determines the z stack, card wrapping, initial active
persona, and selector order.

| Index | Key / slug | Display title | Primary media | Mobile-only use-case labels |
| ---: | --- | --- | --- | --- |
| 0 | `agencies` | Agencies | video | Concept Boards; Campaign Variants; Treatment Decks; Spec Ads |
| 1 | `cd-filmmakers` | CD/Filmmakers | video | Storyboards; AI Shorts; Lookbooks; Reference Boards |
| 2 | `marketers` | Marketers | image | LCM Creatives; Ad Variants; Animated Statics; Localized Copy |
| 3 | `ecommerce` | E-commerce | image | Pack Shots; On-Model Imagery; Lifestyle Heroes; PDP Variants |
| 4 | `gtm-growth` | GTM / Growth | image | Event Graphics; Conference Posters; Sales Decks; Blog Heroes |

### Card copy

| Persona | Downloaded description |
| --- | --- |
| Agencies | Concept work that wins the pitch. Variant work that runs the campaign. The same canvas does both — treatments and concept art at the brief's pace, ad variants and campaign creative at the campaign's volume. |
| CD/Filmmakers | You can see the shot. You can describe it. Single-model tools can't make it. Work with tunable, multimodal nodes until the frame matches what you imagined. |
| Marketers | The hero shot in minutes. The thousand-variant cascade in an afternoon. Localized for every market, sized for every channel, brand-checked before every approval. |
| E-commerce | The shoot that used to take three weeks, an afternoon on the canvas. Pack shots, on-model, hero imagery, all brand-consistent across every frame, at the pace of your ambitions. |
| GTM / Growth | Skip the design ticket. Event graphics, blog heroes, conference posters, decks that don't look like they were made in five minutes — all on the fly, without learning a single tool or writing a single prompt. |

## Asset mapping

All listed media were downloaded. Reconstruction must reference the local
copy, never a public Melius URL.

### Persona-card media

| Persona | Downloaded source URL | Local artifact | Type |
| --- | --- | --- | --- |
| Agencies | `/images/personas/agencies.webm` | `network-assets/86ceab3c1a8e6d7c8eb3.webm` | video/webm |
| CD/Filmmakers | `/images/personas/cd-filmmakers.webm` | `network-assets/f089a69a71176a8ae33d.webm` | video/webm |
| Marketers | `/images/personas/marketers.webp` | `network-assets/c4cc64e83773df97deab.webp` | image/webp |
| E-commerce | `/images/personas/ecommerce.webp` | `network-assets/f2758066c19787742055.webp` | image/webp |
| GTM / Growth | `/images/personas/gtm-growth.webp` | `network-assets/91ccac182a31c629b5be.webp` | image/webp |

`agencies.webm` is 1,015,227 bytes; `cd-filmmakers.webm` is 3,390,738 bytes.
The card video contract is `muted`, `loop`, `playsInline`, `preload="metadata"`.
The runtime calls `play()` only when that persona is active *and* the section
has entered view; otherwise it pauses the video.

### Desktop use-case media

| Persona | Use case | Local artifact | Source type | Model data on flip back |
| --- | --- | --- | --- | --- |
| Agencies | Concept Boards | `network-assets/9ab1791c82e8b5118a0f.webp` | image | GOOGLE — Nano Banana |
| Agencies | Campaign Variants | `network-assets/524ef669e285a2d12913.webm` | video | BLACK FOREST LABS — FLUX 1.1 |
| Agencies | Treatment Decks | `network-assets/15fb23f585d138088f26.webp` | image | OPENAI — GPT-5.6, Sora 2 |
| Agencies | Spec Ads | `network-assets/8adfd178303a7f7c2468.webp` | image | GOOGLE — Veo 3.1 |
| CD/Filmmakers | Storyboards | `network-assets/663495bd745ae82b2459.webp` | image | GOOGLE — Nano Banana |
| CD/Filmmakers | AI Shorts | `network-assets/e148028004057326eea5.webm` | video | GOOGLE — Veo 3.1 |
| CD/Filmmakers | Lookbooks | `network-assets/65d5ca138e9a26878d9d.webm` | video | BLACK FOREST LABS — FLUX 1.1 |
| CD/Filmmakers | Reference Boards | `network-assets/9e338c301274ba16a325.webp` | image | KLING AI — Kling 2.0 |
| Marketers | LCM Creatives | `network-assets/b84374cbfe666051c7c6.webp` | image | BLACK FOREST LABS — FLUX 1.1 |
| Marketers | Ad Variants | `network-assets/ef84a1bf379c21a8a55f.webp` | image | GOOGLE — Nano Banana |
| Marketers | Animated Statics | `network-assets/a3775b876db6d172f73d.webm` | video | GOOGLE — Veo 3.1 |
| Marketers | Localized Copy | `network-assets/f573361c3b27b554b3b6.webp` | image | OPENAI — GPT-5.6 |
| E-commerce | Pack Shots | `network-assets/e3b6d7b3a631d4536d18.webp` | image | GOOGLE — Nano Banana |
| E-commerce | On-Model Imagery | `network-assets/992d3ce395238214f636.webp` | image | BLACK FOREST LABS — FLUX 1.1, FLUX Kontext |
| E-commerce | Lifestyle Heroes | `network-assets/21dd0ec66133c95165e3.webp` | image | GOOGLE — Nano Banana |
| E-commerce | PDP Variants | `network-assets/82f54587b8e77b891593.webp` | image | TOPAZ LABS — Gigapixel |
| GTM / Growth | Event Graphics | `network-assets/b3fa3398fa27f421f93d.webp` | image | GOOGLE — Nano Banana |
| GTM / Growth | Conference Posters | `network-assets/d1ca3e696ce88b797a36.webp` | image | BLACK FOREST LABS — FLUX 1.1 |
| GTM / Growth | Sales Decks | `network-assets/6c31cf6fb9422880db84.webp` | image | OPENAI — GPT-5.6 |
| GTM / Growth | Blog Heroes | `network-assets/c9965e43bc84ae57be8a.webp` | image | GOOGLE — Gemini 2.5, Nano Banana |

## Section and card geometry

### Shared section structure

The DOM is:

```text
section#personas
  dotted gray background layer
  h2.sr-only "Personas"
  .stack (z 20, perspective 30rem)
    five PersonaStackCardMotion elements
  .use-case-field (z 10, display only at lg and wider)
  PersonaSelector (z 30, margin-top 40px)
```

The section classes resolve to `position: relative`, centered flex column,
`overflow: hidden`, `padding-top: 224px`, and `padding-bottom: 96px`. Its side
padding is 20px at 390px and 32px at the 1024px `lg` breakpoint and above. At
both measured breakpoints its background is the same 15px dotted gray pattern
as the other gray-background home sections.

| Captured state | Section rect | Stack rect | Initial active-card rect |
| --- | --- | --- | --- |
| 1280 × 720 | 1280 × 932.76px | 400 × 525.41px | 400 × 525.41px |
| 390 × 844 | 390 × 899.11px | 351 × 491.76px | 351 × 491.76px |

### Persona card

- Width is `90vw` below `lg`: 351px at the 390px reference viewport.
- Width is exactly 400px at `lg` and above.
- White card, 8px radius, `overflow: hidden`, padding `12px 12px 16px`.
- Media is an unclipped square after the padding: 327px at 390px, 376px at
  1280px. It has 8px radius and `object-fit: cover`.
- Copy begins 16px after media, has 8px left padding, an 8px internal gap, and
  gets 32px right padding at `lg`.
- The source's `PersonaIndent` is positioned at 40% down the media's left edge;
  it is 180px tall. The existing primitive already has its exact SVG.
- Mobile use-case chips are absolute at top/right 10px, stacked with a 4px
  gap. They are hidden at `lg` and above. The active card fades all four chips
  in; inactive cards fade them out.

### Initial five-card depth — logical transform values

The stack wrapper has `perspective: 30rem` (480px). These are logical source
transforms, not the perspective-projected screen rectangles:

| Initial card index | z-index | Positioning | Logical transform |
| ---: | ---: | --- | --- |
| 0 | 5 | relative | none |
| 1 | 4 | absolute, top 0 | `translateY(-6rem) translateZ(-5rem)` |
| 2 | 3 | absolute, top 0 | `translateY(-12rem) translateZ(-10rem)` |
| 3 | 2 | absolute, top 0 | `translateY(-18rem) translateZ(-15rem)` |
| 4 | 1 | absolute, top 0 | `translateY(-24rem) translateZ(-20rem)` |

At the mobile reference after the entrance settled, the resulting projected
card widths were 351, 300.86, 263.25, 234, and 210.60px. At desktop they were
400, 342.86, 300, 266.67, and 240px. The difference is the 480px perspective;
do not imitate it with hard-coded width reductions.

## Source state machine

### State owned by `PersonaStack`

```ts
type PersonaStackState = {
  activePosition: number // starts at 0; intentionally unbounded
  entered: boolean       // useInView once, amount: 0.3
}
```

`activePosition` is not limited to `0..4`. Its displayed active index is the
positive modulo of `activePosition` by five. Keeping an unbounded position is
what allows the source to animate a card through the front/back boundary
instead of jumping it to another slot.

For each card `i`, source motion values are:

```ts
cardPosition = motionValue(i)
relative = cardPosition - activePosition
stackY = -6 * relative       // rem
stackZ = -5 * relative       // rem
zIndex = 5 - Math.round(relative)
isActive = i === positiveModulo(activePosition, 5)
pointerEvents = opacity > 0.01 ? "auto" : "none"
```

Each card combines those values with local entrance/wrap values:

```ts
finalY = stackY + localY      // rem
finalZ = stackZ               // rem
finalScaleY = localScaleY
finalOpacity = localOpacity
```

### Entrance

When the 30%-in-view trigger first becomes true, each card starts after
`75ms × cardIndex`:

- opacity animates `0 → 1` in `0.2s` for valid stack positions;
- y animates `50rem → 0` as a spring `{ stiffness: 100, damping: 15 }`;
- scaleY animates `1.3 → 1` with the same spring.

The card stays in the DOM before entering, but starts `opacity: 0` and has
`pointer-events: none`; this matches the static raw HTML capture before the
in-view transition runs.

### Selection and wrapping

Card clicks call `setActivePosition(cardPosition)`. Selector clicks convert the
requested slug to `activePosition + targetIndex - currentActiveIndex`, then
animate the shared motion position to it over `0.7s` with `circOut`.

For a five-card stack, a card wraps when its relative position crosses either
boundary plus a `0.075` guard:

| Condition | Exit animation | Re-index after exit |
| --- | --- | --- |
| `relative < -0.075` | y `0 → 50rem`, scaleY `1 → 1.3` over 0.5s; opacity `1 → 0` over 0.25s beginning at 0.25s | `cardPosition += 5` |
| `relative > 4.075` | y `0 → -50rem`, scaleY `1 → 1.3` over 0.5s; opacity `1 → 0` over 0.2s beginning at 0.3s | `cardPosition -= 5` |

When a wrapped card returns to the valid interval, it re-enters with y
`±50rem → 0` and scaleY `1.2 → 1` over one second using the downloaded
`easeOutExpo`; opacity returns to one over 0.2s. Preserve the guards that stop
the two boundary transitions from firing simultaneously.

### Captured selection evidence

At 390 × 844, clicking the exposed Marketers card changed the settled active
state from Agencies to Marketers:

- Marketers became z-index 5, no transform, 351px wide, and its four mobile
  chips reached opacity 1.
- E-commerce and GTM / Growth occupied the following `-6rem/-5rem` and
  `-12rem/-10rem` stack slots.
- Agencies and CD/Filmmakers had wrapped to the trailing positions, z-index 2
  and 1 respectively.

This confirms selection/wrapping behavior from the runtime, not only the
minified source code.

## Persona selector (`PersonaSelector`)

The selector is a white rounded 8px viewport with an orange active indicator.
It owns interaction separately from the card depth logic.

- Outer container: `inline-flex`, `max-width: 100%`, `overflow: hidden`,
  `touch-pan-y`, white, 8px radius.
- Inner row: inline flex, 8px gap and 8px padding.
- Each persona button: existing `t-b-3` type, horizontal 16px and vertical 8px
  padding; colors transition for 300ms after a 100ms delay.
- Indicator: absolute, top/bottom 8px, orange, 6px radius; animates width and
  x position for 400ms with cubic-in-out.
- At desktop the captured selector is 558.55 × 47.35px, including its 8px
  inner padding, with the row centered.
- At mobile, the row is translated—not natively horizontally scrolled—to keep
  the active button centered and clamped inside the viewport. The translation
  animates for 0.4s with cubic-in-out. A touch drag locks after 8px; horizontal
  drags update the translation and prevent vertical movement only after that
  axis is chosen. Vertical gestures remain page scroll.

All five buttons must be real buttons, in source order. A selector click and a
click on an exposed stack card must produce the same active card state.

## Desktop use-case field (`PersonaUseCaseField`)

This is a separate `lg`-only visual field behind the stack (`z-index: 10`;
the stack is z-index 20). Do not render it at 1023px and below: mobile uses
only the active card's yellow label chips.

The active persona's four use-case cards are placed in corner quadrants:

| Item index | Quadrant class | Size at 1280px |
| ---: | --- | --- |
| 0 | top 40px, left 40px | 160px (`small`) |
| 1 | top 40px, right 40px | 200px (`large`) |
| 2 | bottom 40px, left 40px | 200px (`large`) |
| 3 | bottom 40px, right 40px | 160px (`small`) |

For odd persona indices, the source reverses the small/large sequence to
large, small, small, large. Each quadrant reserves 45% of section height and
30% of width. The actual card is positioned randomly within the central
30–70% range of that reservation on mount, then centered with
`translate3d(-50%, -50%, 0)`. Therefore its precise x/y position is
intentionally non-deterministic; reproduce the range, not one captured frame.

Source field lifecycle:

- An active persona makes the use-case field pointer-interactive; inactive
  fields use `pointer-events: none`.
- Once a persona's field has been activated, it remains mounted for exit
  animation rather than disappearing immediately.
- Enter: each child staggers by 0.1s after 0.5s; each card scales 0.7 → 1 and
  fades 0 → 1 over 0.6s, `easeOutCubic`.
- Exit: children stagger in reverse by 0.06s; each card scales 1 → 0.7 and
  fades 1 → 0 over 0.3s, `easeInCubic`.

### Use-case-card hover state

Every card with model data has a real hover flip, verified at 1280 × 720:

- 700px perspective.
- Inner card uses `transform-style: preserve-3d`.
- Hover rotates it to `rotateY(180deg)` over 0.6s with `easeOutExpo`.
- Front and back each have 1px light border, 8px radius, white background,
  and 8px padding. Both use hidden backfaces.
- Front shows the source media and a yellow label at top/right.
- Back mirrors the same image/video horizontally, overlays black at 60% plus
  backdrop blur, and shows vendor and model chips.
- A video front plays only while its persona is active and in view. The
  mirrored back is an inert video at `#t=0.1` rather than a second active
  player.

## Required component tests before section assembly

`PersonaStack` is only verified when all of the following are captured against
the offline source at both 1280 × 720 and 390 × 844:

1. Initial in-view entrance: five staggered cards, correct logical depth,
   initial active video/chips, and no cards interactive before opacity exceeds
   0.01.
2. Each of the five selector buttons changes the active card, indicator,
   active media playback, and mobile chips.
3. Clicking an exposed trailing card produces the same selected state as its
   selector button.
4. Boundary wrap in both directions preserves visible continuity—no jump,
   duplicate front card, z-index inversion, or card removed from the DOM.
5. Mobile selector supports a horizontal drag without hijacking vertical page
   scroll; its active button recenters after selection.
6. Desktop only: active field entry/exit; all four use-case media cards;
   at least one image and one video hover flip; models readable on back face.
7. 1023px/1024px breakpoint: desktop field vanishes/appears exactly at `lg`,
   while mobile label chips do the inverse.
8. Reduced-motion behavior is explicitly captured before implementation. The
   downloaded component takes a reduced-motion value, but this lane did not
   capture its final rendered reduced-motion states; do not claim them.

## Implementation status

No React/CSS files were changed by this lane. The existing gallery
`PersonaStack` draft is not source-verified and must be replaced only from this
specification and the downloaded artifacts above.
