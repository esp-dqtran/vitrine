# Apps and Sites Detail UI Comparison

## Audit scope

- Apps detail: 15Five, Screens, Web.
- Sites detail: Orchid, Preview, Latest.
- Desktop viewport: 1512 × 900.
- Mobile viewport: 390 × 844.
- Comparison covers the shared header, identity hero, metadata, actions, navigation, first content region, responsive reflow, and visible semantic state.

## Overall verdict

The shared detail shell is visually consistent. Apps and Sites now use the same outer gutters, 80 px desktop identity, compact grid, metadata scale, 44 px actions, 56 px tab rail, dark tokens, and mobile stacking behavior. The most noticeable remaining inconsistency is the extra desktop whitespace before the Site preview.

## Step 1 — Apps desktop

Health: Healthy.

- The hero is 174 px tall with 32 px outer gutters.
- The identity mark is 80 × 80.
- Metadata uses a 32 px gap and the action is 44 px tall.
- The navigation rail is 56 px tall.
- Gallery content starts about 33 px after the navigation rail.

Evidence: `01-apps-desktop.png`.

## Step 2 — Sites desktop

Health: Mostly healthy.

- The shell measurements match Apps: 32 px outer gutters, 80 × 80 identity, 32 px metadata gap, 44 px actions, and a 56 px navigation rail.
- The hero is 208 px tall, 34 px taller than Apps, because Sites includes a tagline and one additional metadata field. This is an expected content-driven difference.
- The Latest control occupies the leading navigation slot and shifts the Site tabs right. This is an intentional functional difference.
- The Site preview starts about 120 px after the navigation rail, compared with about 33 px for Apps.

Evidence: `02-sites-desktop.png`.

## Step 3 — Mobile comparison

Health: Healthy with a shared discoverability issue.

- Both pages use the same 390 px-wide stacked shell with no document-level horizontal overflow.
- Both action regions are 358 px wide and 62 px tall.
- Apps has a 407 px hero; Sites has a 508 px hero because of its tagline and extra metadata.
- Both tab rails clip additional tabs horizontally without a strong cue that the row can be swiped.
- Both pages initially show letter fallbacks for identity media at this viewport, which is consistent but less polished than the loaded desktop logos.

Evidence: `04-apps-mobile.png`, `05-sites-mobile.png`, and `06-mobile-side-by-side.png`.

## Strengths

- Shared header, search, account controls, colors, typography scale, radii, and dividers are consistent.
- The detail hierarchy is now recognizable across both products: identity, metadata, actions, navigation, content.
- Site-only controls remain clear without leaking Apps-only behavior.
- Selected tabs are exposed semantically in both DOM snapshots.
- Neither mobile page has horizontal document overflow.

## Notable risks

1. P2 — Sites desktop preview has excessive top whitespace.
   - Evidence: Apps content begins about 33 px after its rail; Sites begins about 120 px after its rail.
   - Impact: Sites feels slower and less content-dense despite sharing the same shell.
   - Recommendation: reduce the desktop preview-stage top padding to approximately 32 px while preserving the centered 1048 px media width.

2. P2 — Mobile tab overflow lacks a discoverability cue on both surfaces.
   - Evidence: Apps clips `Design System`; Sites clips `Technology`.
   - Impact: users may not realize more sections are available.
   - Recommendation: add a subtle trailing fade or partial-next-tab treatment while preserving horizontal scrolling and focus access.

3. P3 — Mobile identity fallbacks look less finished than desktop logos.
   - Evidence: the captures show `1` and `O` rather than the loaded desktop marks.
   - Impact: brief perceived quality drop during the mobile critical path.
   - Recommendation: keep the performance boundary, but consider a locally cached thumbnail or branded low-cost placeholder.

## Accessibility risks and evidence limits

- Screenshots confirm visible selected states and practical control sizes, but they do not prove keyboard order, focus visibility, screen-reader announcements, or measured contrast compliance.
- Horizontal tabs need keyboard and swipe testing after any overflow-cue change.
- Long Site taglines can increase hero height; text zoom and unusually long imported content should be tested separately.

## Recommended order

1. Tighten the desktop Site preview gap.
2. Add a shared mobile tab-overflow cue.
3. Consider higher-fidelity mobile identity placeholders.
