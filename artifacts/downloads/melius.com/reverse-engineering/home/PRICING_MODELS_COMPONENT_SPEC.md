# Melius home: models carousel and pricing component specification

## Scope and source of truth

This lane analyzes only the downloaded Melius homepage capture, not the public
site. It is a component specification, not a page implementation.

| Evidence | What it establishes |
| --- | --- |
| `../../2026-08-20-home/raw.html` | SSR DOM, the React Flight payload, plan data, provider order, section text, and initial annual billing state. |
| `../../2026-08-20-home/network-assets/9aa9e990ef106d45ccfc.js` | React wrapper for the WebGL models carousel, controls, pointer/wheel handling, accessibility list, and section composition. |
| `../../2026-08-20-home/network-assets/5dd6a9490ab4200512b4.js` | WebGL model-slider mechanics, transitions, progress calculation, desktop/mobile parameters, and WebGL post-processing. |
| `../../2026-08-20-home/network-assets/5259a845d49009de7331.js` | Pricing billing state machine, card composition, number-flow pricing, hover glow, and viewport reveal states. |
| `../../2026-08-20-home/network-assets/33937522490f8ff3aa27.css` | Tokens, dot-pattern surface, masks, and card glow animation. |
| Offline mirror `http://localhost:4186/` | DOM/control verification at 1280px and mobile-width viewports. No public-site inspection was used. |

## Shared visual foundation

Both sections have the same `bg-offblack` (`#1a1616`) surface and an absolute,
pointer-inert repeating SVG dot field:

- Tile: `15px × 15px`.
- Dot: `2px × 2px`, at `(6.5px, 6.5px)`, corner radius `1px`.
- Dot fill: white at `0.08` opacity.
- Main title: Reckless Standard, `56px/56px`, tracking `-0.02em`, white.
- Accent orange: `#f04e23`; gray rail: `#676767`; card surface: `#fafafa`.

At desktop 1280 × 900, `#models` measures `1280 × 900` and its title is
`1216 × 112` (two lines). At a 390px-class mobile viewport the section is one
viewport tall and the title has a 350px content width and wraps to four 56px
lines. These dimensions come from the hydrated downloaded mirror.

---

## A. `ModelCarousel`

### SSR structure

```text
ModelCarouselSection (#models, min-height: main viewport)
├─ DotSurface
├─ ModelWebGLCarousel (absolute, full section)
│  ├─ canvas (aria-hidden)
│  ├─ middle-half pointer/drag surface
│  ├─ ModelCarouselControls
│  └─ screen-reader provider list (role=group, label="Available AI models")
└─ ModelCarouselHeading
   └─ “One subscription. Every image & video model.”
```

The DOM intentionally contains no individual visual model cards: they are
textures rendered in WebGL. Do not replace this source behavior with a normal
DOM carousel and label it source-faithful.

### Exact source data and captured assets

The Flight payload has 17 cards, all declared as 886 × 843 images. The source
prepares each texture at width 512, WebP, quality 80. These downloaded originals
are sufficient for the card textures:

| Index | Provider | Downloaded asset |
| ---: | --- | --- |
| 1 | Google | `network-assets/d8a16ed11aa3a2fb404c.webp` |
| 2 | OpenAI | `network-assets/3c5835ba0efc3539bbd4.webp` |
| 3 | ElevenLabs | `network-assets/f11f5118fbe0f269f736.webp` |
| 4 | Sync Labs | `network-assets/96906e71bcecf1f9148c.webp` |
| 5 | Mistral | `network-assets/28d25b4b131f75ab8cdc.webp` |
| 6 | DeepSeek | `network-assets/bdc48656e02c57768270.webp` |
| 7 | PixVerse | `network-assets/50c956f451f3c0e63e52.webp` |
| 8 | ByteDance | `network-assets/3053ee7bd66a498928e9.webp` |
| 9 | KlingAI | `network-assets/6a2523e389e31cddbeea.webp` |
| 10 | Black Forest Labs | `network-assets/be9d3f1f828c5bcaf77c.webp` |
| 11 | Topaz Labs | `network-assets/b053db6f6fceeddc7baa.webp` |
| 12 | MultiTalk | `network-assets/a3bf3502a6ebbf691085.webp` |
| 13 | HeyGen | `network-assets/c2bef62c899cfb98dcce.webp` |
| 14 | Vidu | `network-assets/e0fed2aed80704e798bc.webp` |
| 15 | Meta | `network-assets/af3050fb7d311b286ce3.webp` |
| 16 | xAI | `network-assets/d71fd7fb5ace372115c1.webp` |
| 17 | Lightricks | `network-assets/ec355877de633fbb52ef.webp` |

### `ModelCarouselControls`

This is a standalone verified composite already suitable to be reused by the
full WebGL carousel.

- Container: `276 × 44px`, flex, `24px` gap, centered at `left: 50%` and
  `top: 75%` of the models section.
- Each previous/next button is `44 × 44px`; labels are **Show previous card**
  and **Show next card**.
- Rail: `140 × 2px`, gray; orange shuttle: `35 × 2px` (25% width).
- On a next click in the downloaded mirror, the shuttle moved from no inline
  transform to `translate3d(6.28147px, 0px, 0px)` while travelling toward the
  rail's usable 105px range.

### State machine and interaction contract

`ModelCarousel` is source-verified from the downloaded JS. Its behavior is:

1. It initializes only once when `#models` enters the configured intersection
   margin (`0px 0px 50% 0px`). The canvas begins transparent and becomes opaque
   after assets and the WebGL scene load.
2. Autoplay is **off** on the homepage (`shouldAutoPlay` defaults to false).
3. Previous and next each change `offsetTarget` by one pitch. The source maps
   next to `round(offsetTarget / pitch) * pitch - pitch` and previous to the
   opposite direction.
4. The pointer capture surface spans only the middle 50% of the section
   (`inset-y-[25%]`). A horizontal drag produces
   `offsetTarget = dragStartOffset + (dragX / sectionWidth) × vWidth × 1`.
   Releasing snaps to the nearest pitch.
5. Wheel input uses horizontal delta (or vertical delta when Shift is held) and
   subtracts `delta × 0.003` from the target. Normal vertical page scrolling is
   not consumed when larger than the horizontal motion.
6. It loops continuously. With 17 source cards, progress is
   `(-offset / (17 × pitch) % 1 + 1) % .999`; shuttle translation is
   `progress × (railWidth - shuttleWidth)`. The `.999` divisor is observable:
   idle progress is `.001` (`.105px` on the 105px usable rail), and one complete
   next step settles at `6.28147px` rather than a mathematically rounded zero-origin value.
7. Scene interpolation uses an easing value of `0.1`; no source duration is
   hard-coded for moving between cards.

### WebGL render rules that must not be lost

- Mobile card spacing is `1.1`, desktop card spacing is `1.3`.
- Card plane width is `.9` world units on a mobile device and `1.1` world units
  on desktop, divided by the source image aspect ratio for height. `vWidth` is
  used for drag distance and loop-copy count, not multiplied into card width.
- The first visible group of cards enters with centre card at 0 delay, then
  ±1, ±2 and ±3 in `.1s` stagger increments. Each card moves from y `-.65`
  (mobile) or `-.85` (desktop) to 0 over 1.25s, scales from `(.75, .85)` to
  `(1, 1)` over .75s, and fades 0→1 over .75s.
- Camera is perspective 45°, position `(0, 0, 5)`. The post pass uses barrel
  distortion K1 `-.075` mobile / `-.15` desktop and settles cylindrical
  distortion to `.85` mobile / `.7` desktop over 1.5s.
- It stops rendering when out of view and destroys the WebGL scene on unmount.
- The canvas remains `aria-hidden`; the 17-provider text list is the accessible
  alternative. Both control buttons have accessible labels.

### Verification status

| Item | State | Evidence |
| --- | --- | --- |
| Provider data and all 17 downloaded assets | **source-verified** | Flight payload + capture manifest |
| Control dimensions and next-state shuttle movement | **runtime-verified** | offline mirror |
| Button, pointer drag, snap, wheel, loop, WebGL timings | **source-verified** | downloaded JS |
| React/WebGL reconstruction | **built and runtime-verified** | `react-demo/src/components/ModelWebGLCarousel.jsx`; isolated at `/slider` and `/models` |
| Static DOM-only fallback | **not a source equivalent** | source has no fallback card DOM |

The React reconstruction keeps the source separation between the accessible DOM
and the visual canvas: 17 provider names remain in the `Available AI models`
group, while the cards use the 17 captured textures in native WebGL. At the
1280 × 720 verification viewport, section, heading, drag surface, controls,
rail, shuttle, and both 44px buttons match the downloaded DOM geometry. Runtime
checks confirmed the exact next-step target (`-1.3`), `.999` progress wrap,
drag-to-nearest-pitch behavior, horizontal wheel delta (`× .003`), asset-ready
gate, and body-cursor cleanup.

---

## B. Pricing primitives and `PricingSection`

### Component boundary

```text
PricingSection (#pricing)
├─ DotSurface
├─ PricingHeading (“Our Pricing”)
├─ PricingBillingToggle
└─ PricingPlanGrid
   ├─ PricingCard (Creator)
   ├─ PricingCard (Growth)
   ├─ PricingCard (Professional; coin cutout)
   └─ PricingCard (Enterprise; wide, coin cutout)
```

`PricingCard` should compose independent primitives rather than duplicate them:
`PricingValue`, `PricingSavingsTag`, `CreditAllowance`, `FeatureList`,
`PlanCta`, and optional `CoinNotchDecoration`.

### Billing state

The source initializes **annual** billing, not monthly:

```js
const [billing, setBilling] = useState('annual')
onClick: billing === 'annual' ? 'monthly' : 'annual'
```

The accessible button label names the destination state (`Switch to monthly
billing` while annual is selected, then `Switch to annual billing`). Its source
geometry is a 69 × 24px custom SVG track with an 18px thumb at `top/left:
2.5px`. The thumb moves from `translateX(46px)` annual to `translateX(0px)`
monthly using a spring `{ duration: .8, bounce: .2 }`; its scale maps across
positions `[0, 23, 46]` to `[1, .35, 1]`. Labels are separated with `16px`.

The source applies 200ms color transitions to the Monthly/Annual labels.
Number changes use `number-flow-react`, not a crossfade or a static text swap.

### Plan data and derived savings

`listPrice` below is the crossed-out reference price. `annualPrice` and
`monthlyPrice` are the displayed price per month after selection.

| Plan | Annual | Monthly | List | Credits / description | Source CTA |
| --- | ---: | ---: | ---: | --- | --- |
| Creator | $17 | $18 | $20 | 20,000 credits/mo; ≈ 275 images or 55s of video | Start with Creator (orange) |
| Growth | $43 | $45 | $50 | 50,000 credits/mo; ≈ 700 images or 140s of video | Start with Growth (gradient) |
| Professional | $240 | $255 | $300 | 300,000 credits/mo; ≈ 4,200 images or 830s of video | Start with Professional (orange) |
| Enterprise | — | — | — | Custom credits | Contact Sales (`/book-intro`, black) |

Derived `Save` tags:

| Plan | Annual state | Monthly state |
| --- | ---: | ---: |
| Creator | 15% | 10% |
| Growth | 15% | 10% |
| Professional | 20% | 15% |

The 15% shown for Growth annual is deliberate source behavior: the generic
calculation rounds 14%, then explicitly rewrites 14 to 15. Savings tags enter
and exit with `opacity 0→1`, `y 5→0`, duration `.3s`; do not round differently.

### Exact feature data

| Plan | Features |
| --- | --- |
| Creator | Access to all models; Up to 1 agent skill; Unlimited seats; Unlimited agent usage; Shared workspaces |
| Growth | Everything in Creator; Up to 3 agent skills |
| Professional | Everything in Growth; Up to 10 agent skills; Slack agent access; Semantic Assets Manager; Import/create ElevenLabs custom voices; AI prompt enhancement; Better fonts; And more... |
| Enterprise | Everything in Professional; Unlimited agent skills; Priority queue access; Dedicated Slack channel; Real-time support; Volume discounts; And more... |

### Card layout and responsive rules

- Base card: white, rounded `12px`, 1px transparent border, `20px 20px 12px`
  padding; desktop non-wide cards increase top padding to `32px`.
- `PricingValue`: FG Futurist `58px/58px`, tabular numbers, bottom-fade mask;
  crossed list price uses sans display `27.2px` and gray.
- Description: Ease Standard `19px/26.6px` and black. Token/credits panel is
  `#d9d9d9`, rounded 6px, `12px 32px 12px 16px`, 12px gap; coin is 64px at
  mobile root sizing and 80px at the 1280 desktop measurement.
- Feature divider is top-only on normal cards, with a gray tag and a 10 × 8px
  check for every feature. The CTA is bottom-aligned by `margin-top: auto`.
- At desktop (`lg`, 64rem), plans form a three-column grid; Enterprise spans
  all three columns, changes to a row, uses 48px padding and has vertical
  separators. Its Contact Sales CTA is in the first column.
- Below `lg`, plans are a 20px-gap vertical stack within 15px contain padding;
  Enterprise returns to a column and moves Contact Sales to the bottom.
- The downloaded 1280px source has a 1200px grid inside `40px` horizontal
  section padding: three 387px standard cards, 20px column gaps, 40px row gap,
  and a 1200px-wide Enterprise card. At the 390px mobile class it has a 360px
  card column and 20px gaps; source card heights are 520px Creator, 460px
  Growth, 592px Professional and 432px Enterprise before any viewport-entry
  transform is applied.

### Coin notch and hover state

Professional and Enterprise use `mask-pricing-card-indent-coin`: an absolute
silver coin is positioned `top: 2rem; right: -1rem`, at `80px` desktop (the
tail is 13.1875rem high). The CSS subtracts `/svg/pricing-card-indent.svg`
from the card mask. The initially missed first-party asset was subsequently
captured as `../../2026-08-20-home/network-assets/pricing-card-indent.svg`
(267 bytes; SHA-256 `174e01ae7293920a5550a32e9d494ef770ead0e2c68e3dee5b7311662701a1c9`).

Creator is the initial active/default card. Hovering another plan changes the
active card; pointer leave restores Creator. The active card gets:

- orange border;
- `pricing-card-glow-breathe` (3.5s sine-in-out infinite): box shadows
  14px/24px at 22%/12% orange then 20px/26px at 30%/15%; and
- a separate orange blurred glow from opacity 0, scale .96 to opacity 1,
  scale 1 in .45s ease-out-cubic, pulsing opacity `.18/.25/.18` and scale
  `1/1.015/1` over 5s forever.

### Viewport reveal state

The whole section uses one-time `whileInView` reveal at some intersection with
`margin: '-10% 0px'`. The title/toggle and each plan begin at opacity 0,
`translateY(10%) scale(.95)` and reveal to opacity 1, y 0, scale 1 over .6s
ease-out-cubic. Card children are staggered by .2s; root children by .12s.
This is section-entry motion, not billing-toggle motion.

### Captured pricing asset

`MeliusCoin` is
`../../2026-08-20-home/network-assets/1b4e42070f482e4b80d6.webp` (source
path `/media/shared/melius-coin-silver.webp`, 131 × 131 declared).

### Verification status

| Component / behavior | State | Evidence |
| --- | --- | --- |
| `PricingBillingToggle` geometry, labels, source SVG and selected state | **runtime + source-verified** | offline mirror + pricing chunk |
| Four plans, prices, CTA destinations, credits and exact feature data | **source-verified** | Flight payload |
| Annual/monthly state transition, spring and savings formula | **source-verified** | pricing chunk |
| Default Creator glow and card classes | **runtime-verified** | offline mirror |
| Responsive plan grid/stack and Enterprise CTA relocation | **source-verified; dimensions runtime-checked** | source DOM/CSS + offline mirror |
| Coin notch asset | **source-captured** | downloaded `/svg/pricing-card-indent.svg` with capture-manifest provenance |
| Complete React `PricingCard` / `PricingSection` | **not built in this lane** | implementation must follow this specification |

---

## Component-first implementation order

1. **Reuse/verify `BillingToggle`** as a controlled primitive (`annual`,
   `onChange`) with the source track/knob motion and accessible destination
   label. Verify both settled positions before composing cards.
2. **Build `PricingValue` and `PricingSavingsTag`** with number-flow or an
   equivalently measured numeric transition. Test all six price states and all
   savings percentages, especially Growth annual = 15%.
3. **Build `CreditAllowance`, `FeatureList`, and `PlanCta`** from the source
   data. Verify normal and Enterprise CTA placement independently.
4. **Build `PricingCard`** with default/hover active state and the captured
   Professional/Enterprise coin notch mask.
5. **Build `PricingPlanGrid` then `PricingSection`**, including only the
   source viewport reveal after the child components pass desktop/mobile tests.
6. **Build `ModelTextureAsset` and `ModelCarouselControls`** from the ordered
   17-card dataset; keep the accessible provider list in the React tree.
7. **Build `ModelWebGLCarousel`** with the source's GPU interaction contract:
   asset loading, pointer capture, wheel filtering, snap, loop, progress rail,
   visibility pause, cleanup and reduced-motion behavior.
8. **Build `ModelCarouselSection`** only after the WebGL carousel has source
   parity at desktop and mobile. It is independent of pricing and can be
   integrated later without assembling the entire homepage.

## Required verification matrix before page assembly

| Component | Desktop | Mobile | Interaction states |
| --- | --- | --- | --- |
| BillingToggle | Annual/monthly track geometry | Annual/monthly track geometry | spring end positions, accessible labels |
| PricingValue/SavingsTag | all three paid plans | all three paid plans | annual ↔ monthly numbers and 6 savings states |
| PricingCard | default, active hover, Enterprise row | default, active hover, Enterprise column | enter/leave restores Creator |
| PricingSection | 3+wide grid | single-card stack | once-only viewport reveal |
| ModelCarouselControls | rail/arrow alignment | rail/arrow alignment | next and previous progress movement |
| ModelWebGLCarousel | asset load, drag/wheel/snap/loop | asset load, drag/wheel/snap/loop | out-of-view pause and reduced motion |

No full-page assembly should begin from this lane until the components above
have their own responsive and interaction verification.
