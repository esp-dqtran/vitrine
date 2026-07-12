# Astryx V1 Completion Audit

Date: 2026-07-11

Specification audited: `2026-07-10-astryx-intelligent-design-system-catalog-design.md`

## Outcome

The V1 product contract is implemented for an internally curated web catalog focused on product designers. User-submitted apps and native platforms remain deferred. The system publishes only observed, evidence-backed data; unavailable legacy detail remains visibly unavailable until a recapture instead of being invented.

## Requirement matrix

| Area | Implemented contract |
|---|---|
| Catalog discovery | Search across apps, screens, flows, components, tokens, and layout/responsive/content/interaction patterns; natural-phrase normalization; filters for app category, page type, product area, layout, component presence, theme, viewport, and visible state. |
| Application overview | “Complete observed design system” summary with captured-screen count, colors, type, spacing/radii, key components, layouts, flow/component counts, capture date, and analyzed version. |
| Screens | Real captured media; filters for all specified facets; source URL, capture timestamp, viewport, state context, visible text, structured analysis, and confidence retained in the catalog model. |
| Flows | Curator-authored order only; each step retains a real evidence screen and observed interaction. No generic flow library. |
| Components | App-specific inventory with anatomy, observed variants/states/properties, associated tokens, responsive notes, occurrences, confidence, review status, and clickable evidence. No generic component seeds. |
| Design system | Evidence-backed colors, type, spacing, radius, border, effect, layout, icon, imagery, responsive, content, and interaction rules. |
| Compare | Two-to-five app comparison aligned across foundations, components/variants, and curated flows; missing cells say “Not observed.” |
| Collections | User-owned collections for apps, screens, flows, components, tokens, and patterns; durable item notes, removal, and ownership enforcement. |
| Figma export | Figma-first ZIP containing a development-plugin template and executable Plugin API code for variables, text/effect documentation, auto-layout components, observed variant sets, responsive/pattern documentation, and embedded source captures when local media exists. Whole-system, foundation, component-family, and selected component/screen scopes. |
| Secondary export | JSON tokens, CSS variables, Tailwind theme, component specification JSON, and React component scaffold from the same reviewed snapshot. |
| Versions | Dated `AppVersion` records, version-to-screen membership, immutable design-system/flow snapshots, draft → review → publish gates, historical switching, and public reads restricted to published versions. |
| Curator workflow | Recapture starts a draft and import pipeline; explicit blockers; rename/reject/merge/split actions preserve evidence; publish atomically freezes the reviewed snapshot. |
| Accuracy | Evidence validation covers tokens, variants, rules, and flow steps; duplicate variant-property validation; confidence and review status exposed; unsupported synthesis results are discarded. |
| Failure handling | Drafts and incomplete batches stay unpublished; prior published versions remain intact; export attempts are recorded; export retry does not rerun analysis. |
| Deferred scope | Public/private app submission, self-service capture, iOS, Android, community entries, and generated unobserved variants are absent. |

## Verification evidence

- `npx tsc --noEmit`
- `npm test`: 98 Node tests and 10 rendered React tests passing
- `npm run build`: production build passing
- Extraction benchmark covers responsive classification, distinct variants, reconstruction data, and observed rules.
- Curator tests cover rename, reject, merge, split, review, publication, and evidence preservation.
- Export tests inspect editable Figma Plugin API operations and every secondary format.

## Operational notes

- Figma assigns development-plugin IDs. The ZIP includes a manifest template and README; the designer creates a development plugin to receive its ID, keeps that generated manifest, and replaces `code.js` with Astryx’s generated code.
- Older snapshots that predate richer capture fields show those details as unavailable. A curator recapture populates viewport, structured pattern, confidence, component reconstruction, and source-context fields; Astryx does not fabricate them retroactively.
- The production build has a non-blocking Vite warning for the main JavaScript chunk exceeding 500 kB.
