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

# Site section inspector footer cleanup — 2026-07-30

## Visual truth and normalization

- Source visual truth:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-flow-modal-2026-07-30/site-section.jpg`.
- Browser-rendered final implementation:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-footer-cleanup-2026-07-30/after.jpg`.
- Source viewport/pixels: 1280 × 720 CSS pixels and 1280 × 720 image pixels at
  1× density.
- Implementation viewport/pixels: 642 × 863 CSS pixels and 642 × 863 image
  pixels at 1× density.
- State: authenticated Vercel section inspector, Section mode, item 5 of 8.
- The active browser viewport was narrower than the source capture. The review
  therefore judges the footer content and responsive alignment rather than
  claiming pixel-level equivalence across the full modal.

## Findings

No actionable P0, P1, or P2 differences remain in the requested footer surface.

- Fonts and typography: the retained `Content Section`, `5 of 8`, and
  `Download` labels keep the established hierarchy and remain legible at the
  narrow viewport.
- Spacing and layout rhythm: removing the secondary metadata row and disclosure
  leaves a single balanced footer row, with summary at the start and Download
  at the end.
- Colors and visual tokens: retained content continues to use the shared modal
  foreground and muted-count tokens.
- Image quality and asset fidelity: the section capture and transparent media
  treatment are unchanged.
- Copy and content: `Reconstruction details`, the pattern badge, and the
  `Vercel · vercel.com` source row are absent. The requested title/count and
  Download action remain.
- Focused-region comparison was not needed because both removed targets and
  the complete remaining footer row are clearly readable in the full-view
  captures. The DOM snapshot independently confirms their absence.

## Interaction and runtime verification

- Section and Full page modes still toggle successfully after the footer
  cleanup.
- The live modal DOM contains `Content Section`, `5 of 8`, and `Download`, and
  contains neither `Reconstruction details` nor `vercel.com`.
- No browser console errors were captured.
- Focused modal tests: 11 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified P2 footer clutter from the reconstruction disclosure and
  the redundant pattern/source metadata row.
- Fix: removed both elements and changed the footer grid from three columns to
  two.
- Post-fix evidence: the final browser capture shows one concise footer row with
  no empty middle column or redundant metadata.

final result: passed

# Site section inspector Flow modal alignment — 2026-07-30

## Visual truth and normalization

- Flow modal source:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-flow-modal-2026-07-30/flow-reference.jpg`.
- Browser-rendered Site section modal:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-flow-modal-2026-07-30/site-section.jpg`.
- Combined comparison:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-flow-modal-2026-07-30/comparison.jpg`.
- Viewport and pixels: both captures are 1280 × 720 CSS pixels and
  1280 × 720 image pixels at 1× density.
- State: authenticated Flow Screens modal compared with the Vercel Section
  modal in Section mode.

## Findings

No actionable P0, P1, or P2 modal-shell mismatch remains.

- Fonts and typography: each modal keeps its content-specific labels while
  sharing the same header density and dark preview hierarchy.
- Spacing and layout rhythm: both use the exact fullscreen overlay, 24/32px
  desktop inset, 24px radius, border, and elevation from the Flow preview
  shell.
- Colors and visual tokens: both inherit `--flow-preview-surface` and the same
  overlay treatment; the Site capture letterbox remains transparent.
- Image quality and asset fidelity: both display authoritative imported
  captures without recoloring or replacement.
- Copy and content: Flow-specific actions remain in Flow; Section-specific
  source metadata, reconstruction details, and download remain in Section.

The full-view side-by-side keeps the modal frame, header, stage, and footer
fully legible, so a focused crop was not needed.

## Interaction and runtime verification

- Section and Full page both render inside the Flow preview shell.
- Compact breakpoints inherit the Flow modal's edge-to-edge behavior.
- Browser console: no application errors.
- Focused Flow, modal, and Section inspector tests: 11 passed.
- Production build: passed.

## Comparison history

- Pass 1 incorrectly used the standard centered dialog presentation.
- Fix: restored the fullscreen design-system variant and reused
  `flow-preview-dialog-shell` plus `flow-preview-dialog` directly.
- Post-fix evidence: the combined comparison shows identical outer geometry,
  backdrop, surface color, border, radius, and elevation.

final result: passed

# Site section inspector shared modal — 2026-07-30

## Visual truth and normalization

- Source visual truth:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-inspector-modal-2026-07-30/before.png`.
- Browser-rendered final implementation:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-inspector-modal-2026-07-30/after.png`.
- Combined before/after comparison:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-inspector-modal-2026-07-30/comparison.jpg`.
- Full-page interaction evidence:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-inspector-modal-2026-07-30/full-page.png`.
- Viewport and pixels: source and implementation are 642 × 863 CSS pixels and
  642 × 863 image pixels at 1× normalized density.
- State: authenticated Vercel Sites detail, section 5 of 8, Section mode.

## Findings

No actionable P0, P1, or P2 differences remain in the requested modal surface.

- Fonts and typography: the existing Section/Full page switcher and metadata
  hierarchy remain unchanged and readable.
- Spacing and layout rhythm: the inspector now has the shared modal inset,
  24px surface radius, border, backdrop, and elevation instead of touching the
  viewport edges.
- Colors and visual tokens: the header, media stage, and footer now inherit the
  shared modal surface and border tokens. The section image uses a transparent
  letterbox, removing the separate muted color layer.
- Image quality and asset fidelity: the imported Site capture is unchanged,
  remains contained without cropping, and retains its original color.
- Copy and content: section title, position, classification, source link,
  reconstruction details, and download action are unchanged.

The full-view comparison keeps the modal frame, switcher, capture, metadata,
and footer legible, so a separate focused crop was not needed.

## Interaction and runtime verification

- Section and Full page modes both render inside the same modal surface.
- Full page remains vertically scrollable and uses the parent page capture.
- Close returns to `/sites/vercel/sections?version=454`.
- Reopening the section route restores Section mode and one accessible
  `Vercel section detail` dialog.
- Browser console: no application errors.
- Focused modal and inspector tests: 7 passed.
- Production build: passed.

## Comparison history

- Pass 1 found a P2 surface mismatch: the fullscreen presentation removed the
  shared modal frame on compact viewports, and the image introduced a separate
  muted background color.
- Fix: changed the inspector to the standard Astryx modal presentation, moved
  sizing to a modal shell, retained the shared surface for content layout, and
  made the section image background transparent.
- Post-fix evidence: the side-by-side comparison shows the requested inset,
  rounded shared modal with one consistent dark surface and unchanged capture
  content.

final result: passed

## Latest QA checkpoint

The latest completed build review is **Site section inspector footer cleanup —
2026-07-30** in this file.

final result: passed

# Site section inspector header actions — 2026-07-30

## Visual truth and normalization

- Source visual truth:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-footer-cleanup-2026-07-30/after.jpg`.
- Browser-rendered implementation:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-actions-header-2026-07-30/after.jpg`.
- Combined side-by-side comparison:
  `/Users/kai/works/eastplayers/Astryx/artifacts/site-section-actions-header-2026-07-30/comparison.jpg`.
- Source and implementation are 642 × 863 CSS pixels and 642 × 863 image
  pixels at 1× density.
- State: authenticated Vercel section inspector, Section mode, item 5 of 8.

## Findings

No actionable P0, P1, or P2 differences remain in the requested action area.

- Fonts and typography: Save and Copy link use the existing compact header
  action hierarchy.
- Spacing and layout rhythm: Save now sits directly beside Copy link and Close
  in the top-right action group. The footer retains only the section title and
  count without an empty second column.
- Colors and visual tokens: the new action reuses the modal foreground and
  hover-surface tokens.
- Image quality and asset fidelity: the section capture is unchanged.
- Copy and content: Download is replaced by Save, while Copy link remains
  available beside it.
- The combined full-view comparison clearly shows both the moved action and
  the simplified footer, so a separate focused crop was unnecessary.

## Interaction and runtime verification

- Save retains the section media URL and native `download` behavior.
- Copy link and the Section/Full page switcher remain present.
- No browser console errors were captured.
- Focused modal tests: 11 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified the P2 action-placement mismatch: Download was isolated in
  the footer while the related Copy link action lived in the header.
- Fix: moved the media action into the header, renamed it Save, and reduced the
  footer to one content column.
- Post-fix evidence: the side-by-side comparison shows Save and Copy link
  grouped at the top-right with no remaining footer action.

final result: passed

## Latest QA checkpoint

The latest completed build review is **Site section inspector header actions —
2026-07-30** in this file.

final result: passed

# App detail Export primary action — 2026-07-30

## Reference set

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-export-secondary-source.jpg`.
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-export-primary-implementation.jpg`.
- Combined comparison input:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-export-button-before-after.jpg`.
- Viewport and pixels: 1280 × 720 CSS pixels and 1280 × 720 normalized
  screenshot pixels at browser device pixel ratio 2.
- State: authenticated Aboard App detail, Web platform, Screens tab, loaded
  first gallery row.

## Findings

No actionable P0, P1, or P2 differences remain for the requested button-state
change.

- Fonts and typography: the existing medium Hero action typography and label
  remain unchanged.
- Spacing and layout rhythm: the control remains 160.9 × 44px with the same
  pill radius, padding, and hero alignment.
- Colors and visual tokens: the action now resolves through the shared Astryx
  primary variant to a white background and border with `rgb(17, 17, 17)` text.
- Image quality and asset fidelity: App identity and gallery media are
  unchanged; the comparison shows identical source crops and sharpness.
- Copy and content: `Export to Figma` is unchanged.

## Interaction and runtime verification

- Activating the action still selects the existing Export section and renders
  `Editable design handoff`.
- The live DOM reports `data-variant="primary"` and `data-size="md"`.
- Focused App-detail tests: 35 passed.
- Production build and diff check: passed.

## Comparison history

- Pass 1 recorded the requested P2 hierarchy mismatch: Export used the
  secondary translucent treatment.
- Fix: enabled the existing `HeroButton` primary prop without changing its
  event handler or layout.
- Post-fix evidence: the normalized side-by-side capture shows the secondary
  gray action replaced by the shared white primary action, with all surrounding
  geometry unchanged.

final result: passed

# Platform-aware App Detail Screens — 2026-07-30

## Visual truth and normalization

- Mobbin iOS source:
  `/Users/kai/.codex/visualizations/2026/07/30/mobbin-app-detail-screens-audit/02-mobbin-mobile-app-screens-top.png`.
- Mobbin Android source:
  `/Users/kai/.codex/visualizations/2026/07/30/mobbin-app-detail-screens-audit/05-mobbin-android-app-screens.png`.
- Mobbin Web source:
  `/Users/kai/.codex/visualizations/2026/07/30/mobbin-app-detail-screens-audit/07-mobbin-web-app-screens.png`.
- Browser-rendered implementations:
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/01-vitrine-ios-fixed.png`,
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/02-vitrine-android-fixed.png`,
  and
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/03-vitrine-web-fixed.png`.
- Combined comparison inputs:
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/compare-ios-fixed.png`,
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/compare-android-fixed.png`,
  and
  `/Users/kai/.codex/visualizations/2026/07/30/astryx-platform-detail-fix/compare-web-fixed.png`.
- Viewport and pixels: every source and implementation is 875 × 863 CSS pixels
  and 875 × 863 image pixels at 1× normalized density.
- State: signed-in App Detail → Screens, Latest version, default screen filters.

## Findings

No actionable P0, P1, or P2 differences remain for the implemented
platform-layout contract.

- Fonts and typography: Vitrine keeps its existing product font and hierarchy.
  Mobbin-only rating/tagline data is intentionally omitted when Astryx has no
  authoritative value.
- Spacing and layout rhythm: App Detail uses 24px horizontal gutters. iOS and
  Android retain a three-column mobile grid at 875px. Web renders two
  402 × 251 cards with a 24px gap, matching the Mobbin Web inspection density.
- Colors and visual tokens: existing Vitrine dark surfaces, borders, selected
  indicators, and muted secondary actions remain unchanged.
- Image quality and asset fidelity: existing imported app icons and full
  screenshot media remain authoritative. Mobile cards use the rounded mobile
  treatment while Web cards use a 12px landscape treatment.
- Copy and content: the hero and gallery now show the selected platform's
  version count. Screen controls use app and screen context instead of database
  ids; no source text or ratings were fabricated.
- Navigation: Screens, UI Elements, and Flows remain primary. Admin Design
  System and Export are available through the functional More selector, so the
  navigation no longer clips at the audited viewport.

Focused-region crops were not needed because the full-view normalized
comparisons keep the hero metadata, navigation controls, and complete first-row
card edges legible.

## Interaction and runtime verification

- Switching Amazon Shopping from iOS to Android updates the route to
  `platform=android` and the displayed total to 268 screens.
- The More selector opens a listbox containing Design System and Export.
- The Screens filter opens its searchable, scroll-contained dialog.
- Save and Copy controls remain in every screen card and the existing preview
  dialog behavior is preserved.
- Browser console: no application errors; only the existing Astryx development
  theme-injection warning and Vite development messages.
- Focused component tests: 40 passed.
- Full repository test suite: passed.
- Production build: passed.

## Comparison history

- Pass 1 found aggregate hero totals, a three-column Web grid, clipped admin
  tabs, and id/flow-only screen labels.
- Fix: used selected-version totals, introduced explicit mobile/Web gallery
  layouts, moved admin sections into More, and generated descriptive labels.
- Post-fix evidence: mobile retains three inspection columns while Web exactly
  measures 402 × 251 in two columns at 875px.
- Interaction pass found platform selection changed content without persisting
  the route.
- Fix: platform selection now forwards the selected platform through the
  existing route callback.
- Post-fix evidence: the Android selection updates both route and count.

final result: passed

# App Screens gallery-label removal — 2026-07-30

## Reference set

- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/02-all-screens-only.png`,
  matching the user-marked `All screens / loaded · total` block.
- Browser-rendered implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/13-screens-no-gallery-heading-final-loaded.jpg`.
- Combined comparison input:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/14-heading-removal-before-after.png`.
- Viewport and pixels: 875 × 863 CSS pixels and 875 × 863 image pixels at
  1× normalized density.
- State: Amazon Shopping, iOS, version 1, loaded Screens tab at page top.

## Findings

No actionable P0, P1, or P2 differences remain for this scoped removal.

- Fonts and typography: no application typography changed; the redundant
  gallery heading and count are absent.
- Spacing and layout rhythm: the screen grid now follows the App navigation
  directly, removing the empty labelled-section gap.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: screen images retain their source crop,
  containment, and sharpness.
- Copy and content: `All screens` and the secondary loaded/total count are no
  longer rendered. The navigation-level `Showing 947 screens` count remains.

## Interaction and runtime verification

- Screen cards, Save, Copy, selection, filters, and incremental loading remain
  wired through the existing gallery implementation.
- Browser DOM contains no `All screens` or `loaded ·` gallery copy.
- Browser console has no application errors; only the existing development
  warning about runtime theme injection.
- Focused component tests: 27 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P2 density issue: the gallery repeated a title and count
  already communicated by the Screens tab and navigation total.
- Fix: removed only the gallery heading wrapper and rendered the existing grid
  directly.
- Post-fix evidence: the side-by-side comparison shows the cards beginning
  directly beneath the App navigation without changing the cards themselves.

final result: passed

---

# Vitrine Screen Save and Copy Parity Design QA — 2026-07-30

## Comparison target

- Source visual truth:
  `artifacts/mobbin-save-copy-audit-2026-07-30/05-save-popover.png`,
  `09-two-selected.png`, and `13-screen-viewer-actions.png`.
- Browser-rendered implementation:
  `03-save-menu.png`, `05-batch-selected-fixed.png`,
  `06-batch-save-menu-fixed.png`, `08-viewer-actions.png`,
  and `10-mobile-batch-toolbar.png` under
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-save-copy-qa-2026-07-30/`.
- Desktop viewport: 1467 × 834 CSS pixels at 1× density.
- Mobile viewport: 390 × 844 CSS pixels at 1× density.
- State coverage: single-screen copy, Save menu, create-collection dialog,
  save/unsave confirmation, two-screen selection, batch Save menu, batch copy,
  and full-screen viewer actions.
- Full-view comparison evidence: each Mobbin source state was paired with the
  matching Vitrine state at the same desktop viewport.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: Vitrine retains its existing product typography while
  matching Mobbin's compact action labels and restrained hierarchy.
- Spacing and layout rhythm: Save and Copy sit directly beneath each screen;
  the selected-screen toolbar stays centered above the viewport edge on
  desktop and stretches safely between mobile gutters.
- Colors and visual tokens: selected cards use a visible blue outline and
  check state, while menus, viewer chrome, and the batch toolbar use the
  existing dark Vitrine tokens.
- Image quality and asset fidelity: actions operate on the original stored
  screenshot bytes and place real `image/png` content on the clipboard.
- Copy and content: `All saved`, `Create collection`, `Saved`, `Unsave`,
  `Copied as png`, and `2 screens copied` match the audited Mobbin behavior.

## Interaction and runtime verification

- Single Copy placed an `image/png` clipboard item and showed
  `Copied as png`.
- Save exposed `All saved` and `Create collection`; the creation dialog
  included Name, Description, and Private controls.
- Saving persisted the selected screen, while removing it required the
  destructive Unsave confirmation and restored the original clean state.
- Selecting two screens showed the floating toolbar; batch Copy produced one
  composite PNG, showed `2 screens copied`, and cleared selection.
- The screen viewer exposed Save, PNG Copy, and Copy link. Copied links include
  `utm_source=copy_link`, `utm_medium=link`, and
  `utm_campaign=screen_sharing`.
- The floating toolbar remained visible and usable at 390 × 844.
- Focused API and Vitrine tests: 134 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P2 layout defect: the fixed batch toolbar inherited the
  transformed gallery as its containing block and could render below a long
  page.
- Fix: moved transient screen-action overlays into a document-level portal.
- Pass 2 confirmed the toolbar at the desktop viewport edge and within mobile
  gutters, with its Save menu anchored above the control.

final result: passed

---

# App Screens Flow Context Build QA — 2026-07-30

## Comparison target

- Source visual truths:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/01-mobbin-app-screens.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/04-mobbin-screen-viewer.png`
- Browser-rendered implementations:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/16-vitrine-app-screens-flow-context-1467x834.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/18-vitrine-screen-viewer-flow-context-1467x834.png`
- Combined comparison inputs:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/21-mobbin-vitrine-screens-final-comparison.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/22-mobbin-vitrine-screen-viewer-final-comparison.png`
- Viewport: 1467 × 834 CSS pixels at 1× density.
- Source pixels: 1467 × 834 for both source captures.
- Implementation pixels: 1467 × 834 for both implementation captures.
- Density normalization: none required.
- State: signed-in Amazon Shopping iOS Screens page with no active filters, plus an open single-screen viewer. Viewer content differs because each capture opens a different real Amazon screen; the shell, navigation, metadata, and action state are equivalent.
- Responsive evidence:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/19-vitrine-app-screens-flow-context-875x863.png`.
- Full-view comparison evidence: the source and implementation were joined side by side for the Screens page and viewer.
- Focused-region comparison: the viewer comparison is the focused interaction region; no additional crop was needed because every action and metadata label is readable.

## Findings

No actionable P0, P1, or P2 differences remain in the requested Screens and viewer surfaces.

- Fonts and typography: Vitrine retains the existing reference-navigation type system while matching Mobbin's large section headings, muted supporting copy, compact metadata, and action hierarchy.
- Spacing and layout rhythm: Highlights is now a horizontal screen rail, Flow context is presented before the divided All screens grid, and the viewer keeps a centered 393 × 852 phone with edge navigation and bottom controls.
- Viewport resilience: the horizontal Highlights and Flow rails preserve card proportions and scroll instead of collapsing at 875 px; action controls remain available on touch-width layouts.
- Colors and visual tokens: the dark neutral canvas, restrained dividers, white primary Save action, dark secondary actions, and muted metadata match the source treatment.
- Image quality and asset fidelity: every card and viewer uses the stored Amazon full image or thumbnail; no placeholder art, CSS illustration, or synthetic app asset was introduced.
- Copy and content: Highlights, Flows using these screens, All screens, Found in, platform/resolution, and More info are grounded in persisted screen and Flow records.
- Icons and controls: Save, Copy, source/more, close, previous, and next use the shared Astryx icon family with accessible labels.
- States and interactions: the Flow-based filter, Highlights, All screens, Flow preview, shareable evidence URL, real collection picker, Copy action, viewer navigation, and exact Found in membership are connected.
- Accessibility: semantic regions and headings identify the three content areas; filters use native checkboxes; controls remain keyboard reachable with named actions.

## Expected product-data differences

- Vitrine does not invent Mobbin's Amazon tagline, rating, or proprietary Highlight flag. Highlight ordering is deterministically derived from repeated persisted Flow evidence.
- The current Amazon screen records have no page-type analysis, so the filter exposes the available `Unclassified` type plus a rich, searchable `Found in Flows` group from 307 real Flows. Screen taxonomy enrichment remains an upstream analysis task rather than a UI fabrication.
- Mobbin's viewer-only collaboration avatars and recommendation affordance are not reproduced because Vitrine has no corresponding collaboration or recommendation state.

## Interaction and runtime verification

- Selecting `Adding a vet clinic` under Found in Flows reduced Highlights, Flow previews, and All screens to one currently loaded matching screen.
- Opening a Highlight produced the shareable route `evidence=SCREEN-340248`.
- The viewer rendered `Found in Favoriting a creator's list +2`, proving multi-Flow membership from persisted evidence IDs.
- Browser console: no errors.
- Focused Screen, viewer, Flow-context, section-store, and API tests: 39 passed.
- Production build: passed.

## Comparison history

- Earlier audit: the Screens surface had only a flat grid, an `Unclassified` filter, no Highlights/All screens structure, no Flow previews, no direct card actions, and no exact Flow membership in the viewer.
- Fix: joined screens to persisted Flow evidence IDs, added deterministic Highlights and Flow preview sections, added searchable Flow-context filtering, connected Save/Copy/source actions, and passed exact memberships into the viewer.
- Post-fix evidence: the two final combined comparisons show the intended Mobbin information architecture and viewer shell while preserving Vitrine's real data and design system.

final result: passed

---

# App Detail Mobbin-Style Flow Modal QA — 2026-07-30

## Comparison target

- Mobbin Screens reference:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/04-mobbin-flow-detail.png`.
- Mobbin Prototype reference:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/05-mobbin-flow-prototype.png`.
- Browser-rendered Screens implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/21-vitrine-modal-screens-final.png`.
- Browser-rendered Prototype implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/16-vitrine-modal-prototype-final.png`.
- Responsive implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/17-vitrine-modal-responsive.png`.
- Screens comparison:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/22-modal-screens-final-comparison.png`.
- Prototype comparison:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/20-modal-prototype-comparison.png`.
- Desktop viewport and source pixels: 1467 × 834 at 1× density.
- Responsive viewport: 875 × 863 at 1× density.
- State: Amazon Shopping, No-Rush reward balance, Screens and Prototype
  modes.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the Flow title, app identity, mode selector, action
  labels, progress, and metadata follow the Mobbin hierarchy and compact scale.
- Spacing and layout rhythm: the desktop modal uses the same 32px horizontal
  inset, 24px top inset, 72px header, three centered 393:852 phones, 32px
  gaps, and bottom action placement.
- Colors and visual tokens: the dimmed black backdrop, charcoal surface,
  selected mode, neutral controls, muted metadata, and white primary action
  reproduce the reference treatment.
- Image quality and asset fidelity: full-resolution Flow screens fill the
  correct phone aspect without the former white letterboxing or 16:10 crop.
- Copy and content: Flow title, Amazon Shopping identity, screen metadata,
  progress, Save, Copy, Restart prototype, and More info remain present.
- Vitrine intentionally retains a third `Document` mode beside Mobbin's
  `Screens` and `Prototype` modes.

## Interaction and runtime verification

- Screens mode displays the complete Flow as a side-by-side sequence without
  prototype arrows.
- Prototype mode displays one screen at a time with previous/next controls,
  `n of m` progress, restart, and overflow actions.
- The Document mode still opens the generated Feature Document and loads its
  existing content.
- Arrow-key navigation is available in visual modes and excluded from the
  document reader.
- At 875px width, all three screens remain visible in a compact strip, the
  header reflows, and the page has no horizontal body overflow.
- Focused Flow tests: 21 passed.
- Production build: passed.

## Comparison history

- Pass 1 found a P1 image treatment mismatch: 16:10 preview containers produced
  large white strips instead of phone-shaped screens.
- Fix: render Flow captures in their observed 393:852 mobile aspect and let the
  source image fill that frame.
- Pass 1 found a P1 functional mismatch: the modal had no first-class Prototype
  playback mode.
- Fix: add single-screen playback, directional controls, progress, restart,
  and mode-aware URL state.
- Pass 1 found a P2 identity mismatch: the source application was absent or
  truncated.
- Fix: pass the app name and icon through the Flow workspace and allow the full
  Amazon Shopping label.
- Pass 1 found a P2 responsive mismatch at the in-app browser width.
- Fix: add a two-row header and a compact three-screen strip with no body
  overflow.

final result: passed

---

# Shared Discovery Migration Runtime QA — 2026-07-28

## Browser coverage

- Apps: verified Web, iOS, and Android; Categories, Screens, UI Elements, and
  Flows filters; same-group OR and cross-group AND selections; Latest and
  Trending; query, reload, back/forward, and cursor-based infinite scroll.
- Sites: verified Web; Categories, Sections, and Styles filters; same-group OR
  and cross-group AND selections; Latest and Popular; query, back/forward, and
  cursor-based infinite scroll.
- Flows: verified Web, iOS, and Android; Flow groups; parent and child Flow-name
  queries; Popular and Grouped; query clearing, back/forward, infinite scroll,
  Flow preview opening, and App-icon navigation.
- Network inspection showed one catalog request per state change and one request
  per cursor. Opening a Flow preview made no catalog or design-system requests.
  No `/api/design-systems/{app}` fan-out was observed.

## Responsive filter-menu regression

- At the tablet breakpoint, filter controls wrap with visible overflow instead
  of becoming a horizontal scroll container.
- Live browser verification at a 763 × 834 CSS-pixel viewport measured the open
  Flow-groups menu below the 36px control row with computed
  `overflow-x: visible`, `overflow-y: visible`, and `flex-wrap: wrap`.
- A hit test 100px inside the menu resolved to the Settings checkbox option,
  and clicking it produced the canonical URL
  `?platform=web&sort=popular&filter=flowGroups.Settings`.

## Unified API benchmark

One warm-up followed by ten timed requests against the optimized API on port
3011:

| Case | Median | p95 | Decoded bytes |
| --- | ---: | ---: | ---: |
| Apps latest | 103 ms | 147 ms | 1,953,843 |
| Apps category | 88 ms | 94 ms | 138,538 |
| Apps combined | 44 ms | 45 ms | 321 |
| Sites latest | 84 ms | 88 ms | 71,272 |
| Sites combined | 80 ms | 85 ms | 1,990 |
| Flows popular | 6 ms | 17 ms | 382,149 |
| Flows grouped | 5 ms | 5 ms | 383,727 |
| Flows parent query | 1 ms | 4 ms | 49,788 |
| Flows child query | 1 ms | 1 ms | 14,332 |
| Flows group filter | 5 ms | 7 ms | 383,750 |

All responses were HTTP 200 and every warm p95 remained below the 500ms
optimization threshold. Separate compression verification measured the largest
Apps response at approximately 155–157KB gzip and the Flow response at
approximately 46KB gzip.

final result: passed

---

# Flows Filter Bar Apps-Parity Design QA — 2026-07-28

## Comparison target

- Source visual truth: `design-qa-flows-apps-reference.png`.
- Browser-rendered implementation: `design-qa-flows-filterbar.png`.
- Combined comparison input: `design-qa-flows-filterbar-comparison.png`.
- Viewport: 1280 × 720 CSS pixels.
- Source pixels: 1280 × 720.
- Implementation pixels: 1280 × 720.
- Density normalization: none required; both captures came from the same
  in-app browser tab and viewport.
- State: loaded Web catalog with no active filter and the default sort.
- Full-view comparison evidence: Apps and Flows were captured at the same
  viewport and combined side by side. The comparison shows the same white
  platform pill, outlined filter pill, result summary, divider rhythm, and
  right-aligned sort control.
- Focused-region comparison: the complete toolbar is fully legible in the
  full-view comparison, so a separate crop was unnecessary.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the Web label, filter label, two-line result count,
  and sort label use the same sizes, weights, and hierarchy as Apps.
- Spacing and layout rhythm: Flows now uses the same compact platform pill,
  dividers, 36px controls, result-summary alignment, and right-hand sort
  placement as Apps.
- Colors and visual tokens: the selected white platform surface, neutral
  outlined filter, muted count, and primary sort label resolve through the
  existing Apps filter-bar styles.
- Image quality and asset fidelity: the control bar contains no raster assets;
  existing Flow preview images and real app icons remain unchanged.
- Copy and content: Flows intentionally retains its product-specific `Flow
  groups`, `12 flows`, and `Popular` copy while matching Apps presentation.

## Interaction and runtime verification

- The Flow platform trigger is the same single-select dropdown used by Apps.
- Opening it exposes Web, iOS, and Android as accessible radio menu items.
- Flow groups, result count, and Popular/Grouped sorting remain connected to
  the existing Flow state and catalog request.
- Focused Apps, Sites, and Flows tests: 65 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P2 consistency mismatch: Flows rendered the older
  three-segment platform switcher while Apps rendered a compact single-select
  platform pill.
- Fix: routed Flows through the same compact platform branch in the shared
  `DiscoveryFilterBar` without changing Flow data or filter behavior.
- Post-fix evidence: the combined 2560 × 720 comparison shows matching platform,
  filter, count, divider, and sort treatments.

final result: passed

---

# App Screens Tab Mobbin Comparison Audit — 2026-07-30

## Audit scope

- Product surface: Amazon Shopping App detail, iOS Screens tab.
- User goal: scan many mobile screens quickly, filter them, open one at full
  readable size, move through adjacent screens, and share the exact selection.
- Mobbin Screens reference:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/01-mobbin-app-screens.png`.
- Mobbin screen viewer reference:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/04-mobbin-screen-viewer.png`.
- Updated Vitrine Screens view:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/07-vitrine-app-screens-updated.png`.
- Updated Vitrine screen viewer:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/06-vitrine-screen-viewer-updated.png`.
- Responsive Vitrine Screens view:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/08-vitrine-app-screens-875x863.png`.
- Responsive Vitrine screen viewer:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/09-vitrine-screen-viewer-875x863.png`.
- Same-input comparisons:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/10-app-screens-comparison.png`
  and
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/11-screen-viewer-comparison.png`.
- Screen-filter comparison:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/14-screen-filter-comparison.png`.
- Desktop viewport: 1467 × 834 CSS pixels at 1× density.
- Responsive viewport: 875 × 863 CSS pixels at 1× density.

## Strengths and resolved gaps

- The Screens gallery now follows Mobbin's dense browsing rhythm: five
  phone-shaped cards at the desktop comparison width and three at the in-app
  browser width, rather than two oversized cards.
- Screen media preserves the observed 393:852 phone shape and uses the
  high-density source image without cropping or white side gutters.
- Opening a card now uses an app-identified modal with one centered phone,
  previous/next navigation, Save, Copy, overflow actions, logical iOS
  resolution, and More info.
- Opening and navigating a screen now serializes `evidence=SCREEN-{id}` into the
  App URL; closing the viewer removes that selection.
- Previously duplicated accessible labels such as `Open Unclassified screen`
  now fall back to the stable screen id.
- The responsive grid and viewer do not introduce horizontal body overflow.

## Remaining UX and data risks

- P1, upstream taxonomy: Mobbin exposes a full categorized screen taxonomy,
  while the currently loaded Amazon Shopping records expose only
  `Unclassified`. The Vitrine filter is therefore structurally correct but can
  offer only one useful option until screen classification is populated.
- P2, page composition: Mobbin separates Highlights, related Flow previews, and
  All screens. Vitrine currently renders one continuous evidence grid because
  highlight rank and screen-to-Flow membership are not part of the Screens
  payload.
- P2, app metadata: Mobbin shows the marketing tagline, rating, Save, Rate, and
  more actions. Vitrine preserves its product-specific Export to Figma action
  and cannot render the missing tagline or rating from the current App
  metadata.
- P2, card actions: Mobbin exposes per-card selection, Save, and Copy controls.
  Vitrine provides Save and Copy in the screen viewer but does not yet expose
  those actions directly on every grid card.
- The viewer can show `Found in {Flow}` only when screen-to-Flow membership is
  supplied. The current unclassified screen records do not include that
  context, so the label is correctly omitted rather than guessed.

## Accessibility evidence and limits

- The viewer is a named modal dialog with a named screen-viewer group.
- Close, previous, next, Save, Copy, overflow, link-copy, and More info controls
  are exposed as named buttons.
- Grid cards now have distinct accessible names even when analysis metadata is
  missing.
- Keyboard arrow and Escape behavior remains connected through the App detail
  controller.
- Screenshots and DOM inspection cannot prove full screen-reader announcement
  quality, contrast compliance, or zoom behavior; those require dedicated
  assistive-technology and contrast testing.

## Verification

- Focused App Screens, router, and App-boundary tests: 62 passed.
- Production build: passed.
- Live browser verification: five-column desktop grid, three-column responsive
  grid, modal open/close, previous/next navigation, and URL evidence state all
  passed.

final result: rendering passed; taxonomy and enrichment gaps remain upstream

---

# App Detail Mobbin-Style Flow Browsing QA — 2026-07-29

## Comparison target

- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/03-mobbin-no-rush-selected.png`
- Browser-rendered implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/10-vitrine-no-rush-final.png`
- Same-region side-by-side comparison:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-mobile-flows-audit/12-flow-comparison.png`
- Desktop viewport: 1467 × 834 CSS pixels.
- Compared state: Amazon Shopping iOS, Flows, searched to the single
  `No-Rush reward balance` Flow.
- The comparison crops normalize the Flow-browsing region because Vitrine
  retains its product-level app header above that region.

## Findings fixed

- [P1] App-detail Flow screens were presented inside oversized 620px white
  media panels instead of recognizable phone-sized screenshots.
  - Fixed with 390:844 device frames, a 450px desktop height, 16px strip
    spacing, rounded phone clipping, and direct full-resolution image media.
- [P1] Category headings displaced the first Flow row and duplicated navigation
  information already present in the persistent directory.
  - Removed from the gallery surface; category context now appears in the Flow
    title as `Flow from Category`, matching the source.
- [P2] The modal preview lost the selected app platform and feature-document
  source when opened from the gallery.
  - The gallery now carries app, iOS/Android platform, version, Flow id, and
    user role into the Screens/Document preview.
- [P2] The existing Flow analysis handoff could have been obscured by a visual
  replication.
  - The persistent searchable Flow hierarchy and sibling Visual Flow /
    Document Flow experiences remain unchanged.

## Visual comparison result

- No actionable P0, P1, or P2 visual difference remains in the replicated Flow
  strip.
- Source and implementation both render three 208 × 450 No-Rush screens with
  the same 16px spacing, dark background, left-aligned strip, rounded device
  frames, and `No-Rush reward balance from Account` metadata.
- Vitrine intentionally keeps the richer persistent hierarchy in the left rail
  and its product app header.

## Interaction and runtime verification

- Search reduced 307 Amazon Shopping Flows to the single matching No-Rush Flow.
- Opening the Flow displayed all three full-resolution screens.
- Preview metadata resolved to `iOS 1179×2555`.
- The Document mode loaded the generated feature document with two supported
  requirements and linked evidence.
- At 390 × 844, the document remained 390px wide with no page overflow; the
  Flow strip retained 208 × 450 phone frames and the mobile Browse flows
  control.
- Focused Flow tests: 20 passed.
- Production build: passed.

final result: passed

---

# App Detail Navigation Rail Design QA — 2026-07-28

## Comparison target

- Source visual truth: `/tmp/astryx-mobbin-reference.png`
- Browser-rendered implementation: `/tmp/astryx-shopee-nav-final.png`
- Full-view comparison: `/tmp/astryx-app-detail-nav-comparison.png`
- Focused navigation comparison: `/tmp/astryx-app-detail-nav-focused-comparison.png`
- Screens-filter source state: `/tmp/mobbin-screens-filter-reference.png`
- Screens-filter implementation state: `/tmp/astryx-shopee-screens-filter.png`
- Screens-filter side-by-side comparison: `/tmp/astryx-screens-filter-comparison.png`
- UI Elements filter state: `/tmp/astryx-shopee-ui-elements-filter.png`
- Flows filter state: `/tmp/astryx-shopee-flows-filter.png`
- Cross-section filter comparison: `/tmp/astryx-section-filters-comparison.png`
- Viewport: 905 × 863 CSS pixels.
- Source pixels: 905 × 863.
- Implementation pixels: 905 × 863.
- Density normalization: none required; both captures came from the same in-app browser viewport and density.
- State: Mobbin Mercor Screens and Astryx Shopee Flows. The comparison is intentionally scoped to the annotated 64px navigation rail; product identity, hero height, available sections, and gallery content remain product-specific.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the 17px navigation labels, active weight, two-line result count, and quiet inactive hierarchy match the reference treatment.
- Spacing and layout rhythm: both rails are 64px tall. Astryx retains its existing 32px product gutter while matching the source's version divider, horizontal tab rhythm, active underline, and far-right count alignment.
- Colors and visual tokens: the rail uses Astryx's existing dark background, subtle divider, primary active text, secondary inactive text, and white underline tokens.
- Image quality and asset fidelity: this rail contains no raster image assets. Existing app identity and gallery media remain unchanged.
- Copy and content: `Latest`, the five real Astryx destinations, contextual `Screens`, `UI Elements`, and `Flows` filters, and the two-line section total preserve Astryx behavior while adopting the Mobbin hierarchy. Screens and UI Elements use their own evidence metadata; Flows uses real parent groups, tags, interactions, and analyzed states when those fields exist.

## Interaction and runtime verification

- The App version control exposes an accessible combobox and opens a listbox containing the real `Latest` version.
- Selecting `Latest` closes the listbox and preserves the current route-backed version.
- Existing section tabs, active underline, and section result totals remain connected.
- The secondary `Screens` control appears only on the Screens section. It opens an accessible searchable dialog, supports multi-select options, displays a selected-count badge, clears in one action, and resets when platform or version changes.
- UI Elements and Flows expose the same contextual control with independent selections. UI Elements labels its evidence facets as Element types, Layouts, Components, and States. Flows labels its facets as Flow groups, Tags, Interactions, and States.
- Options inside one metadata group use OR matching; separate metadata groups use AND matching.
- Selecting the real Shopee `Onboarding` Flow group reduced the workspace to its one child flow and changed the total to `1 of 538 flows`.
- The 905px page has no horizontal overflow.
- Browser console: no errors.
- Focused Screen Detail and shared shell tests: 32 passed.
- Production build: passed.

## Comparison history

- Pass 1 found a P1 loading-state copy defect: the version trigger briefly rendered `Select...` before the version list loaded.
- Fix: fall back to the stable `Latest` option until the resolved version exists in the loaded version collection.
- Post-fix evidence: the final 905 × 863 capture and focused 857 × 128 comparison show `Latest`, the divider, five working tabs, active underline, and the two-line total with no placeholder flash.
- Pass 2 added the annotated secondary `Screens` filter. The initial rail was too tight and clipped `Export`; reducing the App-only tab gap to 20px preserved all five real destinations, the contextual filter, and the section total at 905px.
- Pass 3 extended the same control to UI Elements and Flows. The longer UI Elements trigger initially clipped the final tab; the App-only rail now uses a compact 16px label scale and 10px tab gap so every destination, contextual filter, and total remains visible at 905px.

## Follow-up polish

- P3: Astryx intentionally omits Mobbin's playback and adjacent utility icon because Astryx has no corresponding actions in this rail.

final result: passed

---

# Apps Platform Switcher Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/mobbin-platform-switcher-762.png`
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-platform-switcher-762.png`
- Combined comparison evidence: both captures were emitted together in the same
  browser comparison pass.
- Viewport: 762 × 863 CSS pixels.
- Pixels and density: both captures are 762 × 863 at the same browser density;
  no normalization was required.
- State: dark-theme Apps catalog, Web selected, compact responsive toolbar.
  Mobbin exposes its two available platforms as device icons at this width;
  Astryx intentionally retains readable labels for its three supported
  platforms.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: each label uses the same 12px size and is centered
  without truncation or overlap. The selected and inactive weights remain
  consistent with the surrounding filter toolbar.
- Spacing and layout rhythm: all three segments measure exactly 56px, with 2px
  gaps and a 55.99px indicator inside a 178px pill. The indicator aligns with
  each segment rather than following unequal intrinsic label widths.
- Colors and visual tokens: the muted inactive labels, neutral selected surface,
  dark track, and low-contrast border retain the Mobbin-derived hierarchy.
- Image quality and asset fidelity: this control needs no image assets. No
  custom icon, SVG, or drawn replacement was introduced.
- Copy and content: Web, iOS, and Android remain explicit because Astryx
  supports all three catalog platforms.
- Accessibility and interaction: the radiogroup and radio semantics remain
  intact, arrow-key behavior is unchanged, and selecting Android then Web
  updates both `aria-checked` and the URL.

## Interaction and runtime verification

- At 762px, button bounds are 27–83px, 85–141px, and 143–199px, so no labels
  collide.
- Selecting Android moves the indicator by 115.98px, exactly two segment widths
  plus two gaps.
- Returning to Web restores
  `/apps?platform=web&content_type=apps&sort=latest`.
- The only browser error retained in the tab log predates this fix and belongs
  to the earlier hot-refresh cursor-state transition; no new switcher errors
  were produced.
- Focused Apps tests: 20 passed.
- Production build: passed.

## Focused comparison

The full 762px captures make the annotated platform control, its relationship
to the filter pills, and its responsive density clearly readable. No additional
crop was needed.

## Comparison history

- Pass 1 P2: the Apps toolbar set platform buttons to intrinsic `auto` widths
  even though the animated indicator divides the track into equal thirds.
  Android therefore received a wider segment and crowded the neighboring labels.
- Fix: assigned equal 60px desktop, 56px tablet, and 52px mobile segment widths,
  removed horizontal padding, and clipped the moving indicator to the pill.
- Post-fix evidence: the 762px browser measurement reports three equal 56px
  buttons, aligned 2px gaps, and a matching 55.99px indicator.

## Follow-up polish

- P3: if Astryx later adds platform-specific icons to its design system, the
  tablet breakpoint could adopt Mobbin's icon-only treatment. Explicit labels
  are currently clearer for the third Android option.

final result: passed

---

# Apps Multi-select Filter Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-mobbin-source.png`
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-multiselect-implementation.png`
- Combined comparison evidence: both 1512 × 834 captures were emitted together
  in the same Chrome comparison pass.
- Viewport: 1512 × 834 CSS pixels.
- Pixels and density: both captures are 1512 × 834; no density normalization
  was required.
- State: Web, Screens, Trending, two Categories and two Screen patterns
  selected. The implementation menu is open to verify pinned selected values;
  the source full view is closed, while its open-menu behavior was verified
  separately in the same signed-in Chrome session.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the compact 14–15px labels, medium-weight selected
  pills, muted result count, and hierarchy closely match the Mobbin reference
  while retaining Astryx's product font.
- Spacing and layout rhythm: the 36px pill controls, one-pixel dividers,
  compact sticky toolbar, rounded menu, selected-value pinning, and grouped
  taxonomy preserve the source density. Astryx intentionally keeps Android,
  Flows, and its existing funnel action because those are supported product
  controls.
- Colors and visual tokens: the neutral dark surfaces, selected white outline,
  subdued borders, selected-row fill, and high-contrast count badges match the
  reference treatment.
- Image quality and asset fidelity: no new imagery was needed. Check, close,
  search, and chevron controls use the Astryx icon library rather than custom
  drawings.
- Copy and content: Astryx keeps its own taxonomy and result terminology while
  using Mobbin's selected-group count and URL behavior.
- Accessibility and interaction: selected options use `aria-selected`, filter
  triggers expose selected counts, clear controls name the affected group, and
  the open menu remains available while values are toggled.

## Interaction and runtime verification

- Repeated URL tokens restore two Categories and two Screen patterns.
- Removing Business leaves the menu open, updates the Categories pill from
  three to two, and removes only the matching `appCategories.Business` token.
- Selected values are pinned above the divider and repeated in their taxonomy
  section with real check icons.
- Matching is OR within Categories or Screens and AND between the two groups.
- Multi-category public catalog requests are merged and de-duplicated before
  the local cross-group filter is applied.
- Console errors were checked. A hot-refresh-only stale-state error was found
  during the first pass, fixed with a null-safe cursor transition, and the
  final route and interactions completed successfully.
- Focused Apps tests: 23 passed.
- Production build: passed.

## Focused comparison

The toolbar and open Categories menu were large enough in the full-view
captures to judge pill typography, count badges, borders, menu spacing,
selected checks, divider treatment, and URL-backed interaction. No additional
crop was needed.

## Comparison history

- Pass 1 found that selected rows did not visibly render the check icon because
  the design-system Button expects its leading visual in `icon`.
- Fix: moved the real Astryx `check` icon to the supported Button prop.
- Post-fix evidence: both pinned selections expose one SVG check and the
  browser capture shows the checks beside Shopping and AI.

## Follow-up polish

- P3: the result count can briefly show zero while a freshly combined facet
  catalog is loading. This is existing catalog-state behavior and does not
  affect selection, persistence, or matching semantics.

final result: passed

---

# Flow Preview Dialog Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/mobbin-flow-dialog-audit/01-mobbin-flow-dialog.png`
- Browser-rendered implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/flow-preview-dialog-build/06-astryx-flow-dialog-metrics-refined.png`
- Mobile implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/flow-preview-dialog-build/09-astryx-flow-dialog-metrics-mobile.png`
- Combined comparison evidence:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/flow-preview-dialog-build/07-metrics-refined-comparison.png`
- Focused header and footer evidence:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa6a9-148a-7922-ae94-8317b9e0c87f/flow-preview-dialog-build/08-metrics-focused-comparison.png`
- Viewport: 866 × 863 CSS pixels; compact check at 390 × 844 CSS pixels.
- Pixels and density: source and desktop implementation are both 866 × 863
  physical pixels at device scale 1.
- State: initial Flow screen, Screens selected, dark theme, no transient menu
  or information panel open.

## Findings

No actionable P0, P1, or P2 differences remain.

- Layout: the implementation matches the 24px inset dialog, 24px radius,
  fixed identity header, centered horizontal media strip, partial next screen,
  and anchored footer actions and metadata.
- Content: Astryx uses the selected Flow title, real source-app icon and name,
  real full-resolution screen captures, platform, and measured image
  resolution. No generated or placeholder assets replace available evidence.
- Behavior: opening a Flow card restores a shareable URL, screen navigation
  updates that URL, edge arrows disappear at the first and last screen, and
  closing clears Flow preview state.
- Controls: Screens is selected; Prototype is visibly disabled until prototype
  data exists. Save, Copy, link copy, screen actions, More info, source-app
  navigation, and Close expose accessible names.
- Typography and control metrics: Astryx retains its available Figtree family
  while matching Mobbin's measured 20/26px identity type, 14/20px mode type,
  16/22px action type, and 600 weight. The mode pill is 159.9 × 36px; Save,
  Copy, and More are 67 × 44px, 98 × 44px, and 44 × 44px.
- Deliberate adaptation: Mobbin-only collaborator and comment controls are not
  shown because Astryx does not currently expose those product capabilities.

## Interaction and runtime verification

- Direct reload restored
  `/flows?flow=whatsapp%3A7230&tab=screens&screen=0`.
- Next moved to Screen 2, exposed Previous, and updated `screen=1`.
- Returning to Screen 1 hid Previous and restored `screen=0`.
- Save changed to Saved; Copy changed to Copied.
- More info exposed the active step and screen position.
- Screen actions exposed Open full image and Copy image URL.
- At 390px the dialog remained usable with the app icon, mode tabs, carousel,
  actions, and metadata visible.
- Browser console: no errors.
- Focused Flow UI tests: 8 passed.
- Production build and `git diff --check`: passed.

## Comparison history

- Pass 1 found a P2 breakpoint mismatch at 866px: the identity header stacked
  into two rows and the dialog inset shrank to 12px.
- Fix: moved the compact breakpoint below the reference viewport, restoring
  the 72px single-row header and 24px dialog inset.
- Pass 2 found a P2 programmatic focus outline around the source-app control,
  then around the full dialog when focus was redirected.
- Fix: focused the dialog canvas for predictable keyboard entry and suppressed
  only that non-interactive container outline; interactive controls retain
  visible keyboard focus.
- Pass 3 found P2 density drift in the requested size, font, and buttons:
  Astryx used an 18px identity, a 206 × 44px mode pill, 52px footer buttons,
  and a carousel card aligned to the dialog edge instead of the 32px content
  gutter.
- Fix: matched the measured typography, reduced the mode and action controls to
  Mobbin's dimensions, moved the Copy icon to the trailing side, and corrected
  scroll snapping to preserve the media gutter.
- Post-fix browser measurements place the first screen at 57 × 255.1 with a
  519.6 × 324.7 frame, versus the reference's 56 × 255 and approximately
  520 × 325 frame. Full-view and focused comparisons confirm the source
  hierarchy, spacing, carousel geometry, footer placement, and dark treatment.

final result: passed

---

# Apps Filter Bar Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/mobbin-apps-filter-reference-open.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/mobbin-apps-filter-reference-mobile.png`
- Browser-rendered implementation:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/astryx-apps-filter-open-866.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/astryx-apps-filter-mobile.png`
- Combined comparison evidence:
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/apps-filter-open-comparison.png`
  - `/Users/kai/.codex/visualizations/2026/07/28/019fa865-de61-7db0-8d2c-0e1ebff02d68/apps-filter-mobile-comparison.png`
- Viewports and pixels:
  - Desktop source and implementation: 866 × 863 CSS pixels and 866 × 863 captured pixels.
  - Mobile source and implementation: 390 × 844 CSS pixels and 390 × 844 captured pixels.
- Density normalization: all comparison inputs use one captured pixel per CSS pixel; no resampling was required.
- State: authenticated dark-theme Web Apps catalog with `Shopping`, `My Account & Profile`, and `Trending` selected. The open-menu comparison keeps the Screens menu open and the mobile comparison keeps it closed.
- Data constraint: Mobbin has 27 matching screens while the current Astryx preview catalog has no matching classified screen payload. Result cards and the empty state are therefore not judged as visual equivalents; the requested Apps filter surface and its interaction states are the fidelity target.

## Findings

No actionable P0, P1, or P2 differences remain for the requested Apps filter surface.

- Fonts and typography: the implementation uses Astryx's existing Figtree/system stack with the same compact hierarchy for pills, group labels, options, result count, and ordering. The smaller tablet platform labels are an intentional fit adjustment for Astryx's third Android option.
- Spacing and layout rhythm: the 64 px desktop bar, 36 px pills, 320 px menu, 96 px compact mobile header, 52 px horizontal mobile control row, and separate count/sort row match the reference structure. The user's earlier request to minimize Apps search intentionally keeps the desktop navigation at 72 px instead of Mobbin's taller search header.
- Colors and visual tokens: the implementation matches the source's `#111` page/bar, dark raised menu, subdued inactive text, white selected-pill outline, muted dividers, and highlighted selected option using Astryx's neutral tokens.
- Image quality and asset fidelity: no Mobbin assets were copied or approximated. Astryx retains its real favicon, app media, and design-system icons. The menu preview appears only when a real catalog preview asset exists.
- Copy and content: `Shopping`, `My Account & Profile`, `UI Elements`, `Flows`, `Showing`, `Latest`, and `Trending` follow the source language. Astryx retains its own Apps/Sites/Flows navigation and Android platform because those are existing product capabilities.
- Accessibility and interaction: platforms remain keyboard-operable radios; filter suggestions are searchable options; selected filters are independently removable; menus expose expanded/selected state; Escape closes filter menus; sorting is a radio menu; and URL state is shareable.

## Comparison history

- Pass 1 found a P2 mobile hierarchy mismatch: the Apps search occupied a full second row, making the header too tall and shifting the filter controls below the reference position.
- Fix: rebuilt the Apps-only compact header into a 58 px brand/search/account row plus a 38 px product-navigation row, then anchored the filter bar at 96 px.
- Post-fix evidence: `apps-filter-mobile-comparison.png` shows the search, navigation, horizontal filter rail, and count/sort row aligned to the same 390 × 844 frame.
- Pass 2 found a P2 tablet/desktop overflow: at 866 px, the third Astryx platform and Flow control collided with persistent sort controls, and the wide two-column menu did not match the source.
- Fix: compressed the platform switcher at the tablet breakpoint, hides the redundant Flow chip while keeping More Filters available, removes the count label at that width, narrows the menu to 320 px, and uses a source-like selected-row treatment.
- Post-fix evidence: `apps-filter-open-comparison.png` shows the bar and menu fitting without overlap at 866 × 863, with the menu aligned under the selected Screens pill.

## Interaction and runtime verification

- Selecting Shopping produced the Mobbin-style URL filter and loaded 16 real Shopping apps.
- The exact combined state round-tripped as `appCategories.Shopping_screenPatterns.My+Account+%26+Profile`.
- Searching the open Screens menu for `account` reduced it to the selected `My Account & Profile` option.
- Switching Trending → Latest → Trending updated and restored the URL sort state.
- The browser console reported no runtime errors. The only warning is the existing Astryx neutral-theme development injection notice.

## Open questions

- None blocking. Populating result cards for `My Account & Profile` requires fuller screen classifications in the catalog payload; the UI intentionally does not fabricate them.

## Implementation checklist

- Keep the Apps search compact.
- Preserve URL-backed filters and sort state.
- Keep the mobile filter controls horizontally scrollable.
- Continue using real Astryx catalog media and design-system icons.

## Follow-up polish

- [P3] Mobbin uses icon-only mobile platform controls and only iOS/Web in this state; Astryx keeps short text labels because it also supports Android.
- [P3] Mobbin shows notification/avatar actions while Astryx keeps its existing compact account menu.

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

---

# Apps Filter Funnel Removal Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-before-funnel-removal-762.png`
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-after-funnel-removal-762.png`
- Viewport: 762 × 863 CSS pixels at 1× density.
- Source pixels: 762 × 863.
- Implementation pixels: 762 × 863.
- Density normalization: none required; both captures have identical pixel and CSS dimensions.
- State: Apps route, Web platform, Apps content, Latest sorting, no active facet.
- Full-view comparison evidence: the before and after captures were emitted together in one comparison pass.
- Focused-region comparison: not needed because the selected toolbar occupies the full width, all labels are readable in the same-size full-view captures, and the change is isolated to one trailing control.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: unchanged across the platform switcher, filter labels, result metadata, and Latest sort control.
- Spacing and layout rhythm: removing the funnel also removes its orphan divider; Categories remains the first filter immediately after the platform switcher and divider.
- Colors and visual tokens: unchanged; the toolbar retains its dark surfaces, borders, and text hierarchy.
- Image quality and asset fidelity: app-card imagery and identity assets are unchanged.
- Copy and content: Categories, Screens, UI Elements, and Latest remain visible; More filters is absent.

## Interaction and runtime verification

- Browser DOM inspection confirms `Open Categories filters` remains present.
- Browser DOM inspection confirms `More filters` is absent.
- Browser console: no errors.
- Focused Apps tests: 21 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified the annotated redundant funnel as a P2 toolbar-control mismatch.
- Fix: removed the More filters callback, button, dedicated style, and the divider that existed only for that control.
- Post-fix evidence: the 762 × 863 implementation capture shows Categories preserved below the header with no funnel and no empty trailing divider.

final result: passed

---

# Apps Taxonomy Restoration Design QA — 2026-07-28

## Comparison target

- Source visual truth:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-sites-taxonomy-reference-707.png`
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-taxonomy-restored-707.png`
- Viewport: 707 × 863 CSS pixels at 1× density.
- Source pixels: 707 × 863.
- Implementation pixels: 707 × 863.
- Density normalization: none required; both captures have identical pixel and CSS dimensions.
- State: signed-in dark-theme Sites taxonomy reference compared with the signed-in dark-theme Apps taxonomy at Web, Apps content, Latest sorting, and no selected facets.
- Full-view comparison evidence: the Sites reference and Apps implementation were emitted together in one comparison pass.
- Focused-region comparison: not needed because every visible taxonomy heading and option is readable in the full-view comparison. The different Apps header composition and App-specific taxonomy copy are intentional product differences.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the Apps taxonomy reuses the shared facet group typography, weights, line heights, and hierarchy visible on Sites.
- Spacing and layout rhythm: the Apps groups use the same single-column responsive structure, left alignment, heading gaps, option rhythm, and content gutter as the 707 px Sites reference.
- Colors and visual tokens: background, primary option text, secondary group headings, selected-state treatment, and divider-free presentation use the shared discovery tokens.
- Image quality and asset fidelity: the taxonomy contains no image assets; the existing Vitrine brand asset remains unchanged.
- Copy and content: the restored Apps groups intentionally use Apps-specific values under Categories, Screens, UI Elements, and Flows rather than copying Sites content.

## Interaction and runtime verification

- Clicking `AI` selects the category and synchronizes the compact filter bar.
- Clicking `Business` adds a second selected category, preserving multi-selection.
- The Apps DOM contains the full `App discovery filters` taxonomy and the compact filter bar below it.
- `More filters` remains absent.
- Browser console: no errors.
- Focused Apps tests: 21 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P1 missing major region: Apps emitted an empty taxonomy container and CSS hid it.
- Fix: restored the shared facet-group rendering with the original Apps taxonomy definitions, connected each option to the current multi-select URL state, and removed the Apps-only hide rule.
- Post-fix evidence: the 707 × 863 Apps capture matches the Sites taxonomy's responsive hierarchy and visual rhythm while showing Apps-specific groups and values.

final result: passed

---

# Apps Filter Checkbox Design QA — 2026-07-28

## Comparison target

- Source visual truth: `browser:Categories suggestions` from User Comment 1.
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-filter-checkboxes-707.png`
- Viewport: 707 × 863 CSS pixels at 1× density.
- Source pixels: 707 × 863.
- Implementation pixels: 707 × 863.
- Density normalization: none required; the annotated source and implementation use the same viewport and density.
- State: Categories menu open with Education, AI, and Business selected.
- Full-view comparison evidence: the annotated source and browser-rendered implementation were compared in the same turn at the same route, viewport, menu state, and selected values.
- Focused-region comparison: the open Categories popover is large and readable in the full-view captures, so a separate crop was unnecessary.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: labels retain the existing compact menu type scale, weight, and hierarchy.
- Spacing and layout rhythm: every pinned and grouped option now has the same checkbox-leading alignment, row padding, radius, and vertical rhythm.
- Colors and visual tokens: native Astryx checkbox states provide a clear blue checked state and quiet dark unchecked state while retaining existing selected-row surfaces.
- Image quality and asset fidelity: the menu contains no image assets; the underlying app-card imagery remains unchanged.
- Copy and content: all category labels, pinned selected values, group headings, and search placeholder remain unchanged.

## Interaction and runtime verification

- The Categories suggestions container exposes accessible group semantics.
- Every selected and unselected row exposes a native checkbox with its label.
- Clicking unchecked `Finance` changed the filter summary from three to four selections.
- Clicking checked `Finance` restored the original three-selection state.
- Search, selected-value pinning, duplicate grouped values, preview hover/focus hooks, and multi-select URL state remain connected.
- Browser console: no errors.
- Focused Apps tests: 22 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P2 affordance mismatch: selected rows used small check glyphs while unselected rows had no persistent selection control.
- Fix: replaced option buttons with the shared native `CheckboxInput` for both pinned and grouped rows, added checkbox-row hover/focus/selected styling, and changed the suggestion container from listbox to checkbox-group semantics.
- Post-fix evidence: the 707 × 863 capture shows visible checked and unchecked boxes on every option with unchanged content and menu structure.

final result: passed

---

# Apps Filter Dark Checkbox Design QA — 2026-07-28

## Comparison target

- Source visual truth: `browser:Education AI Business` from User Comment 1.
- Browser-rendered implementation:
  `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/astryx-apps-filter-dark-checkboxes-707.png`
- Viewport: 707 × 863 CSS pixels at 1× density.
- Source pixels: 707 × 863.
- Implementation pixels: 707 × 863.
- Density normalization: none required; the annotated source and implementation use the same viewport and density.
- State: Categories menu open with Education, AI, and Business selected.
- Full-view comparison evidence: the annotated source and browser-rendered implementation were compared in the same turn at the same route, viewport, menu state, and selected values.
- Focused-region comparison: the open Categories menu is readable at full size, so a separate crop was unnecessary.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: search, group heading, and option labels retain the existing compact hierarchy.
- Spacing and layout rhythm: removing the pinned block and divider eliminates duplicate rows and lets the grouped list begin directly below search.
- Colors and visual tokens: checked controls now use dark neutral fills, gray borders, and white checks; unchecked controls remain dark and quiet.
- Image quality and asset fidelity: the menu contains no image assets; app-card imagery remains unchanged.
- Copy and content: all category labels and selected values remain available once in the grouped list.

## Interaction and runtime verification

- The Categories menu contains one grouped list and no pinned selected block.
- AI, Business, and Education remain checked in place.
- Clicking unchecked `Finance` changed the filter summary from three to four selections.
- Clicking checked `Finance` restored the original three-selection state.
- Browser console: no errors.
- Focused Apps tests: 23 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified two P2 issues: selected values were duplicated above the grouped list, and checked controls used a bright blue treatment inconsistent with the requested dark theme.
- Fix: removed the selected-options block and divider, then scoped dark neutral checked and unchecked checkbox colors to the Apps filter menu.
- Post-fix evidence: the 707 × 863 capture shows a single grouped category list with dark checkboxes and no duplicate selected section.

final result: passed

---

# Sites Filter Bar Apps-Parity Design QA — 2026-07-28

## Comparison target

- Source visual truth: `design-qa-sites-apps-reference.png`.
- Browser-rendered implementation: `design-qa-sites-filterbar.png`.
- Combined comparison input: `design-qa-sites-filterbar-comparison.png`.
- Viewport: 1280 × 720 CSS pixels.
- Source pixels: 1280 × 720.
- Implementation pixels: 1280 × 720.
- Density normalization: none required; both captures came from the same
  in-app browser tab and viewport.
- State: loaded Web catalogs with no active filters and Latest sorting.
- Full-view comparison evidence: the Apps and Sites pages were combined side by
  side. Both use the same white platform dropdown, outlined filter pills,
  two-line count, divider rhythm, and right-aligned sort control.
- Focused-region comparison: the complete toolbar is readable in the full-view
  comparison, so a separate crop was unnecessary.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the Web label, filter labels, result count, and Latest
  label share the Apps type scale, weights, and hierarchy.
- Spacing and layout rhythm: Sites now uses the same compact 36px platform
  control, dividers, filter gaps, result-summary alignment, and sort placement.
- Colors and visual tokens: the selected white platform surface, neutral
  filter borders, muted count, and primary sort text reuse the Apps toolbar
  tokens.
- Image quality and asset fidelity: the toolbar contains no raster assets;
  Site preview media, logos, and crops remain unchanged.
- Copy and content: Sites intentionally retains its product-specific
  Categories, Sections, Styles, site count, and Latest labels.

## Interaction and runtime verification

- The Site platform trigger now uses the shared single-select dropdown shell.
- The Web-only Site platform menu opens and closes correctly.
- Categories, Sections, Styles, result count, and sorting remain connected to
  the existing Site state and data.
- Focused Apps, Sites, and Flows tests: 66 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified a P2 consistency mismatch: Sites rendered the older
  platform switcher while Apps and Flows used the compact platform dropdown.
- Fix: removed the kind-specific switcher branch so every discovery page uses
  the same platform control.
- Post-fix evidence: the combined 2560 × 720 comparison shows matching platform,
  filter, count, divider, and sort treatments.

final result: passed

# App Screens hover actions and Flow-card identity — 2026-07-30

## Reference set

- Source visual truth: the three user-marked Vitrine Screens and Apps Flow-card
  states, captured at 875 × 863 CSS pixels.
- Before implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/mobbin-app-screens-audit-2026-07-30/19-vitrine-app-screens-flow-context-875x863.png`.
- Browser-rendered hover state:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/03-hover-actions-875.png`.
- Browser-rendered Apps Flow cards:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/04-flows-no-app-icon.png`.
- Combined comparison input:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-card-hover-qa-2026-07-30/05-before-after-comparison.png`.
- Viewport: 875 × 863 CSS pixels at 1× density.
- State: Amazon Shopping, iOS, version 1; the first screen card was forced
  into its browser hover pseudo-state only for screenshot verification.

## Findings

No actionable P0, P1, or P2 differences remain for the requested changes.

- Typography: the existing App detail hierarchy is unchanged; the remaining
  `All screens` heading and count retain the established scale.
- Layout: the Screens tab now contains one gallery instead of the redundant
  Highlights and related-Flows sections.
- Visual tokens: Save and Copy share one compact dark glass action pill inside
  the image card, using the existing Vitrine neutral palette.
- Image fidelity: the source screen images, aspect ratios, containment, and
  high-density sources are unchanged.
- Copy and content: Highlight labels, `Open source screen`, and
  `Flows using these screens` are absent. App-local Flow cards no longer repeat
  the app icon.

## Interaction and runtime verification

- Save and Copy are hidden at rest and appear on hover, keyboard focus, or
  selected state; touch-only devices keep the actions visible.
- Save opens the existing collection picker without navigating away.
- Copy completes through the existing PNG-copy path and reports
  `Copied as png`.
- The Apps Flow tab preserves Flow titles, screen counts, Save, and Copy while
  omitting redundant app identity. The global Flow catalog retains app identity
  where its icon remains an actionable source-app link.
- Browser console: no application errors; only the pre-existing development
  warning about runtime theme injection.
- Focused component tests: 34 passed.
- Production build: passed.

## Comparison history

- Pass 1 identified the requested mismatches: screen actions sat persistently
  below cards, a source-screen overflow action was present, Highlights and
  related-Flow sections duplicated the gallery, and App-local Flow cards
  repeated the app icon.
- Fix: placed Save and Copy inside the screen media as hover/focus actions,
  removed the source action and redundant sections, and conditioned Flow-card
  identity on having an actionable source-app destination.
- Post-fix evidence: the 1750 × 863 comparison shows one focused gallery and
  the action pill inside the hovered card; the Apps Flow capture shows cards
  without app icons.

final result: passed

# App detail responsive navigation spacing — 2026-07-30

## Audit scope and evidence

- Surface: Amazon Shopping App detail navigation on the Screens tab.
- User goal: scan and switch App sections without the version, tabs, and filter
  feeling compressed at tablet and compact widths.
- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-responsive-nav-qa-2026-07-30/01-before-689x863.jpg`.
- Browser-rendered implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-responsive-nav-qa-2026-07-30/03-after-loaded-689x863.jpg`.
- Additional compact-width evidence:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-responsive-nav-qa-2026-07-30/04-mobile-390x844.jpg`.
- Combined comparison input:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-responsive-nav-qa-2026-07-30/05-before-after-comparison.png`.
- Viewport and pixels: 689 × 863 CSS pixels and 689 × 863 image pixels at
  1× normalized density. Compact verification used 390 × 844.
- State: Amazon Shopping, iOS, version 1, loaded Screens tab at page top.

## Audit findings

- [P2] Nine navigation controls were compressed into one 64px row at 689px.
  The five tabs had only 10px gaps, weakening grouping between the version,
  section navigation, and filter.
- Accessibility risk: the one-row layout had no room to absorb longer labels or
  text scaling before relying on implicit horizontal scrolling. Screenshot
  evidence cannot establish full keyboard or screen-reader compliance.
- Strengths preserved: semantic tablist, selected indicator, labelled version
  selector, filter control, tap heights, and horizontal overflow behavior.

## Fix and design QA

- At widths up to 720px, version and filter now occupy a clear 52px utility row.
  The section tabs use a separate 60px row with 24px spacing.
- The tab row retains horizontal scrolling at 390px while the page itself has
  no horizontal overflow (`390px` body width and scroll width).
- Fonts and typography: existing type family, sizes, weights, wrapping, and
  selected hierarchy are unchanged.
- Spacing and layout rhythm: controls are separated by task and the tab gap
  increases from 10px to 24px without changing the desktop layout.
- Colors and visual tokens: existing background, divider, selected indicator,
  and text tokens are unchanged.
- Image quality and asset fidelity: App icon and captured screen images are
  unchanged.
- Copy and content: all labels and App data are unchanged.
- Interaction: tablist overflow, version selector, and Screens filter remain
  functional; switching to UI Elements and back to Screens updated the route
  and selected tab correctly. The 390px layout does not create page-level
  overflow.
- Browser console: no application errors; only the existing development
  warning about runtime theme injection.
- Focused component tests: 27 passed.
- Production build: passed.

## Comparison history

- Pass 1 recorded the P2 compressed single-row navigation.
- Fix: introduced a two-row responsive grid only for App detail at `≤720px`.
- Post-fix evidence: the 689px comparison shows distinct utility and section
  rows; the 390px capture confirms resilient horizontal tab scrolling.

final result: passed

# Screens filter viewport containment — 2026-07-30

## Reference set

- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-filter-menu-qa-2026-07-30/01-before-open-875x863.jpg`.
- Browser-rendered implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-filter-menu-qa-2026-07-30/02-after-open-875x863.jpg`.
- Compact implementation:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-filter-menu-qa-2026-07-30/04-mobile-open-full-list-390x844.jpg`.
- Combined comparison input:
  `/Users/kai/.codex/visualizations/2026/07/28/019fa930-3eda-7e20-93aa-0ddd56b4693c/vitrine-filter-menu-qa-2026-07-30/05-before-after-comparison.png`.
- Viewport and pixels: 875 × 863 CSS pixels and 875 × 863 image pixels at
  1× normalized density. Compact verification used 390 × 844.
- State: Amazon Shopping Screens filter open with the complete unfiltered list.

## Findings

No actionable P0, P1, or P2 differences remain after the fix.

- Earlier P1: the options content escaped the menu surface and continued across
  the screen grid, obscuring content and making lower options difficult to use.
- Fonts and typography: search, section, and option typography are unchanged
  and remain readable inside the clipped surface.
- Spacing and layout rhythm: the 520px menu surface remains aligned to its
  trigger; search occupies a fixed 40px row and options receive the remaining
  454px.
- Colors and visual tokens: the existing dark surface, border, shadow,
  checkboxes, and text colors are unchanged.
- Image quality and asset fidelity: background screen images are unchanged and
  are no longer covered by escaped option content.
- Copy and content: all 200 filter options and search labels are preserved.

## Interaction and runtime verification

- The search field remains visible while the options element scrolls
  independently (`454px` client height, `7332px` scroll height at 875px).
- Searching for `Cart` reduced the visible list to seven matching options;
  clearing restored all 200.
- The desktop popover bottom is `630px` within an `863px` viewport.
- At 390 × 844, the complete-list popover ends at `684px`, its options scroll
  internally, and the page has no horizontal overflow.
- Browser console: no application errors; only the existing development
  warning about runtime theme injection.
- Focused component tests: 41 passed.
- Production build: passed.

## Comparison history

- Pass 1 recorded the P1 escaping option list.
- Fix: gave the popover a viewport-aware height, clipped the surface, made the
  menu fill that height, and retained scrolling on the options row only.
- Post-fix evidence: the side-by-side comparison shows the complete surface
  ending above the lower screen cards without any transparent overflow.

final result: passed

# Sites Sections gallery — 2026-07-30

## Visual truth and normalization

- Source visual truth:
  `/Users/kai/.codex/visualizations/2026/07/30/019fb1ac-763e-7a23-8c67-7a2207a85da1/sections-comparison/02-mobbin-sections.png`.
- Initial Astryx implementation:
  `/Users/kai/.codex/visualizations/2026/07/30/019fb1ac-763e-7a23-8c67-7a2207a85da1/sections-comparison/01-local-sections.png`.
- Browser-rendered final implementation:
  `/Users/kai/.codex/visualizations/2026/07/30/019fb1ac-763e-7a23-8c67-7a2207a85da1/sections-comparison/05-local-sections-final.png`.
- Combined final comparison:
  `/Users/kai/.codex/visualizations/2026/07/30/019fb1ac-763e-7a23-8c67-7a2207a85da1/sections-comparison/06-mobbin-local-final-comparison.png`.
- Viewport and pixels: source and implementation are 642 × 863 CSS pixels and
  642 × 863 image pixels at 1× normalized density.
- State: authenticated Vercel Sites detail, Sections tab, latest version, no
  active filter.

## Findings

No actionable P0, P1, or P2 differences remain in the requested Sections
gallery surface.

- Fonts and typography: Astryx retains its product font and compact control
  hierarchy. Meaningful extracted headings lead each card; section type and
  page name move to secondary copy.
- Spacing and layout rhythm: the duplicate title and explanatory paragraph are
  removed. The type control, search action, and result count share one compact
  row, and the first capture begins immediately below it.
- Colors and visual tokens: controls use the existing Vitrine dark surface,
  neutral border, muted text, and white selected-state tokens.
- Image quality and asset fidelity: imported captures remain authoritative.
  Image and video cards now measure their loaded media and preserve its native
  aspect ratio rather than containing it inside a fixed 16:10 letterbox.
- Copy and content: generic `Feature Section` labels are shortened to `Feature`;
  extracted headings such as `Agentic Infrastructure` are promoted when
  available. OCR text remains excluded.
- The larger Astryx identity/metadata/Visit Site area differs from Mobbin
  intentionally because Sites detail reuses the approved shared Apps/Sites
  detail shell. The comparison judges the Sections surface below the tabs.

The full-view comparison keeps the toolbar, first card, text hierarchy, media
crop, and surrounding shell legible, so a smaller focused crop was not needed.

## Interaction and runtime verification

- Selecting `Hero` from the shared Astryx dropdown reduced the gallery to one
  card and announced `1 of 8 sections`.
- Opening search and entering `footer` reduced the gallery to the Footer card
  and announced `1 of 8 sections`.
- Filtered cards still open the correct original inspector item.
- No runtime errors were captured while opening and closing the filter and
  search controls.
- Focused Sites tests: 45 passed.
- Production build: passed.

## Comparison history

- Pass 1 found a P2 density mismatch from the large `8 sections` heading and
  explanatory copy, a duplicate count in the detail navigation, generic labels,
  and fixed-ratio letterboxing that made the navigation capture mostly empty.
- Fix: replaced the intro with a compact functional toolbar, moved the count
  into that row, added type/search filtering, promoted meaningful headings,
  preserved native image/video ratios, and placed the Hero capture first.
- Post-fix evidence: the final side-by-side shows a Mobbin-like control row and
  a dense Hero capture without letterboxing.

final result: passed

## Latest QA checkpoint

The latest completed build review is **Site section inspector header actions —
2026-07-30** in this file.

final result: passed
