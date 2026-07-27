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
