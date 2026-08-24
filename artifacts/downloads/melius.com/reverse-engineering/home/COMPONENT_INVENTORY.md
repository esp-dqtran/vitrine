# Melius component-first reverse-engineering inventory

Source of truth: the downloaded `raw.html`, captured styles/chunks/media, and
the offline mirror at `http://localhost:4186/`. This inventory is deliberately
separate from the assembled React draft: a component is only **verified** after
a same-viewport, same-state comparison against the downloaded source.

## Component hierarchy

The reconstruction order is small-to-large. A composite cannot be verified
until every primitive it uses has been verified; sections follow composites;
only then may the page assembly use them.

### 1. Primitives (atoms)

| Primitive | Downloaded-source evidence | Required states | Status |
| --- | --- | --- | --- |
| `MenuToggle` | Header `button[aria-label="Menu"]`, 40 × 40px source button and its SVG paths | closed hamburger; open collapsed paths | verified at 1280 × 720 and 390 × 844 |
| `AccordionContent` | Header’s Radix `AccordionContent`, `data-state` lifecycle, height CSS variables and keyframes | opening; open; closing; closed | verified at 1280 × 720 and 390 × 844 |
| `MeliusLogo` | Header’s inline SVG, `viewBox="0 0 73 14"` | default | verified at 1280 × 720 |
| `MenuLink` | Header nav anchor, screen-reader prefix and source type classes | default; hover | verified at 1280 × 720 |
| `TextLink` | Announcement-bar anchor with optional accent text | default; desktop and mobile layout | verified at 1280 × 720 and 390 × 844 |
| `MeliusButton` | Sign-in, start-for-free and in-panel actions | outline, yellow, orange; desktop and mobile layout | verified at 1280 × 720 and 390 × 844 |
| `Typography` | Source heading/body type classes and downloaded fonts | heading; body; label | analysis captured |
| `HeroHeadline` | Hero’s two-line `t-h-1` element and entrance state machine | hidden; revealed | verified typography and source transition |
| `HeroDescription` | Hero’s source-sanitized, line-broken description | desktop; mobile | verified at 1280 × 720 and 390 × 844 |
| `SegmentedTab` | Canvas category button | active; inactive; hover | verified against source active/inactive states |
| `MeliusTag` | Canvas-node media tag | orange label | verified against source dimensions and type |
| `CanvasNodeCaption` | Canvas-node title and model label | default | verified against source dimensions and type |
| `CanvasMediaFrame` | Canvas-node image/video surface | loading; loaded | verified source geometry and asset state styling |
| `PersonaIndent` | Persona-card media-side source SVG and label | default | verified at 1280 × 720 and 390 × 844 |
| `PersonaMedia` | Persona-card image/video surface, `PersonaIndent`, mobile use-case tags | image; video; active/inactive tags; desktop/mobile | verified at 1280 × 720 and 390 × 844 |
| `PersonaCard` | `PersonaMedia`, title, description | active card; desktop/mobile | verified at 1280 × 720 and 390 × 844 |
| `BillingToggle` | Pricing section’s `button[aria-label^="Switch to"]`, source SVG and animated knob | annual; monthly; desktop/mobile | verified at 1280 × 720 and 390 × 844 |
| `FooterStatus` | Footer `Status: Up` row and downloaded status-state code | operational; incident | operational verified at 1280 × 720 and 390 × 844; incident mapping reconstructed from downloaded code |
| `FooterMeta` | Footer status/copyright/legal-link strip | desktop row; mobile stack; cookie-preferences callback | static layout verified at 1280 × 720 and 390 × 844; consent dialog remains a separate component |
| `ConsentSwitch` | Downloaded c15t consent category switch | checked; unchecked; disabled necessary; reduced motion | verified at 1280 × 720, 640 × 844, and 390 × 844 |

### 2. Composite components

| Composite | Depends on | Required states | Status |
| --- | --- | --- | --- |
| `AnnouncementBar` | `TextLink`, typography | default link | verified at 1280 × 720 and 390 × 844 |
| `SiteHeader` | `MeliusLogo`, `MenuToggle`, `MenuLink`, `MeliusButton`, `AccordionContent` | menu closed; menu open | verified at 1280 × 720 and 390 × 844 |
| `SegmentedTabBar` | `SegmentedTab` | each selected category; desktop and horizontal mobile scroll | verified at 1280 × 720 and 390 × 844 |
| `CanvasNode` | `CanvasNodeCaption`, `MeliusTag`, `CanvasMediaFrame` | hidden; revealed; image/video media | verified source geometry and reveal behavior at 1280 × 720 and 390 × 844 |
| `CanvasScene` | `CanvasNode` | five category scenes; observer/tab synchronization; timed node/connector playback; drag; reduced motion; desktop and mobile scaling | analyzed; the existing static Advertising draft is not source-equivalent |
| `ModelCarouselControls` | source arrow SVG and progress rail | 25% idle progress; previous/next callback affordances; desktop/mobile layout | static geometry verified at 1280 × 720 and 390 × 844; carousel-state transitions remain part of `ModelCarousel` |
| `FaqAccordionItem` | `AccordionContent`, downloaded source icon treatment and FAQ typography | closed; open; desktop/mobile | verified at 1280 × 720 and 390 × 844 |
| `NewsletterForm` | source email field and arrow-submit button | idle; native invalid-email behavior; source delivery success/error | idle geometry and native input behavior verified at 1280 × 720 and 390 × 844; delivery transitions remain pending |
| `FooterLinkGroup` | footer `linkColumns` data and its desktop/mobile Radix markup | mobile collapsed; mobile open; desktop static links | verified at 390 × 844 (collapsed/open) and 1280 × 720 (static links) |
| `CookiePreferencesDialog` | `ConsentSwitch`, native dialog, downloaded consent category/action data | open; custom save; reject all; accept all; outside dismiss; desktop/mobile | verified at 640 × 844 and 390 × 844; provider persistence/script gating remains an integration boundary |

### 3. Sections and larger components

| Section | Depends on | Required states | Status |
| --- | --- | --- | --- |
| `HeroSection` | typography, prompt button, WebGL scene | gallery settled; prompt CTA | analysis captured |
| `CanvasShowcase` | `SegmentedTabBar`, `CanvasScene`, `CanvasNode` | every selected tab | analysis captured |
| `PersonaStack` | `PersonaCard`, `PersonaStackCardMotion`, `PersonaSelector` | five-card idle depth; click/selector-driven wrapping transition; desktop/mobile | analyzed; current gallery draft is not verified |
| `ModelCarousel` | WebGL scene, `ModelCarouselControls` | initial; previous/next; pointer drag; wheel; loop; reduced motion | analyzed; implementation pending |
| `PricingSection` | `BillingToggle`, `PricingCard` | annual; monthly; savings animation; card hover/reveal; desktop/mobile | implementation in progress; real source notch asset captured, responsive section verification pending |
| `FaqSection` | `FaqAccordionItem`, downloaded FAQ data | collapsed; one answer expanded; desktop/mobile | verified at 1280 × 720 and 390 × 844 |
| `FooterSection` | `NewsletterForm`, footer links | idle; valid/invalid submit | analysis captured |

## Assembly rule

The final page may import only components marked **verified**. Page-level
polishing is deferred until every source state is reproduced and tested at the
primitive, composite, and section levels.

## Verification notes

- `MenuToggle` is isolated at
  `react-demo/src/components/primitives/MenuToggle.jsx`. It uses the exact
  downloaded SVG paths, 40 × 40px geometry, and source-orange focus outline.
  At 1280 × 720, its closed and open geometry matches the source: panel
  `x=16 y=56 w=230`, button `x=205 y=57 w=40`; open panel height differs only
  by sub-pixel layout rounding (`241.94px` versus `242px`). At 390 × 844, the
  closed panel is `x=12 y=52 w=140`, and the open panel is
  `x=12 y=52 w=366 h=362`, matching the source.
- `AccordionContent` is isolated at
  `react-demo/src/components/primitives/AccordionContent.jsx`. The downloaded
  JavaScript uses Radix Accordion. The reconstruction keeps its region in the
  DOM while closed, uses `data-state="open"` / `"closed"`, retains the source
  height animation (300ms, `cubic-bezier(.76, 0, .24, 1)`), and changes to
  `display:none` after closing. Its closed/open regions measure 0/200px at
  desktop and 0/320px at mobile, matching the downloaded mirror.
- `MeliusLogo` is isolated at
  `react-demo/src/components/primitives/MeliusLogo.jsx`. It uses the exact
  source SVG path and matches its 72 × 14px rendered mark and 96 × 38px linked
  hit area at the desktop reference viewport.
- `MenuLink` is isolated at
  `react-demo/src/components/primitives/MenuLink.jsx`. Its text, `/pricing`
  destination, typography, 75.57 × 27.5px text rect, and the header panel’s
  230 × 242px open geometry match the desktop source state.
- `MeliusButton` is isolated at
  `react-demo/src/components/primitives/MeliusButton.jsx`. It reproduces the
  downloaded `t-b-3` typography (12.8px / 15.36px / -0.03em), 6px radius,
  14px header padding, 8px menu padding, and the outline, yellow, and orange
  variants. At 1280 × 720 its source and reconstructed header buttons have
  identical 66.06 × 40px and 103.39 × 40px bounds; the open-menu actions
  match at `x=31 y=255` and `x=136 y=255`. At 390 × 844 the open panel is
  366 × 362px and the only menu action is the 68.06 × 40px Sign In button at
  `x=29 y=349`, matching the source’s responsive state.
- `TextLink` is isolated at
  `react-demo/src/components/primitives/TextLink.jsx`. It reproduces the
  downloaded announcement anchor: 12.8px / 15.36px / -0.03em, 8px gap, 16px
  horizontal padding, white primary text, and the orange optional accent.
  The reconstructed 40px bar preserves the source link’s center alignment at
  both reference viewports, including the unchanged mobile type scale.
- `AnnouncementBar` is composed only from `TextLink` at
  `react-demo/src/components/AnnouncementBar.jsx`. Its source URL, text,
  dark `#1a1616` background, 40px height, and responsive state are verified.
- `HeroHeadline` is isolated at
  `react-demo/src/components/primitives/HeroHeadline.jsx`. It uses the
  downloaded 56px Reckless heading type (56px line height and -0.02em
  tracking), which produces the source’s 533.125px untransformed desktop
  headline width. The downloaded JavaScript’s entry state is reproduced:
  `opacity: 0; scale: 1.2` to `opacity: 1; scale: 1` over 1.5 seconds with
  `cubic-bezier(.16, 1, .3, 1)`. The upcoming hero composite will connect this
  state to the downloaded WebGL-intro completion event.
- `HeroDescription` is isolated at
  `react-demo/src/components/primitives/HeroDescription.jsx`. It accepts the
  source newline and renders the source `<br>` break. It uses the downloaded
  16px / 24px system type, centered alignment, and responsive `max-width`
  values: 480px desktop and 320px mobile. Its untransformed text block is
  480 × 72px at desktop and 320 × 120px at mobile, matching the mirror.
- `SegmentedTab` is isolated at
  `react-demo/src/components/primitives/SegmentedTab.jsx`. It matches the
  downloaded canvas category-button type: Futurist 12px / 16px / -0.04em,
  16px horizontal and 6px vertical padding, 4px radius, white active text,
  and gray inactive text. The source and reconstruction both render the
  Advertising label at 95.64 × 28px.
- `SegmentedTabBar` is at
  `react-demo/src/components/SegmentedTabBar.jsx`. It reproduces the
  downloaded animated orange indicator (width and x position), active
  `aria-current="true"` state, 11px button gap, and responsive horizontal
  scroll-to-selected behavior. At mobile width its 510px content scrolls
  within the 326px viewport, matching the source’s overflow model.
- `MeliusTag` is isolated at
  `react-demo/src/components/primitives/MeliusTag.jsx`. It reproduces the
  canvas-node `Image` label: Ease 10px / 10px, 18px height, 12px horizontal
  padding, 2px radius, and the source orange/black colors. The source and
  reconstruction both measure 52.43 × 18px before the canvas-scene transform.
- `CanvasNodeCaption` is isolated at
  `react-demo/src/components/primitives/CanvasNodeCaption.jsx`. It reproduces
  the canvas-node title/model row: Ease 10px / 10px, `#d9d9d9` text,
  `space-between` layout, baseline alignment, and 8px bottom padding. The
  untransformed source and reconstruction both produce a 320 × 18px caption.
- `CanvasMediaFrame` is isolated at
  `react-demo/src/components/primitives/CanvasMediaFrame.jsx`. It reproduces
  the source’s aspect-ratio surface, black background, 2px radius, hidden
  overflow, absolute `object-contain` media, and the 500ms source loading
  transition (60% opacity / 4px blur to loaded). The Product Mockup reference
  frame is 282 × 184.25px in both the source and reconstruction.
- `CanvasNode` is composed at `react-demo/src/components/CanvasNode.jsx` only
  from the verified caption, tag, and media-frame primitives. Its logical
  geometry matches the source at both reference viewports: 300 × 246.25px
  overall, 300 × 18px caption, 300 × 228.25px media body, and 282 × 184.25px
  media frame. It supports the downloaded sequence states: hidden is
  `opacity: 0` with `translateY(16px) scale(.98)`; revealed transitions to
  identity over 750ms with the source cubic-out easing while the media’s
  brightness/sepia reveal resolves over the same duration. The mobile canvas
  scales this same logical node externally; that scaling belongs to the
  upcoming `CanvasScene`, not the node component.
- `CanvasScene` is currently a geometry-and-asset draft at
  `react-demo/src/components/CanvasScene.jsx`, based on the Advertising
  scene’s 1100 × 559px track, captured assets, 780px/560px viewport rule, and
  connector coordinates. It must not be treated as verified: the downloaded
  source uses five scroll-observed scenes, synchronized tabs/backgrounds,
  typed prompt dock, timed node/connector playback, post-playback dragging,
  media lifecycle, and a reduced-motion branch. The complete source contract
  is recorded in `CANVAS_COMPONENT_SPEC.md`.
- `ModelCarouselControls` is isolated at
  `react-demo/src/components/ModelCarouselControls.jsx`. It uses the exact
  downloaded 24 × 24px arrow path, two 44 × 44px button hit areas, and the
  source’s 140 × 2px rail with a 35px (25%) `#f04e23` fill. Those values are
  identical in the offline source and local gallery at both 1280 × 720 and
  390 × 844. The controls are callback-driven; the source carousel’s model
  selection and WebGL card transition are deliberately not claimed until the
  `ModelCarousel` section is captured and reproduced.
- `PersonaIndent` is isolated at
  `react-demo/src/components/primitives/PersonaIndent.jsx`. It uses the exact
  downloaded `viewBox="0 0 23 178"` SVG path from the persona card, a 180px
  high left-edge media indent, and the downloaded Futurist `MELIUS` label
  (10px / 10px, 8px right margin, `rotate: 270deg`). The reconstruction and
  source both measure 23.26 × 180px for the indent and 10 × 38.8px for its
  rotated label at desktop and mobile.
- `PersonaMedia` is composed at
  `react-demo/src/components/primitives/PersonaMedia.jsx`. It matches the
  source’s square, 8px-radius, clipped media surface with absolute
  `object-fit: cover` video/image media; video playback follows its active
  state. At mobile, its use-case tags match source geometry exactly: Futurist
  10px / 10px, 4px × 8px padding, 2px radius, yellow background, 4px stack
  gap, and 10px top/right placement. The tags are intentionally hidden at the
  source `lg` breakpoint (1024px) and the inactive state fades them out.
- `PersonaCard` is composed at `react-demo/src/components/PersonaCard.jsx`.
  It reproduces the source’s 400px desktop / 90vw mobile card, white 8px
  container, 12px / 16px media padding, 16px media-to-copy gap, 8px left copy
  indent, and `lg` 32px right copy padding. Its title uses the captured
  Reckless 36px/36px type and its description uses captured Ease
  12.8px/15.36px/-0.03em type. At 390px, source and reconstruction both
  measure a 351px card with a 327px square media surface and visible tags.
- `BillingToggle` is isolated at
  `react-demo/src/components/primitives/BillingToggle.jsx`. It reproduces the
  downloaded controlled button’s labels, accurate accessible action label,
  69 × 24px source SVG path, 18px orange-accented knob, 46px annual offset,
  and 200ms label-color / 300ms knob transitions. In both the downloaded
  mirror and local gallery, the settled annual and monthly states measure
  209.34 × 24px with label widths 58.55px and 49.79px, respectively; its
  mobile state fits a 390px viewport without horizontal overflow.
- `FaqAccordionItem` is composed at
  `react-demo/src/components/FaqAccordionItem.jsx` from the previously
  verified `AccordionContent` primitive. It keeps the source’s Radix-like
  `aria-expanded` / `data-state` lifecycle, a single 1px faded top border,
  16px trigger padding, 16px gap, 0.6em plus mark, and an answer region that
  remains mounted while it animates. At desktop the local closed/open trigger,
  content, and root measure 896 × 60.5px, 896 × 165.01px, and 896 ×
  226.51px versus the mirror’s 896 × 60.5px, 896 × 164.97px, and 896 ×
  226.47px. At mobile, it retains the downloaded 13.6px / 16.32px type and
  52.4px trigger height when placed in the source-width container.
- `NewsletterForm` is isolated at
  `react-demo/src/components/NewsletterForm.jsx`. It uses the captured email
  semantics (`type=email`, `inputMode=email`, autocomplete, no `required`
  attribute), source arrow SVG, 16px field padding, 24px submit target, and
  8px rounded, 1px `#d9d9d9` control shell. Its local gallery matches the
  source at 360 × 42.32px desktop and 311 × 42.32px mobile, including the
  13.6px / 16.32px field type. Source delivery success/error screens are
  intentionally held back until their downloaded state transitions are
  captured without submitting user data.
- `FooterLinkGroup` is composed at
  `react-demo/src/components/FooterLinkGroup.jsx` from the downloaded footer
  `linkColumns` data and the verified `AccordionContent` lifecycle. At 390px,
  its mobile Product trigger is 311 × 20.40px in both the mirror and gallery;
  its expanded region is 311 × 254.24px and root is 311 × 274.64px. The seven
  copied Product link destinations, target behavior, 13.6px / 16.32px / -.03em
  type, and `#676767` text color match the source. At 1280px, the desktop
  static group has the source’s intrinsic 78.93px width and 250.56px height:
  16.32px title, 24px gap, then seven 16.32px links at 16px intervals.
- `FooterStatus` is isolated at
  `react-demo/src/components/primitives/FooterStatus.jsx`. Its operational
  state matches the source at desktop and mobile: a 6px `#778958` dot, 6px
  gap, and `Status: Up` in 13.6px / 16.32px / -.03em `#676767` type, for an
  intrinsic 74.55 × 16.32px row. The downloaded footer code maps an incident
  to an orange dot and `Status: Down`; that code path is represented without
  claiming a live incident visual capture.
- `FooterMeta` is composed at `react-demo/src/components/FooterMeta.jsx` from
  `FooterStatus` and the downloaded legal-link data. At desktop its 1080 ×
  37.32px source strip has a 1px `#3e3e3e` top rule, 36px top margin, 20px top
  padding, 24px column gap, and right-aligned legal links. At mobile it
  switches structurally to the captured 311 × 130.28px stack with 32px top
  margin, 24px top padding, 16px group gap, and wrapped legal links. Its
  Cookie Preferences button exposes the captured parent callback; the third-
  party consent dialog is tracked separately rather than substituted with an
  invented modal.
- `ConsentSwitch` and `CookiePreferencesDialog` are composed at
  `react-demo/src/components/primitives/ConsentSwitch.jsx` and
  `react-demo/src/components/CookiePreferencesDialog.jsx`. They use the
  downloaded source's native-dialog overlay, 28 × 16px role=switch contract,
  locked Necessary state, 150ms switch transition, 640px layout change,
  outside-card dismissal, focus return, and scroll lock. The locally verified
  mobile card is 376 × 395.42px with its source 354px rows and 86px action
  stack; the desktop card is 448 × 320.92px with a 426px horizontal action
  footer. Save, Reject all, and Accept all correctly preserve the supplied
  controlled state. Consent-provider persistence and script gating remain
  intentionally outside the visual React component.
- `FaqSection` is composed at `react-demo/src/components/FaqSection.jsx` from
  `FaqAccordionItem` and the eight exact question/answer records extracted
  from the downloaded page data. Its outer and inner geometry matches the
  source at both reference widths: desktop is 1280 × 821px with a 896px
  content column, 56px title, and 493px collapsed accordion; mobile is
  390 × 716.67px with a 360px content column, 112px two-line title, and
  452.67px collapsed accordion. It keeps the source’s one-open-item
  interaction model.
- `SiteHeader` at `react-demo/src/components/SiteHeader.jsx` is verified in
  closed and open states. At desktop it matches the source’s 230 × 42px closed
  panel and 230 × 242px open panel; at mobile it matches the 140 × 42px closed
  panel and 366 × 362px open panel. The matching checked state includes the
  accessible expanded state and the header action/menu-action visibility.
