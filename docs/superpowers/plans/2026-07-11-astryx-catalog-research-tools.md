# Astryx Catalog Research Tools Implementation Plan

> Execute inline in this workspace. Keep every result tied to observed screens or the structured design-system snapshot; do not infer missing variants or flows.

**Goal:** Give web product designers one research workspace for cross-entity search, side-by-side app comparison, and durable collections with notes.

**Architecture:** Add a pure `catalogResearch` domain module that turns captured screens, snapshots, and curator-authored flows into searchable and comparable views. Expose it through authenticated Express routes. Persist collections as user-owned records with generic, evidence-addressable items, then add focused React surfaces to search, compare, save, and annotate those records.

**Constraints:** No new runtime dependency. Search is deterministic text/facet matching over observed metadata. Compare accepts 2-5 apps. Collection ownership is enforced in SQL and again by route-scoped user IDs.

---

## Task 1: Search and comparison domain

**Files:**
- Create: `src/catalogResearch.ts`
- Create: `src/catalogResearch.test.ts`

1. Write failing tests for result kinds, evidence IDs, facets, relevance order, and 2-5 app comparison rows.
2. Run the focused test and confirm it fails because the module is absent.
3. Implement the smallest typed index/search and comparison builders.
4. Run the focused test and confirm it passes.

## Task 2: Collection persistence

**Files:**
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`

1. Extend the database test with collection ownership, notes, duplicate-item, update, and delete behavior.
2. Run the focused database test and confirm the missing schema/API failure.
3. Add `collections` and `collection_items` tables plus narrowly scoped CRUD functions.
4. Add list helpers for all design snapshots and curator flows used by search.
5. Run the database test and confirm it passes when Postgres is available.

## Task 3: Research API

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

1. Write failing route tests for `/search`, `/compare`, and collection CRUD/ownership validation.
2. Run the API test and confirm the new routes return 404.
3. Add dependencies and authenticated routes with strict query/body parsing.
4. Filter search and comparison to apps the signed-in user may access.
5. Run the API test and confirm it passes.

## Task 4: Product-designer research UI

**Files:**
- Create: `src/vitrine/researchApi.ts`
- Create: `src/vitrine/components/SearchResults.tsx`
- Create: `src/vitrine/components/ComparisonPanel.tsx`
- Create: `src/vitrine/components/CollectionPicker.tsx`
- Create: `src/vitrine/components/CollectionsPanel.tsx`
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/AppCard.tsx`
- Modify: `src/vitrine/components/SearchBox.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify detail panels/cards as needed to expose observed item references
- Create or modify focused TSX tests

1. Write failing component tests for search result grouping, the 2-app compare table, and collection save/notes controls.
2. Run the focused TSX tests and confirm the missing surfaces fail.
3. Add debounced structured search with kind/theme/page/product-area/state facets and evidence-aware result navigation.
4. Add 2-5 app selection and side-by-side foundations/components/flows comparison.
5. Add collection creation, item saving for apps/screens/components/tokens/flows, item notes, removal, and a research panel.
6. Run focused TSX tests and TypeScript.

## Task 5: Phase verification

1. Run `npm test`.
2. Run `npx tsc --noEmit`.
3. Run `npm run build`.
4. Check source for placeholder search, fake compare data, or non-persisted collection state.
