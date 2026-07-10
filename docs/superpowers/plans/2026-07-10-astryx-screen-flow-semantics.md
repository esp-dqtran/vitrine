# Astryx Screen and Flow Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify every newly captioned web screen into structured observed metadata and render reliable curator-ordered flows backed by existing captured image IDs.

**Architecture:** Make the caption response a validated JSON screen analysis stored beside each image. Keep flow order out of AI: an internal CLI imports a curator-authored JSON manifest, validates every referenced image against the app, stores it in PostgreSQL, and the existing design-system API hydrates those references into real image URLs for the React flow viewer.

**Tech Stack:** TypeScript, Node.js, PostgreSQL/JSONB, Express, React 19, Vite, Node test runner

---

## File Map

### Create

- `src/screenAnalysis.ts` — screen-analysis types and strict parser.
- `src/screenAnalysis.test.ts` — parser tests.
- `src/flows.ts` — curator manifest validation and import.
- `src/flows.test.ts` — manifest validation tests.
- `src/vitrine/components/FlowsPanel.tsx` — pure real-flow gallery and drill-in.
- `src/vitrine/components/FlowsPanel.test.tsx` — evidence rendering tests.

### Modify

- `src/prompt.ts` — require JSON screen analysis.
- `src/caption.ts` — parse and persist screen analysis.
- `src/db.ts` — add image analysis and app-flow JSONB storage.
- `src/db.test.ts` — persist analysis and flow snapshots.
- `src/gallery.ts` — expose page type, product area, theme, and observed states.
- `src/gallery.test.ts` — verify semantic screen metadata.
- `src/designSystem.ts` — validate and hydrate stored flow steps.
- `src/designSystem.test.ts` — flow hydration tests.
- `services/api/src/app.ts` — merge persisted flows into the structured response.
- `services/api/src/app.test.ts` — verify hydrated ordered flows.
- `src/index.ts` — add the internal `import-flows` command.
- `src/vitrine/types.ts` — extend the screen view.
- `src/vitrine/components/FlowCard.tsx` — use real evidence images.
- `src/vitrine/components/FlowViewer.tsx` — render ordered evidence steps.
- `src/vitrine/components/ScreenDetail.tsx` — mount real flows and counts.
- `src/vitrine/ScreenDetail.test.tsx` — verify generic flow copy stays absent.

## Task 1: Validate Structured Screen Analysis

**Files:** Create `src/screenAnalysis.ts`, `src/screenAnalysis.test.ts`

- [ ] Write tests proving valid fenced JSON is normalized and unsupported theme values or prose are rejected.
- [ ] Run `node --experimental-strip-types --test src/screenAnalysis.test.ts` and confirm missing-module failure.
- [ ] Implement:

```typescript
export type ScreenTheme = "light" | "dark" | "mixed";

export interface ScreenAnalysis {
  description: string;
  purpose: string;
  pageType: string;
  productArea: string;
  theme: ScreenTheme;
  visibleStates: string[];
  componentNames: string[];
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function stringList(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : []).filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()))];
}

export function parseScreenAnalysis(raw: string): ScreenAnalysis {
  let value: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("root must be an object");
    value = parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Screen analysis did not return valid JSON: ${(error as Error).message}`);
  }
  const theme = requiredText(value.theme, "theme") as ScreenTheme;
  if (!["light", "dark", "mixed"].includes(theme)) throw new Error(`Unsupported screen theme: ${theme}`);
  return {
    description: requiredText(value.description, "description"),
    purpose: requiredText(value.purpose, "purpose"),
    pageType: requiredText(value.pageType, "pageType"),
    productArea: requiredText(value.productArea, "productArea"),
    theme,
    visibleStates: stringList(value.visibleStates),
    componentNames: stringList(value.componentNames),
  };
}
```

- [ ] Re-run the focused test and expect all parser tests to pass.

## Task 2: Persist Screen Analysis and Curated Flows

**Files:** Modify `src/db.ts`, `src/db.test.ts`

- [ ] Extend the database test first to save an analysis for image `1`, read it through `appImages("airbnb")`, save two ordered flows, and replace them on a second save.
- [ ] Run `node --experimental-strip-types --test src/db.test.ts`; expect missing functions/column failure.
- [ ] Add to schema setup:

```sql
ALTER TABLE images ADD COLUMN IF NOT EXISTS analysis JSONB;
CREATE TABLE IF NOT EXISTS app_flows (
  app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  flows JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] Extend `CrawledImage` with `analysis: ScreenAnalysis | null`, select `i.analysis` in `allImages()` and `appImages()`, and add:

```typescript
export async function saveScreenAnalysis(id: number, analysis: ScreenAnalysis): Promise<void> {
  await query("UPDATE images SET description = $1, analysis = $2::jsonb WHERE id = $3", [analysis.description, JSON.stringify(analysis), id]);
}

export async function saveAppFlows(app: string, flows: DesignFlow[]): Promise<void> {
  await query(
    `INSERT INTO app_flows (app_id, flows) SELECT id, $2::jsonb FROM apps WHERE name = $1
     ON CONFLICT (app_id) DO UPDATE SET flows = EXCLUDED.flows, updated_at = now()`,
    [app, JSON.stringify(flows)],
  );
}

export async function getAppFlows(app: string): Promise<DesignFlow[]> {
  const result = await query<{ flows: DesignFlow[] }>(
    `SELECT f.flows FROM app_flows f JOIN apps a ON a.id = f.app_id WHERE a.name = $1`, [app],
  );
  return result.rows[0]?.flows ?? [];
}
```

- [ ] Re-run `src/db.test.ts` and expect pass.

## Task 3: Produce Structured Metadata During Captioning

**Files:** Modify `src/prompt.ts`, `src/caption.ts`; create `src/caption.test.ts`

- [ ] Write a failing test around an exported `parseCaptionReply()` that returns a `ScreenAnalysis` for valid JSON and rejects prose.
- [ ] Run `node --experimental-strip-types --test src/caption.test.ts`; confirm missing export failure.
- [ ] Replace `CAPTION_PROMPT` with a JSON-only contract containing `description`, `purpose`, `pageType`, `productArea`, `theme`, `visibleStates`, and `componentNames`; explicitly forbid unobserved states.
- [ ] Export `parseCaptionReply = parseScreenAnalysis` from `caption.ts`, replace `saveDescription` with `saveScreenAnalysis`, and persist the parsed reply.
- [ ] Run caption, analysis, and prompt tests; expect pass.

## Task 4: Expose Screen Semantics in the Gallery

**Files:** Modify `src/gallery.ts`, `src/gallery.test.ts`, `src/vitrine/types.ts`

- [ ] Update the gallery test first so the first image contains analysis and assert `type`, `productArea`, `theme`, `visibleStates`, and `id`.
- [ ] Run `node --experimental-strip-types --test src/gallery.test.ts`; confirm semantic assertions fail.
- [ ] Map screen fields as:

```typescript
{
  id: image.id,
  type: image.analysis?.pageType ?? "Unclassified",
  productArea: image.analysis?.productArea ?? "Unclassified",
  theme: image.analysis?.theme ?? "mixed",
  visibleStates: image.analysis?.visibleStates ?? [],
  platform: image.platform,
  description: image.description,
  url: publicImageUrl(app, image.image_url),
}
```

- [ ] Add the matching fields to the React `Screen` interface and rerun the gallery test.

## Task 5: Validate and Import Curator-Ordered Flows

**Files:** Create `src/flows.ts`, `src/flows.test.ts`; modify `src/index.ts`

- [ ] Write tests for a manifest shaped as `{ "flows": [{ id, title, description, tags, steps: [{ label, imageId }] }] }`, proving unknown image IDs are rejected and order is preserved.
- [ ] Run `node --experimental-strip-types --test src/flows.test.ts`; confirm missing module failure.
- [ ] Implement `parseFlowManifest(raw, allowedImageIds)` returning `DesignFlow[]`, with each step converted to `{ label, evidence: [imageId] }`; reject empty flows, duplicate flow IDs, duplicate step image IDs within a flow, and unknown IDs.
- [ ] Implement `importFlowManifest(app, path)` using `readFileSync`, `appImages`, and `saveAppFlows`.
- [ ] Add CLI case:

```typescript
case "import-flows": {
  const [app, path] = rest;
  if (!app || !path) {
    console.error("Usage: npm run import-flows -- <app> <manifest.json>");
    process.exit(1);
  }
  await importFlowManifest(app, path);
  break;
}
```

- [ ] Add `"import-flows": "tsx src/index.ts import-flows"` to `package.json`, rerun focused tests, and expect pass.

## Task 6: Hydrate Ordered Flows Through the API

**Files:** Modify `src/designSystem.ts`, `src/designSystem.test.ts`, `services/api/src/app.ts`, `services/api/src/app.test.ts`

- [ ] Add a failing hydrator test with two ordered steps and assert both public image URLs retain order.
- [ ] Add a failing API test whose `getAppFlows` fake returns the same flow and assert it appears in the response.
- [ ] Update `hydrateDesignSystem()` to map every flow step's evidence IDs through the existing `hydrate()` helper instead of returning `flows: []`.
- [ ] Add `getAppFlows` to API dependencies and call:

```typescript
const flows = await deps.getAppFlows(appSlug);
res.json(hydrateDesignSystem({ ...snapshot, flows }, await deps.appImages(appSlug)));
```

- [ ] Run focused design-system and API tests; expect pass.

## Task 7: Render Real Ordered Flows

**Files:** Create `src/vitrine/components/FlowsPanel.tsx`, `src/vitrine/components/FlowsPanel.test.tsx`; modify `FlowCard.tsx`, `FlowViewer.tsx`, `ScreenDetail.tsx`

- [ ] Write a failing pure rendering test that supplies a two-step `DesignFlow<EvidenceView>` and asserts both labels and both real image URLs are present.
- [ ] Update `FlowCard` and `FlowViewer` to accept `DesignFlow<EvidenceView>`, use `step.label`, and render `step.evidence[0]?.imageUrl` through `PlaceholderImage src`.
- [ ] Create `FlowsPanel` with local selected-flow state, an empty evidence state, the existing card list, and the existing viewer.
- [ ] In `ScreenDetail`, set `const flows = snapshot?.flows ?? []`, show `${flows.length} flows`, and render `<FlowsPanel flows={flows} />`.
- [ ] Run focused TSX tests and expect pass.

## Task 8: Verify Phase Two

- [ ] Run `docker compose up -d postgres`.
- [ ] Run `npm test` and `npx tsx --test src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/components/FlowsPanel.test.tsx`.
- [ ] Run `npm run build`.
- [ ] Verify no `FLOW_LIBRARY`, generic flow seed, or AI flow synthesis remains using `rg`.
- [ ] Create no live flow data unless a curator manifest with valid image IDs is supplied.

## Exit Criteria

- New captions persist structured screen metadata.
- Gallery screens expose page type, product area, theme, and observed states.
- Flow order comes only from curator manifests.
- Every flow step references an existing image belonging to the app.
- API and UI preserve the curator's step order and use real evidence images.
- Empty flow state remains honest when no manifest exists.
- Full tests and build pass.
