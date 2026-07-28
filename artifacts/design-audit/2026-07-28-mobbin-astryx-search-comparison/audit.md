# Mobbin vs Astryx Flow Search Audit

## Audit scope

- Surface: desktop Apps search and Flow taxonomy browser.
- Browser: the user's signed-in Chrome session.
- Comparison viewport: 1512 × 834 CSS pixels at device pixel ratio 2.
- Mobbin URL: `https://mobbin.com/search/apps/web?content_type=apps&sort=publishedAt`
- Astryx URL: `http://127.0.0.1:5175/apps`

## User goal and accessibility target

The user should be able to open Search, switch to Flows, scan a standardized Flow taxonomy, and move through choices quickly with mouse or keyboard.

## Captured steps

1. **Mobbin Apps search page — healthy.**
   - Search is prominent in the global header.
   - Platform and taxonomy filters are visible before the modal opens.
   - Evidence: `01-mobbin-search-page.png`.

2. **Mobbin Flow search modal — strong.**
   - The modal preserves surrounding page context and shows a dense, curated taxonomy.
   - The search control exposes combobox semantics; Flow groups use listbox/group/option semantics.
   - Arrow Down moved selection from `Browsing Tutorial` to `Creating Account`.
   - Opening the modal generated zero network requests in the captured CDP trace; the taxonomy was already available locally.
   - Evidence: `02-mobbin-flow-search-modal.png`.

3. **Astryx Flow search modal — functional, but not yet a faithful match.**
   - The modal structure, dark palette, chips, navigation, highlighted row, counts, and internal scrolling follow Mobbin.
   - Astryx makes one bounded request: `/api/catalog/flows?platform=web&limit=80`.
   - Flow data is still dominated by the orphaned `Other Flows` group rather than a curated parent taxonomy.
   - Evidence: `03-astryx-flow-search-modal.png`.

4. **Runtime and keyboard comparison — needs improvement in Astryx.**
   - Mobbin: Arrow Down changes the selected listbox option.
   - Astryx: Arrow Down leaves the same statically highlighted Flow row and does not move selection.
   - Mobbin exposes combobox, listbox, group, option, and selected-option relationships.
   - Astryx exposes a normal text input and individual buttons without listbox or active-descendant relationships.

## Strengths

- Astryx reduced the previous per-App API fan-out to one paginated Flow catalog request.
- The main visual regions are present and ordered correctly.
- Real App icons and real catalog counts are used.
- Astryx's text platform labels are clearer than Mobbin's unlabeled icon-only controls.
- Focus remains visible in Astryx.

## UX risks

1. **The Astryx modal is almost twice Mobbin's intended CSS scale.**
   - Mobbin dialog: 816 × 594 CSS pixels.
   - Astryx dialog: 1468 × 784 CSS pixels.
   - Astryx covers nearly the whole page and removes the contextual, lightweight feel of quick search.

2. **Typography and controls are approximately doubled.**
   - Mobbin Flow row: 16px type, 38px height, 12px radius.
   - Astryx Flow row: 29px type, 76px height, 22px radius.
   - Mobbin shows more taxonomy in less space; Astryx shows only a handful of rows.

3. **Popularity ranking is not taxonomy standardization.**
   - `Other Flows` remains the first and largest group.
   - Generic labels such as `Home`, `Settings`, and `Notifications` mix navigation destinations, product areas, and user goals.
   - Mobbin separates stable parent groups such as New User Experience, Account Management, Commerce & Finance, Social, Content, and Misc.

4. **The left promo card is clipped at the comparison viewport.**
   - The oversized shell and controls leave insufficient vertical room.
   - Correcting the two-times scale should resolve most of this without redesigning the layout.

## Accessibility risks

- Astryx Flow browsing is not represented as a composite choice control.
- Arrow-key navigation does not traverse Flow choices.
- The dialog has no explicit accessible name in the inspected attributes.
- Screenshot and DOM inspection cannot confirm screen-reader announcements, contrast ratios, zoom reflow, or full keyboard order.

## Request behavior

- Mobbin modal open: 0 captured Fetch/XHR requests.
- Astryx Search open plus Flows selection: 1 captured Fetch request.
- The Astryx request budget is reasonable and fixes the original N-request problem. Prefetching the first Flow page could make the transition feel instant, but it is lower priority than taxonomy and scale.

## Recommendations

1. Correct the Retina/CSS-pixel mismatch: target roughly 816px modal width, 594px modal height, 16px row type, 38px rows, and 12px radii at this viewport.
2. Standardize Flow parents in the database with an explicit curated taxonomy; do not infer the final taxonomy from popularity.
3. Model the Flow browser as combobox → listbox → group → option, with `aria-activedescendant` and working Arrow Up/Down/Enter behavior.
4. Keep the one paginated Flow endpoint. Consider prefetching its first page only after the taxonomy is stable.
5. Retain Astryx's clearer platform labels or add accessible labels if switching to icons.

## Evidence

- `01-mobbin-search-page.png`
- `02-mobbin-flow-search-modal.png`
- `03-astryx-flow-search-modal.png`
- `04-mobbin-astryx-side-by-side.png`
