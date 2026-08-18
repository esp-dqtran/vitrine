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
