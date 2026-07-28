# Astryx Sites UI Design QA

## Visual truth

- Mobbin catalog reference: `artifacts/design-audit/2026-07-24-sites-comparison/02-mobbin-sites.png`
- Mobbin V7 detail reference: `artifacts/design-audit/2026-07-24-sites-comparison/04-mobbin-v7-detail.png`
- Astryx catalog: `design-qa-sites-catalog-final.png`
- Astryx V7 detail: `design-qa-site-detail-preview.png`
- Astryx compact catalog: `design-qa-sites-catalog-mobile.png`
- Catalog side-by-side: `design-qa-catalog-comparison-final.png`
- Detail side-by-side: `design-qa-detail-comparison-final.png`

Every source and implementation capture uses the same 1512 × 782 viewport and
the same loaded catalog/detail state.

## Rebuilt surfaces

- Full-width Sites navigation with centered 512 px search, Apps/Sites switcher,
  import action, and account controls.
- Mobbin-measured discovery taxonomy, ordering row, filter action, three-column
  grid, large media cards, logo, description, version, and section count.
- Site detail with vertical identity, display heading, Category and Style
  groups, Save/Visit actions, Latest selector, Preview/Sections tabs, and a wide
  real-media stage.
- Responsive two-column, one-column, and compact navigation breakpoints.
- Search, taxonomy filters, sorting, filter toggle, full-card navigation,
  version selection, Save, Visit site, and Preview/Sections remain interactive.

## Findings fixed

- [P1] Sites still inherited the Apps/admin shell instead of Mobbin's full-width
  surface.
  - Fixed by routing both Sites views through their own shared top navigation.
- [P1] The discovery taxonomy order, column positions, vertical rhythm, and
  card start position did not match the source.
  - Fixed with source-measured 32 px gutters, column tracks, column-flow
    ordering, 24 px labels, and the 432 px card baseline.
- [P1] Site detail used a horizontal product header and compact preview frame.
  - Fixed with the vertical 96 px identity, split display heading, source-style
    metadata/actions/navigation, and 1048 px preview media.
- [P2] Search width and height, action styling, filter treatment, and card
  semantics diverged from the source.
  - Fixed with the 512 × 48 search field, white primary Save action, quiet
    Filter action, and one semantic link for the complete card.
- [P2] Existing imports did not expose Mobbin tagline, logo, styles, or
  popularity.
  - Fixed in the crawler/store contract and migration `0022`; existing records
    need the migration plus re-import/backfill before those authoritative values
    appear. The UI does not fabricate missing metadata.

## Verification

- Catalog comparison: no remaining P0/P1/P2 layout defect.
- Detail comparison: the layout contract is matched; the local legacy V7 row
  intentionally shows the explicit captured-source fallback until migration and
  re-import/backfill provide its Mobbin metadata.
- Compact catalog: 390 px client width and 390 px scroll width, with no
  horizontal overflow and no navigation collisions.
- Focused Sites component tests: 16 passed.
- Sites route-boundary tests: 16 passed.
- Production build: passed.
- Vite reports only its existing large-chunk optimization warning.

## Apps/Sites header replication QA — 2026-07-27

### Visual truth and normalization

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/TemporaryItems/NSIRD_screencaptureui_pxRSMa/Screenshot 2026-07-27 at 12.28.13.png`
- Browser-rendered implementation: `/tmp/astryx-apps-after.png`
- Normalized source header: `/tmp/astryx-header-reference.png`
- Normalized implementation header: `/tmp/astryx-header-implementation.png`
- Combined comparison input: `/tmp/astryx-header-comparison.png`
- Browser viewport: 1512 × 900 CSS px at device pixel ratio 2.
- Source pixels: 3024 × 146 at 2× density, downsampled to 1512 × 73.
- Implementation pixels: 1512 × 900 CSS-normalized browser capture; the
  1512 × 72 header crop was extended by one background pixel to match the
  source comparison frame.
- State: source is Mobbin signed-in; implementation is Vitrine Apps in the
  guest state. The product logo and right-side account controls are intentional
  product/state differences and were excluded from false-precision matching.

### Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the active/inactive tab hierarchy, 16 px/600 tab
  treatment, and subdued search copy match the source. The implementation keeps
  the existing product font stack.
- Spacing and layout rhythm: the header is 72 px high; the centered search is
  512 × 48 at x=500; the logo, tabs, and search align to the source frame.
- Colors and visual tokens: the header resolves to `#111111`, the search to
  `#303030`, the active tab to `#f5f5f5`, and inactive tabs to `#686868`.
- Image quality and asset fidelity: Vitrine's existing SVG favicon remains
  sharp at 32 × 32. The Mobbin logo was not copied because this is Vitrine's
  product header.
- Copy and content: `Apps`, `Sites`, and `Search on Web...` match the source.
  The source's signed-in actions intentionally remain Vitrine's functional
  guest `Login` control.

### Comparison evidence

- Full-view evidence: the normalized two-row comparison shows matching header
  frame, centered search proportions, baseline, dark surfaces, and flat tabs.
- Focused-region evidence: the complete header is itself the focused region;
  no smaller crop was required because all typography, icon, and control edges
  are legible in the 1512 × 146 combined comparison.
- Comparison history: the first formal comparison found no actionable
  P0/P1/P2 mismatch, so no blocking design-QA iteration was required.

### Interaction and runtime verification

- Apps → Sites and Sites → Apps navigation both reached their expected routes.
- The header search opened the catalog dialog and its Close action dismissed it.
- Browser console: no runtime errors; only the existing Astryx development
  theme-injection warning and Vite development messages.
- Focused Apps/Sites tests: 52 passed.
- Production build: passed.

### Open questions

- None blocking. The signed-in action cluster can only be compared exactly in
  the equivalent authenticated Vitrine state.

### Implementation checklist

- Keep Vitrine branding and account behavior.
- Preserve the shared header across Apps and Sites.
- Recheck the authenticated action cluster when that state is next changed.

### Follow-up polish

- [P3] The reference placeholder begins a few pixels farther from the search
  icon; the current spacing remains clear and consistent with the design-system
  button internals.

final result: passed

---

# Flow Search Behavior QA

## Visual truth and normalization

- Source Flow browser: `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/mobbin-search-audit/02-flows.png`
- Source typed-query state: `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/mobbin-search-audit/03-query-login.png`
- Browser-rendered Flow browser: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/01-flow-browser.png`
- Browser-rendered typed-query state: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/02-flow-query-login.png`
- Browser-rendered Flow-filtered Apps: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/03-flow-filtered-apps.png`
- Full-view Flow browser comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/04-flow-browser-comparison.jpg`
- Full-view typed-query comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/05-flow-query-comparison.jpg`
- Focused modal comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/06-flow-modal-focused-comparison.jpg`
- Active-filter before/after comparison: `/Users/kai/works/eastplayers/Astryx/artifacts/design-audit/2026-07-28-flow-search-behavior/07-filter-condition-before-after.jpg`
- Viewport and pixels: 1512 × 782 CSS px and 1512 × 782 captured px for both source and implementation.
- Density normalization: the Mobbin source was captured from a DPR-2 Chrome tab that returned one captured pixel per CSS pixel; Astryx used an explicit DPR-1 1512 × 782 viewport. Both comparison inputs are therefore equal-size 1512 × 782 images with no rescaling.
- State: authenticated Apps catalog, Search open, Web selected, Flows selected; the typed-query comparison uses `login`.

## Findings

- No actionable P0, P1, or P2 visual or interaction differences remain for the requested Flow-first slice.
- Fonts and typography: the Flow browser keeps the measured 16 px row hierarchy, regular group labels and counts, muted secondary text, and compact search input treatment from the source.
- Spacing and layout rhythm: the default state retains the 816 × 594 dialog, 260 px navigation column, grouped Flow rows, highlighted first item, real App chip rail, internal scrolling, and the measured neutral spacing. The typed state collapses the App rail and navigation so suggestions use the full results width, matching Mobbin's query-state transition.
- Colors and visual tokens: dark neutral surfaces, selected navigation, highlighted rows, backdrop blur, secondary labels, and count colors remain aligned with the source and Astryx's current neutral theme.
- Image quality and asset fidelity: real catalog App icons remain in the default Flow browser; no placeholder, CSS-drawn, generated, or approximate assets were introduced.
- Copy and content: Flow groups, titles, counts, Apps, and result cards intentionally use Astryx's normalized production data. Unlike Mobbin's global mixed-type query, the typed state intentionally remains Flow-scoped because this implementation slice is Flow search first.
- Accessibility and responsiveness: Flow suggestions remain semantic buttons, selected platform and navigation states remain exposed, arrow keys move the active Flow row, Enter selects it, Escape behavior is preserved, and the existing compact breakpoint remains intact.

## Comparison history

- First typed-query comparison: Astryx kept the App chip rail and left navigation visible after typing, while Mobbin moved to a focused full-width result state. This was a P2 interaction-state mismatch.
- Fix: added a query-state layout that hides the App chips and navigation and expands the Flow results to the full modal width while preserving the Flow scope and platform controls.
- Post-fix evidence: `05-flow-query-comparison.jpg` shows the focused full-width query state at the same viewport; `06-flow-modal-focused-comparison.jpg` confirms the unchanged default Flow browser geometry.
- First selected-filter treatment: the active Flow appeared as a high-contrast pill beside the search trigger, so the applied condition competed with the primary search action and left the results without local context. This was a P2 hierarchy issue.
- Fix: moved the condition below the ordering toolbar into a quiet `Filtered by` context row with an editable Flow chip, a dedicated clear action, and the live App count aligned to the results.
- Post-fix evidence: `07-filter-condition-before-after.jpg` confirms that search stays visually stable while the applied condition is now attached to the result set.

## Interaction and runtime verification

- Opening Flows performs one grouped `/api/catalog/flows` request instead of one design-system request per App.
- Typing `login` produced exactly one debounced request: `/api/catalog/flows?platform=web&limit=80&query=login`. No `/api/design-systems/{app}` or broad `/api/search` request was emitted.
- Selecting `Logging in (saved login info)` closed the modal and produced one normalized facet request: `/api/catalog?group=flows&value=Logging+in+%28saved+login+info%29&platform=web`.
- The facet handoff retained Web, displayed the active Flow context row with `1 app`, and returned the matching Instagram App from normalized Flow mappings.
- At the 390 px compact breakpoint, the filter context stacked to 109 px without horizontal overflow; the Flow chip remained fully visible and independently clearable.
- A clean Chrome verification tab reported no console errors. The only console entry was the existing neutral-theme runtime-injection warning.
- Focused Flow catalog, normalized facet, Apps handoff, keyboard/ID routing, and UI tests: 41 passed.
- Production build: passed.
- Full repository suite: 1,262 of 1,266 passed. The four remaining failures are outside this Flow slice: two existing design-system API tests attempted unavailable real database fallbacks, one pre-existing Apps boundary source-shape assertion does not recognize the server-facet sentinel, and the existing Astryx native-control migration baseline still reports CommandPalette and MediaGridCard buttons.

## Open questions

- None blocking.

## Implementation checklist

- Keep Flow typing on the lightweight grouped catalog endpoint.
- Keep Flow selection on the normalized catalog facet path.
- Keep platform context through the modal-to-Apps handoff.
- Keep mixed Screen/UI Element/Site query results out of this Flow-first slice until those scopes receive the same normalized search contract.

## Follow-up polish

- The current database still contains a large `Other Flows` parent group. Taxonomy curation can improve those labels independently without changing this search behavior.

final result: passed

---

# First-class Flows Catalog QA

## Comparison target

- Source visual truth:
  `artifacts/design-audit/2026-07-28-flows-page-card-parity/01-app-flow-card-source.png`
- Browser-rendered implementation:
  `artifacts/design-audit/2026-07-28-flows-page-card-parity/03-global-flows-page-final.png`
- Combined full-view comparison:
  `artifacts/design-audit/2026-07-28-flows-page-card-parity/04-source-vs-global-flows.png`
- Viewport and pixels: both captures are 1512 × 778 CSS pixels and
  1512 × 778 image pixels at device scale 1. No density normalization was
  required.
- State: authenticated dark-theme Web Flow browser. The source is Linear's App
  detail Flows tab; the implementation is the first-class `/flows` catalog.

## Findings

No actionable P0, P1, or P2 differences remain for the requested composition.

- Fonts and typography: `/flows` now uses the same Apps/Sites discovery
  taxonomy scale and toolbar hierarchy above the results, then the exact
  existing App FlowCard title, screen count, and action typography below.
- Spacing and layout rhythm: the shared discovery top navigation, 32px page
  gutters, 29px taxonomy top inset, 73px taxonomy-to-toolbar rhythm, 64px
  ordering row, and wide one-column screen strips match the existing product
  patterns. The Flow strip keeps the same carousel spacing, radii, arrows, and
  footer rhythm as App detail.
- Colors and visual tokens: the implementation reuses the existing neutral
  body, search, taxonomy, toolbar, screen-stage, action, and selected-state
  tokens. No new palette or card surface was introduced.
- Image quality and asset fidelity: every card uses real published Flow
  evidence. The first visible WhatsApp sequence loaded at 480 × 300 through
  the public Flow preview route; 65 image nodes were present and only the
  visible nine loaded initially through native lazy loading. No generated,
  drawn, or placeholder imagery replaces available evidence.
- Copy and content: the parent Flow group, representative App, distinct App
  count, normalized Flow title, and true screen count come from the current
  catalog database. The source and implementation intentionally show different
  products because `/flows` is an aggregate catalog rather than one App.
- Accessibility and interaction: Apps, Sites, and Flows remain semantic tabs;
  platforms are radios; Popular/Grouped are tabs; Flow groups are pressed-state
  buttons; each screen strip and action retains its accessible App FlowCard
  label.

## Comparison history

- Pass 1 used compact text-only Flow cards under a custom page title and inline
  search field. This was a P1 mismatch with the requested Apps/Sites shell and
  App Flow rendering.
- Fix: routed `/flows` through `ReferenceDiscoveryPageShell`, reused the shared
  top navigation, taxonomy, platform switcher, and ordering toolbar, and
  replaced text cards with the existing `FlowCard` screen strip.
- Pass 2 exposed a slow aggregate query because representative selection
  examined evidence JSON for every normalized Flow before pagination. This was
  a P1 runtime issue.
- Fix: page the normalized Flow titles first, then choose one strongest
  representative only for the 13 bounded page rows. The page now returns 12
  cards plus one pagination sentinel in one catalog request.
- Post-fix evidence:
  `04-source-vs-global-flows.png` shows the shared component geometry and real
  screen strips at the same viewport.

## Interaction and runtime verification

- The Web catalog loaded 12 real Flow strips with zero horizontal overflow.
- Selecting the `Logging in` group produced 12 Flow-only results and exposed
  the active pressed state in the shared taxonomy.
- Popular and Grouped ordering both completed; the selected ordering tab stayed
  explicit.
- iOS loaded 12 Flow strips, then Web/Popular restored the final deliverable
  state.
- Real public preview media resolved for the first Flow, and lazy loading
  prevented all 65 screen images from downloading at once.
- The aggregate page performs one `/api/catalog/flows` metadata request. It
  does not call `/api/design-systems/{app}` or `/api/apps/{app}/flows` per card.
- Focused Flow store, media, API, router, route-boundary, navigation, and UI
  tests: 59 passed.
- Production build: passed.

## Follow-up polish

- P3: the first 12 database-derived parent groups are more granular than a
  curated top-level taxonomy. Their normalization can improve independently
  without changing the shared shell or FlowCard contract.

final result: passed

---

# Sites Detail Design QA — 2026-07-28

final result: passed

## Comparison target

- Source visual truth:
  - `artifacts/design-audit/2026-07-28-mobbin-sites-detail-audit/03-sections-grid.png`
  - `artifacts/design-audit/2026-07-28-mobbin-sites-detail-audit/04-section-detail.png`
- Browser-rendered implementation:
  - `artifacts/design-qa/sites-detail-adaptation/01-sections-desktop.png`
  - `artifacts/design-qa/sites-detail-adaptation/02-section-detail-desktop.png`
- Combined comparison evidence:
  - `artifacts/design-qa/sites-detail-adaptation/05-source-vs-implementation.png`
- Viewport: 1512 × 778 CSS pixels
- Pixels and density: all source and implementation captures are 1512 × 778 at device scale 1; no density normalization was required.
- State: authenticated dark-theme Vercel Sites detail, Sections tab, second section open in Section mode.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: Astryx keeps its existing product font while matching the reference hierarchy, compact modal controls, section count scale, and restrained metadata weights.
- Spacing and layout rhythm: the two-column 24px section grid, 32px modal inset, 24px radius, three-part header, centered media stage, and footer rhythm match the source structure.
- Colors and visual tokens: the neutral dark surface, subtle borders, muted card stage, white captured media, and low-emphasis secondary text align with the source while using Astryx tokens.
- Image quality and asset fidelity: real crawler images and site identity assets are used; no drawn or placeholder replacement was introduced. Irregular-height captured sections are letterboxed instead of distorted.
- Copy and content: Astryx intentionally keeps its own site description, Pages and Sections counts, Technology tab, download action, and reconstruction details instead of copying Mobbin product content.
- Accessibility and interaction: the dialog, Section and Full page controls, Save, Copy, Close, previous/next controls, links, and deep-linked route expose accessible names and keyboard behavior.

## Interaction verification

- Opening a card navigates to `/sites/vercel-2/sections/13662`.
- Loading that URL directly restores the correct section dialog.
- Previous and next controls retain the deep-linked inspector model.
- Full page mode produces a scrollable 556px viewport with 5,256px captured content.
- Closing the dialog returns to `/sites/vercel-2/sections` and removes the dialog.
- At 390px, the modal and header have zero horizontal overflow; controls end at 378px inside the 390px frame.
- A clean browser tab reported no console errors.

## Comparison history

- Pass 1 found a P2 mobile header overflow: Save, Copy, and Close extended beyond the 390px frame.
- Fix: hid the redundant modal Save action at the mobile breakpoint, shortened Copy, and retained Copy and Close as visible controls.
- Post-fix evidence: article and header widths are 390px, both report zero overflow, the switcher ends at 180.34px, and actions end at 378px.

## Follow-up polish

- P3: captures with extremely short source sections retain visible letterboxing. This preserves source geometry and avoids stretching; improving it belongs in future crawler crop normalization, not this UI adaptation.

---

# Sites Version Picker Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/TemporaryItems/NSIRD_screencaptureui_rkjsf1/Screenshot 2026-07-28 at 16.29.04.png`
- Browser-rendered implementation:
  `artifacts/design-qa/site-version-picker/implementation-open.png`
- Compact implementation:
  `artifacts/design-qa/site-version-picker/mobile-open.png`
- Combined comparison evidence:
  `artifacts/design-qa/site-version-picker/reference-vs-implementation.png`
- Focused viewport: 818 × 650 CSS pixels, cropped to the same 818 × 355
  comparison frame as the source.
- State: Vercel Sections, earlier capture selected, version menu open.

## Findings

No actionable P0, P1, or P2 differences remain.

- The selected capture is a compact trigger beside the Preview, Sections, and
  Technology tabs, separated by the existing navigation divider.
- The menu uses the source's wide dark rounded surface, newest-first ordering,
  `Latest` badge, selected-version checkmark, and rotating chevron.
- Astryx intentionally uses full capture date-time labels because multiple
  crawls can occur on the same day.
- At 390 px, the menu fits within 16 px page gutters and its date-time labels,
  badge, and selected check remain visible.

## Interaction and runtime verification

- Selecting the latest option changed the route from `version=329` to
  `version=454`, updating the detail from 22 pages and 50 sections to 1 page
  and 8 sections.
- Escape closes the open menu and returns `aria-expanded` to `false`.
- Options expose `menuitemradio` semantics and the selected option exposes
  `aria-checked`.
- Browser console: no errors.
- Focused Sites tests: 38 passed.
- Production build: passed.

## Comparison history

- Pass 1 found the menu narrower than the source and the programmatically
  focused selected row showed a blue outline not present in the reference.
- Fix: widened the desktop popover to 480 px and retained keyboard focus
  visibility through a quiet background treatment instead of the accent
  outline.
- Post-fix comparison confirms matching popover scale, hierarchy, radius,
  latest badge, selected check, and tab relationship.

final result: passed
