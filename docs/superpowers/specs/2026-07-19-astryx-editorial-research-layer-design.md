# Astryx Editorial Research Layer — Product Design

Date: 2026-07-19

Status: Approved direction; awaiting written-spec review

## Product Decision

Astryx will apply a warm editorial treatment to the parts of the product where a designer reads evidence, compares alternatives, records judgment, and prepares a handoff.

This is a scoped **editorial research layer**, not a product-wide rebrand. The Research Project and Decision Canvas should feel calm, deliberate, and readable while the catalog, search results, crawling progress, and administration surfaces remain compact and operational.

The intended result is:

> A research workspace that feels closer to a considered design brief than a generic dashboard, without weakening evidence density or trust.

## Scope

The editorial layer applies to:

- `ResearchProjectPage`
- `EvidenceDrawer`
- `DecisionCanvas`
- `EvidenceCard`
- `ProjectInsightsPanel`
- Research-project Markdown handoff presentation

It does not apply to:

- App catalog cards and gallery browsing
- Global command palette and search results
- Crawl progress, queue, repair, and worker controls
- Admin users, analytics, billing, or settings
- Authentication and onboarding

Those operational surfaces continue to use the existing neutral Astryx design system.

## Design Principles

### Editorial hierarchy, operational controls

Research questions, conclusions, synthesis headings, and accepted decisions receive a more editorial typographic voice. Buttons, form labels, metadata, filters, tags, and status messages remain in the existing Figtree/sans-serif system.

### Warmth through surfaces, not decoration

Warmth comes from a lightly tinted research canvas, quieter borders, generous spacing, and restrained orange/amber emphasis. Astryx does not adopt hand-drawn wellness illustrations, mood controls, decorative quotations, or consumer-journaling metaphors.

### Evidence remains visually primary

Captured screens and source metadata are more prominent than generated prose. AI output never appears more authoritative than the selected evidence or the designer's saved decision.

### Trust is visible

The interface clearly labels observed evidence, interpretation, recommendation, and unresolved questions. Citations remain adjacent to the claim they support.

### Existing tokens remain authoritative

The research layer composes the current `@astryxdesign/core` tokens. It may add scoped semantic aliases under `.research-project-page`, but it must not replace the global theme or hard-code a second independent component system.

## Visual System

### Scoped surface aliases

The implementation should define research-only aliases using the current theme tokens and `color-mix()`:

```css
.research-project-page {
  --research-canvas: color-mix(
    in srgb,
    var(--color-background-body) 88%,
    var(--color-background-orange) 12%
  );
  --research-panel: color-mix(
    in srgb,
    var(--color-background-surface) 94%,
    var(--color-background-orange) 6%
  );
  --research-rule: color-mix(
    in srgb,
    var(--color-border) 78%,
    var(--color-border-orange) 22%
  );
  --research-emphasis: var(--color-text-orange);
  --research-emphasis-muted: var(--color-background-orange);
  --research-font-editorial: "Iowan Old Style", "Palatino Linotype",
    "Book Antiqua", Georgia, serif;
}
```

These aliases must resolve in both light and dark modes. Interactive focus, selected controls, and primary buttons continue to use `--color-accent`; orange is an editorial emphasis color, not a replacement interaction color.

### Typography

- Project title: editorial font, 32px/38px desktop and 27px/33px mobile, weight 600.
- Research question: editorial font, 20px/29px desktop and 18px/27px mobile, normal weight, maximum line length 760px.
- Lane title: existing sans-serif, 15px/20px, semibold.
- Lane conclusion when displayed as saved text: editorial font, 16px/24px.
- Synthesis section headings: editorial font, 18px/24px, weight 600.
- Body, inputs, metadata, citations, tags, and controls: existing Figtree/system scale.
- Long synthesis paragraphs: maximum readable line length of 68 characters.

The editorial font is never applied to text inputs, buttons, compact evidence metadata, or crawl/admin data.

### Color and elevation

- Page canvas uses `--research-canvas`.
- Side panels and lanes use `--research-panel`.
- Standard borders use `--research-rule`; important evidence may use `--color-border-orange` plus a text label.
- Primary actions retain the normal blue accent and focus treatment.
- Shadows are reserved for overlays, sticky panels, and actively lifted evidence. Default lanes and evidence cards use borders rather than persistent shadows.
- Destructive states continue to use the existing error tokens.

### Shape and spacing

- Use the existing `--radius-container` and `--radius-element` values.
- Do not increase the global radius scale or turn every label into a pill.
- Workspace spacing follows the existing 4px base: 8px metadata gaps, 12px card gaps, 16px control groups, 20px workspace columns, and 32px major section breaks.

## Workspace Layout

### Desktop, 1280px and wider

The workspace remains a three-region layout:

1. Evidence drawer: 272px fixed width.
2. Decision canvas: flexible primary region, minimum 0.
3. Insights panel: 336px fixed width.

The page uses a maximum width of 1560px with 28px horizontal padding. The decision canvas owns the visual center and receives more contrast than the side panels.

The project header contains the Projects back action, project title, research question, project status, and compact actions. It may become sticky after scrolling, but it must not become a solid black band.

### Medium, 800px to 1279px

The Decision Canvas stays visible. Evidence and Insights become explicit top-level panel buttons that open as side sheets or stacked regions. The interface must not place three full-width panels one after another before the designer reaches the canvas.

### Narrow, below 800px

Use an accessible segmented workspace switcher with three views: **Evidence**, **Compare**, and **Decision**. Preserve the user's current view while mutations complete. Lanes stack vertically in Compare.

Mobile remains functional for review and light editing; desktop remains the primary comparison environment.

## Project Header

The project header is the editorial entry point:

- The title and research question form one reading block.
- Supporting state such as platform, evidence count, and synthesis freshness appears below as compact sans-serif metadata.
- Back navigation and actions remain visually secondary to the question.
- When sticky, use a transparent or lightly mixed research surface with `backdrop-filter: blur(10px)` and a bottom rule.

The sticky header/search surface must not use a black background. Its background should be either transparent or:

```css
background: color-mix(
  in srgb,
  var(--research-canvas) 92%,
  transparent
);
```

If transparency reduces contrast over moving content, use the mixed surface above. Dark mode should remain dark through the theme tokens, not through a hard-coded `black` value.

## Evidence Drawer

The drawer remains a compact research tool rather than an editorial article.

- Search and target-lane controls stay sticky within the panel.
- The sticky control container uses the transparent/mixed research surface above, never an opaque black fill.
- Search results show a 16:10 thumbnail where media is available, followed by title, app/platform, match reason, and Add evidence.
- Match reasons are labeled **Why this matched** rather than presented as an unexplained AI score.
- Upload is a secondary action below catalog search.
- Empty results explain how to broaden the question or add private evidence.

The drawer should fit at least two useful suggestion cards in a 768px-high viewport without scrolling the entire page.

## Decision Canvas

The canvas is the strongest surface and should read as a comparison document.

### Lane anatomy

Each lane contains:

1. Editable lane title and evidence count.
2. A short conclusion region.
3. Ordered evidence cards.
4. An empty-state drop/add region when no evidence exists.
5. A low-emphasis lane management menu.

Lane backgrounds use `--research-panel`; the surrounding canvas remains `--research-canvas`. Lane headers may be sticky within the horizontal canvas as long as they do not obscure keyboard focus.

### Evidence card anatomy

Each evidence card displays:

1. Screen thumbnail or restricted-media state.
2. Step label.
3. App, platform, flow, state, and capture date when available.
4. Designer note.
5. Tags and Important evidence state.
6. Source/citation identifier such as `e104`.
7. A compact actions menu plus keyboard-accessible move actions.

The default card is quiet. Important evidence gains an orange side rule and the text label **Important**; color is not the only signal.

Move earlier, Move later, Move to lane, and Remove should not appear as a permanent row of equally weighted buttons. They move into a compact actions menu while remaining reachable by keyboard and exposed to assistive technology.

Selecting a card opens its full evidence view without losing the project's scroll position.

## Decision and Synthesis Panel

The panel contains two clearly separated authors:

### Your decision

Designer-authored Constraints, Decision, Rationale, and Open questions remain at the top. The section uses the normal control typography and the primary Save action.

### AI draft from selected evidence

Generated content is presented in this order:

1. **Executive read** — short orientation, labeled AI-generated.
2. **Observed** — cited facts derived from selected evidence.
3. **Interpretation** — meaningful differences and alternatives, visibly separated from observation.
4. **Recommended direction** — cited recommendation and evidence-linked requirements.
5. **Open questions** — uncited unknowns that require further product or user research.

Each cited claim displays compact evidence chips immediately after the sentence. A citation opens the matching evidence card and briefly highlights it. Unknown or restricted citations never render as valid links.

The **Accept recommendation into decision** action must preview the replacement and require an explicit confirmation when the Decision field already contains text. AI never silently overwrites designer-authored content.

Stale synthesis is visually muted and labeled **Out of date — evidence changed**. It remains readable for context but cannot be accepted until regenerated.

## Content Style

- Use direct research language: observed, differs, suggests, unknown, selected evidence.
- Avoid wellness language such as reflection, mood, journey within, or daily ritual.
- Do not describe generated claims as facts without citations.
- Prefer short headings and complete sentences over dashboard fragments.
- Keep the designer's question visible while comparing and reading synthesis.

## Interaction and Motion

- Motion is restrained: 160–220ms for panel transitions and evidence highlighting.
- Evidence cards may lift 2px on hover; the existing catalog-card 6px lift is too strong for the dense canvas.
- Adding or moving evidence animates position without shifting the entire workspace.
- Honor `prefers-reduced-motion`; no interaction depends on animation.
- Busy mutations disable only the affected control where practical and preserve visible workspace state.

## Accessibility

- Text and controls meet WCAG 2.2 AA contrast in both themes.
- Editorial typography does not reduce body text below 16px for long-form reading.
- Important, stale, restricted, selected, and AI-generated states use text labels in addition to color.
- Sticky regions never cover focused elements.
- Horizontal canvas scrolling remains available by keyboard and does not trap vertical page navigation.
- Evidence move actions announce the destination lane and new position.
- Citation focus moves to the cited card and offers a clear return path to synthesis.
- The Evidence/Compare/Decision mobile switcher exposes correct tab semantics and focus order.

## Implementation Boundaries

The visual pass should reuse the current component and data boundaries:

- `src/vitrine/components/ResearchProjectPage.tsx` owns page shell and responsive region state.
- `src/vitrine/components/EvidenceDrawer.tsx` owns sticky search controls and result-card presentation.
- `src/vitrine/components/DecisionCanvas.tsx` owns lane layout and lane headers.
- `src/vitrine/components/EvidenceCard.tsx` owns evidence hierarchy, thumbnail, metadata, and compact actions.
- `src/vitrine/components/ProjectInsightsPanel.tsx` owns author separation and synthesis sections.
- `src/vitrine/styles.css` owns scoped research aliases, layout, responsive rules, and motion.

The current `ResearchSynthesisResult` already provides observations, differences, alternatives, recommendation, requirements, and open questions. The first visual pass should map those fields into the new hierarchy without changing the backend schema.

The existing `@astryxdesign/core` Button, Card, TextInput, TextArea, Selector, FileInput, Spinner, color, radius, shadow, and focus tokens remain the component foundation.

## Verification and Acceptance Criteria

The editorial research layer is ready when:

- Only research-project surfaces receive the warm editorial treatment.
- Catalog, crawling, and admin pages retain their existing density and neutral theme.
- No research sticky header or search container uses hard-coded black.
- Light, dark, and system themes all remain readable.
- Project title, research question, synthesis headings, and saved conclusions use the editorial type role; controls and metadata remain sans-serif.
- Desktop keeps the Decision Canvas primary while showing both supporting panels.
- Medium layouts reach the canvas without scrolling past two stacked side panels.
- Narrow layouts provide functional Evidence, Compare, and Decision views.
- Evidence cards show media or an explicit restricted state, source metadata, notes, tags, importance, and citation ID.
- Observed evidence is visually distinct from interpretation and recommendation.
- Every generated observed, difference, recommendation, and requirement claim retains its current evidence citations.
- Accepting AI text cannot silently replace an existing designer decision.
- Keyboard movement, citation navigation, focus visibility, reduced motion, and live status behavior pass component and browser checks.

## Explicit Non-Goals

- No full-site cream or beige rebrand.
- No custom illustration system.
- No consumer wellness metaphors or journaling interactions.
- No bottom mobile navigation copied from the reference app.
- No new synthesis provider or schema in the visual pass.
- No team collaboration, sharing, Figma export, or crawler changes.
