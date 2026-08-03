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
