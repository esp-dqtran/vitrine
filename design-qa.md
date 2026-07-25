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

final result: passed
