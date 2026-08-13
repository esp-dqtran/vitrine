# Design QA — FigJam Sticky Color Parity

Source visual truth:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/sticky-palette-review/figjam-sticky-options.png`
  — live FigJam Sticky note tool with its color options open.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/sticky-palette-review/vitrines-sticky-options-final.png`
  — live Vitrines canvas with Sticky notes active.
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/sticky-palette-review/comparison-final.png`
  — same-state, side-by-side comparison.
- `http://127.0.0.1:5173/projects/3d48a5c7-20b5-480a-a268-c3de515d8344/canvases/2dd5641d-50be-4c3e-b370-a994ab160d02`
  — current browser-rendered insertion preview, compared side-by-side with the
  live FigJam capture during this QA pass.

Viewport and normalization: both browser captures are 779 × 863 CSS px at 1×
density. The comparison is a direct 1558 × 863 side-by-side composition; no
scaling or density normalization was required.

State: Sticky note is active, the color tray is visible directly above the
bottom toolbelt, and Yellow is selected.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped sticky palette.
- Fonts and typography: the palette has no visible copy, matching FigJam's
  color-only option tray. Vitrines retains its existing placement hint for the
  active tool, rather than adding a second palette label.
- Spacing and layout rhythm: both trays are centered above the bottom toolbar,
  use a compact white floating surface, and maintain a clear gap from the
  persistent toolbelt. The 28px interaction targets retain FigJam's compact
  visual density while remaining easy to select.
- Colors and visual tokens: Vitrines now uses FigJam's exact ten fills: White
  `#ffffff`, Gray `#e6e6e6`, Red `#ffafa3`, Orange `#ffd3a8`, Yellow
  `#ffe299`, Green `#b3efbd`, Teal `#b3f4ef`, Blue `#a8daff`, Violet
  `#d3bdff`, and Pink `#ffa8db`. The inserted rectangle uses the exact selected
  fill for both its surface and edge, so the swatch, tool preview, and note do
  not drift.
- Image quality and asset fidelity: the existing source sticky-note icon is
  retained; the palette uses semantic CSS color controls, not a replacement
  asset or approximate icon.
- Copy and content: accessibility names expose `Sticky options` and `Sticky
  color`, with each color as a radio option; no unnecessary picker copy or
  stack action remains.

## Full-view comparison evidence

`comparison-final.png` compares the live FigJam source and live Vitrines
implementation at the same viewport and active sticky-tool state. A current
779 × 863 browser side-by-side comparison of FigJam's selected Yellow sticky
with the Vitrines insertion preview confirmed the exact `rgb(255, 226, 153)`
surface value. The scoped comparison confirms matching palette order, centered
placement, white floating surface, circular color controls, and selected-color
treatment.

## Focused region comparison evidence

The palette and its immediate toolbar context are fully readable in the
full-view comparison, so an additional crop is not needed.

## Comparison history

1. First comparison found that Vitrines used large rounded-square swatches,
   while the FigJam source uses compact circular color controls.
2. Updated the swatches to circular fills with a violet selected ring and
   recaptured `vitrines-sticky-options-final.png`.
3. A later FigJam inspection found the Vitrines fill values were approximate;
   the Yellow insertion preview was `#fff4a3` instead of FigJam's `#ffe299`.
4. Replaced every sticky token with the inspected FigJam RGB values and
   verified a fresh Yellow insertion preview resolves to
   `rgb(255, 226, 153)` without committing a test note.

## Primary interactions tested

- Open Sticky notes from the Vitrines bottom toolbelt.
- Confirm Yellow is selected by default.
- Select Violet and confirm the radio state and placement hint update.
- Close the picker and reopen it.
- Select Orange then Yellow and open a transient sticky draft; confirm the
  computed preview color is `#ffe299` / `rgb(255, 226, 153)`, then cancel it.

final result: passed

---

# Design QA — Savee-inspired shared discovery search

Source visual truth:

- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/savee-search-idle-919x863.png`
  — live Savee idle search at the requested reference viewport.
- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/savee-search-active-919x863.png`
  — live Savee focused search and suggestion panel.

Implementation evidence:

- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/vitrines-search-idle-919x863-v2.png`
  — Vitrines Apps header with the corrected rolling prompt.
- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/vitrines-search-active-919x863-v2.png`
  — focused Vitrines catalog search after the active-shell correction.
- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/search-active-comparison.png`
  — direct same-viewport active-state comparison.
- `/Users/kai/.codex/visualizations/2026/08/13/019ff92c-330a-7b73-9f5f-be36319bb1c7/vitrines-search-active-390x844.png`
  — responsive active-state verification.

Viewport and normalization: the desktop source and implementation captures are
both `919 × 863` CSS px at 2× device density and were compared without scaling.
The responsive implementation capture is `390 × 844` CSS px. The desktop
side-by-side comparison is `1838 × 863` image px.

State: idle prompt cycling, click-to-open transition, focused query input,
Escape dismissal, and compact responsive layout.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped search
  interaction.
- Fonts and typography: Vitrines intentionally retains Figtree and its existing
  discovery hierarchy. The idle prompt uses the reference's individual-letter
  roll, stagger, masking, and restrained muted tone without changing the
  accessible action name.
- Spacing and layout rhythm: the desktop trigger remains a 360px capsule and
  the active field becomes one clean capsule inside the existing Vitrines
  results browser. Mobile collapses the persistent trigger to its 44px search
  icon and keeps the active dialog inside the viewport with no horizontal
  overflow.
- Colors and visual tokens: the trigger and active search field use the
  reference's near-black capsule treatment while retaining Vitrines surface,
  border, and focus tokens for the richer results browser.
- Image quality and asset fidelity: existing Vitrines application artwork and
  design-system search/close icons are retained. No approximate or custom-drawn
  assets were introduced.
- Copy and content: prompts remain route-specific for Apps, Sites, and Flows;
  the active state preserves the real catalog, platform, category, recent-app,
  and result behaviors instead of substituting a static Savee-style menu.

## Full-view comparison evidence

`search-active-comparison.png` places the live Savee source and live Vitrines
implementation together. The active capsules share the same dark surface,
rounded geometry, muted prompt treatment, and immediate results reveal.
Vitrines intentionally keeps its 816px evidence browser instead of copying
Savee's 450px lightweight suggestion panel because the existing control must
support platform selection and visual catalog results.

## Focused region comparison evidence

The search capsules and their full active surfaces are readable in the
same-viewport comparison, so a separate crop was not required.

## Comparison history

1. The first implementation rendered the animated label at zero width because
   the design-system Button's text wrapper was a shrink-to-content flex item.
2. Made that existing wrapper participate in the button's flex layout and
   recaptured the idle state with a 294px animated-label region.
3. The first active capture showed a nested TextInput ring inside the new outer
   capsule and inherited extra compact-breakpoint padding.
4. Removed the inner field shell border/background, restored the 48px capsule
   rhythm, and recaptured desktop and mobile active states.

## Primary interactions tested

- Observed route-specific prompts cycling every 2.4 seconds with per-letter
  entering and leaving transforms.
- Opened search from the Apps header and confirmed the real query input receives
  focus.
- Dismissed the search with Escape and reopened it.
- Verified desktop `919 × 863` and mobile `390 × 844` layouts with zero
  horizontal overflow.
- Checked browser logs: no errors; one pre-existing Astryx theme performance
  warning remains unrelated to this change.

## Follow-up polish

- [P3] The modal framework's computed entrance duration remains 240ms even
  though the search-specific stylesheet requests the reference's 350ms timing.
  The direction and easing are correct; aligning the shared modal runtime would
  be a broader design-system change.

final result: passed

---

# Design QA — Project card treatment

Source visual truth:

- User-provided browser capture of `http://127.0.0.1:5173/projects`, 919 × 863 CSS px, dark theme, with the `Hi` project tile highlighted for a card-treatment update.

Implementation capture:

- Codex in-app browser, `http://127.0.0.1:5173/projects`, 919 × 863 CSS px, dark theme, captured after the card update in this task.

State and normalization: both captures show the Personal projects page at the same desktop viewport and dark theme. They were compared at 1× without scaling. The blue ring in the source is an annotation marker, not application UI, and is therefore excluded from the comparison.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested card treatment.
- Fonts and typography: the existing Vitrines Figtree hierarchy is retained; title, description, and updated metadata remain legible and naturally grouped.
- Spacing and layout rhythm: the thumbnail is now inset evenly inside a single 18px card surface, followed immediately by the details rather than a disconnected media-and-text stack.
- Colors and visual tokens: the project-specific media keeps its existing dark visual treatment; the outer card uses the existing surface, border, and elevated-shadow language.
- Image quality and asset fidelity: existing project artwork and icon-library assets are retained; no replacement or new approximated asset was introduced.
- Copy and content: the project title, question fallback, and update date remain unchanged.

## Full-view comparison evidence

The supplied 919 × 863 projects capture and the current 919 × 863 browser capture both show the same single `Hi` project. The updated implementation retains its media, identity, metadata, and action controls while giving the whole tile a continuous border, radius, shadow, and hover/focus lift.

## Focused region comparison evidence

The project-card region was reviewed at the same desktop state. The implementation's media inset, 16:9 crop, content padding, and card boundary are visible without truncation or overlap. No additional focused capture was needed because the card is the only populated item and remains readable in the full-view capture.

## Primary interactions checked

- The card retains its `Open Hi` link semantics in the rendered accessibility tree.
- Hover and keyboard focus share the card lift/border treatment in the scoped CSS.
- Browser console: no errors.

## Comparison history

1. The first card pass pinned the content to a fixed-height surface, which created too much empty space between the thumbnail and its details.
2. Removed the fixed-height fill so the media and details form one compact, continuous card.
3. Reloaded and captured the live `/projects` view after the adjustment.

final result: passed
---

# Design QA — FigJam Toolbar, Catalog, and Document Placement

Source visual truth:

- `.codex-artifacts/toolbar-parity-final-audit/04-figjam-launcher-current.png`
  — live FigJam launcher above the bottom toolbelt.
- `.codex-artifacts/toolbar-parity-final-audit/13-figjam-sticky-object-toolbar.png`
  — live FigJam selected Sticky note and contextual toolbar.

Implementation evidence:

- `.codex-artifacts/toolbar-parity-final-audit/07-vitrines-catalog-tabs-fixed.png`
  — Vitrines Catalog with the revised compact search and segmented controls.
- `.codex-artifacts/toolbar-parity-final-audit/18-vitrines-document-edge-safe-final.png`
  — a newly inserted Document with its contextual toolbar safely below the
  floating project header.
- `.codex-artifacts/toolbar-parity-final-audit/14-vitrines-sticky-object-toolbar.png`
  — selected Vitrines Sticky note using the shared object-toolbar shell.
- `.codex-artifacts/toolbar-parity-final-audit/15-sticky-toolbar-side-by-side.jpg`
  and `16-catalog-launcher-side-by-side.jpg` — unscaled, same-viewport source
  and implementation comparisons.

Viewport and normalization: all captures are 1280 × 720 CSS px at 1× density.
The combined comparisons are direct 2560 × 720 compositions with no scaling.

## Findings and corrections

1. The Catalog panel previously overlapped the bottom toolbelt. It now stays
   between the floating header and toolbelt with a 12px bottom gap, matching
   FigJam's detached panel rhythm.
2. Catalog search and tab chrome now use the board's light surface tokens,
   compact 8px/6px radii, muted inactive labels, and a quiet selected segment.
3. Document insertion was being overwritten during Excalidraw's pointer-up
   reconciliation. It now uses the durable placement path shared with Table,
   inserts on the following animation frame, selects the created object, and
   returns to Select.
4. Document placement clamps the object beneath the 60px project header. The
   verified contextual toolbar begins at y=74, leaving a clear 14px gap. A
   second clamp keeps the 760px object inside the horizontal viewport even
   when it is placed near the right canvas edge.
5. The main tool order matches FigJam from Select through Widgets; Vitrines'
   project-specific Document and Catalog tools follow after a divider.
6. The selected Sticky note toolbar matches FigJam's compact black shell,
   circular color control, typography controls, inline actions, and placement
   above the selected object. Additional Vitrines alignment and author controls
   remain visible because they are functional object actions.

## Primary interactions tested

- Activated Document, clicked an empty canvas point, confirmed one document was
  created and selected, opened the Markdown editor, then removed the temporary
  object.
- Searched Catalog for `Artlist`, confirmed three filtered Screen results,
  switched to Flows and back, and placed a full-resolution Screen image.
- Closed Catalog, confirmed the placed Screen inspector, and removed the
  temporary image.
- Activated Sticky notes and then Document; confirmed the Sticky options tray
  closed and only Document remained active.
- Selected an existing Sticky note in both FigJam and Vitrines and reviewed the
  contextual toolbars in one side-by-side image.

No actionable P0, P1, or P2 differences remain in this scoped comparison.

# Design QA — FigJam Section Tool

Source visual truth:

- `/tmp/figjam-section-reference.png` — live FigJam with Section active.

Implementation evidence:

- `/tmp/vitrines-section-drawing-final.png` — Vitrines Canvas with Section
  active.
- `/tmp/vitrines-section-created-final.png` — native Vitrines frame created
  from the tool, before the test frame was deleted.
- `/tmp/section-tool-design-qa-comparison.png` — unscaled side-by-side active
  toolbar comparison.

Viewport and normalization: both source and implementation captures are
1280 × 720 CSS px at 1× density. The comparison is one 2560 × 720 px image,
with no scale, crop, or density conversion.

State: Section is active in the bottom toolbar. Vitrines intentionally keeps
its existing divider before this grouped tool, as requested; FigJam uses no
divider at that point.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped Section tool.
- Fonts and typography: the focused control has no visible copy; its accessible
  name is `Section` and its tooltip includes the FigJam `Shift+S` shortcut.
- Spacing and layout rhythm: it is a 40px Vitrines control on the existing
  compact toolbar rail, separated from the previous tool group by one divider.
- Colors and visual tokens: activation is the same violet `#9747ff` / white
  icon pair used by the surrounding FigJam-inspired controls.
- Image quality and asset fidelity: the exact supplied 24px FigJam Section SVG
  is rendered directly; no replacement icon or hand-drawn approximation was
  introduced.
- Copy and content: clicking Section switches to Excalidraw's native frame
  creation mode. Drawing produces a real, selectable board frame, then returns
  to Select with contextual frame actions.

## Focused comparison evidence

`section-tool-design-qa-comparison.png` was reviewed as one combined image.
It confirms the matching nested-corner Section glyph, black idle ink, violet
active surface, white active ink, and bottom-toolbelt behavior. The overall
board composition is intentionally not treated as a visual mismatch because
this is a scoped tool build on top of Vitrines' existing Canvas.

## Primary interactions tested

- Activate Section from the bottom toolbar and confirm the pressed violet state.
- Drag on the Canvas to create a real native frame, then confirm native
  contextual actions appear after creation.
- Delete the temporary test frame to leave the user canvas unchanged.
- Use the FigJam-aligned `Shift+S` keyboard shortcut path in the implementation.
- Check the browser console: one pre-existing Excalidraw mount warning appeared
  during initial page load; no Section click or frame-creation error occurred.

final result: passed

---

# Design QA — FigJam Shapes and Connectors

- Source visual truth: live FigJam Shapes and connectors toolbar and its More shapes library.
- Implementation: live Vitrines Canvas toolbar at the same compact bottom-toolbelt position.
- States checked: compact shape row, active Bent connector, More shapes open, and a `rounded` search query.

## Fidelity check

- The main toolbar now uses FigJam's 64 × 40 px shape-family affordance, with an attached active state and a three-item collage preview.
- The secondary toolbar uses the inspected 40 px white surface, 13 px radius, compact color combobox, divider, and small selectable tiles.
- Bent, curved, and straight connectors map to Excalidraw's elbow, round, and sharp arrow modes; the endpoint-free connector maps to a line; square, ellipse, diamond, and rounded rectangle map to their corresponding supported primitives.
- More shapes opens a searchable, grouped library following FigJam's two-level interaction. It intentionally lists only Vitrines primitives that can be drawn, instead of rendering inert FigJam-only shapes such as cylinder or mind map.
- Browser verification confirmed the library search reduces the result set to Rounded rectangle and every visible selection controls the active canvas tool.

## Verification

- `node --test --import tsx src/vitrine/ProjectPlayground.test.ts` — 26 passed.
- `npm run build` — passed (existing chunk-size warning only).
- `git diff --check` — passed.

final result: passed

---

# Design QA — FigJam Shapes and Connectors

- Source visual truth: `/tmp/vitrines-shape-toolbar-review/figjam-shapes.png` (live FigJam Shape and connector menu).
- Implementation: `/tmp/vitrines-shape-toolbar-review/vitrines-shapes.png` (Vitrines Canvas Shape and connector menu).
- Side-by-side comparison: `/tmp/vitrines-shape-toolbar-review/shape-toolbar-comparison.png`.
- State: orange selected, Rectangle selected, at 779 × 863 CSS px.

## Comparison history

1. Initial finding [P1]: the Vitrines popup exposed only five loose shape controls, had no shape-color control, and could overlap the Sticky Notes popup.
2. Fix: rebuilt it as a compact white toolbelt row, added a direct color chip with the shared eight-color palette, retained the active shape state, and made opening Shapes close competing transient tool controls.
3. Post-fix: the Shape menu fits above the core toolbelt; Rectangle visibly stays selected; the orange chip and new shapes receive the same stroke color; no Sticky Notes popup remains after the Shapes tool opens.

## Scope and fidelity

- Follow-up visual review: the initial five-primitive row was visibly shorter and used generic glyphs, so it did not match the FigJam source closely enough.
- Current implementation uses extracted FigJam SVG geometry for all twelve visible shortcuts and the source's 40px high, ~550px wide surface, 13px radius, white surface, compact color control, divider, and More shapes button.
- The eight Vitrines primitives still select their matching Excalidraw tool. Triangle, down triangle, cylinder, and mind-map shortcuts truthfully open the searchable More shapes library because those primitives are not yet Canvas drawing tools.
- Typography: tool names remain accessible labels, matching FigJam's icon-first compact control density.
- Color: the tool chip, swatch selection, active glyph, and Excalidraw stroke state use the same exact color value.

## Primary interactions tested

- Opened Shapes and connectors from the live Vitrines canvas.
- Opened Shape color and verified all eight palette choices are present.
- Selected Orange and Rectangle; verified the Rectangle active state and orange current-tool color.
- Opened Sticky Notes, then Shapes; verified Shapes is open and no competing Sticky popup remains.
- Reopened Shapes after the visual rebuild: verified 12 source-geometry glyphs on a 560px toolbar and verified a Triangle shortcut opens the More shapes library.

final result: passed

---

# Design QA — Compact Sticky Note Formatting Toolbar

Source visual truth:

- `/tmp/vitrines-sticky-toolbar-review/04-figjam-selected-sticky.png` — live
  FigJam sticky note selected with its formatting toolbar open.

Implementation evidence:

- `/tmp/vitrines-sticky-toolbar-review/05-vitrines-compact-sticky.png` — live
  Vitrines selected sticky note after the compact-toolbar update.
- `/tmp/vitrines-sticky-toolbar-review/06-compact-comparison.png` — normalized
  full-view FigJam/Vitrines side-by-side comparison.
- `/tmp/vitrines-sticky-toolbar-review/07-focused-toolbar-comparison.png` —
  focused selected-note and toolbar comparison.

Viewport and normalization: both browser captures are 779 × 863 CSS/image px
at 1× density. The full comparison is a direct 1558 × 863 horizontal pair;
the focused comparison uses equal-density crops without scaling.

State: a sticky note is selected on a light FigJam-style board. The main
toolbar is closed; the Vitrines alignment menu and More options menu were
separately opened and confirmed in the same state.

## Findings

- No actionable P0, P1, or P2 differences remain for the selected sticky
  toolbar. The former right-edge overflow is resolved.
- Fonts and typography: compact label controls retain the existing Figtree
  formatting hierarchy, while the selected values remain legible and do not
  truncate inside the 779px viewport.
- Spacing and layout rhythm: the toolbar now has a 42px compact floating
  rhythm, stays clear of the viewport edge, and keeps the selected-note anchor
  relationship from the FigJam reference.
- Colors and visual tokens: both tools use the dark floating-toolbar surface
  against the light dotted board. The selected sticky colour remains visible
  as the colour control, without changing the actual note fill.
- Image quality and asset fidelity: existing Vitrines and component-library
  icons are retained; no custom-drawn replacement icon or raster asset was
  introduced.
- Copy and content: Font, size, alignment, link, colour, and More options are
  mapped to truthful Vitrines sticky-note actions. Secondary collaboration and
  lock controls are available from More options rather than being clipped.

## Full-view comparison evidence

`06-compact-comparison.png` shows the source and implementation side by side
at the same viewport. The Vitrines toolbar is intentionally shorter because
it groups collaboration controls into More options, while preserving the
FigJam reference's compact dark-surface treatment and all persistent
formatting affordances.

## Focused region comparison evidence

`07-focused-toolbar-comparison.png` makes the selected sticky and its toolbar
legible at equal density. It confirms the Vitrines toolbar stays entirely
inside the viewport with stable padding at the left edge.

## Comparison history

1. Initial selected-sticky capture found a P1: the Vitrines toolbar expanded
   past the right viewport edge because every collaboration action and three
   independent alignment buttons were persistent.
2. Replaced the alignment button group with a selected-value dropdown, removed
   redundant sticky identity chrome, and moved author, tag, reaction, comment,
   and lock actions into More options.
3. Replaced the unbounded screen coordinate with a CSS-clamped toolbar anchor,
   then recaptured the same 779 × 863 selected-note state.
4. Post-fix browser verification confirmed the main toolbar, the alignment
   dropdown, and the More options dialog are all reachable without overflow.

## Primary interactions tested

- Select a sticky note on the live Vitrines canvas.
- Open and close Text alignment; confirm Left, Centre, and Right choices are
  exposed and the current choice is selected.
- Open More sticky note options; confirm author, tag, reaction, comment, and
  lock controls remain reachable.
- Run `node --test --import tsx src/vitrine/ProjectPlayground.test.ts`,
  `npm run build`, and `git diff --check`.

final result: passed

---

# Design QA — Save to Project & Evidence Handoff

Source visual truth:

- `http://127.0.0.1:5173/apps/aboard-ea683077-aadb-47c5-a771-d21fd9676510/screens?platform=web&version=1`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/source-app-detail.png`

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-storybook.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-saved.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-mobile.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/comparison-app-detail-vs-story.png`

Viewport and normalization: the production source and desktop interaction captures use 1280 × 720 CSS px at 1× density; the full Storybook implementation is 1280 × 2125 px; the compact implementation is 579 × 863 CSS px. The combined comparison uses equal 1280 × 720 crops, yielding a 2560 × 720 side-by-side image without density scaling.

State: dark-mode Aboard App Detail source and the Save-to-Project visual review. The desktop interaction capture shows the successful handoff result; the compact capture shows the create-project bottom sheet.

## Findings

- No actionable P0, P1, or P2 findings remain for the visual-review prototype.
- Fonts and typography: the review inherits the current Vitrines Figtree product tokens, 16px control text, and existing title/body hierarchy. Labels remain legible at desktop and compact widths.
- Spacing and layout rhythm: desktop uses the production page gutter and surface rhythm; the 560px dialog remains focused. At 579px, the sheet measures 563px wide with 8px side gutters and no horizontal overflow.
- Colors and visual tokens: surfaces, borders, primary/secondary actions, success, and error states use the existing Vitrines semantic tokens.
- Image quality and asset fidelity: the Aboard screen loads at its full 1920 × 1199 source dimensions with `object-fit: contain`; the Aboard icon loads at 512 × 512. No placeholder or cropped substitute is used.
- Copy and content: destination, duplicate, success, error, retry, and View project labels describe a single-item save flow and avoid the rejected multi-selection model.
- Interaction states: Save opens the project chooser; Save to project produces the successful handoff; Create new project opens the form; Try again returns to the chooser. The duplicate state is harmless and disables the repeated save.

## Full-view comparison evidence

`comparison-app-detail-vs-story.png` places the production App Detail source and the rendered Storybook entry point together at equal 1280 × 720 crops. The implementation preserves the source evidence treatment, dark surface balance, button language, typography family, and card rhythm while adding the destination workflow requested for review.

## Focused region comparison evidence

- Desktop result dialog: `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-saved.png` confirms the centered success state and reachable Done/View project actions.
- Compact create sheet: `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-mobile.png` confirms one-column fields, stacked full-width actions, 8px viewport gutters, and no horizontal overflow.
- A separate focused crop was not needed for the evidence asset because browser geometry and natural image dimensions confirmed the full source raster is contained without cropping.

## Comparison history

1. Captured the live App Detail source and the first Storybook implementation at 1280 × 720.
2. Verified the source and implementation evidence images load at native dimensions and use the same product typography, surface, and action tokens.
3. Exercised Save, destination confirmation, successful handoff, and create-project states.
4. Re-captured the compact create state at 579 × 863 and confirmed the 563px bottom sheet remains within the viewport with no horizontal overflow.

## Primary interactions tested

- Open Save from the production-style evidence card.
- Choose `Onboarding audit` and confirm Save to project.
- Reach the Saved to Onboarding audit result with Done and View project.
- Open Create new project and render the project-name/description form.
- Confirm compact bottom-sheet behavior and stacked actions.
- Focused Storybook tests pass; the Vite production build passes.

final result: passed

---

# Design QA — FigJam-Inspired Right Toolbar

Source visual truth:

- User-provided FigJam `T · 03:00 · Share` toolbar capture at 807 × 863.

Implementation evidence:

- Live Vitrines canvas capture at 1280 × 720 during this review, with the toolbar in its idle state.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped right toolbar.
- Structure and rhythm: Vitrines uses a compact white 48px floating surface, a 36px avatar/menu region, and a trailing primary Share action.
- Product mapping: the unrelated FigJam timer and workspace controls are intentionally omitted, keeping this bar specific to Vitrines collaboration and access.
- Actions: Share remains the connected project-access dialog. The avatar control refreshes collaborator presence.
- Colors: the Share control uses FigJam's violet hierarchy while keeping the semantic Vitrines project-access action.

## Primary interactions tested

- Share opens the project access dialog and Escape closes it.
- The collaboration control remains present and labelled in the rendered canvas.
- Focused canvas test suite and production build pass.

final result: passed

---

# Design QA — FigJam-Inspired Canvas Header

Source visual truth:

- `/tmp/figjam-top-left-toolbar-reference.png` — live FigJam canvas capture.

Implementation evidence:

- `/tmp/vitrines-top-left-toolbar-sized.png` — live Vitrines canvas capture.
- `/tmp/vitrines-figjam-top-left-final-comparison.png` — equal-size side-by-side comparison.

Viewport and normalization: both captures are 807 × 863 CSS/image pixels at 1× density. The comparison is a 1614 × 863 horizontal pair; no scaling or density normalization was applied.

State: light canvas, idle toolbar, with the top-left board control closed.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped top-left header.
- Fonts and typography: Vitrines retains its Figtree product font, while matching the compact 14px title hierarchy and small purple metadata chip from the FigJam reference.
- Spacing and layout rhythm: the control uses the reference's 48px segmented rhythm, 12px outer inset, thin separators, rounded white surface, and a dedicated trailing pages segment.
- Colors and visual tokens: the header is intentionally fixed to a near-white surface with dark ink and a restrained purple `Canvas` chip, so it remains legible when the surrounding Vitrines shell is dark.
- Image quality and asset fidelity: the existing Vitrines mark remains vector-rendered; standard icons use the existing component icon set.
- Copy and content: FigJam's `Untitled` and `Free` are mapped to the real project title and the truthful `Canvas` file-kind chip rather than presenting an unverified plan.

## Full-view comparison evidence

`/tmp/vitrines-figjam-top-left-final-comparison.png` places the source and the live Vitrines canvas side by side at equal dimensions. The remaining right-side collaboration control and board contents are outside this top-left-only change.

## Focused region comparison evidence

The top-left controls match the source structure: brand/dropdown segment, board title, compact metadata chip, status indicator, separator, and pages control. A separate crop was unnecessary because these details are legible in the normalized full-view pair.

## Comparison history

1. Initial live pass found that the title segment was hidden by a legacy direct-child selector.
2. Fix: scoped that selector to only the hidden descriptor, then matched the control to the reference's 48px rhythm.
3. A hot reload exposed an Excalidraw initialization race that could restore a dark board. The API handoff now reapplies the forced light scene configuration.
4. Post-fix capture confirms the white board, rendered top-left toolbar, and the existing canvas controls remain visible.

## Primary interactions tested

- The brand segment retains its Projects-home route action.
- The board/title and pages affordances expose the canvas-pages action and its Project home route in the component contract.
- Focused canvas test suite and production build pass.

final result: passed

---

# Design QA — FigJam Board Background

- Source visual truth: `/tmp/figjam-background-reference.png` — live FigJam board at `https://www.figma.com/board/qcrsrmVpogqrJrTeySwXOa/Untitled`.
- Implementation evidence: `/tmp/vitrines-figjam-background-refined.png`.
- Full-view comparison: `/tmp/figjam-background-comparison-refined.png`.
- Viewport and density: both captures are 1280 × 720 CSS/image pixels at 1×; no density normalization was required.
- State: idle canvas at 100% zoom with an empty visible region.

## Comparison history

1. Initial finding [P1]: Vitrines used a dark square grid, materially different from FigJam's light dotted board.
2. Fix: set the Excalidraw scene to transparent/light, disabled the native square grid, and rendered a 16px dotted surface beneath the drawing layer.
3. Post-fix evidence: both surfaces use a `#f5f5f5` base with the same 16px dot cadence; the implementation retains `filter: none` so drawing colors are unchanged.

## Fidelity check

- Typography and copy: outside the canvas-background comparison.
- Spacing and layout rhythm: the repeating dot cadence and full-viewport surface match the reference.
- Colors and visual tokens: the base surface is `rgb(245, 245, 245)`; dots are neutral gray and stay behind drawings.
- Image quality and asset fidelity: no raster or substitute asset was introduced; the board is rendered by the canvas surface.
- Focused region: not needed because the repeating pattern is fully legible in the full-view comparison.

final result: passed

---

# Design QA — Projects Component System 02–03

## Cards and lists

- The Project Cards & Lists Storybook review is approved.
- The review renders the exported production `ProjectCard` component rather than a parallel mock.
- Default, hover/focus, action-menu, and responsive list behavior preserve the production card footprint without layout shift.
- The action menu was opened in the in-app browser and exposes Share, Rename, Duplicate, and Delete using the shared menu contract.

## Forms and dialogs

- The Project Forms & Dialogs review renders the exported production `CreateProjectDialog`, `RenameProjectDialog`, and `DeleteProjectDialog` components.
- Create and rename retain the approved white primary action with black text; destructive red is reserved for final deletion confirmation.
- Labels, inputs, team selection, modal surface, spacing, and action hierarchy match the production Projects implementation.
- Create, rename, and delete states were opened and visually inspected at the current Storybook viewport with no horizontal overflow.

## Verification

- Six focused Projects component-review tests pass.
- The static Storybook build succeeds.
- The production Vite build succeeds.
- A fresh unauthenticated production `/projects` tab remains sign-in gated, so this checkpoint does not claim a new authenticated production-browser pass.

final result: passed

---

# Design QA — Save to Project Production Screen Card

Source visual truth: the production `ScreenGridCard` rendered in the Media & Evidence Storybook review at 697 × 863 CSS px in dark mode.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/source-production-screen-card-current.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-production-screen-card-current.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/implementation-save-modal-current.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/production-card-comparison.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/save-to-project-review/save-workflow-comparison.png`

Viewport and state: source and implementation were captured at 697 × 863 CSS/image pixels. The focused region covers the production Screen card with its action overlay visible. The workflow comparison places that card beside the open Save-to-Project modal.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Component fidelity: the Storybook entry point now renders the same production `ScreenGridCard` used by App Detail instead of a handcrafted approximation.
- Media and layout: the full source image uses the production contain-fit behavior, natural web aspect ratio, radius, elevation, and action overlay without cropping or layout shift.
- Actions: hover or keyboard focus reveals the white Save action and dark Copy image action. The direct Save workflow preserves the production trailing choice indicator and opens the Save-to-Project modal.
- Typography, color, and spacing: the card inherits the shared Figtree roles, product action colors, production padding, and action sizing from the real component.
- Copy and context: Aboard, Onboarding, Web, and the screen title remain available to the workflow without adding custom card copy.
- Workflow boundary: this review covers one Screen and one destination. Multi-select remains a separate bulk-selection state with its centered action control and is not substituted for the single-item Save modal.

## Full-view comparison evidence

`production-card-comparison.png` places the production gallery source and the Save-to-Project story in one input. The page composition differs by story, but the evidence fit, card surface, selected/action overlay, button treatment, and image quality resolve through the same component.

## Focused-region comparison evidence

The live browser check focused the production Screen card, confirmed the action overlay opacity, and exercised its visible Save action. `save-workflow-comparison.png` shows the unchanged card geometry before the modal and the modal state after activation.

## Comparison history

1. Initial P1: the workflow story used a bespoke evidence card that did not match App Detail.
2. Fix: replaced the bespoke card with the production `ScreenGridCard` and preserved its shared styling and media behavior.
3. Interaction fix: provided a single-item `onSave` handoff so the card Save action opens the existing Save-to-Project modal.
4. Post-fix: side-by-side visual review, live browser interaction, six focused tests, production build, and `git diff --check` pass.

## Primary interactions tested

- Keyboard focus reveals the production card action overlay.
- Clicking the visible Screen card Save action opens the dialog (`open: true`, visible flex surface).
- The dialog exposes project selection, create-project, duplicate, success, and retry states without changing the underlying card layout.
- Multi-select behavior remains outside this single-item workflow.

final result: passed

---

# Design QA — Search, Filters & Results

Source visual truth:

- `http://127.0.0.1:6008/iframe.html?id=patterns-search-filters-and-results--visual-review&viewMode=story&globals=theme%3Adark`
- `/tmp/vitrines-search-filters-story.png`

Implementation evidence:

- `/tmp/vitrines-search-filters-production-success.png`
- `/tmp/vitrines-search-filters-mobile.png`

Viewport and normalization: desktop story and production use 1440 × 1024 CSS px; mobile production uses 579 × 863 CSS px. All captures are CSS-pixel normalized at 1× density.

State: dark-mode Apps discovery with latest results; mobile search open with a typed query; Sites and Flows controls reviewed at the mobile breakpoint.

## Findings

- No actionable P0, P1, or P2 findings remain for the approved Search, Filters & Results pattern.
- Hierarchy: the shared search entry, filter toolbar, result count, and result area follow the approved Storybook composition across Apps, Sites, and Flows.
- Toolbar: desktop filters remain aligned on one line; mobile collapses the detailed controls into the shared `Filters` action while preserving platform and sort controls.
- Result states: loading, empty, error, retry, and successful results preserve the result footprint and use the same responsive shell.
- Media: successful production cards load their source previews without substituting the unavailable-evidence state.
- Content: route-specific labels, result counts, and sort choices remain intact for Apps, Sites, and Flows.
- Responsiveness: the mobile product header remains on one line, and search opens from the compact trigger without clipping or horizontal overflow.
- Runtime: a transient catalog 500 rendered the standardized error state; Retry recovered 24 cards. The browser console contains no errors.

## Full-view comparison evidence

The approved Storybook pattern and the production Apps route were captured in the same browser session at 1440 × 1024. Search placement, toolbar alignment, result count, card hierarchy, and responsive gutters match the shared production composition.

## Focused region comparison evidence

- Desktop: product header, taxonomy, filter toolbar, result count, and loaded card grid.
- Mobile: single-line product header, compact search trigger, merged Filters action, platform control, and sort control.

## Comparison history

1. Approved Storybook Search, Filters & Results visual review.
2. Confirmed the shared production components already compose Apps, Sites, and Flows through the same discovery layout.
3. Verified the transient error and Retry recovery path without changing layout.
4. Re-captured the successful production result state after Retry.

## Primary interactions tested

- Mobile search opens and accepts a query.
- Retry recovers a transient catalog failure and renders 24 Apps cards.
- Sites and Flows expose the same responsive control structure with their route-specific labels.
- Focused component tests, pattern tests, responsive tests, and the production build pass.

final result: passed

---

# Design QA — Focused Project Document Shell

Source visual truth:

- `/Users/kai/works/eastplayers/Astryx/.codex-audits/notion-structure-2026-08-03/01-document-shell-desktop.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/notion-structure-2026-08-03/02-app-detail-shell.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/notion-structure-2026-08-03/03-app-detail-mobile.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/notion-structure-2026-08-03/04-document-shell-mobile.jpg`

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-focused-shell-2026-08-03/01-focused-document-desktop.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-focused-shell-2026-08-03/02-focused-document-mobile.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-focused-shell-2026-08-03/03-focused-document-mobile-menu.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-focused-shell-2026-08-03/04-desktop-comparison.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-focused-shell-2026-08-03/05-mobile-comparison.jpg`

Viewport and normalization: desktop source and implementation use 1280 × 720 CSS px; mobile source and implementation use 390 × 844 CSS px. All screenshots are CSS-pixel normalized at 1× density.

State: authenticated dark-mode `Discovery notes` document. The base captures have Share, More, and Page discussion closed. The mobile-menu capture shows the responsive overflow menu open.

## Findings

- No actionable P0, P1, or P2 findings remain for the approved focused-shell change.
- Hierarchy: the document route now starts with its 46px document bar. The duplicate Projects/search/account discovery header is absent, matching the App detail page's single-shell hierarchy while preserving the document-specific canvas.
- Desktop actions: breadcrumb, connection status, collaborator, Favorite, Share, and More remain in one compact bar. Copy link is available from Share rather than duplicated in the bar.
- Mobile actions: the bar reduces to back, truncated document title, Share, and More. Favorite and Copy link move into More, and the global header is absent.
- Page canvas: the 72px page icon remains above the persistent `Change icon` and `Add comment` controls. Their label size is 13px, and the editor surface remains transparent over the page background.
- Responsiveness: measured document width is 760px in Standard mode and 1208px in Full width mode at 1280px. The 390px view has matching 390px client and scroll widths, so there is no horizontal overflow.
- Accessibility: connection status is exposed as a polite live status. The discussion error is scoped to the Page discussion panel with `role="alert"` and a Retry action rather than becoming a page-wide banner.
- Runtime: the browser console contains no errors. Realtime collaboration remains visibly `Offline` because the local collaboration service is blocked by a pre-existing pending database migration; the document UI and API-backed discussion still load.

## Full-view comparison evidence

The desktop comparison places the previous double-header document, the App detail hierarchy reference, and the focused implementation in one 1:1 comparison. The implementation removes the redundant global chrome and keeps the content anchored to the same document width and dark surface.

The mobile comparison places the previous double-header document, App detail mobile hierarchy, and focused implementation together. The focused build recovers substantial vertical space and preserves a clear back/title/action relationship without clipping or overflow.

## Comparison history

1. Previous document shell: global Projects discovery header plus a second document action bar created competing navigation levels on desktop and mobile.
2. Focused-shell implementation: document routes opt out of the global discovery header, and document actions are consolidated into one responsive bar.
3. Interaction refinement: desktop keeps Favorite visible; mobile moves Favorite and Copy link into More. Discussion failures are isolated inside the discussion panel.
4. Post-fix evidence: matched desktop and mobile captures, DOM snapshots, geometry checks, and console inspection confirm the approved hierarchy and responsive behavior.

## Primary interactions tested

- Share opens the existing share dialog with Manage access and Copy link.
- Desktop More contains only Page width controls.
- Mobile More contains Add to favorites, Copy link, Standard, and Full width.
- Standard and Full width switch between measured 760px and 1208px document canvases at desktop width.
- Add comment opens the Page discussion panel without creating a page-wide error surface.
- Focused Project Document and App boundary tests pass.
- Production build succeeds.
- Final browser console has no errors.

final result: passed

---

# Design QA — Apps Discovery Figtree Restoration

Source visual truth: the user's annotated Apps discovery taxonomy, backed by the pre-standardization declarations in `git show HEAD:src/vitrine/referenceDiscovery.css`. The pre-restoration rendered evidence is `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/apps-dark.png`.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/apps-discovery-figtree/implementation-1280x720.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/apps-discovery-figtree/before-vs-restored-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/apps-discovery-figtree/focused-before-vs-restored.png`

Viewport and normalization: source and implementation captures are 1280 × 720 image pixels at a 1280 × 720 CSS viewport with device scale factor 1. The full comparison appends the equal-size captures into one 2560 × 720 input. The focused comparison uses equal 1280 × 300 crops of the taxonomy region. The older full-page source was captured while results were loading, so only the unchanged header, taxonomy, and toolbar are compared; result-card state is intentionally excluded from fidelity judgment.

State: authenticated dark-mode Apps discovery with no active taxonomy filter for visual comparison. The AI category was then selected separately for interaction verification.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the taxonomy resolves to the bundled Figtree family. Section headings are 14px/500 with normal line height and tracking; filter choices are 24px/600 with 32px line height and -0.025em tracking. The rest of the Apps screen remains on the shared Vitrines typography contract.
- Spacing and layout rhythm: the original four-column desktop taxonomy, 48px inter-column gap, 29px top padding, and 48px bottom padding are preserved. The restored type does not produce horizontal overflow at 1280px.
- Colors and visual tokens: the restoration retains the current foundation text, page, surface, and interaction colors; it changes no color token.
- Image quality and asset fidelity: existing app marks, screenshots, cards, and icons remain unchanged. No new visual asset or placeholder was introduced.
- Copy and content: taxonomy headings and choices remain exactly Categories, Screens, UI Elements, Flows, and their existing options.
- Scope: Figtree is deliberately limited to `.reference-discovery__taxonomy`; navigation, toolbar, result cards, App detail, and all other screens continue using the standard product family.

## Full-view comparison evidence

The combined before-versus-restored input shows the previously flattened small taxonomy on the left and the restored original hierarchy on the right. Header geometry, toolbar position, color system, and content remain stable while the taxonomy regains its intended visual weight.

## Focused-region comparison evidence

The focused 2560 × 300 comparison makes the restored Figtree family, lighter headings, larger choices, and compact 32px rows readable at native scale. Browser computed styles confirm the exact source values and confirm that the Figtree 600 face is loaded.

## Comparison history

1. Earlier typography rollout: the global semantic layer overrode the Apps taxonomy with 15px/700 headings and 14px/600 choices in the native system stack.
2. First restoration pass: Figtree was loaded and taxonomy declarations were restored, but computed-style verification found that the later global typography selector still won.
3. Boundary fix: the taxonomy was explicitly excluded from the global H2 and button mappings, preserving the exception without weakening typography coverage elsewhere.
4. Post-fix evidence: computed styles resolve to Figtree 14px/500 headings and Figtree 24px/600 choices; visual comparisons show the intended hierarchy; focused tests, production build, and Storybook build pass.

## Primary interactions tested

- Selecting AI sets `aria-pressed="true"` and updates the URL to `filter=categories.AI`.
- The restored taxonomy reports no horizontal overflow.
- A clean browser load reports no console errors; the existing runtime-theme performance warning remains unrelated.
- Fourteen focused foundation tests pass.
- Production and Storybook builds succeed, including bundled Figtree 500 and 600 font assets.

final result: passed

---

# Design QA — Vitrines Typography Foundation

Source visual truth: `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/source-app-detail-dark.png`, captured from the authenticated dark-mode Aboard App detail before the typography bridge.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/implementation-app-detail-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/app-detail-comparison.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/storybook-system-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/storybook-system-light.png`

Viewport and normalization: the matched App detail source and implementation use 1280 × 720 CSS px. Their combined comparison uses the identical 1280 × 370 top region at 1:1 scale. The Storybook foundation was also checked in a 732 CSS px responsive browser area in both themes; the full-page PNGs retain the browser's device-pixel density.

State: authenticated Aboard App detail with Screens selected, plus the Typography/System Storybook reference in dark and light modes.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Source fidelity: the App detail display, lead, metadata, tabs, actions, and supporting count preserve the measured source hierarchy. Computed values remain 38px/600/42.56px for the display title, 21.76px/520/27.2px for the responsive lead, 16px/400/24px for metadata labels, 17px/600/24px for emphasized metadata, 16px/500/24px for tabs, and 12px/400/15px for the screen count.
- Font truth: the prior Figtree declaration did not load a Figtree asset and rendered through the system fallback. The foundation now names the actual `-apple-system`, Segoe UI, Roboto, Helvetica, Arial stack directly and reserves the system monospace stack for technical values.
- Semantic hierarchy: twelve roles cover display, lead, title, heading, subheading, body-large, body, label, detail, supporting, micro, and code. The shared component tokens resolve through the same roles instead of creating a second scale.
- Responsive behavior: the Storybook specimen has matching client and scroll widths at 732 CSS px in both themes. The headline now wraps at a readable 18ch measure; no card, type specimen, or family panel creates horizontal overflow.
- Theme behavior: the light specimen resolves to `rgb(241, 244, 247)` and the dark specimen resolves to `rgb(17, 17, 18)`. Type hierarchy, contrast, and density remain consistent across both modes.
- Screen coverage: the root Vitrines page shell establishes the body family, size, weight, and leading. Discovery, App detail, Flow preview, Storybook, and canvas UI fallbacks inherit the same family. A guardrail fails if screen CSS restores the phantom Figtree declaration.
- Domain boundary: imported reference typography and data-canvas label measurements remain evidence-specific implementation details rather than expanding the public Vitrines scale.

## Full-view comparison evidence

The combined App detail image places the captured source on the left and the implementation on the right. At identical scale, the Aboard title, description, four metadata groups, primary and secondary actions, navigation tabs, and count align without a visible typography or layout shift.

The Storybook dark and light captures show the full twelve-role system in one responsive reference: family policy first, live specimens second, and usage guidance with exact size/leading/weight metadata for each role.

## Comparison history

1. Initial state: screen CSS referred to Figtree without bundling or loading it, while product components mixed that phantom declaration with the core system stack and page-specific sizes.
2. Measurement: the App detail source was captured and its rendered family, size, weight, leading, and tracking were recorded before changes.
3. Foundation bridge: the actual system stack and twelve semantic roles became the product-owned contract; core Heading and Text roles now resolve through it.
4. Screen migration: App detail source styles, the global page shell, discovery, Flow preview, canvas fallbacks, and Storybook moved onto the shared family and roles.
5. Post-fix evidence: the matched App detail comparison, responsive light/dark Storybook captures, computed-style checks, focused tests, Storybook build, and production build confirm the result.

## Primary interactions tested

- The App detail loads its Screens gallery while retaining the measured title, description, metadata, action, tab, and count styles.
- Storybook renders the complete typography scale in light and dark theme globals.
- App detail and the responsive Storybook specimen have no horizontal overflow.
- The 15 focused foundation tests and 26 Apps discovery tests pass.
- Storybook and the production Vite build succeed.

final result: passed

---

# Design QA — Project Document Controls Below Page Icon

Source visual truth: `browser:/projects/3d48a5c7-20b5-480a-a268-c3de515d8344/documents/6#comment-change-icon-and-add-comment-below-icon`, using the authenticated dark-mode document screenshot and the user's explicit placement annotation from the current conversation.

Implementation screenshot: `/Users/kai/works/eastplayers/Astryx/.codex-audits/project-document-controls-below-icon-893x855.png`

Viewport and normalization: source and implementation use 893 × 855 CSS px. The implementation capture is 893 × 855 pixels at CSS-pixel-normalized density; no scaling was applied.

State: authenticated dark-mode `Discovery notes` document with the icon menu and comment discussion closed.

## Findings

- No actionable P0, P1, or P2 findings remain for the requested placement change.
- Spacing and layout: the 72 × 72px page icon is first in the document article, followed by the 28px control row and then the document title. Browser geometry confirms the control row begins 10px below the icon and ends 4px above the title.
- Visibility and affordance: `Change icon` and `Add comment` are always visible beneath the page icon rather than depending on page hover.
- Typography and copy: existing control labels, title styling, weights, wrapping, and editor typography are unchanged.
- Colors and tokens: controls retain the existing muted text and hover tokens. The editor and ProseMirror surfaces remain transparent over the `rgb(25, 26, 29)` document background.
- Icons and image quality: the existing Vitrines icon component is retained at 48 × 48px; no generated, placeholder, CSS-drawn, or replacement imagery was introduced.
- Accessibility: both controls remain semantic buttons with their existing accessible names, expanded states, and keyboard behavior.
- Responsiveness: the 893 × 855 viewport has no horizontal overflow, and the existing narrow-screen control visibility remains intact.

## Full-view comparison evidence

The matched implementation capture shows the requested order directly: page icon, `Change icon` and `Add comment`, document title, then the seamless editor surface. The surrounding header, breadcrumb, title, and editor layout remain unchanged from the source state.

## Focused-region comparison evidence

No separate crop was needed because the affected icon-to-title region is large and readable at 1:1 scale in the 893 × 855 full-view capture. Browser geometry additionally confirms the DOM and visual ordering.

## Comparison history

1. Earlier state: the control row appeared before the page icon and was hidden unless the page was hovered.
2. Fix: moved the control row after the page icon in `ProjectDocumentPage` and made the row persistently visible.
3. Post-fix evidence: the matched screenshot and browser measurements confirm the controls are below the icon, above the title, visible, and free of overflow.

## Primary interactions tested

- `Change icon` opens the existing Page icon menu and closes without changing document data.
- `Add comment` opens the existing Page discussion panel.
- The final browser console has no errors.
- Focused Project Document test and production build pass.

final result: passed

---

# Design QA — Collections In Personal Workspace Navigation

Source visual truth: `browser:/projects#comment-add-collections-to-workspace-navigation`, using the user's authenticated dark-mode Projects screenshot at 1010 × 855 and the explicit annotation to add Collections beside Projects.

Implementation screenshots: `browser:http://127.0.0.1:5173/projects#collections-rail-1010x855` and `browser:http://127.0.0.1:5173/collections#collections-workspace-1010x855`.

Viewport and normalization: desktop source and implementation use 1010 × 855 CSS px and 1010 × 855 screenshot pixels. The responsive implementation was additionally checked at 390 × 844 CSS px. Captures were CSS-pixel normalized; no scaling or density conversion was applied.

State: authenticated dark-mode Personal workspace. Projects contains one existing project; Collections is in its empty state because the current account has no saved collection yet.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the existing Assistant font family, heading hierarchy, 12px rail labels, input copy, and empty-state typography are preserved from the Projects workspace.
- Spacing and layout rhythm: Collections occupies the next Personal navigation slot beneath Projects, before the library divider. The dedicated page reuses the existing 80px rail, 64px context header, content inset, radii, and empty-state spacing.
- Colors and visual tokens: the page uses the existing workspace surface, muted background, border, focus, and text tokens. The active Collections state matches the active Projects treatment.
- Image quality and assets: the existing Vitrines favicon and Storybook bookmark, folder, grid, globe, help, notification, and settings icons are retained. No placeholder raster, custom SVG, CSS drawing, or generated asset was introduced.
- Copy and content: the page explicitly describes Collections as a personal place for saved Screens and Flows. Empty-state and creation labels are concise and consistent with Projects.
- Responsiveness: the desktop rail is present at 1010px. At 390px it becomes the existing slide-in Personal menu, where Projects, Collections, Apps, Sites, and Settings remain accessible with Collections visibly selected.
- Accessibility: the rail remains labeled `Workspace navigation`; Collections receives `aria-current="page"` on its page. The responsive drawer exposes a named Personal navigation landmark and semantic buttons.

## Full-view comparison evidence

The 1010 × 855 Projects capture preserves the source composition and adds one bookmark-labeled Collections destination directly below Projects. The matching Collections capture keeps the same rail, top header, horizontal alignment, dark palette, and primary-action treatment while moving collection content into the dedicated main area.

## Focused-region comparison evidence

No separate crop was needed because the complete 80px rail and its labels remain readable at 1:1 in the 1010 × 855 full-view capture. A DOM check independently confirmed the ordered rail labels: Personal, Projects, Collections, Apps, Sites, Settings.

## Comparison history

1. Initial implementation: the 1010px Collections header included a third account action that clipped at the right viewport edge, a P2 persistent-control overflow issue.
2. Fix: removed the duplicate account action from this header because Settings remains permanently available in the workspace rail. Replaced the initial stacked rail glyph with the clearer existing bookmark icon.
3. Post-fix evidence: the revised 1010 × 855 capture shows Help and Notifications fully inside the header, with no persistent control clipping. The 390 × 844 capture shows the complete responsive Personal menu without horizontal overflow.

## Primary interactions tested

- Projects rail exposes Collections in the intended order.
- `/collections` loads as a first-class authenticated route instead of opening the former right-side drawer.
- The mobile Personal menu opens and shows Projects, Collections, Apps, Sites, and Settings.
- The Collections empty state and New collection affordances render at desktop and mobile widths.
- Browser console contains no errors on the final Collections route.
- Focused route and route-access tests pass, and the production build succeeds.

final result: passed

---

# Design QA — App Screen Detail Typography Standard

Source visual truth: the authenticated Aboard App Screen detail dialog opened from the Screens gallery at `http://127.0.0.1:5173/apps/aboard-ea683077-aadb-47c5-a771-d21fd9676510` in dark mode.

Source and implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/screen-detail-standard/source-default-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/screen-detail-standard/source-info-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/screen-detail-standard/implementation-screen-detail-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/screen-detail-standard/implementation-system-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/screen-detail-standard/source-vs-implementation-dark.png`

Viewport and normalization: the source dialog, post-token dialog, and Storybook implementation were measured at 732 × 855 CSS px. The combined source-versus-system evidence keeps both sides at 732px width and crops only the long Storybook page below the first 855px for a single comparison input.

State: authenticated dark-mode Aboard screen 1 of 624, with the Screen information panel open, plus the Typography/System Storybook reference.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Source correction: this section supersedes the earlier App-overview typography QA. The App Screen detail dialog is now the sole product typography source.
- Exact role fidelity: Title resolves to 18px/600/26px at this viewport; Action to 16px/600/22px with 0.2px tracking; Heading to 15px/700/22.5px; Body to 14px/400/18.2px; Label to 14px/600/20px with 0.2px tracking; Detail to 13px/400/18.85px.
- Contract size: nine semantic roles plus the system UI and monospace families make an eleven-token public typography contract. Display, lead, and large overview copy are explicitly presentation-layer decisions rather than product roles.
- Source integration: the App Screen detail app identity, footer actions, metadata, More info control, information heading, information detail, and optional screen context all consume semantic foundation roles instead of repeating raw font measurements.
- Responsive behavior: the App Screen detail and Storybook implementation both report matching 732px client and scroll widths, with no horizontal overflow.
- Font truth: product roles use the native system UI stack and code remains on the system monospace stack. The later Apps discovery QA documents the intentionally narrow Figtree taxonomy exception.

## Full-view comparison evidence

The combined evidence places the live App Screen detail source on the left and the Storybook system on the right. The Aboard identity maps to Title, Save and Copy image map to Action, More info maps to Label, Web maps to Body, and the open information card maps Aboard screen to Heading plus Web to Detail.

## Comparison history

1. Prior foundation: twelve roles were derived from the App overview, which incorrectly promoted its 32–38px display and 18–24px lead styles into everyday product typography.
2. Correct source measurement: the actual App Screen detail dialog was captured in default and information-open states, then measured before edits.
3. Contract correction: the public scale was reduced to the compact nine-role hierarchy, while large App overview type moved behind named presentation tokens.
4. Source migration: the live Screen detail dialog was mapped directly to the new roles and re-measured with the same values.
5. Post-fix evidence: focused tests, Storybook build, production build, overflow checks, implementation screenshots, and the single comparison input confirm the correction.

## Primary interactions tested

- Opening an Aboard screen from the Screens gallery still opens the fullscreen detail dialog.
- More info still opens the Screen information panel and exposes its compact heading and detail hierarchy.
- The live dialog retains the exact measured title, action, heading, body, label, and detail values after token mapping.
- The 11 focused foundation tests pass.
- Storybook and the production Vite build succeed.

final result: passed

---

# Design QA — Typography Applied Across Product Screens

Source visual truth: `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/screen-detail-dark.png`, the authenticated Aboard App Screen detail dialog with its information panel open at 1280 × 720 CSS px.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/apps-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/sites-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/flows-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/collections-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/settings-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/projects-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/admin-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/app-detail-dark.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/standard-vs-product-screens-dark.png`

Viewport and normalization: every source and implementation route was captured at 1280 × 720 CSS px and 1280 × 720 image pixels. The combined comparison is a 1280 × 776 contact sheet containing four 640 × 360 normalized views plus 28px labels.

State: authenticated dark mode. Apps, Sites, and Flows use their loaded discovery state; Collections uses its empty state; Settings uses Billing; Projects uses its existing API-error state; Admin uses the loaded Users table; App detail uses Aboard Screens; the Screen detail source has More info open.

## Findings

- No actionable P0, P1, or P2 typography findings remain.
- Fonts and typography: application surfaces inherit the system UI family and 14px/400/18.2px body role. H1 resolves to the responsive 18–20px/600/26px Title role, H2/H3 to 15px/700/22.5px Heading, labels and ordinary actions to 14px/600/20px with 0.2px tracking, primary actions to 16px/600/22px, metadata to 13px/400/18.85px, and supporting text to 12px/400/16px. The Apps taxonomy is the documented Figtree exception.
- Screen coverage: computed styles were verified on Apps, Sites, Flows, Collections, Settings, Projects, Admin, Aboard App detail, and the App Screen detail overlay. All inspected routes report equal 1280px client and scroll widths.
- Spacing and layout rhythm: the compact hierarchy preserves the existing grids, header heights, workspaces, card geometry, overlay frame, and control alignment. No persistent control or title is clipped in the comparison sheet.
- Colors and visual tokens: the typography migration does not change the neutral foundation palette, foreground hierarchy, borders, fills, or status colors.
- Image quality and assets: all app icons, screen captures, cards, and workspace icons remain the existing source assets. No placeholder, generated, CSS-drawn, or replacement imagery was introduced.
- Copy and content: route labels, app names, descriptions, metadata, empty-state copy, and actions remain unchanged.
- Scope boundaries: App overview and Project Files hero copy retain named presentation tokens. Imported evidence, BlockNote document content, document-flow content, canvas documents, Excalidraw, and the source Screen detail dialog keep their domain typography instead of being flattened by the product layer.
- Existing runtime state: Projects still displays its pre-existing `/api/research-projects returned 500` message; the typography migration was verified on that visible state and did not introduce the request failure.

## Full-view comparison evidence

The single comparison input places the App Screen detail standard beside Apps discovery, Collections, and Settings. Across all four views, titles, section headings, controls, descriptions, metadata, and primary actions follow the same compact density without altering each screen's layout or content priority.

## Focused-region comparison evidence

Computed-style checks provide the focused typography comparison because the full-view contact sheet reduces each screen to 640 × 360. The checks confirm exact source-role values for discovery headings and controls, workspace H1/H3/body copy, primary actions, App detail tabs and actions, plus Screen detail title, information heading, label, body, and detail copy.

## Comparison history

1. Earlier state: shared tokens existed, but route CSS could continue rendering page-specific font sizes and weights.
2. Fix: added a final application-surface typography layer that maps semantic HTML, controls, primary actions, metadata, brand identity, and card identity onto the measured roles.
3. Boundary fix: excluded editorial overview copy, evidence, documents, canvas content, Excalidraw, and the source dialog from generic overrides, then reasserted named presentation tokens for App and Project Files heroes.
4. Post-fix evidence: the eight route captures, computed values, overflow checks, fourteen focused foundation tests, Storybook build, production build, and single visual comparison input confirm the final state.

## Primary interactions tested

- Navigated among Apps, Sites, and Flows discovery routes with their persistent header intact.
- Opened Collections, Billing settings, Projects, and the Admin Users table.
- Opened Aboard App detail, selected a screen, and opened More info in the Screen detail dialog.
- Verified primary New collection and Export to Figma actions resolve to the Action role.
- The fourteen focused foundation tests pass.
- Storybook and the production Vite build succeed.

final result: passed

---

# Design QA — Figtree Applied Across Product UI

Source visual truth: the user-approved Figtree Apps discovery taxonomy at `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/apps-discovery-figtree/implementation-1280x720.jpg`. Previous system-family evidence is `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/storybook-system-dark.png` and `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/all-screens/collections-dark.png`.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/figtree-global/storybook-figtree-1280x720.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/figtree-global/collections-figtree-1280x720.jpg`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/typography-foundation/figtree-global/system-vs-figtree-product-normalized.png`

Viewport and normalization: live implementations were captured at 1280 × 720 CSS px and 1280 × 720 image pixels with device scale factor 1. The normalized comparison contains four 640 × 360 cells in a 1280 × 720 image. The older portrait Storybook source is cropped from the top to the same 16:9 cell; Collections is compared at equal aspect ratio and scale.

State: authenticated dark-mode Apps, Collections empty state, Aboard App detail, and the dark Typography/System Storybook foundation.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: Figtree is the product-family token and resolves across navigation, filters, cards, metadata, workspace titles, body copy, controls, App detail presentation roles, and Storybook. Bundled 400, 500, 600, and 700 faces all load successfully. The compact App Screen detail measurements remain unchanged.
- Technical and domain boundaries: code remains on SF Mono, Monaco, and Consolas. Imported reference typography, document/canvas content, and Excalidraw keep their domain-owned family instead of being overwritten.
- Apps taxonomy: the approved 14px/500 headings and 24px/600 choices remain intact while sharing the same global Figtree family; the redundant taxonomy-only family token was removed.
- Spacing and layout rhythm: Collections and Apps retain their existing navigation rails, grids, control geometry, card spacing, and hierarchy. Apps, Collections, App detail, and Storybook report no horizontal overflow at 1280px.
- Colors and visual tokens: the family migration changes no page, surface, text, border, action, or semantic-state color.
- Image quality and assets: all existing icons, app captures, cards, and workspace assets remain unchanged; no generated or placeholder imagery was introduced.
- Copy and content: product copy is unchanged. The foundation story now identifies Figtree and its four bundled weights instead of presenting the former native-system stack.

## Full-view comparison evidence

The normalized comparison places the earlier system-family foundation and Collections screen on the left, with the Figtree foundation and Collections implementation on the right. The product retains the same density and layout while gaining the rounder, more deliberate Figtree character approved in Apps discovery.

## Focused-region comparison evidence

Browser computed-style checks cover Apps navigation, taxonomy headings and choices, filter controls, card titles and metadata; Collections H1, body, navigation, and actions; Aboard App-detail title, lead, metadata, controls, and tabs; plus Storybook product and code families. Every product sample resolves to `Figtree, system-ui, sans-serif`; code resolves to the monospace token.

## Comparison history

1. Source selection: the Apps discovery taxonomy established Figtree as the approved family while the rest of Vitrines still used the native-system stack.
2. Foundation migration: the product-family token changed to Figtree and bundled 400, 500, 600, and 700 faces were loaded in both the application and Storybook.
3. Cleanup: the taxonomy-only family token and remote Storybook Figtree request were removed; the approved taxonomy hierarchy remains as a size-and-weight exception only.
4. Post-fix evidence: visual comparison, computed styles, overflow checks, fourteen focused tests, production build, and Storybook build confirm the global migration.

## Primary interactions tested

- Loaded Apps discovery with its navigation, taxonomy, filters, and populated app-card grid.
- Loaded the Collections workspace and its empty-state actions.
- Loaded the Aboard App detail with presentation heading, metadata, controls, tabs, and screen cards.
- Loaded the Typography/System Storybook reference with Figtree product specimens and monospace technical specimens.
- Browser logs contain no errors; the existing runtime-theme performance warning remains unrelated.
- Fourteen focused foundation tests pass.
- Production and Storybook builds succeed and emit all four Figtree weight assets.

final result: passed

---

# Design QA — Foundation 03 Spacing & Size

Source visual truth: rendered Vitrines Apps discovery, Aboard App detail, and Collections workspace at 1280 × 720 CSS px in authenticated dark mode.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-foundation/spacing-system-dark-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-foundation/spacing-system-dark-full.png`

## Findings

- No actionable P0, P1, or P2 spacing-foundation findings remain.
- Product spacing choices are limited to seven values: 4, 8, 12, 16, 24, 32, and 48px. The core package's finer 0/2/6/20/28/36/40/44px steps remain available to shared component internals instead of becoming page-level design choices.
- Control heights remain aligned to the shared 28, 32, and 36px size contract for small, medium, and large component variants.
- The live source measurements support the chosen rhythm: Apps uses 8px control gaps, 24px page gutters, 32px major spacing, and 48px taxonomy separation; App detail uses 4px metadata stacks, 8px action gaps, 12px control groups, 24px gutters, and 32px section insets; Workspace uses 8/12/16px compact rail spacing, 24px header grouping, and 32px primary controls.
- The Storybook reference shows the scale, intended use of every value, aligned control-size specimens, and compact/content/region composition examples.
- The built story resolves all ten spacing and size custom properties to their documented pixel values and has equal 1280px client and scroll widths.
- The existing live Storybook development process has a stale index error in the pre-existing Typography story. The fresh static Storybook build succeeds and contains the verified Spacing/System story.

## Verification

- Eighteen focused color, typography, spacing, and foundation tests pass.
- The production Vite build succeeds.
- The static Storybook build succeeds and emits `Spacing.stories`.
- The verified dark-mode Storybook story has no horizontal overflow at 1280px.

final result: passed

---

# Design QA — Foundation 03 Spacing Rollout

Checkpoint: foundation commit `1d5b3d65` was pushed to `origin/main` before this rollout began.

Implementation evidence:

- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/apps-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/sites-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/flows-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/app-detail-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/collections-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/projects-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/settings-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/admin-1280x720.png`
- `/Users/kai/works/eastplayers/Astryx/.codex-artifacts/spacing-rollout/pricing-1280x720.png`

## Findings

- No actionable P0, P1, or P2 spacing-rollout findings remain.
- A final application layer maps repeated actions, controls, tools, headers, metadata items, identity stacks, empty states, and screen-family anchors onto the seven-step product scale.
- Apps, Sites, and Flows use 24px page gutters, 32px taxonomy entry spacing, and 48px major separation.
- App detail uses 24px composition gaps and gutters, 32px hero/body insets, 8px action gaps, 4px metadata-item stacks, and 48px body-end separation.
- Projects, Collections, Settings, Project Document shell, Admin, and public product pages share standardized header, grid, action, control, and section relationships.
- Small, medium, and large component variants resolve to 28, 32, and 36px outside explicitly preserved tab, metadata, evidence, document, and canvas regions.
- Project drawer animation scales two 32px controls to 31.36px while the drawer is open; their declared size remains 32px and returns to 32px after the transform completes.
- Imported evidence, BlockNote documents, document flows, Screen detail, Project Canvas document content, and Excalidraw retain their domain geometry.
- All nine verified routes have equal client and scroll widths at 1280px.

## Verification

- Seventeen focused color, typography, spacing, and rollout tests pass.
- The production Vite build succeeds.
- The Storybook build succeeds.
- Browser verification covers Apps, Sites, Flows, Aboard App detail, Collections, Projects, Billing settings, Admin Users, and Pricing.

final result: passed

---

# Design QA — FigJam Marker Control

- Source visual truth: `/tmp/marker-figjam-final.png` (live FigJam marker submenu).
- Implementation: `/tmp/marker-vitrines-final.png` (Vitrines Canvas marker submenu).
- Viewport: 864 × 864 px at 1× density.
- State: Marker and thin stroke selected, black color selected.
- Focused region: the first Marker tool button; the board themes and canvas contents intentionally differ.

## Comparison history

1. Initial finding [P1]: Vitrines used a 28 × 32 px button with a 16 × 28 px icon. FigJam uses a 24 × 24 px button and clips a 16 × 34 px SVG at a 4 px top inset.
2. Fix: matched the 24px control, clipping, icon dimensions, and inset.
3. Post-fix measurement: both source and Vitrines render a 24 × 24 px button with a 16 × 34 px SVG and a 20 px visible clipped portion.

## Fidelity check

- Typography and copy: not present in the focused icon.
- Spacing: matched source button geometry and inset.
- Color: FigJam violet selection state is retained.
- Asset quality: source SVG remains the rendered artwork.
- Follow-up: Highlighter, Washi tape, and Eraser need independent source-size passes; they are outside this marker-only change.

final result: passed

---

# Design QA — FigJam Text Tool

Source visual truth:

- `/tmp/figjam-text-tool-final-reference.png` — live FigJam with Text active.

Implementation evidence:

- `/tmp/vitrines-text-tool-final.png` — Vitrines Canvas with Text active.
- `/tmp/vitrines-text-tool-editing-final.png` — Vitrines Canvas while the
  inline text editor is active.
- `/tmp/text-tool-design-qa-comparison.png` — focused side-by-side visual
  comparison of the active toolbar state.

Viewport and normalization: both captures are 1280 × 720 CSS px at 1× density.
The comparison is an unscaled 2560 × 720 side-by-side composition.

State: Text is active in the bottom toolbar. The editing capture verifies that
Vitrines keeps the purple FigJam Text affordance while its inline editor owns
keyboard input.

## Findings

- No actionable P0, P1, or P2 differences remain in the scoped Text tool.
- Fonts and typography: the Text tool now uses the supplied FigJam `T` mark,
  including white active ink on the violet selected surface.
- Spacing and layout rhythm: the existing 40px toolbar control and the divider
  before Text remain intact, matching the compact grouped FigJam toolbelt.
- Colors and visual tokens: active Text uses `#9747ff` with white icon ink;
  Select loses its violet active state while an inline text editor is open.
- Image quality and asset fidelity: the supplied `figjam-text-tool.svg` is
  rendered directly, replacing Excalidraw's generic `A` icon.
- Copy and content: formatting remains at the point of editing. The large
  Excalidraw left inspector is suppressed for text selection and editing.

## Focused comparison evidence

`text-tool-design-qa-comparison.png` was reviewed as one image. It confirms
the same source asset, violet selected state, white icon ink, and bottom-belt
placement. The broad board content is intentionally not compared because the
test only scopes the Text control.

## Comparison history

1. The initial Vitrines state used Excalidraw's `A` glyph and showed its large
   left formatting inspector after placement.
2. Replaced the toolbar glyph with the supplied FigJam Text asset; retained
   the active violet state while the inline text editor is open; suppressed the
   text inspector.
3. The first edit-state check showed both Select and Text as violet. Updated
   the Select override and recaptured the editing state. Only Text is active
   now, while the editor remains usable and no inspector is visible.

## Primary interactions tested

- Activate Text from the Vitrines bottom toolbar.
- Confirm the selected FigJam `T` asset, violet background, and no inspector.
- Place an empty inline text editor, then confirm it is editable, the Text
  affordance stays active, Select is visually inactive, and the inspector stays
  hidden.
- Leave the editor through Selection and confirm the editing surface closes.

final result: passed

---

# Design QA — FigJam Section Tool: Size and Order Correction

Source visual truth:

- `/tmp/section-audit-01-figjam-active.png` — live FigJam with Section active.

Implementation evidence:

- `/tmp/section-fix-02-vitrines-active.jpg` — Vitrines Canvas with Section
  active after the correction.
- `/tmp/section-fix-comparison.png` — focused source and implementation
  toolbelt comparison.

Viewport and normalization: both captures are 1280 × 720 CSS px. The focused
comparison is composed at native scale, without resizing either toolbar.

## Findings and correction

1. Earlier Vitrines placed Section after the image and custom tools, and used
   a 40px selected tile. FigJam places Section immediately after Text and uses
   a compact 32px violet selected tile with a 24px icon.
2. Section is now its own ordered toolbar group: it follows Text, precedes
   Image and the remaining custom controls, and retains the requested divider
   before the tool.
3. The active Section surface is now exactly 32 × 32 px. The supplied FigJam
   asset remains 24px and inverts to white when selected.

## Interaction and runtime check

- Clicked Section in the live Vitrines Canvas; its `aria-pressed` state became
  `true`, confirming the native Section drawing action remains wired after
  reordering.
- The page reports one pre-existing Excalidraw mount-time React warning. No
  error was emitted by clicking or activating Section.

final result: passed

---

# Design QA — FigJam Shapes Trigger and More Shapes Drawer

Source visual truth:

- `/tmp/shapes-source-more-open.jpg` — live FigJam with the Shapes drawer and
  quick shape toolbelt open.

Implementation evidence:

- `/tmp/shapes-fix-00-vitrines-initial.jpg` — corrected Vitrines Shapes
  drawer, quick toolbelt, and source-derived trigger.
- `/tmp/shapes-fix-comparison.jpg` — same-state FigJam/Vitrines comparison at
  the same viewport.

Viewport and normalization: both captures are 1280 × 720 CSS px, composed at
native scale without crop or density conversion.

## Findings and correction

1. The trigger had a solid black preview square because its source outline was
   overlaid with an artificial fill. It now renders the source outline-only
   Square and Ellipse assets beside the connector, matching FigJam's lighter
   collage affordance.
2. The More shapes drawer now follows FigJam's fixed left-edge geometry:
   72px from the top, 12px from the bottom, 12px from the left, and 240px wide.
   The quick toolbar remains visible above the main toolbelt while the drawer
   stays open.
3. The drawer only lists primitives Vitrines can actually draw. Unsupported
   FigJam library items are not presented as inert controls.

## Interaction and runtime check

- Confirmed the quick shape toolbar and the More shapes drawer render together
  from the live Canvas state.
- Source inspection confirms the Shapes trigger provides the accessible name
  `Shapes and connectors`, including its open/close state.

final result: passed

---

# Design QA — FigJam Rectangle, Arrow, and Circle Assets

Source visual truth: the exact FigJam Rectangle, Arrow, and Circle SVG markup
provided for this task.

Implementation evidence:

- `/tmp/shapes-svg-fix-vitrines-final.jpg` — live Vitrines Canvas with the
  updated Shapes toolbar visible.

## Findings and correction

1. Rectangle now uses the supplied 144 × 144 FigJam geometry with white fill,
   rounded corners, and the exact 5.8947px source stroke.
2. Arrow now uses the supplied 17 × 12 FigJam path and is named Arrow in the
   shape picker.
3. Circle now uses the supplied 144 × 144 FigJam geometry, white fill, and
   exact 6.7368px source stroke. The picker labels are Rectangle, Arrow, and
   Circle so the accessible names match their visible FigJam tools.
4. The Shape trigger renders Rectangle and Circle as source SVG images rather
   than masks, preserving their white interiors and outline treatment.

## Verification

- Vitrines Canvas was captured with the Shapes toolbar open after the asset
  update.
- `node --test --import tsx src/vitrine/ProjectPlayground.test.ts` — 26 passed.
- `npm run build` and `git diff --check` — passed.

final result: passed

---

# Design QA — Shared Canvas Object Toolbar

Source visual truth: the existing compact Sticker Notes object toolbar in
Vitrines Canvas. The same shell is now the shared formatting UI for canvas
objects, starting with text.

Implementation evidence:

- `/tmp/vitrines-shared-object-toolbar-text.png` — live text editing with the
  shared object toolbar visible above the text caret.

## Findings and correction

1. Text previously exposed Excalidraw's large left-side selected-object
   inspector, which did not match the compact Canvas workflow.
2. Text now uses the Sticker Notes shell for font, size, alignment, link, and
   color. Its accessible region is `Object formatting`, with controls named
   for Text.
3. Sticky note collaboration actions remain note-only. The shared text toolbar
   receives no collaboration props, so it has no sticky-only More menu.

## Interaction and runtime check

- Selected Text, clicked the live canvas, and confirmed the compact Object
  formatting toolbar appeared with the inline text editor.
- Confirmed the native Excalidraw selected-object inspector was absent.
- Pressed Escape and confirmed the temporary editor and object toolbar closed
  without leaving a test object on the board.
- `npm run build` — passed.

final result: passed

---

# Design QA — Motion Prompts

Source visual truth: the existing Vitrines Sites catalogue and the established
Flow detail modal. Motion remains a Sites extension rather than a separate
top-level product area.

## Verification

- `/sites/motion` retains the Sites shell, movement taxonomy, search, type
  dropdown, and catalogue layout without clipping or overlap.
- A reference opens the Flow-style dialog. The **Site** tab presents its visual
  reference; the **Prompt** tab presents an agent-ready implementation brief.
- The agent selector changes the execution framing while preserving the
  reference-specific prompt.
- Browser console: no errors. The only warning is the existing Astryx theme
  runtime-style-injection performance warning.
- Focused route and UI tests: 33 passed. `npm run build` and `git diff --check`
  passed.

final result: passed

---

# Design QA — Motion Video-Card Gallery

Source visual truth: the supplied MotionSites-style gallery reference, with
large visual cards on a dark canvas and concise title/category metadata.

## Same-state comparison

- Source: `/var/folders/_x/_t0kc8qn5vs2xlpstygr0lvc0000gn/T/TemporaryItems/NSIRD_screencaptureui_ga8DNJ/Screenshot 2026-08-10 at 20.00.07.png`
- Implementation: `/tmp/vitrines-motion-video-card.png`
- Combined comparison: `/tmp/vitrines-motion-video-card-comparison.png`
- Viewport: 2048 × 1152, Motion catalogue, dark theme, all motion types.

## Findings and correction

1. Replaced the bespoke Sites identity-card treatment with the shared
   `MediaGridCard` surface for every Motion reference.
2. Kept the image as the primary visual, with only a compact title and motion
   category underneath; the repeated identity icon and description are gone.
3. Preserved the responsive four/three/two/one-column card grid and the
   existing Motion filtering controls.

## Verification

- The visual comparison confirms the intended dark media-gallery hierarchy,
  image-first density, concise metadata, and rounded card treatment.
- Opened a card in the in-app browser and confirmed the existing Flow-style
  dialog shows both **Site** and **Prompt** tabs; the Prompt tab retains the
  AI-agent selector and copy action.
- Layout, typography, spacing, color, and interaction state have no P0, P1,
  or P2 visual regressions in the checked desktop state.
- `npx tsx --test src/vitrine/MotionPromptsPage.test.tsx` — 3 passed.
- `npm run build` and targeted `git diff --check` — passed.

final result: passed

---

# Design QA — Lumin-style Projects Sidebar

Source visual truth:

- `https://app.luminpdf.com/workspace/xNGi3LVu/home/recent` — the compact icon rail in the user-provided Lumin dashboard capture.

Implementation:

- `http://127.0.0.1:5173/projects/3d48a5c7-20b5-480a-a268-c3de515d8344` — live Vitrines project workspace.

Viewport and normalization: both reference and implementation captures are `1288 × 959` JPEG px at 1× density. The live captures were compared together without scaling.

State: light Vitrines project-detail route with Projects selected; dark Vitrines project-detail route with the same navigation state. The source itself is light, so dark mode is assessed for structural parity and token contrast rather than literal color copying.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested sidebar clone.
- Fonts and typography: the rail uses Vitrines' Figtree type scale, with centered icon-over-label destinations matching the source's compact hierarchy.
- Spacing and layout rhythm: the 80px rail, 56px destination tiles, dedicated bottom Settings action, and adjacent project directory match the source's narrow vertical-navigation rhythm.
- Colors and visual tokens: the rail uses a light/dark token pair — light has Lumin-like pale-blue selection, dark keeps a legible charcoal selected state.
- Image quality and asset fidelity: the existing Vitrines mark and icon-library icons are retained; no custom-drawn replacement assets were introduced.
- Copy and content: Vitrines-specific labels (Personal, Apps, Projects, Collections, Settings) replace Lumin document actions while preserving the hierarchy.

## Full-view comparison evidence

The source and Vitrines light-theme captures were reviewed together at `1288 × 959`. Both have a persistent narrow rail, compact label hierarchy, centered icons, a selected destination tile, and a separate Settings control at the bottom.

## Focused region comparison evidence

The rail region was compared in both themes. Light mode has the distinct pale navigation surface and selected Projects tile. Dark mode preserves the same geometry with neutral elevation and readable contrast. The Projects disclosure opens a nearby directory panel; Canvas and Documents remain reachable from it.

## Primary interactions tested

- Change Theme to Light, Dark, and back to System.
- Expand and collapse Projects.
- Navigate from a project to Canvas and Documents.
- Open the workspace switcher.
- Check the live browser console: no errors.

## Comparison history

1. The initial compact rail used the page surface and a too-subtle selected path.
2. Added a dedicated light/dark rail surface and selected-tile tokens, then reduced the rail to 80px and tiles to 56px.
3. Recaptured the live light comparison and tested the same sidebar in dark mode.
4. Reduced the selected Projects state to a centered 44px icon tile with an 8px radius, matching the reference's compact active treatment while keeping the label outside the tile.

final result: passed

---

# Design QA — Collections rail hierarchy repair

Source visual truth:

- `https://app.luminpdf.com/workspace/xNGi3LVu/home/recent` — user-provided Lumin compact-rail reference.

Implementation:

- `http://127.0.0.1:5173/collections` — browser-rendered Vitrines Collections workspace.

Viewport and state: the source remains the saved `1288 × 959` Lumin capture; the current Vitrines interaction was checked at the user's `1159 × 863` desktop state with Collections selected. This focused repair evaluates rail hierarchy and its open/closed behavior rather than a whole-page pixel comparison.

## Findings and repair

- [P1 resolved] Sibling destinations after the first one were rendered one tree depth too deep. Passing `renderAction` directly to `Array.map` supplied the array index as its depth argument, which made Collections appear as a child of Projects.
  - Fix: invoke `renderAction(action)` explicitly for every primary action.
- [P2 resolved] An open project directory could remain over the Collections page after choosing Collections.
  - Fix: close desktop directory folds when a navigation destination is selected.
- [P2 resolved] The narrow rail truncated the Collections label.
  - Fix: use the full available label width and a compact 10px label scale; the live label bounds are 15–64px inside the 80px rail.

## Focused comparison and interactions

- The Lumin and Vitrines rail captures were reviewed together. Both keep a narrow, icon-first rail with the selected icon on a compact tile and its label beneath.
- Checked the Vitrines closed state: Apps, Projects, and Collections all render as root (`is-depth-0`) destinations and no directory panel is visible.
- Expanded Projects: exactly one adjacent directory opened. Selected Collections: Collections became active and the directory closed after its transition.
- Browser console errors: none.

## Fidelity surfaces

- Fonts and typography: compact labels remain single-line and the full Collections label fits.
- Spacing and layout rhythm: root destinations follow the same vertical cadence; the floating directory is only present while explicitly expanded.
- Colors and visual tokens: the existing dark rail and compact active tile remain unchanged.
- Image quality and assets: existing Vitrines mark and icon-library assets are retained.
- Copy and content: Projects and Collections remain distinct top-level destinations.

final result: passed
