# Build in Public Roadmap Design

## Goal

Give visitors a public, honest view of what Astryx has shipped, what is being built now, and what may come next. The page should make project momentum understandable in under a minute without exposing internal operational detail or presenting exploratory ideas as commitments.

## Product decision

Astryx will add a static editorial page at `/build-in-public`. Roadmap entries live in a typed frontend data structure and are updated through ordinary code review. The first version does not use a database, CMS, Git-history parser, voting, comments, subscriptions, or automatic progress calculations.

This approach keeps the public narrative deliberate and makes maintenance proportional to the small amount of roadmap content. A Git-derived roadmap would expose noisy implementation history, while a database-managed roadmap would add administration and API work without improving the visitor experience.

## Audience and success criteria

The primary audience is a prospective Astryx user who wants to understand whether the product is active, useful now, and heading toward a credible public launch.

The page succeeds when a visitor can identify:

- the current catalog scale;
- the major capabilities already available;
- the single broad area receiving attention now;
- the next public-facing milestone;
- which later ideas are exploratory rather than promised.

## Route and access

- Add a public `build-in-public` route mapped to `/build-in-public`.
- Render it before authenticated application branches so signed-out visitors never see a sign-in gate.
- Add a `Build in public` link to the landing-page navigation and footer.
- The page uses the same public header behavior, responsive width, typography, tokens, and CTA conventions as the existing landing and pricing pages.
- Browser back/forward navigation continues through the existing client router.

## Page structure

### Header and hero

The existing public header remains visible. The hero contains the eyebrow `Build in public`, the heading `Building the design intelligence workspace in the open`, a short explanation of why the roadmap is public, and a `Browse the library` primary action.

A small freshness line displays `Last updated July 23, 2026`. This is authored content, not derived at runtime.

### Current snapshot

Three compact metrics reuse the verified completed-crawl marketing totals:

- `465` apps;
- `137K+` screens;
- `647` UI elements.

The snapshot describes these as catalog-scale figures rather than real-time counters. The values remain manually maintained alongside the roadmap.

### Timeline

The central experience is one responsive vertical timeline. Each entry contains:

- status group;
- month and year;
- title;
- one concise outcome-oriented description;
- optional short evidence chips;
- an accessible textual status label in addition to color.

The desktop timeline uses a narrow status rail and a wide content column. Small screens collapse to one column with the rail on the left. Entries remain chronological from newest/current work toward earlier shipped foundations, followed by future items.

The four status groups are:

- `Shipped`: available capabilities and completed foundations;
- `Building now`: the current focus, limited to one broad milestone;
- `Up next`: the next intended public outcome;
- `Exploring`: possible later directions with no delivery promise.

### Closing call to action

The page ends with a short invitation to explore the shipped product and a `Browse the library` action. The first version does not add feedback collection because Astryx does not yet have an agreed public feedback channel.

## Initial roadmap content

### Building now

**Product polish and production hardening — July 2026**

Improve reliability, responsive behavior, catalog presentation, and the path from evidence to a developer-ready artifact.

### Shipped

**Flow-to-feature developer handoff — July 2026**

Turn observed product flows into reviewable feature documents with evidence navigation, revision state, export, and read-only sharing.

**Design-system reconstruction — July 2026**

Present imported and reconstructed systems as specimen-led previews with tokens, components, variants, usage guidance, and source material.

**Full catalog crawl — July 2026**

Complete the current catalog pass and make 465 apps, more than 137,000 screens, and 647 UI elements available as the public scale snapshot.

**Evidence and catalog foundation — July 2026**

Establish versioned Apps, Screens, UI Elements, Flows, protected media, search, collections, and evidence-aware publication boundaries.

### Up next

**Public launch and feedback loop — Next**

Finish the public-facing experience, validate the production launch path, and establish a deliberate channel for learning from early users.

### Exploring

**Collaborative research and integrations — Later**

Explore shared evidence comparisons, decision trails, team handoff, and external integrations after the core public workflow is stable.

Exploring entries must use language such as `explore`, `consider`, or `learn`; they must not include a promised date.

## Component and data boundaries

- `BuildInPublicPage` owns page composition only.
- `ROADMAP_ITEMS` is a typed, immutable list close to the page because it has one consumer.
- A small `RoadmapItem` component renders one semantic timeline entry.
- Existing public navigation is extended with one callback or route action; no new global navigation abstraction is introduced.
- Styles use Astryx design tokens and existing primitives. Page-specific layout may remain colocated unless the current component conventions require a small focused stylesheet section.

The roadmap item type contains `status`, `date`, `title`, `description`, and optional `evidence`. Status is a closed union so unsupported states fail TypeScript checks.

## Accessibility and responsive behavior

- Use a heading hierarchy with one page-level heading and one heading per milestone.
- Render the timeline as a semantic ordered list.
- Status meaning is always written as text and never conveyed only by color.
- Focus styles come from existing button and link primitives.
- Decorative rail and markers are hidden from assistive technology.
- The layout must remain readable at 320 CSS pixels without horizontal scrolling.
- Motion is not required. If an existing reveal behavior is reused, it must respect reduced-motion preferences and content must remain visible without JavaScript animation.

## Error and empty behavior

The first version has no network dependency, so it has no loading or transport-error state. The typed list is expected to contain entries. Tests protect the required status groups and content; no public empty-roadmap design is added.

## Testing and verification

Implementation follows test-driven development:

1. Add failing router tests for parsing and serializing `/build-in-public`.
2. Add a failing page boundary/render test for public access, required status groups, metrics, semantic ordered-list structure, freshness copy, and CTA.
3. Add the minimal route, navigation link, typed data, and page implementation.
4. Run focused Vitrine tests, TypeScript through the production build, and the full test suite.
5. Verify the page in a browser at desktop and narrow mobile widths, including signed-out access, navigation, back/forward behavior, and absence of horizontal overflow.

The existing production-build chunk-size warning is non-blocking unless this page materially increases the main chunk. The implementation should avoid adding a new dependency.

## Scope boundaries

This slice does not include:

- a CMS or admin roadmap editor;
- automatic extraction from commits, issues, or pull requests;
- public voting, comments, reactions, or subscriptions;
- per-item detail pages;
- promised delivery dates for future work;
- live database-backed catalog metrics;
- unrelated changes to authenticated Apps, Sites, Projects, crawler operations, or billing.

## Acceptance criteria

- `/build-in-public` is public and directly reloadable through the existing SPA hosting behavior.
- Landing navigation and footer expose the page.
- The page clearly distinguishes shipped, current, next, and exploratory work.
- Initial content matches the approved roadmap narrative and completed-crawl snapshot.
- Desktop and mobile layouts are accessible and visually consistent with the Astryx public experience.
- Focused tests, full tests, and the production build pass.
