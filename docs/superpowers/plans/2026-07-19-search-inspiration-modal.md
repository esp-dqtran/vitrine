# Search Inspiration Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Vitrine search modal into a visual inspiration canvas with intent prompts, grouped results, in-modal previews, related references, comparison, and collection saving.

**Architecture:** Keep `App` as the owner of the debounced `/api/search` request and pass its result state into `CommandPalette`. Extend existing search results with image URLs, then split modal presentation into focused prompt, results, preview, and comparison components. Related discovery reuses `/api/search`; comparison and saving reuse `/api/compare` and the existing collection APIs.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, CSS animations, Node test runner, React server rendering, Express.

---

## File map

- Modify `src/catalogResearch.ts`: expose the result-item alias and optional media fields.
- Modify `services/api/src/app.ts`: hydrate search items with full and thumbnail media URLs.
- Modify `services/api/src/app.test.ts`: verify media hydration and search API behavior.
- Modify `src/vitrine/researchApi.ts`: add related-search and comparison clients.
- Create `src/vitrine/inspirationSearch.ts`: prompts, grouping, related-query construction, and pure modal navigation helpers.
- Create `src/vitrine/inspirationSearch.test.ts`: unit tests for the pure inspiration model.
- Create `src/vitrine/components/InspirationPrompts.tsx`: empty-state prompt shortcuts.
- Create `src/vitrine/components/InspirationResults.tsx`: visual grouped result grid.
- Create `src/vitrine/components/InspirationPreview.tsx`: selected reference, flow context, related references, and actions.
- Create `src/vitrine/components/InspirationComparison.tsx`: compact comparison view backed by `/api/compare`.
- Create `src/vitrine/InspirationComponents.test.tsx`: server-rendered component contract tests.
- Modify `src/vitrine/components/CommandPalette.tsx`: modal state machine, related loading, keyboard behavior, and component composition.
- Modify `src/vitrine/App.tsx`: pass shared search, collection, loading, retry, and navigation state into the modal.
- Modify `src/vitrine/styles.css`: visual grid, preview transition, responsive layout, and reduced-motion rules.
- Modify `src/vitrine/CommandPaletteMotion.test.ts`: assert preview transition and reduced-motion hooks.
- Modify `src/vitrine/App.boundary.test.ts`: assert that the modal uses the shared catalog search rather than a second local matcher.

### Task 1: Add media-aware catalog search results

**Files:**
- Modify: `src/catalogResearch.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Extend the existing failing API test**

In `services/api/src/app.test.ts`, update `serves evidence-backed search and 2-app comparison` so the existing component result also verifies both media variants:

```ts
const search = await fetch(`${base}/search?q=primary&kind=component`, { headers: { cookie: "astryx_session=user" } });
assert.equal(search.status, 200);
const searchBody = await search.json() as CatalogSearchResult;
assert.equal(searchBody.items[0].id, "component:linear:button");
assert.equal(searchBody.items[0].imageUrl, "/api/media/linear/0123456789abcdef");
assert.equal(searchBody.items[0].thumbnailUrl, "/api/media/linear/0123456789abcdef?variant=thumb");
```

Add `import type { CatalogSearchResult } from "../../../src/catalogResearch.ts";` at the top of the test file.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL because search items do not yet expose `imageUrl` or `thumbnailUrl`.

- [ ] **Step 3: Extend the public search result type**

In `src/catalogResearch.ts`, add media fields and export a reusable result-item alias:

```ts
export interface CatalogSearchItem {
  id: string;
  kind: CatalogEntityKind;
  app: string;
  title: string;
  description: string;
  evidenceIds: number[];
  imageUrl?: string;
  thumbnailUrl?: string;
  pageType?: string;
  productArea?: string;
  theme?: "light" | "dark" | "mixed";
  states: string[];
  layoutPatterns: string[];
  componentNames: string[];
  appCategory?: string;
  searchText: string;
}

export interface CatalogSearchFacets {
  kinds: Record<CatalogEntityKind, number>;
  themes: string[];
  pageTypes: string[];
  productAreas: string[];
  states: string[];
  layouts: string[];
  components: string[];
  appCategories: string[];
}

export type CatalogSearchResultItem = Omit<CatalogSearchItem, "searchText">;

export interface CatalogSearchResult {
  items: CatalogSearchResultItem[];
  facets: CatalogSearchFacets;
}
```

Replace the existing inline facet shape with `CatalogSearchFacets` without changing its fields.

- [ ] **Step 4: Hydrate each result in the existing `/search` route**

In `services/api/src/app.ts`, retain the computed result, map its evidence to the already-loaded `allowedImages`, and return the decorated result:

```ts
const searchOptions = {
  query: optionalQuery(req.query.q) ?? "",
  kind: requestedKind as CatalogEntityKind | "all",
  theme: optionalQuery(req.query.theme),
  pageType: optionalQuery(req.query.pageType),
  productArea: optionalQuery(req.query.productArea),
  state: optionalQuery(req.query.state),
  layout: optionalQuery(req.query.layout),
  component: optionalQuery(req.query.component),
  appCategory: optionalQuery(req.query.appCategory),
  limit: optionalQuery(req.query.limit) ? Number(req.query.limit) : undefined,
};
const result = searchCatalog({
  images: allowedImages,
  systems: systems.filter(({ app }) => allowed.has(app)),
  flows: flows.filter(({ app }) => allowed.has(app)),
  appCategories,
}, searchOptions);
const imagesById = new Map(allowedImages.map((image) => [image.id, image]));

res.json({
  ...result,
  items: result.items.map((item) => {
    const evidence = item.evidenceIds.map((id) => imagesById.get(id)).find(Boolean);
    if (!evidence) return item;
    return {
      ...item,
      imageUrl: publicImageUrl(evidence.app, evidence.image_url),
      thumbnailUrl: publicImageUrl(evidence.app, evidence.image_url, "thumb"),
    };
  }),
});
```

This is a mechanical extraction of the route's current inline options; do not change filters, entitlements, or result limits.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
node --experimental-strip-types --test src/catalogResearch.test.ts services/api/src/app.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/catalogResearch.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: add media to catalog search results"
```

### Task 2: Add the pure inspiration model and API clients

**Files:**
- Create: `src/vitrine/inspirationSearch.ts`
- Create: `src/vitrine/inspirationSearch.test.ts`
- Modify: `src/vitrine/researchApi.ts`

- [ ] **Step 1: Write failing model tests**

Create `src/vitrine/inspirationSearch.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSPIRATION_PROMPTS,
  groupInspirationResults,
  relatedSearchQuery,
  moveSelection,
} from "./inspirationSearch.ts";

const items = [
  { id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [] },
  { id: "flow:linear:signin", kind: "flow", app: "linear", title: "Sign in", description: "Authentication", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [] },
  { id: "pattern:linear:sidebar", kind: "pattern", app: "linear", title: "Sidebar", description: "Persistent navigation", evidenceIds: [2], states: [], layoutPatterns: ["Sidebar"], componentNames: [] },
] as const;

test("offers useful starting intents", () => {
  assert.deepEqual(INSPIRATION_PROMPTS.slice(0, 4).map(({ query }) => query), ["Onboarding", "Checkout", "AI assistant", "Empty states"]);
});

test("groups inspiration results into screens, flows, and patterns", () => {
  const groups = groupInspirationResults([...items]);
  assert.deepEqual(groups.map(({ label, items }) => [label, items.length]), [["Screens", 1], ["Flows", 1], ["Patterns", 1]]);
});

test("builds a related query from observed metadata", () => {
  assert.equal(relatedSearchQuery({ ...items[0], pageType: "Login", productArea: "Authentication", componentNames: ["Text input"] }), "Login Authentication Text input");
});

test("wraps keyboard selection through visible results", () => {
  assert.equal(moveSelection(2, 1, 3), 0);
  assert.equal(moveSelection(0, -1, 3), 2);
});
```

- [ ] **Step 2: Run the model test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/inspirationSearch.test.ts
```

Expected: FAIL because `inspirationSearch.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

Create `src/vitrine/inspirationSearch.ts`:

```ts
import type { CatalogEntityKind, CatalogSearchResultItem } from "../catalogResearch";

export const INSPIRATION_PROMPTS = [
  { label: "Onboarding", query: "Onboarding" },
  { label: "Checkout", query: "Checkout" },
  { label: "AI assistant", query: "AI assistant" },
  { label: "Empty states", query: "Empty states" },
  { label: "Pricing", query: "Pricing" },
  { label: "Profile", query: "Profile" },
] as const;

const GROUPS: Array<{ label: string; kinds: CatalogEntityKind[] }> = [
  { label: "Screens", kinds: ["screen"] },
  { label: "Flows", kinds: ["flow"] },
  { label: "Patterns", kinds: ["pattern", "component"] },
  { label: "Apps", kinds: ["app"] },
];

export function groupInspirationResults(items: CatalogSearchResultItem[]) {
  return GROUPS.map((group) => ({
    label: group.label,
    items: items.filter((item) => group.kinds.includes(item.kind)),
  })).filter((group) => group.items.length > 0);
}

export function relatedSearchQuery(item: CatalogSearchResultItem): string {
  return [...new Set([
    item.pageType,
    item.productArea,
    item.layoutPatterns[0],
    item.componentNames[0],
    item.title,
  ].filter((value): value is string => Boolean(value?.trim())))]
    .slice(0, 3)
    .join(" ");
}

export function moveSelection(index: number, delta: number, count: number): number {
  if (count === 0) return -1;
  return (index + delta + count) % count;
}
```

- [ ] **Step 4: Write API client tests and implementations**

Add tests to a new `src/vitrine/inspirationApi.test.ts` using a temporary `globalThis.fetch` stub. Assert the exact requests:

```ts
assert.equal(requestedUrl, "/api/search?q=Login+Authentication+Text+input&kind=all&limit=12");
assert.equal(compareUrl, "/api/compare?apps=linear%2Cairbnb");
```

In `src/vitrine/researchApi.ts`, import `CatalogComparison` and `CatalogSearchResultItem`, then add:

```ts
export async function searchRelatedCatalog(item: CatalogSearchResultItem, signal?: AbortSignal): Promise<CatalogSearchResultItem[]> {
  const params = new URLSearchParams({
    q: relatedSearchQuery(item),
    kind: "all",
    limit: "12",
  });
  const result = await json<CatalogSearchResult>(`/api/search?${params}`, { signal });
  return result.items.filter((candidate) => candidate.id !== item.id).slice(0, 6);
}

export function compareCatalogApps(apps: string[], signal?: AbortSignal): Promise<CatalogComparison> {
  const params = new URLSearchParams({ apps: apps.join(",") });
  return json<CatalogComparison>(`/api/compare?${params}`, { signal });
}
```

Import `relatedSearchQuery` from `./inspirationSearch`.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
node --experimental-strip-types --test src/vitrine/inspirationSearch.test.ts src/vitrine/inspirationApi.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/inspirationSearch.ts src/vitrine/inspirationSearch.test.ts src/vitrine/inspirationApi.test.ts src/vitrine/researchApi.ts
git commit -m "feat: add inspiration search model"
```

### Task 3: Build prompt and visual result components

**Files:**
- Create: `src/vitrine/components/InspirationPrompts.tsx`
- Create: `src/vitrine/components/InspirationResults.tsx`
- Create: `src/vitrine/InspirationComponents.test.tsx`

- [ ] **Step 1: Write failing render tests**

Create `src/vitrine/InspirationComponents.test.tsx` with the initial prompt and results contracts:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InspirationPrompts } from "./components/InspirationPrompts.tsx";
import { InspirationResults } from "./components/InspirationResults.tsx";

test("renders inspiration prompts as actions", () => {
  const html = renderToStaticMarkup(<InspirationPrompts onSelect={() => undefined} />);
  assert.match(html, /What are you designing/);
  assert.match(html, /Onboarding/);
  assert.match(html, /AI assistant/);
});

test("renders thumbnail-first grouped references", () => {
  const html = renderToStaticMarkup(<InspirationResults
    items={[{ id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [], thumbnailUrl: "/thumb.webp" }]}
    activeId="screen:1"
    onPreview={() => undefined}
  />);
  assert.match(html, /Screens/);
  assert.match(html, /\/thumb\.webp/);
  assert.match(html, /Login/);
  assert.match(html, /linear/);
  assert.match(html, /aria-selected="true"/);
});
```

- [ ] **Step 2: Run the render tests to verify they fail**

Run:

```bash
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement `InspirationPrompts`**

Create `src/vitrine/components/InspirationPrompts.tsx`:

```tsx
import { Button } from "@astryxdesign/core";
import { INSPIRATION_PROMPTS } from "../inspirationSearch";

export function InspirationPrompts({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <section aria-labelledby="inspiration-prompts-title" className="inspiration-prompts">
      <h2 id="inspiration-prompts-title">What are you designing?</h2>
      <p>Start with an intent and explore observed product references.</p>
      <div className="inspiration-prompt-list">
        {INSPIRATION_PROMPTS.map((prompt) => (
          <Button key={prompt.query} label={prompt.label} size="sm" onClick={() => onSelect(prompt.query)} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement `InspirationResults`**

Create `src/vitrine/components/InspirationResults.tsx`. Flatten groups in visual order so keyboard indexing matches DOM order:

```tsx
import { ClickableCard } from "@astryxdesign/core";
import type { CatalogSearchResultItem } from "../../catalogResearch";
import { groupInspirationResults } from "../inspirationSearch";
import { PlaceholderImage } from "./PlaceholderImage";

interface InspirationResultsProps {
  items: CatalogSearchResultItem[];
  activeId?: string;
  onPreview: (item: CatalogSearchResultItem) => void;
}

export function InspirationResults({ items, activeId, onPreview }: InspirationResultsProps) {
  return (
    <div className="inspiration-results" role="listbox" aria-label="Design inspiration results">
      {groupInspirationResults(items).map((group) => (
        <section key={group.label} aria-labelledby={`inspiration-${group.label.toLowerCase()}`}>
          <h2 id={`inspiration-${group.label.toLowerCase()}`}>{group.label}</h2>
          <div className="inspiration-result-grid">
            {group.items.map((item) => (
              <div key={item.id} role="option" aria-selected={item.id === activeId} className="inspiration-result-card">
                <ClickableCard
                  label={`Preview ${item.title}`}
                  onClick={() => onPreview(item)}
                  padding={0}
                >
                  <div className="inspiration-result-media">
                    <PlaceholderImage src={item.thumbnailUrl ?? item.imageUrl ?? ""} accent="var(--color-accent)" />
                    <span>{item.kind}</span>
                  </div>
                  <div className="inspiration-result-copy">
                    <strong>{item.title}</strong>
                    <span>{item.app}</span>
                  </div>
                </ClickableCard>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

The wrapper owns listbox semantics so accessibility does not depend on `ClickableCard` forwarding DOM attributes.

- [ ] **Step 5: Run render tests and commit**

Run:

```bash
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/components/InspirationPrompts.tsx src/vitrine/components/InspirationResults.tsx src/vitrine/InspirationComponents.test.tsx
git commit -m "feat: add visual inspiration results"
```

### Task 4: Build preview, save, and comparison components

**Files:**
- Create: `src/vitrine/components/InspirationPreview.tsx`
- Create: `src/vitrine/components/InspirationComparison.tsx`
- Modify: `src/vitrine/InspirationComponents.test.tsx`

- [ ] **Step 1: Extend failing component tests**

Add these contracts to `src/vitrine/InspirationComponents.test.tsx`:

```tsx
test("renders preview context and all three actions", () => {
  const html = renderToStaticMarkup(<InspirationPreview
    item={{ id: "screen:1", kind: "screen", app: "linear", title: "Login", description: "Sign in", evidenceIds: [1], states: [], layoutPatterns: [], componentNames: [], imageUrl: "/full.webp" }}
    related={[]}
    relatedLoading={false}
    collections={[]}
    onCollectionsChange={() => undefined}
    onBack={() => undefined}
    onOpen={() => undefined}
    onCompare={() => undefined}
    onSelectRelated={() => undefined}
  />);
  assert.match(html, /Back to results/);
  assert.match(html, /Open/);
  assert.match(html, /Compare/);
  assert.match(html, /Save to collection/);
  assert.match(html, /\/full\.webp/);
  assert.match(html, /Flow context/);
});

test("renders an aligned catalog comparison", () => {
  const html = renderToStaticMarkup(<InspirationComparison
    comparison={{ apps: ["linear", "airbnb"], foundations: [{ id: "accent", label: "Accent", values: ["#111", "#222"], evidenceIds: [[], []] }], components: [], flows: [] }}
    onBack={() => undefined}
  />);
  assert.match(html, /linear/);
  assert.match(html, /airbnb/);
  assert.match(html, /Accent/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: FAIL because preview and comparison components do not exist.

- [ ] **Step 3: Implement `InspirationPreview`**

Create `src/vitrine/components/InspirationPreview.tsx` with these props and actions:

```tsx
import { Button, Spinner } from "@astryxdesign/core";
import type { CatalogSearchResultItem } from "../../catalogResearch";
import type { ResearchCollection } from "../../db";
import { CollectionPicker } from "./CollectionPicker";
import { InspirationResults } from "./InspirationResults";
import { PlaceholderImage } from "./PlaceholderImage";

interface InspirationPreviewProps {
  item: CatalogSearchResultItem;
  related: CatalogSearchResultItem[];
  relatedLoading: boolean;
  relatedError?: string;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  onBack: () => void;
  onOpen: (item: CatalogSearchResultItem) => void;
  onCompare: (item: CatalogSearchResultItem) => void;
  onSelectRelated: (item: CatalogSearchResultItem) => void;
  onRetryRelated?: () => void;
}

export function InspirationPreview(props: InspirationPreviewProps) {
  const { item } = props;
  const flowContext = props.related.filter((candidate) => candidate.kind === "flow" && candidate.app === item.app);
  const relatedAcrossApps = props.related.filter((candidate) => candidate.app !== item.app);
  return (
    <section className="inspiration-preview" aria-label={`Preview ${item.title}`}>
      <Button label="Back to results" variant="ghost" size="sm" onClick={props.onBack} />
      <div className="inspiration-preview-layout">
        <div className="inspiration-preview-media">
          <PlaceholderImage src={item.imageUrl ?? item.thumbnailUrl ?? ""} accent="var(--color-accent)" />
        </div>
        <div className="inspiration-preview-copy">
          <span>{item.kind} · {item.app}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <div className="inspiration-preview-actions">
            <Button label="Open" variant="primary" size="sm" onClick={() => props.onOpen(item)} />
            <Button label="Compare" size="sm" onClick={() => props.onCompare(item)} />
            <CollectionPicker
              reference={{ kind: item.kind, app: item.app, referenceId: item.id, title: item.title }}
              collections={props.collections}
              onCollectionsChange={props.onCollectionsChange}
            />
          </div>
        </div>
      </div>
      <section aria-label="Flow context">
        <h3>Flow context</h3>
        {flowContext.length ? <InspirationResults items={flowContext} onPreview={props.onSelectRelated} /> : <p>No observed flow context for this reference.</p>}
      </section>
      <section aria-label="Related references">
        <h3>Related references</h3>
        {props.relatedLoading ? <Spinner size="sm" aria-label="Loading related references" /> : null}
        {props.relatedError ? <Button label="Retry related references" size="sm" onClick={props.onRetryRelated} /> : null}
        {!props.relatedLoading && !props.relatedError ? <InspirationResults items={relatedAcrossApps} onPreview={props.onSelectRelated} /> : null}
      </section>
    </section>
  );
}
```

This keeps same-app flow context separate from cross-app inspiration while using one related-search response.

- [ ] **Step 4: Implement `InspirationComparison`**

Create `src/vitrine/components/InspirationComparison.tsx`:

```tsx
import { Button } from "@astryxdesign/core";
import type { CatalogComparison, ComparisonRow } from "../../catalogResearch";

function ComparisonSection({ title, rows, apps }: { title: string; rows: ComparisonRow[]; apps: string[] }) {
  if (!rows.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div className="inspiration-comparison-table" role="table">
        <div role="row"><strong role="columnheader">Reference</strong>{apps.map((app) => <strong role="columnheader" key={app}>{app}</strong>)}</div>
        {rows.map((row) => <div role="row" key={row.id}><span role="rowheader">{row.label}</span>{row.values.map((value, index) => <span role="cell" key={`${row.id}-${apps[index]}`}>{value ?? "—"}</span>)}</div>)}
      </div>
    </section>
  );
}

export function InspirationComparison({ comparison, onBack }: { comparison: CatalogComparison; onBack: () => void }) {
  return (
    <section className="inspiration-comparison" aria-label="App comparison">
      <Button label="Back to preview" variant="ghost" size="sm" onClick={onBack} />
      <h2>Compare inspiration</h2>
      <ComparisonSection title="Foundations" rows={comparison.foundations} apps={comparison.apps} />
      <ComparisonSection title="Components" rows={comparison.components} apps={comparison.apps} />
      <ComparisonSection title="Flows" rows={comparison.flows} apps={comparison.apps} />
    </section>
  );
}
```

- [ ] **Step 5: Run render tests and commit**

Run:

```bash
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/components/InspirationPreview.tsx src/vitrine/components/InspirationComparison.tsx src/vitrine/InspirationComponents.test.tsx
git commit -m "feat: add inspiration preview and comparison"
```

### Task 5: Refactor `CommandPalette` around the inspiration flow

**Files:**
- Modify: `src/vitrine/components/CommandPalette.tsx`
- Modify: `src/vitrine/CommandPaletteMotion.test.ts`

- [ ] **Step 1: Extend the failing boundary test**

In `src/vitrine/CommandPaletteMotion.test.ts`, retain the close-animation assertions and add:

```ts
assert.match(source, /InspirationPrompts/);
assert.match(source, /InspirationResults/);
assert.match(source, /InspirationPreview/);
assert.match(source, /searchRelatedCatalog/);
assert.match(source, /onKeyDownCapture/);
assert.doesNotMatch(source, /appMatches/);
assert.doesNotMatch(source, /screenMatches/);
assert.match(styles, /inspiration-view-enter/);
assert.match(styles, /prefers-reduced-motion/);
```

- [ ] **Step 2: Run the boundary test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/CommandPaletteMotion.test.ts
```

Expected: FAIL because the command palette still performs local matching and does not compose the inspiration components.

- [ ] **Step 3: Replace local matching with explicit modal view state**

Extend `CommandPaletteProps`:

```ts
interface CommandPaletteProps {
  apps: App[];
  query: string;
  result: CatalogSearchResult | null;
  searchLoading: boolean;
  searchError: string;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  onQueryChange: (value: string) => void;
  onRetrySearch: () => void;
  onClose: () => void;
  onSelectApp: (appId: string) => void;
  onSelectScreen: (appId: string, evidenceId?: number) => void;
  onSelectCategory: (category: string) => void;
  onSelectFlow: (appId: string) => void;
}
```

Add state and refs:

```ts
const [selected, setSelected] = useState<CatalogSearchResultItem | null>(null);
const [related, setRelated] = useState<CatalogSearchResultItem[]>([]);
const [relatedLoading, setRelatedLoading] = useState(false);
const [relatedError, setRelatedError] = useState("");
const [activeIndex, setActiveIndex] = useState(0);
const [compareApps, setCompareApps] = useState<string[]>([]);
const [comparison, setComparison] = useState<CatalogComparison | null>(null);
const [comparisonLoading, setComparisonLoading] = useState(false);
const [comparisonError, setComparisonError] = useState("");
const resultsScrollRef = useRef<HTMLDivElement>(null);
const savedScrollTopRef = useRef(0);
```

Delete `appMatches`, `screenMatches`, `elementMatches`, and `hasMatches`. Continue to use the existing browse navigation only while `query.trim()` is empty.

- [ ] **Step 4: Load related references only after selection**

Use an abortable effect:

```ts
useEffect(() => {
  if (!selected) return;
  const controller = new AbortController();
  setRelatedLoading(true);
  setRelatedError("");
  searchRelatedCatalog(selected, controller.signal)
    .then(setRelated)
    .catch((error: Error) => { if (error.name !== "AbortError") setRelatedError(error.message); })
    .finally(() => { if (!controller.signal.aborted) setRelatedLoading(false); });
  return () => controller.abort();
}, [selected]);
```

Before selecting an item, store `resultsScrollRef.current?.scrollTop ?? 0`. On Back, clear `selected`, then restore `scrollTop` in `requestAnimationFrame`.

- [ ] **Step 5: Implement result, preview, compare, and Escape behavior**

Render these states in priority order:

```tsx
{comparison ? (
  <InspirationComparison comparison={comparison} onBack={() => setComparison(null)} />
) : selected ? (
  <>
    <InspirationPreview
      item={selected}
      related={related}
      relatedLoading={relatedLoading}
      relatedError={relatedError}
      collections={collections}
      onCollectionsChange={onCollectionsChange}
      onBack={backToResults}
      onOpen={openResult}
      onCompare={addToComparison}
      onSelectRelated={openPreview}
      onRetryRelated={() => setSelected({ ...selected })}
    />
    {compareApps.length === 1 ? <div role="status">Choose one more app to compare with {compareApps[0]}.</div> : null}
    {comparisonLoading ? <Spinner size="sm" aria-label="Building comparison" /> : null}
    {comparisonError ? <div role="alert"><span>{comparisonError}</span><Button label="Retry comparison" size="sm" onClick={() => void loadComparison(compareApps)} /></div> : null}
  </>
) : query.trim() ? (
  <div ref={resultsScrollRef} className="inspiration-search-state">
    {searchError ? <div role="alert"><span>{searchError}</span><Button label="Retry search" size="sm" onClick={onRetrySearch} /></div> : null}
    {searchLoading ? <Spinner size="sm" aria-label="Searching catalog" /> : null}
    {result?.items.length ? (
      <InspirationResults items={result.items} activeId={result.items[activeIndex]?.id} onPreview={openPreview} />
    ) : !searchLoading && !searchError ? (
      <div><p>No observed evidence matches “{query}”. Try a nearby intent.</p><InspirationPrompts onSelect={onQueryChange} /></div>
    ) : null}
  </div>
) : nav === "trending" ? (
  <InspirationPrompts onSelect={onQueryChange} />
) : (
  browseContent
)}
```

Define `browseContent` by moving the current `categories`, `screens`, `elements`, and `flows` JSX branches into a local constant without changing their behavior. This keeps existing direct navigation available while the new result path uses the shared catalog search.

Handle keys on the modal body with `onKeyDownCapture`:

```ts
const onPaletteKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === "Escape" && comparison) {
    event.preventDefault(); event.stopPropagation(); setComparison(null); return;
  }
  if (event.key === "Escape" && selected) {
    event.preventDefault(); event.stopPropagation(); backToResults(); return;
  }
  if (selected || comparison || !result?.items.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    setActiveIndex((index) => moveSelection(index, event.key === "ArrowDown" ? 1 : -1, result.items.length));
  }
  if (event.key === "Enter") {
    const item = result.items[activeIndex];
    if (item) { event.preventDefault(); openPreview(item); }
  }
};
```

`openResult` routes by kind: screen uses its first evidence ID, flow opens the flows section, and all other types open the app detail. `addToComparison` keeps unique app slugs; when the second app is selected, call `compareCatalogApps(nextApps)`, render a progress indicator during the request, and show a retryable inline error without leaving the preview.

Use these request helpers so comparison state and retry behavior stay deterministic:

```ts
const loadComparison = async (appsToCompare: string[]) => {
  setComparisonLoading(true);
  setComparisonError("");
  try {
    setComparison(await compareCatalogApps(appsToCompare));
  } catch (error) {
    setComparisonError((error as Error).message);
  } finally {
    setComparisonLoading(false);
  }
};

const addToComparison = (item: CatalogSearchResultItem) => {
  const nextApps = [...new Set([...compareApps, item.app])].slice(0, 2);
  setCompareApps(nextApps);
  if (nextApps.length === 2) void loadComparison(nextApps);
};
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
node --experimental-strip-types --test src/vitrine/CommandPaletteMotion.test.ts src/vitrine/inspirationSearch.test.ts src/vitrine/inspirationApi.test.ts
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/components/CommandPalette.tsx src/vitrine/CommandPaletteMotion.test.ts
git commit -m "feat: add inspiration flow to search modal"
```

### Task 6: Wire shared search state and navigation from `App`

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Add failing app boundary assertions**

Add to `src/vitrine/App.boundary.test.ts`:

```ts
test("shares catalog search state with the inspiration modal", async () => {
  const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  assert.match(source, /searchLoading/);
  assert.match(source, /searchRetry/);
  assert.match(source, /result=\{searchResult\}/);
  assert.match(source, /collections=\{collections\}/);
  assert.match(source, /onCollectionsChange=\{setCollections\}/);
});
```

- [ ] **Step 2: Run the boundary test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because `App` does not expose loading/retry state to `CommandPalette`.

- [ ] **Step 3: Add loading and retry state without clearing old results**

Near the existing search state in `src/vitrine/App.tsx`, add:

```ts
const [searchLoading, setSearchLoading] = useState(false);
const [searchRetry, setSearchRetry] = useState(0);
```

Update the search effect:

```ts
useEffect(() => {
  if (!q.trim()) {
    setSearchResult(null);
    setSearchError("");
    setSearchLoading(false);
    return;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    setSearchLoading(true);
    searchCatalog(q, filters, controller.signal)
      .then((next) => { setSearchResult(next); setSearchError(""); })
      .catch((error: Error) => { if (error.name !== "AbortError") setSearchError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
  }, 180);
  return () => { window.clearTimeout(timer); controller.abort(); };
}, [q, filters, searchRetry]);
```

Do not clear `searchResult` when a new request begins; this preserves the grid while the small loading indicator is visible.

- [ ] **Step 4: Pass the shared data and exact navigation callbacks**

Update the `CommandPalette` call:

```tsx
<CommandPalette
  apps={apps}
  query={q}
  result={searchResult}
  searchLoading={searchLoading}
  searchError={searchError}
  collections={collections}
  onCollectionsChange={setCollections}
  onQueryChange={setQ}
  onRetrySearch={() => setSearchRetry((value) => value + 1)}
  onClose={() => setPaletteOpen(false)}
  onSelectApp={(appId) => void openApp(appId)}
  onSelectScreen={(appId) => navigate({ name: "app", appId, section: "screens" })}
  onSelectFlow={(appId) => navigate({ name: "app", appId, section: "flows" })}
  onSelectCategory={setCat}
/>
```

Keep the screen evidence ID in the callback contract even though the current route opens the screens section; it provides the seam for later deep-linking without expanding this task.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
node --experimental-strip-types --test src/vitrine/App.boundary.test.ts src/vitrine/CommandPaletteMotion.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/App.tsx src/vitrine/App.boundary.test.ts
git commit -m "feat: connect catalog search to inspiration modal"
```

### Task 7: Add responsive layout and transition styling

**Files:**
- Modify: `src/vitrine/styles.css`
- Modify: `src/vitrine/CommandPaletteMotion.test.ts`

- [ ] **Step 1: Add failing style assertions**

Add to `src/vitrine/CommandPaletteMotion.test.ts`:

```ts
assert.match(styles, /\.inspiration-result-grid/);
assert.match(styles, /\.inspiration-preview-layout/);
assert.match(styles, /@media \(max-width: 700px\)/);
assert.match(styles, /@keyframes inspiration-view-enter/);
assert.match(styles, /@keyframes inspiration-view-back/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test src/vitrine/CommandPaletteMotion.test.ts
```

Expected: FAIL because the new inspiration selectors and keyframes do not exist.

- [ ] **Step 3: Add desktop and narrow-screen styles**

Add the following structure to `src/vitrine/styles.css`, using existing color and spacing tokens:

```css
.inspiration-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.inspiration-result-card { overflow: hidden; border-radius: 12px; }
.inspiration-result-media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; }
.inspiration-result-media > span { position: absolute; left: 8px; bottom: 8px; }
.inspiration-result-copy { display: flex; justify-content: space-between; gap: 8px; padding: 10px 12px; }

.inspiration-preview,
.inspiration-comparison {
  min-height: 100%;
  animation: inspiration-view-enter 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.inspiration-preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
  gap: 24px;
}

.inspiration-preview-media { min-height: 320px; border-radius: 14px; overflow: hidden; }
.inspiration-preview-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.inspiration-comparison-table > div { display: grid; grid-template-columns: minmax(140px, 1fr) repeat(var(--comparison-columns, 2), minmax(120px, 1fr)); gap: 8px; }

@keyframes inspiration-view-enter {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes inspiration-view-back {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (max-width: 700px) {
  .command-palette-dialog { width: 100vw !important; max-width: 100vw; max-height: 100dvh !important; border-radius: 0; }
  .inspiration-result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inspiration-preview-layout { grid-template-columns: 1fr; }
  .inspiration-preview { min-height: calc(100dvh - 76px); }
}

@media (prefers-reduced-motion: reduce) {
  .inspiration-preview,
  .inspiration-comparison {
    animation-duration: 1ms !important;
  }
}
```

Set `--comparison-columns` from `InspirationComparison` using `style={{ "--comparison-columns": comparison.apps.length } as React.CSSProperties }` on the table root.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
node --experimental-strip-types --test src/vitrine/CommandPaletteMotion.test.ts
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/vitrine/styles.css src/vitrine/CommandPaletteMotion.test.ts src/vitrine/components/InspirationComparison.tsx
git commit -m "feat: style inspiration modal experience"
```

### Task 8: Full verification and behavior check

**Files:**
- Modify only files required to fix regressions introduced by Tasks 1-7.

- [ ] **Step 1: Run all focused inspiration tests**

Run:

```bash
node --experimental-strip-types --test src/catalogResearch.test.ts src/vitrine/inspirationSearch.test.ts src/vitrine/inspirationApi.test.ts src/vitrine/CommandPaletteMotion.test.ts src/vitrine/App.boundary.test.ts services/api/src/app.test.ts
tsx --test src/vitrine/InspirationComponents.test.tsx
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run type and production-build verification**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands exit 0. If the execution starts from the current dirty main checkout, first distinguish pre-existing failures from plan regressions; do not edit unrelated user files to make this task green.

- [ ] **Step 3: Run the repository test suite**

Run:

```bash
npm test
```

Expected: PASS with zero failures.

- [ ] **Step 4: Perform a manual browser behavior check**

At `http://localhost:5173/apps`, verify:

1. `⌘K` opens the animated modal and focuses search.
2. Empty search shows six intent prompts.
3. Selecting `Onboarding` shows visual grouped results.
4. Arrow keys move selection and Enter opens preview.
5. Preview shows media, flow context, related references, Open, Compare, and Save.
6. Back restores the original result scroll position.
7. Escape returns comparison → preview → results → closed modal one layer at a time.
8. Related-result failure does not hide the primary preview.
9. Two different apps can produce a comparison.
10. Narrow viewport uses the full-height preview layer.

- [ ] **Step 5: Commit any verification fixes**

If verification required task-scoped corrections, review the diff and stage the complete feature file set (Git ignores unchanged paths):

```bash
git add src/catalogResearch.ts services/api/src/app.ts services/api/src/app.test.ts src/vitrine/researchApi.ts src/vitrine/inspirationSearch.ts src/vitrine/inspirationSearch.test.ts src/vitrine/inspirationApi.test.ts src/vitrine/InspirationComponents.test.tsx src/vitrine/components/InspirationPrompts.tsx src/vitrine/components/InspirationResults.tsx src/vitrine/components/InspirationPreview.tsx src/vitrine/components/InspirationComparison.tsx src/vitrine/components/CommandPalette.tsx src/vitrine/App.tsx src/vitrine/styles.css src/vitrine/CommandPaletteMotion.test.ts src/vitrine/App.boundary.test.ts
git commit -m "fix: polish inspiration modal behavior"
```

If no corrections were needed, do not create an empty commit.
