**Comparison Target**

- Source visual truth: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/01-source-revealed.jpg` and `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/04-source-mobile.jpg`
- Implementation: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/03-react-after.jpg` and `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/05-react-mobile.jpg`
- Combined comparisons: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/06-desktop-comparison.jpg` and `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/07-mobile-comparison.jpg`
- Focused CTA comparisons: source/React rest states `08-source-cta-rest.png` and `09-react-cta-rest.png`; source/React hover states `10-source-cta-hover.png` and `11-react-cta-hover.png`, all under `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/footer-easter-egg/`.
- Desktop viewport and captures: 882 x 863 CSS pixels, 882 x 863 image pixels, normalized 1:1.
- Mobile viewport and captures: 390 x 844 CSS pixels, 390 x 844 image pixels, normalized 1:1.
- State: bottom-scroll easter egg revealed after the 240px overscroll threshold; carousel playback active.

**Findings**

- No actionable P0, P1, or P2 differences remain in the scoped footer easter-egg component.
- The source global site header and the React global floating signup button appear in the full-view comparisons. They are outside the annotated `footer-easter-egg` scope and were not treated as footer-component drift.
- The source and React shuffle the same 36-image pool and begin their looping carousel at different random phases, so exact asset order is intentionally nondeterministic. Card count, dimensions, path, and playback behavior match.

**Required Fidelity Surfaces**

- Fonts and typography: Futurist 40px/40px, weight 400, normal tracking, split-letter geometry, staggered entrance, and hover-color treatment match. Source and React CTA boxes both measure `317.64 x 96` at 882px; splitting the label into source-equivalent inline letters resolved the earlier 2.62px text-width drift.
- Spacing and layout rhythm: revealed root, sticky background canvas, CTA height, responsive top offset, 22-card mobile count, and 21-card 882px count match. Source/local mobile CTA boxes are `317.64 x 96 at 36.18,205.42` and `317.64 x 96 at 36.18,205.33`.
- Colors and visual tokens: off-black `#1a1616`, 15px dot grid, 2px rounded dots at 8% opacity, white CTA, and interactive 200px pointer glow match the downloaded source contract.
- Image quality and asset fidelity: the original downloaded WebP assets and exact downloaded CTA arrow vector are used without placeholders or generated replacements; crop, radius, scale, and carousel motion are preserved.
- Copy and content: both CTAs read `Sign up for free`; the signup destination and new-tab behavior match.

**Comparison History**

1. Initial comparison found a P1 background mismatch: the opaque easter-egg root covered the footer dot field and interactive glow. Fix: made the easter-egg root transparent and restored the source SVG dot tile plus sticky interactive canvas. Post-fix evidence: `06-desktop-comparison.jpg` and `07-mobile-comparison.jpg`.
2. Initial comparison found a P2 CTA placement mismatch at 882px: source y=275.77, React y=210.99. Fix: applied the source `-12.5%` offset from the 640px breakpoint. Post-fix React y=275.71; mobile source/local y=205.42/205.33.
3. Focused follow-up found a P2 CTA primitive mismatch: React used a static unsplit label, an approximate pixel drawing, and no hover state. Fix: restored source-equivalent split letters, exact source arrow geometry, staggered reveal, 1.03 hover scale, orange letter transition, and off-white/black to orange/white icon transition. Post-fix desktop rest geometry is identical (`317.64 x 96`); source and React hover both compute `scale: 1.03`, orange `rgb(240,78,35)`, and off-white `rgb(250,250,250)`. Evidence: `08` through `11` focused CTA captures.

**Focused Region Comparison**

- Rest state: `08-source-cta-rest.png` and `09-react-cta-rest.png` show matching label width, 16px gap, 40px circular control, exact arrow orientation, and centering.
- Hover state: `10-source-cta-hover.png` and `11-react-cta-hover.png` show matching orange letter/icon treatment. Browser-computed state also matches at `scale: 1.03`, avoiding ambiguity from transition-frame antialiasing.

**Implementation Checklist**

- [x] Preserve the source transparent easter-egg root.
- [x] Restore the downloaded 15px dot-field tile.
- [x] Restore the sticky pointer-proximity canvas glow.
- [x] Match the CTA offset at mobile, tablet, and desktop widths.
- [x] Match CTA split-letter geometry, entrance, hover scale/color, icon asset, and active/focus behavior.
- [x] Preserve source assets, carousel count, signup link, and reduced-motion behavior.
- [x] Verify production build, Sites tests, browser console, desktop geometry, and mobile geometry.

**Follow-up Polish**

- No scoped P3 CTA differences remain.

---

**Canvas Prompt Dock Update — 2026-08-21**

**Comparison Target**

- Source visual truth: downloaded mirror `http://localhost:4186/#canvas-showcase-e-commerce` plus `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/CANVAS_COMPONENT_SPEC.md`.
- Source capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/canvas-prompt-dock/01-source-desktop.png`.
- Implementation capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/canvas-prompt-dock/02-react-desktop.png`.
- Combined full-view comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/canvas-prompt-dock/07-desktop-comparison.jpg`.
- Combined focused comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/canvas-prompt-dock/08-focused-dock-comparison.jpg`.
- Desktop viewport: 1280 x 720 CSS pixels. Source and implementation captures are both normalized to 1280 x 720 image pixels despite the implementation tab reporting DPR 2.
- State: E-commerce selected; category prompt fully typed; orange signup state visible.

**Findings**

- No actionable P0, P1, or P2 mismatch remains in the annotated canvas prompt dock.
- The source and React scene media differ in playback frame and source loading phase in the full-view capture. The focused comparison isolates the selected dock and avoids treating independent image/video timing as dock drift.
- Mobile DOM geometry was checked at 390 x 844 with DPR 1. Source/local shell measurements were `369 x 114 at 12,66` and `366 x 114 at 12,66`; the residual 3px width difference is P3 and does not change text wrapping, tab access, or CTA placement.

**Required Fidelity Surfaces**

- Fonts and typography: tabs now use Futurist 12px/16px with -0.04em tracking; compact prompt text uses Futurist 11px/15px with -0.04em tracking and a two-line clamp, matching the downloaded computed styles.
- Spacing and layout rhythm: the previous two-card composition is replaced by the source-equivalent single 353 x 114 shell, 48px tab row, 64px prompt row, 11px tab gap, 8px prompt gap, 15px horizontal prompt padding, and shared separator.
- Colors and visual tokens: shell `#202020`, 40% faded-gray border, 12px/64px shadow, gray prompt text, gray typing CTA, and orange completed CTA match the source states.
- Image quality and asset fidelity: the captured Melius prompt mark and exact source pixel-arrow paths are preserved as local SVG assets; the earlier text-glyph arrow was removed.
- Copy and content: category prompts remain source-exact. Only the circular control links to signup with the encoded active prompt, matching the downloaded DOM and new-tab behavior.

**Comparison History**

1. Initial P1: React rendered the tab bar and prompt as two separate translucent cards, while the source uses one bordered dock. Fix: rebuilt `CanvasDock` as one shell with a shared border and separator.
2. Initial P1: React omitted the Melius prompt mark, used larger Ease text, and substituted a `↗` glyph. Fix: restored the captured mark, exact pixel-arrow asset, compact Futurist text, and source 32px CTA.
3. Initial P2: React treated the entire prompt row as an external link and kept the CTA permanently orange. Fix: made only the circle the accessible signup link and reproduced gray typing to orange completed state. Browser interaction verified partial typed copy at 120ms and the completed prompt after playback.
4. Post-fix evidence: focused source/React comparison `08-focused-dock-comparison.jpg` shows matching shell, tab indicator, separator, mark, two-line prompt, and CTA. Build and Sites tests pass; local desktop/mobile console checks reported no warnings or errors.

**Implementation Checklist**

- [x] Use one source-equivalent dock shell.
- [x] Match tab and prompt row geometry and typography.
- [x] Restore the downloaded mark and pixel-arrow assets.
- [x] Preserve typewriter, selected-tab, encoded-signup, and completion states.
- [x] Verify desktop focused comparison, mobile DOM geometry, interaction changes, build, tests, and console.

**Follow-up Polish**

- P3: investigate the downloaded mobile runtime's 3px shell-width excess if exact emulated-mobile width becomes a release gate.

final result: passed

---

**Page Scroll Runtime Update — 2026-08-21**

**Comparison Target**

- Source truth: downloaded runtime assets `18496ddd88e776d5853e.js`, `9aa9e990ef106d45ccfc.js`, `33937522490f8ff3aa27.css`, plus `CANVAS_COMPONENT_SPEC.md`, `FOOTER_COMPONENT_SPEC.md`, `MODELS_COMPONENT_SPEC.md`, and `HERO_DOM_COMPONENT_SPEC.md` under `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/`.
- Desktop source capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/quality-audit/2026-08-20/desktop-canvas-source.png`.
- Desktop implementation capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/scroll-runtime/react-desktop-canvas-settled.jpg`.
- Desktop combined comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/scroll-runtime/desktop-source-local-comparison.jpg`.
- Mobile source capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/canvas-prompt-dock/03-source-mobile.png`.
- Mobile implementation capture: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/scroll-runtime/react-mobile-canvas-docked.png`.
- Mobile combined comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/downloads/melius.com/reverse-engineering/home/audit/scroll-runtime/mobile-source-local-comparison.jpg`.
- Desktop viewport/captures: 1280 x 720 CSS pixels and 1280 x 720 image pixels, normalized 1:1.
- Mobile viewport/captures: 390 x 844 CSS pixels and 390 x 844 image pixels, normalized 1:1.
- State: Canvas dock fully settled with Advertising active; sticky site header visible; source and implementation use their real downloaded media playback frames.

**Findings**

- No actionable P0, P1, or P2 difference remains in the scoped page-scroll runtime.
- DOM/state verification was the primary acceptance method. Screenshots were used only to confirm that the sticky header and dock occupy the source positions after the state machine had passed.
- Source and implementation media frames can differ while video and one-time Canvas playback are running. This is asynchronous content timing, not scroll-position drift.

**Required Fidelity Surfaces**

- Fonts and typography: the scroll change preserves the downloaded Futurist/Reckless/Ease families and existing sizes. The Canvas dock does not reflow while morphing between its 320px hero slot and 353px dock width.
- Spacing and layout rhythm: desktop dock settles at `353 x 114` and `216,172.906`; mobile settles at `353 x 114` and `12,66`. The header begins beneath the 40px announcement bar and sticks with 16px content inset after the bar leaves.
- Colors and visual tokens: no palette changes were introduced. Sticky backgrounds retain the downloaded cross-fade, dot grid, and noise layers.
- Image quality and asset fidelity: all visible media remain the downloaded local WebP/WebM/SVG assets. Inactive Canvas background videos now pause instead of continuing behind the active layer.
- Copy and content: no source text, CTA label, prompt, category, or navigation copy changed.

**Interaction and DOM Verification**

1. Desktop wheel smoothing: a 420px wheel target exposed `lenis-scrolling lenis-smooth`, converged to `scrollY=420`, then returned to the idle `lenis` class.
2. Hero-to-Canvas morph: the hero prompt begins at the measured `#hero-prompt-slot` (`320px` wide at desktop), grows its tab row from 0 to 48px, and settles at the downloaded desktop dock position `x=216`, `y=172.906`.
3. Exact tab navigation: Filmmaking settled at `top=172.9375` for the expected desktop offset `172.9064`; mobile settled at `top=202.5` for expected `202.6847`.
4. Canvas observer/idle rule: scrolling selects the central scene; after 5.4 seconds of down-scroll inactivity inside the source progress range, selection returned to Advertising without moving the page.
5. Models wheel routing: a horizontal 240px wheel kept `scrollY=4768` and changed the carousel target `0 -> -1.4400`; a vertical 300px wheel moved the page to `5365.5` while preserving the carousel target.
6. Footer overscroll: the first 120px at the true bottom left the easter egg closed; 240px revealed the exact `100svh` root and the shared controller advanced from the old bottom `7548` to the new bottom `8268`.
7. Modal locking: opening privacy settings applied `lenis-stopped` and `body overflow:hidden`; saving settings restored the idle `lenis` state and visible body overflow at the same scroll position.
8. Reduced motion: emulated reduced motion removed effective Hero/Canvas transition durations and kept Lenis wheel smoothing disabled while preserving native touch/document scrolling.
9. Browser console: zero errors and zero warnings after the native non-passive Models wheel listener replaced the passive React wheel path.

**Comparison History**

1. Initial P1: sections used independent native smooth scrolling and manual footer animation. Fix: added one Lenis runtime with the downloaded `lerp=.1`, wheel/touch multipliers, overscroll, reduced-motion, lock, and route-reset behavior.
2. Initial P1: the prompt dock was permanently placed inside Canvas. Fix: measured the Hero slot and animated one shared fixed dock to the downloaded desktop/mobile targets with stiffness 140 and damping 26.
3. Initial P1: Canvas tabs used `scrollIntoView({block:'center'})`. Fix: all tabs now use the source offset `-innerHeight * 195 / 812` through the shared controller.
4. Initial P2: footer reveal expanded the DOM but left the viewport at the old bottom. Fix: resize the shared Lenis limit before scrolling to the new bottom.
5. Initial P2: the global header disappeared after Hero. Fix: changed it to a zero-height sticky layer that starts below the announcement bar and remains at the source 16px inset while scrolling.
6. Initial P2: the Models horizontal wheel path attempted `preventDefault` through a passive React listener. Fix: attach one native `{passive:false}` listener; post-fix horizontal/vertical routing passed with no browser errors.

**Implementation Checklist**

- [x] One global scroll owner and source Lenis settings.
- [x] Hero prompt to Canvas dock spring handoff.
- [x] Exact Canvas scene offset, central observer, idle reset, and media lifecycle.
- [x] Sticky global header behavior.
- [x] Direction-aware Models wheel routing.
- [x] Footer 240px bottom-overscroll reveal through the shared controller.
- [x] Cookie-dialog lock/resume and reduced-motion branch.
- [x] Desktop and mobile DOM geometry, state transitions, build, Sites tests, and console verification.

**Follow-up Polish**

- P3: source/local Canvas video stills can show different frames in static screenshots; interaction playback and the scroll state machine are verified independently.

final result: passed
