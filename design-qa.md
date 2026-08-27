# Screen Analyze dark-card redesign QA — 2026-08-27

## Scope and evidence

- Scope: the Screen Analyze information panel only. The viewer, actions, evidence summary, and stored analysis data remain unchanged.
- Source visual truth: `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/TemporaryItems/NSIRD_screencaptureui_ZHi3yb/Screenshot 2026-08-27 at 11.06.28.png` (716 × 510 px).
- Browser-rendered implementation: `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/vitrines-screen-analysis-dark-card-final.png` (603 × 863 px, matching the active 603 × 863 CSS viewport at 1x capture density).
- State: Storybook visual-review story, mobile-width Screen Preview modal, Screen Analyze panel open at its top position.
- Full-view evidence: the source and browser-rendered implementation above were opened before review.
- Focused normalized comparison: `/tmp/vitrines-screen-analysis-qa-comparison.png`. The source card was cropped to 640 × 460 px. The implementation panel was cropped to 571 × 497 px and normalized to 460 px high for the side-by-side comparison.

## Findings and comparison history

1. P2: the first browser pass showed a blue focus outline around the dark panel that was absent from the source. The focus-only outline was removed from the programmatically focusable analysis panel. The final browser capture shows the intended uninterrupted charcoal surface.
2. P2: initial labels and values were visually smaller and lighter than the source. Labels were adjusted to 15/20 semibold Figtree and values/chips to 16/22 semibold Figtree. The focused comparison shows the source hierarchy carried into the denser Vitrines content.
3. P2: annotation review found Theme and Viewport unnecessary in this panel. Both fields were removed, leaving Product area as the only secondary fact. The final browser capture at `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/vitrines-screen-analysis-dark-card-simplified.png` shows the shorter hierarchy.
4. P0/P1: none.

No actionable P0, P1, or P2 differences remain. The implementation preserves Vitrines' visual description, product area, Page Type, and five UI-element values while using the source screenshot's compact hierarchy.

## Required fidelity surfaces

- Fonts and typography: Figtree preserves the source's clean sans-serif character; muted semibold labels and brighter semibold values create the same hierarchy without clipping or truncation.
- Spacing and layout rhythm: the two-column summary/fact rows, 24 px mobile inset, 24 px section rhythm, compact chip gaps, and 26 px panel radius match the source's proportions while allowing the richer Vitrines payload to scroll safely.
- Colors and visual tokens: the panel uses the source-like `#242424` charcoal, `#b9b9b9` labels, white values, and `#4b4b4b` chips with sufficient contrast.
- Image quality and asset fidelity: the source contains no imagery, logo, illustration, or non-standard icon asset inside the card; no placeholder or generated asset was needed.
- Copy and content: the focused Screen Analyze fields use their existing Vitrines values. Theme and Viewport are intentionally omitted per annotation feedback; the header labels the existing screen type and platform explicitly.

## Browser checks

- Hide info closes the panel and More info reopens it successfully.
- Opening and closing use the verified 180–220 ms opacity/translate/scale transition; the panel becomes visible during opening and hidden after closing. Reduced-motion mode disables the transform and transition.
- The panel remains readable at the active mobile-width viewport and scrolls within its existing height constraint.
- Browser console messages after the interaction check: 0.

## Follow-up polish

- P3: a future wider desktop-specific layout could keep all facts on one row, but the current two-column treatment is more faithful and readable at mobile width.

final result: passed

---

# Pricing page design QA

**Comparison target**

- Source visual truth: `/Users/kai/.codex/generated_images/01a00dd9-471d-7983-ac42-90d8b703f880/exec-5d27fe51-a716-4b3e-8b03-25f75b923c4e.png`
- Implementation: `http://127.0.0.1:4173/pricing` in the in-app browser.
- Viewport: 1536 × 1024 CSS px. The source is 1536 × 1024 px; the browser capture was taken at the matching CSS viewport. The browser capture used the runtime device density, so visual comparison was made on the browser-rendered result rather than a pixel-diff.
- States reviewed: light default, dark system preference, annual billing selected, and an expanded Team billing FAQ.

**Full-view comparison evidence**

The source image and browser-rendered light implementation were opened together during the review. Both preserve the defining composition: restrained masthead, asymmetric research headline, billing selector, full-width Free/Pro/Team comparison board with the Pro column in saturated blue, methodology proof strip, and questions beneath it.

**Focused region comparison evidence**

The pricing board was reviewed separately because it carries the price, plan hierarchy, CTA, and feature-comparison density. The light view keeps the blue Pro emphasis legible against the white board; the dark view retains the same grid, border rhythm, and high-contrast CTA treatment. The annual toggle visibly changes Pro to `$79.99/year`, and the Team FAQ visibly expands with its billing explanation.

**Findings**

No actionable P0, P1, or P2 differences remain.

- [P3] The implementation uses Vitrines' existing compact navigation rather than the source's broader marketing-navigation labels. This is intentional so the rebuilt page stays connected to real application routes and auth states.
- [P3] The light surface uses the existing Vitrines cool-neutral token rather than the source image's paper-white texture. This is intentional: the source uses a decorative texture that is not part of the product design system.

**Required fidelity surfaces**

- Fonts and typography: existing Figtree/Bricolage system preserves the oversized, tight headline and compact comparison text hierarchy.
- Spacing and layout rhythm: the measured wide board, border grid, dense rows, and generous hero whitespace are retained; mobile collapses the surrounding layout while allowing the comparison board to scroll horizontally.
- Colors and visual tokens: body/surface/border/text use existing semantic Vitrines tokens; Pro is given a stable blue accent with white foreground and CTA treatment in both themes.
- Image quality and asset fidelity: the selected board contains no custom imagery beyond the existing Vitrines favicon; product icons use the existing icon library.
- Copy and content: source-direction copy is adapted to the real Free, Pro, and Team entitlement model, including the $8.99/month, $79.99/year, and three-editor Team minimum.

**Implementation checklist**

- [x] Render the selected board direction on the public and catalog pricing routes.
- [x] Support light and dark system themes.
- [x] Keep monthly/annual selection, plan CTAs, Team entry, Free-use context, and expandable FAQs functional.
- [x] Verify browser rendering and primary interactions.

**Browser checks**

The pricing route rendered and its annual selector and FAQ controls completed without browser errors attributable to this change. The development session logged one existing React `createRoot()` warning after a forced Vite reload used to switch the emulated color preference; `src/vitrine/main.tsx` contains a single root creation and the warning did not recur through the pricing controls.

**Follow-up polish**

- If marketing navigation expands later, the optional source-style links can be added to the shared public nav rather than only to Pricing.

final result: passed

---

# Apps hero motion refinement QA — 2026-08-25

## Scope and evidence

- Scope: the three annotated Apps-page motion refinements only: header search, editorial title, and catalog proof icons. The surrounding header, hero layout, copy, CTA, filters, and cards remain unchanged.
- Source visual truth: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/01-details-hero-reference-919.png`, supplemented by browser Comments 1–3 describing the intended interaction states.
- Desktop implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/15-vitrines-apps-motion-desktop-919.png`.
- Mobile implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/16-vitrines-apps-motion-mobile-390.png`.
- Desktop viewport and images: 919 x 863 CSS pixels and image pixels at 1x density. Mobile viewport and image: 390 x 844 CSS pixels and image pixels at 1x density.
- State: dark theme, Apps selected, catalog loaded with 32 products, page at the top, search at rest and hovered.

## Comparison evidence

- Full normalized comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/17-details-vs-vitrines-motion-919.png`.
- Focused header and hero comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/20-details-vs-vitrines-motion-focused.png`.
- The full and focused comparisons show no static layout drift: headline wrapping, subtitle measure, CTA position, proof row, filter transition, typography, spacing, colors, real app assets, and product copy remain consistent with the previously approved hero adaptation.

## Findings and iteration history

1. P2: the first ambient search sweep targeted `background-position` on a button whose shared background shorthand is `!important`, so the keyframe could not move. Fixed by moving the sweep to an isolated, non-interactive pseudo-element. Post-fix browser evidence changed the sweep from `120%` to `87.68%` during the sampled cycle; hover stops the ambient animation at `-120%`, lifts the button by 1px, and moves/scales the icon.
2. P2: the first moving proof strip exposed hard partial-icon edges during entry and exit. Fixed with a narrow edge mask while retaining real catalog icon assets. The final 919px and 390px captures show a softened continuous left-to-right loop.
3. P0/P1: none.

No actionable P0, P1, or P2 issues remain.

## Required fidelity and runtime checks

- Fonts and typography: Instrument Serif wrapping, size, weight, tracking, and hierarchy are unchanged; the React Bits-inspired shine is background-clipped to the existing title without changing its metrics.
- Spacing and layout rhythm: search, hero, CTA, proof, and filter geometry are unchanged at 919px and 390px; no horizontal overflow was detected (`scrollWidth` equals viewport width).
- Colors and tokens: motion uses the existing text, surface, border, and motion tokens; the shine remains neutral and restrained against the dark theme.
- Image quality and assets: the carousel continues to use real `AppIcon` catalog imagery, duplicated only for a seamless track; no replacement or placeholder asset was introduced.
- Copy and content: all Apps-page copy and the live `32 products indexed` count are unchanged.
- Motion: title background position and icon-track transform both changed across timed browser samples; the search ambient sweep and hover state were independently measured. Reduced-motion disables all three continuous/transition effects.
- Primary interactions: search still opens the modal and Escape restores page scrolling; Explore apps behavior remains covered by the existing hero QA.
- Browser console errors: none.
- Focused automated checks: 34 passed, 0 failed. `git diff --check` passed.

final result: passed

---

# Apps Screens filter transition design QA

## Comparison target

- Source: the user's browser annotation on the Screens filter at 1159 × 863, showing the open desktop panel and requesting a smooth change between its two states.
- Implementation: `http://localhost:5173/apps?platform=web&content_type=screens`.
- Evidence: `/Users/kai/.codex/visualizations/2026/08/23/01a02d53-4ee4-7922-b724-f351938af751/vitrines-screens-filter-transition-final.png`.

## Findings and verification

No actionable P0, P1, or P2 differences remain. The panel now remains mounted for its 180ms exit animation, is hidden from assistive technology and pointer input while closing, returns focus to the trigger, and then unmounts. Desktop uses the compact fade/lift motion; the 390px bottom sheet exits downward. Apps and Screens results use the same 180ms motion token when their result mode changes. Reduced-motion rules remove the animations.

- Desktop 1159 × 863: open animation `astryx-dropdown-in`, close animation `astryx-dropdown-out`, no horizontal overflow, and zero console errors.
- Mobile 390 × 844: open animation `apps-filter-sheet-in`, close animation `apps-filter-sheet-out`, no horizontal overflow, and the closing panel unmounted after 180ms.
- `npx tsx --test src/vitrine/AstryxDropdown.test.tsx src/vitrine/AppsFilterBar.test.tsx src/vitrine/AppsDiscovery.test.tsx` — 63 passing.
- `node --experimental-strip-types --test src/vitrine/MotionSystem.test.ts` — 8 passing.
- `npm run build` — passing; Vite reports only existing unresolved-reference and large-chunk advisories.
- `git diff --check` — passing.

final result: passed

---

# Taste Labs corrected component design QA

## Scope and source evidence

- Corrected React components: `TasteChallengeCarouselSection` and `TasteSwipeFooter` on `/components`.
- Live source inspected from the rendered DOM at `https://tastelabs.com/#product`; implementation was matched to the source element geometry, asset order, responsive behavior, and interaction scripts rather than inferred from screenshots.
- Challenge comparison evidence: `artifacts/taste-challenge-source-same-viewport.png`, `artifacts/taste-challenge-local-qa.png`, and `artifacts/taste-challenge-comparison.png`.
- Footer comparison evidence: `artifacts/downloads/tastelabs.com/2026-08-22-product/source-evidence/desktop-09-5737.jpg`, `artifacts/taste-footer-local-qa.png`, and `artifacts/taste-footer-comparison.png`.

## Corrected findings

1. [P1, fixed] The challenge was a flat collection of independently floating images. It is now a source-shaped 12-panel 3D cylinder with the measured panel grouping, perspective, radius, continuous rotation, pointer drag, and release direction.
2. [P1, fixed] The footer was a single horizontal deck with one active draggable tile and an extra inner border. It now uses the source's borderless 16:9 footer surface, 11-tile 6/5 honeycomb, source typography and labels, and any-tile dragging.
3. [P1, fixed] Footer progress began at `00` and counted upward. It now begins at `LOVE IT 04`, counts remaining favorites down, reaches the result state after four yes decisions, and exposes a restart control.
4. [P2, fixed] Desktop preview ratios were incorrect. Challenge now uses `1280 / 780`; footer uses `1280 / 720`.
5. [P2, fixed] The two components switched to their compact implementation too early. The source-faithful desktop layout now remains active through 695px; the 390px compact implementation activates at 480px and below.

No actionable P0, P1, or P2 differences remain in the requested component surfaces.

## Browser and interaction checks

- Desktop card view renders 12 challenge panels and the full 11-tile footer honeycomb.
- The challenge panel transform advanced automatically, then changed materially after a horizontal drag (`rotateY(432.676deg)` to `rotateY(485.931deg)`).
- Dragging a footer tile to the yes side changed the full preview from `Love it 04` to `Love it 03`; four yes decisions reached `Love it 00` and rendered the result/restart state.
- At 390px, the intrinsic challenge host is 390 × 489 and the footer host is 390 × 660; both have equal client and scroll widths, with 12 challenge panels and the compact 7-slot footer fallback.
- A fresh local load recorded no runtime errors after the server was restarted. The existing neutral-theme runtime-injection advisory remains a warning only.

## Automated verification

- `git diff --check` on the corrected component files — passing.
- `npx tsx --test src/vitrine/CatalogComponentsPage.test.tsx` — 2 passing.
- `npm run build` — passing; Vite reports existing unresolved-reference and large-chunk advisories only.
- The repository-wide `npm test` run completed 1,969 of 1,972 tests passing; its three failures are pre-existing unrelated Vitrines chrome/favicon migration assertions and do not touch the corrected Taste Labs components.

final result: passed

# Taste Labs selected React components QA — 2026-08-22

## Scope and source evidence

Five regions selected from `https://tastelabs.com/#product` were reconstructed as standalone React components: `TasteHeroSection`, `TasteChallengeCarouselSection`, `TasteMissionSection`, `TasteStackSection`, and `TasteSwipeFooter`. The implementation uses hydrated selected DOM, computed layout evidence, source media, local Matter/Azeret fonts, the original WebM, source `.lottie` files, and the source tile imagery. No downloaded page HTML or source JavaScript is mounted at runtime.

- Source capture: `artifacts/downloads/tastelabs.com/2026-08-22-product/source-evidence/`.
- Desktop reference-to-React comparison: `artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/evidence/comparisons/all-desktop-pairs.jpg`.
- Mobile reference-to-React comparison: `artifacts/downloads/tastelabs.com/2026-08-22-product/reverse-engineering/selected-components-suite/evidence/comparisons/all-mobile-pairs.jpg`.

## Browser and interaction checks

- A fresh `/components` load exposed all five named Taste Labs React hosts in the component library.
- The hero's local WebM reached `readyState: 4` and played; the challenge loaded 18 local images with zero broken assets.
- The challenge pointer-parallax transform changed after cursor movement.
- The mission rendered one source Lottie canvas; the Stack component rendered two source Lottie canvases and two React-owned forms.
- Submitting a Stack form changed local React state without making a network submission.
- Desktop and 390px mobile footer drag gestures advanced the active tile and the `Love it` count; four desktop decisions reached the React result/restart state.
- At 390px, the Stack host measured 390 × 1420, its section content measured 390 × 1405, and horizontal scroll width equaled client width.
- A clean browser tab recorded no runtime errors. The only console entry was the existing Vitrines neutral-theme runtime-injection advisory.

## Automated verification

- `node --import tsx --test src/vitrine/componentLibraryCatalog.test.ts src/vitrine/CatalogComponentsPage.test.tsx` — 5 focused tests passing.
- `git diff --check` — passing.
- `npm run build` — passing; Vite reports existing unresolved-reference and large-chunk advisories only.

final result: passed

---

# Color Composer design QA

## Comparison target

- User reference: `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/TemporaryItems/NSIRD_screencaptureui_iwsXPS/Screenshot 2026-08-18 at 13.29.04.png` (2630 × 1378 physical px, normalized to 1315 × 689 CSS px at its recorded 2× density).
- Live source: Adobe Color Wheel, `https://color.adobe.com/create/color-wheel`.
- Latest product direction: the five browser annotations on `/colors/compose` at 742 × 863, removing the palette-mode toolbar and Primary/Image tabs, changing the swatch borders, and refining the harmony icons.
- Implementation: `http://127.0.0.1:5175/colors/compose`.
- Matched reference comparison viewport: 1315 × 689 CSS px. Additional live-source and responsive checks used 1280 × 720, 891 × 863, and the annotated 742 × 863 CSS viewport.
- States reviewed: exact five-color palette, dark-neutral active color, bright-pink active color, tint editor, focused swatch actions, compact desktop, compact footer actions, harmony selection, and undo.

## Full-view comparison evidence

- User reference and the final verified Vitrines build at the exact 1315 × 689 CSS viewport: `artifacts/color-composer-qa/continued-live/29-final-verified-comparison.jpg`.
- Latest Adobe/reference and annotation-revised Vitrines comparison at 1315 × 689: `artifacts/color-composer-qa/continued-live/38-annotated-revision-comparison.jpg`.
- Clean annotation-revised Vitrines capture at 742 × 863: `artifacts/color-composer-qa/continued-live/36-annotated-revision-clean-742x863.jpg`.
- Custom-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/39-custom-thumbnail-742x863.jpg`.
- Analogous-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/40-analogous-thumbnail-742x863.jpg`.
- Complementary-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/41-complementary-thumbnail-742x863.jpg`.
- Split-Complementary-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/42-split-complementary-thumbnail-742x863.jpg`.
- Triad-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/43-triad-thumbnail-742x863.jpg`.
- Square-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/44-square-thumbnail-742x863.jpg`.
- Compound-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/45-compound-thumbnail-742x863.jpg`.
- Shades-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/46-shades-thumbnail-742x863.jpg`.
- Monochromatic-thumbnail verification at 742 × 863: `artifacts/color-composer-qa/continued-live/47-monochromatic-thumbnail-742x863.jpg`.

The matched desktop comparison places the pane boundary within 1px of the reference, uses the same 84px toolbar row, 540px five-column swatch field, 16px canvas/footer gap, 49px footer, 286px wheel, two-line title, and bottom action bar. The user-requested revision intentionally removes Adobe's left palette-mode toolbar and the Primary/Image/Color wheel tab strip, making the wheel the sole editor. At compact widths the editor changes to a 51%/49% split with five 124px horizontal color rows and a two-line footer. Vitrines uses the exact supplied palette: `#424242`, `#FF98BB`, `#BA1650`, `#CCCCCC`, and `#056C5C`.

## Focused region comparison evidence

- Tint state, Adobe and Vitrines: `artifacts/color-composer-qa/continuation/23-desktop-tint-comparison.png`.
- Bright-pink active wheel, Adobe and Vitrines: `artifacts/color-composer-qa/continuation/27-pink-active-comparison.png`.
- Complementary source thumbnail and its rendered third-control placement: `artifacts/color-composer-qa/continued-live/41-complementary-focused-comparison.png`.
- Split Complementary source thumbnail and its rendered fourth-control placement: `artifacts/color-composer-qa/continued-live/42-split-complementary-focused-comparison.png`.
- Triad source thumbnail and its rendered fifth-control placement: `artifacts/color-composer-qa/continued-live/43-triad-focused-comparison.png`.
- Square source thumbnail and its rendered sixth-control placement: `artifacts/color-composer-qa/continued-live/44-square-focused-comparison.png`.
- Compound source thumbnail and its rendered seventh-control placement: `artifacts/color-composer-qa/continued-live/45-compound-focused-comparison.png`.
- Shades source thumbnail and its rendered eighth-control placement: `artifacts/color-composer-qa/continued-live/46-shades-focused-comparison.png`.
- Monochromatic source thumbnail and its rendered ninth-control placement: `artifacts/color-composer-qa/continued-live/47-monochromatic-focused-comparison.png`.

The Adobe tint control and the Vitrines tint control both replace one full-height swatch with seven stacked tint/base/shade choices and outline the active value. The seven values now use the same RGB-to-white and RGB-to-black blend ratios observed in Adobe. The wheel is canvas-rendered from the active color's HSV value, uses Adobe's measured artistic hue map, and places every handle by saturation and hue; selecting the bright-pink handle redraws the wheel at the matching brightness without mutating the palette.

## Findings

No actionable P0, P1, or P2 differences remain.

- [P3] Vitrines keeps its own name and icon mark; Adobe's brand assets are intentionally not copied.
- [P3] All nine harmony controls use the exact user-supplied Adobe PNG thumbnails stored in `public/color-wheel/harmony-thumbnails/`.
- [P3] The palette-mode toolbar and starting-point tabs visible in Adobe are intentionally absent because the user's latest annotations explicitly removed them.
- [P3] Adobe continues below the editor with promotional content. Vitrines ends at the functional composer because that material is outside the requested tool surface.

## Comparison history

1. Initial review found an extra secondary toolbar, an inline title, clipped swatches, pill-shaped harmony labels, permanently visible text controls, a range-based tint editor, and a footer positioned too early.
2. The layout was rebuilt to match Adobe's measured split, toolbar rows, five-column canvas, icon tabs, compact harmony buttons, hover/focus action rail, seven-step tint editor, and bottom palette action bar.
3. Live Adobe inspection showed the apparent color wheel is not a static rainbow: it is value-aware HSV rendered through a non-linear artistic hue map. Vitrines replaced the CSS approximation with a high-DPI canvas renderer and matching marker math.
4. The final compact pass aligned the 51%/49% split, five horizontal rows, add-color row, two-line footer, palette name, action icons, and full-width create button.
5. A fresh comparison against the supplied 2× screenshot found the remaining desktop split, wheel-size, toolbar, canvas-height, and footer geometry differences. The composer was isolated from the catalog header and those dimensions were corrected at the normalized 1315 × 689 viewport.
6. Interaction replay exposed a mismatch where clicking a wheel marker moved focus without changing the base swatch. Marker selection now updates the base color and active swatch together; Enter also commits and exits a hex field cleanly.
7. The annotation pass removed the left palette-mode toolbar and Primary/Image starting points, changed swatch separators from dark 1px rules to crisp 2px white rules, and replaced the generic/repeated harmony glyphs with distinct library-backed direction, contrast, branch, triangle, grid, merge, stack, and monochrome symbols.
8. The Custom harmony control now uses the exact 336 × 336 transparent PNG supplied by the user, rendered at 46 × 46 inside the existing 48px harmony button without changing the control's accessible name or behavior.
9. The Analogous harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size as Custom while preserving the second radio control's accessible name and behavior.
10. The Complementary harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the third radio control's accessible name and behavior.
11. The Split Complementary harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the fourth radio control's accessible name and behavior.
12. The Triad harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the fifth radio control's accessible name and behavior.
13. The Square harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the sixth radio control's accessible name and behavior.
14. The Compound harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the seventh radio control's accessible name and behavior.
15. The Shades harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the eighth radio control's accessible name and behavior.
16. The Monochromatic harmony control now uses the exact supplied 336 × 336 Adobe PNG, rendered at the same 46 × 46 size while preserving the ninth radio control's accessible name and behavior.

## Required fidelity surfaces

- Typography: two-line 34–48px editor title, compact supporting copy, restrained canvas labels, and existing Vitrines product typography.
- Spacing and layout: measured 34%/66% desktop split, responsive 51%/49% compact split, five equal desktop swatches, five 124px compact rows, 286px desktop wheel, add-color row, and two-line compact footer.
- Color and tokens: supplied reference palette is the stable default; foreground text and controls use contrast-aware colors.
- Assets: all nine harmony controls use the exact PNG assets explicitly supplied by the user, with no text symbols, CSS-drawn substitutes, or approximate library icons.
- Interaction: value-aware wheel click/drag editing, marker selection without palette mutation, harmony selection, lock, random, undo/redo, tint selection, delete/add, copy/share/download, palette naming, and create navigation are represented.

## Browser checks

- Clicking and dragging the wheel moved the selected handle and updated its hex value; clicking an existing marker selected it without changing any of the five values.
- Clicking an existing wheel marker also synchronized the active swatch and base-color state.
- The removed starting-point tabs and palette-mode toolbar no longer appear in the accessibility tree or DOM.
- Lock preserved a color through random generation.
- Generate random changed all unlocked values; Undo restored the previous palette and Redo restored the random palette.
- The harmony rail's right-arrow control scrolled the overflowed harmony choices.
- Selecting Triad changed the five-color palette, and Undo restored the exact supplied palette.
- Selecting Monochromatic, Shades, Compound, Square, Triad, Split Complementary, Complementary, Analogous, and Custom updated the respective `aria-checked` states; all nine 336px supplied images loaded completely and rendered at 46px inside their 48px radio buttons.
- Tint exposed seven options and changed the active color.
- Delete reduced the palette from five to four; Add restored it to five.
- Create with my palette navigated to `/colors/create`.
- A clean browser load after the annotation revision recorded no composer runtime errors. The development runtime reports the existing neutral-theme runtime-injection warning only.

## Automated verification

- `npx tsx --test src/vitrine/ColorGalleryPage.test.tsx src/vitrine/router.test.ts` — 49 passing.
- `npm run build` — passing; Vite reports only existing large-chunk advisory warnings.

final result: passed

---

# Details-inspired discovery header QA

Final result: passed

## Scope and state

- Scope: the shared Vitrines discovery header on Apps, Sites, Flows, Components, and Colors. Content below the header is intentionally outside this comparison.
- Reference: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-audit/02-details-header-1062.png`
- Desktop implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/12-vitrines-header-desktop-final.png`
- Mobile reference: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-audit/03-details-header-mobile.png`
- Mobile implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/04-vitrines-header-mobile-closed.png`
- Desktop viewport and image size: 1062 x 863 CSS pixels, 1062 x 863 image pixels, 1x CSS-density capture.
- Mobile viewport and image size: 390 x 844 CSS pixels, 390 x 844 image pixels, 1x CSS-density capture.
- State: dark theme, signed-in Vitrines account, Apps selected, discovery page at the top of the document.

## Comparison evidence

- Full desktop comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/13-desktop-full-comparison-final.jpg`
- Focused desktop header comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/14-desktop-header-comparison-final.jpg`
- Focused mobile header comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/10-mobile-header-comparison.jpg`
- Mobile menu state: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/05-vitrines-header-mobile-menu.png`
- Tablet state: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/header-build/03-vitrines-header-tablet-fixed.png`

The final header preserves the reference's compact dark bar, brand-first left edge, rounded selected destination, centered rounded search field, quiet secondary navigation, and terminal menu affordance. Product-specific differences are intentional: Vitrines retains its five reference types and shows the signed-in account control instead of Details' pricing and authentication calls to action.

## Iteration history

1. P1: At 850px, the five desktop type tabs crowded and clipped beneath the centered search. Fixed by moving 721-900px layouts to the compact type menu while keeping search visible. Rechecked at 850 x 900 with a 56px header and no horizontal overflow.
2. P2: At 1062px, the final Colors tab had insufficient clearance from the search field. Fixed by compacting medium-width tab typography and padding. Final measured clearance is 20.8px; all five tabs are fully visible.
3. P0: none.

No P0, P1, or P2 visual issues remain. The only remaining differences are intentional product-content adaptations rather than fidelity defects.

## Interaction and runtime checks

- Mobile type menu opens and exposes Apps, Sites, Flows, Components, and Colors with the current type marked selected.
- Selecting Sites navigates from `/apps` to `/sites`, updates the header identity, and changes the search label to `Search Sites…`.
- The shared search trigger opens the catalog search dialog on Apps and Sites.
- Keyboard shortcuts remain available through Command-K and Command-Space.
- Desktop, tablet, and mobile document widths match their viewports; no horizontal overflow was detected.
- Browser console errors: none.
- Focused automated checks: 121 passed, 0 failed.
- Production build: passed. Existing unresolved-asset and large-chunk warnings remain outside this header change.
- Search modal regression check: close button, native Escape, and backdrop dismissal all unmount the dialog after the exit transition; 44 focused search and application-boundary tests pass.

---

# Details-inspired Apps hero QA — 2026-08-25

## Scope and comparison target

- Scope: replace the Apps discovery category showcase with a Details-inspired editorial hero while retaining the functional platform, category, and screen filters below it.
- Source visual truth: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/01-details-hero-reference-919.png`.
- Final implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/08-vitrines-apps-hero-dark-919.png` at `http://127.0.0.1:5173/apps`.
- Desktop viewport and image size: 919 x 863 CSS pixels, 919 x 863 image pixels, 1x CSS-density capture for both source and implementation.
- Additional responsive evidence: 850 x 900 and 390 x 844 CSS pixels, both captured at 1x density.
- State: dark color scheme, Apps selected, catalog loaded with 32 products, page at the top of the document.

## Comparison evidence

- Full-view normalized comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/11-source-vs-vitrines-919.png`.
- Focused hero comparison: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/14-source-vs-vitrines-hero-focused.png`.
- Mobile implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/09-vitrines-apps-hero-mobile-390.png`.
- Tablet implementation: `/Users/kai/.codex/visualizations/2026/08/25/01a03856-1e30-7f91-b3b1-6c69b61a2e22/apps-hero-build/10-vitrines-apps-hero-tablet-850.png`.

The final desktop comparison preserves the source's centered two-line serif headline, muted centered support copy, white pill CTA, overlapping proof imagery, roughly 500px hero field, and immediate transition into the filtering/results surface. Product-specific differences are intentional: Vitrines keeps its own navigation, copy, real catalog app icons, exact catalog scale, and functional Apps filters rather than Details' membership conversion and inspiration-category pills.

## Comparison history

1. P1: the first rendered pass inherited a medium-width two-column taxonomy rule, compressing the hero to 411.5px and turning the headline into a small product title. Fixed by making the Apps hero taxonomy a single track at every breakpoint and explicitly preserving editorial typography from the global product-title contract.
2. P2: product-wide spacing rules added 32px/48px taxonomy padding, reduced the CTA to 40px, and collapsed the CTA/proof gap to 8px. Fixed with hero-scoped spacing exclusions: zero taxonomy padding, a 52px CTA, and a 24px action gap.
3. P2: after the structural fixes, the desktop title fit on one line and the hero ran 540px tall, drifting from the source's wrapping and catalog entry point. Fixed by constraining the title to 560px and the hero to 500px. The post-fix evidence is the final 919px full and focused comparison above.

No actionable P0, P1, or P2 findings remain.

## Required fidelity surfaces

- Fonts and typography: Instrument Serif 400 at 52px/54.08px on the 919px reference viewport; a 560px measure preserves the source's two-line editorial wrap. Supporting copy remains Vitrines Figtree at 17px with muted contrast.
- Spacing and layout rhythm: 500px hero field begins immediately below the 56px navigation; the filter toolbar begins at 556px, within the same visible transition zone as the source. CTA, proof row, and subtitle spacing match the source hierarchy without horizontal overflow.
- Colors and tokens: the hero uses Vitrines page, primary-text, secondary-text, border, and action tokens. Dark and light color schemes both remain supported; the dark comparison matches the selected source state.
- Image and icon fidelity: the proof row uses three real catalog `AppIcon` assets and the shared chevron-right icon. No placeholder imagery, emoji, CSS art, or handcrafted SVG is used.
- Copy and content: source conversion copy is adapted to the Apps catalog: “The details behind the world’s best apps,” a product-research description, “Explore apps,” and a live catalog count.

## Interaction, responsive, and runtime checks

- Clicking Explore apps scrolled from `scrollY: 0` to `499.5` and moved focus to `#apps-catalog`.
- The Categories filter opened its dialog with the full catalog taxonomy; Escape closed and unmounted it.
- The 390px layout has no horizontal overflow (`scrollWidth` equals `innerWidth` at 390px), stacks CTA and proof, merges the compact filter control, and retains the visible result count.
- The 850px layout has no horizontal overflow and preserves the same full-width hero composition and two-column result grid.
- Browser console errors: none. The existing neutral-theme runtime-injection performance advisory remains unchanged.
- Focused automated verification: `npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/ProductSpacingCoverage.test.ts src/vitrine/ProductTypographyCoverage.test.ts src/vitrine/ResponsiveSystem.test.ts` — 47 passed, 0 failed.
- `npm run build` — passed; existing unresolved-asset and large-chunk advisories only.
- `git diff --check` — passed.

final result: passed
