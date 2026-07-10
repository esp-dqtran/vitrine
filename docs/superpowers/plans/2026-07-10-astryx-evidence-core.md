# Astryx Evidence-Backed Design-System Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Astryx's canned UI-element and design-system data with a structured, persisted, evidence-backed design-system snapshot built from the web screens Astryx already captures.

**Architecture:** Keep the existing capture → caption → synthesize worker pipeline, but make synthesis produce a validated JSON snapshot instead of a Markdown file. Store one JSONB snapshot per app in PostgreSQL, retain image IDs as evidence, hydrate those IDs through the API, and render the resulting components and foundations in the existing React app-detail tabs. This is the smallest durable base for later flow capture, catalog search, comparison, collections, and Figma export.

**Tech Stack:** TypeScript, Node.js, PostgreSQL/JSONB, Express, React 19, Vite, Node test runner, existing `@astryxdesign/core` components

---

## Release Decomposition

The approved product specification is too broad for one safe implementation plan. Implement it through these independently testable releases:

1. **This plan — Evidence core:** structured tokens, components, source occurrences, API hydration, and real app-specific UI.
2. **Flow and screen semantics:** capture reliable flow order and screen metadata; do not infer flows from the current unordered bulk download.
3. **Catalog research tools:** structured search, cross-app comparison, and collections.
4. **Figma export:** editable variables, styles, auto-layout components, and evidence pages.
5. **Curator/version workflow:** app versions, review state, publishing gates, and recapture diffs.

App submission and native mobile platforms remain deferred.

## File Map

### Create

- `src/designSystem.ts` — shared snapshot types, runtime validation, evidence filtering, and API hydration.
- `src/designSystem.test.ts` — parser and hydration contract tests.
- `src/vitrine/useDesignSystem.ts` — one fetch lifecycle for an app's structured snapshot.
- `src/vitrine/components/ComponentsPanel.tsx` — pure evidence-backed component gallery.
- `src/vitrine/components/ComponentsPanel.test.tsx` — component-gallery rendering tests.

### Modify

- `src/db.ts` — create the JSONB storage table and expose save/read helpers.
- `src/db.test.ts` — verify snapshot persistence and replacement.
- `src/prompt.ts` — require evidence-backed JSON synthesis.
- `src/synthesize.ts` — parse, validate, and persist structured snapshots.
- `src/synthesize.test.ts` — verify image IDs and previous snapshots are included in prompts.
- `services/api/src/app.ts` — serve hydrated structured snapshots.
- `services/api/src/app.test.ts` — verify JSON, evidence URLs, validation, and 404 behavior.
- `src/vitrine/types.ts` — expose the structured design-system view to React.
- `src/vitrine/components/ElementCard.tsx` — display a real evidence image and component metadata.
- `src/vitrine/components/ScreenDetail.tsx` — use fetched app-specific components and remove canned flows.
- `src/vitrine/components/DesignSystemPanel.tsx` — render structured foundations and evidence counts.
- `src/vitrine/DesignSystemPanel.test.tsx` — verify structured foundation rendering.
- `src/vitrine/ScreenDetail.test.tsx` — verify the empty real-flow state and the design-system tab.

### Delete

- `src/vitrine/data.ts` — remove the generic component and flow libraries after their consumers are gone.

## Task 1: Define and Validate the Evidence Snapshot

**Files:**
- Create: `src/designSystem.ts`
- Create: `src/designSystem.test.ts`

- [ ] **Step 1: Write the failing parser tests**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { hydrateDesignSystem, parseDesignSystemSnapshot } from "./designSystem.ts";

test("keeps only tokens and variants backed by captured image ids", () => {
  const snapshot = parseDesignSystemSnapshot(
    JSON.stringify({
      tokens: [
        { id: "color-primary", kind: "color", name: "Primary", value: "#5E6AD2", role: "primary action", evidence: [1, 999] },
        { id: "color-invented", kind: "color", name: "Invented", value: "#000000", role: "unknown", evidence: [999] },
      ],
      components: [
        {
          id: "button",
          name: "Button",
          category: "Actions",
          description: "Rounded action control",
          variants: [
            { id: "button-primary", name: "Primary", description: "Filled purple button", evidence: [1] },
            { id: "button-disabled", name: "Disabled", description: "Not observed", evidence: [999] },
          ],
        },
      ],
      flows: [],
    }),
    "linear",
    new Set([1]),
    "2026-07-10T00:00:00.000Z",
  );

  assert.deepEqual(snapshot.tokens[0].evidence, [1]);
  assert.equal(snapshot.tokens.length, 1);
  assert.deepEqual(snapshot.components[0].variants.map((variant) => variant.id), ["button-primary"]);
});

test("rejects malformed synthesis output", () => {
  assert.throws(
    () => parseDesignSystemSnapshot("not json", "linear", new Set([1]), "2026-07-10T00:00:00.000Z"),
    /valid JSON/,
  );
});

test("hydrates evidence ids with public image data", () => {
  const snapshot = parseDesignSystemSnapshot(
    JSON.stringify({
      tokens: [{ id: "space-8", kind: "spacing", name: "Space 8", value: "8px", role: "control gap", evidence: [7] }],
      components: [],
      flows: [],
    }),
    "linear",
    new Set([7]),
    "2026-07-10T00:00:00.000Z",
  );

  const hydrated = hydrateDesignSystem(snapshot, [
    { id: 7, image_url: "mobbin-bulk:0123456789abcdef", description: "Toolbar" },
  ]);
  assert.deepEqual(hydrated.tokens[0].evidence, [
    { imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Toolbar" },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/designSystem.test.ts
```

Expected: FAIL because `src/designSystem.ts` does not exist.

- [ ] **Step 3: Implement the shared types, validator, and hydrator**

Create `src/designSystem.ts` with these public contracts and behavior:

```typescript
import { publicImageUrl } from "./imageSource.ts";

export type TokenKind = "color" | "typography" | "spacing" | "radius" | "border" | "effect";

export interface EvidenceView {
  imageId: number;
  imageUrl: string;
  description: string | null;
}

export interface DesignToken<T = number> {
  id: string;
  kind: TokenKind;
  name: string;
  value: string;
  role: string;
  evidence: T[];
}

export interface ComponentVariant<T = number> {
  id: string;
  name: string;
  description: string;
  evidence: T[];
}

export interface DesignComponent<T = number> {
  id: string;
  name: string;
  category: string;
  description: string;
  variants: ComponentVariant<T>[];
}

export interface DesignFlow<T = number> {
  id: string;
  title: string;
  description: string;
  tags: string[];
  steps: Array<{ label: string; evidence: T[] }>;
}

export interface DesignSystemSnapshot<T = number> {
  app: string;
  generatedAt: string;
  tokens: DesignToken<T>[];
  components: DesignComponent<T>[];
  flows: DesignFlow<T>[];
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function evidence(value: unknown, allowedImageIds: ReadonlySet<number>): number[] {
  return [...new Set(list(value).filter((id): id is number => Number.isInteger(id) && allowedImageIds.has(id as number)))];
}

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function parseDesignSystemSnapshot(
  raw: string,
  app: string,
  allowedImageIds: ReadonlySet<number>,
  generatedAt = new Date().toISOString(),
): DesignSystemSnapshot {
  let parsed: JsonObject;
  try {
    parsed = object(JSON.parse(stripFence(raw)), "snapshot");
  } catch (error) {
    throw new Error(`Synthesis did not return valid JSON: ${(error as Error).message}`);
  }

  const tokens = list(parsed.tokens).flatMap((value): DesignToken[] => {
    const item = object(value, "token");
    const refs = evidence(item.evidence, allowedImageIds);
    if (refs.length === 0) return [];
    const kind = text(item.kind, "token.kind") as TokenKind;
    if (!["color", "typography", "spacing", "radius", "border", "effect"].includes(kind)) {
      throw new Error(`Unsupported token kind: ${kind}`);
    }
    return [{
      id: text(item.id, "token.id"),
      kind,
      name: text(item.name, "token.name"),
      value: text(item.value, "token.value"),
      role: text(item.role, "token.role"),
      evidence: refs,
    }];
  });

  const components = list(parsed.components).flatMap((value): DesignComponent[] => {
    const item = object(value, "component");
    const variants = list(item.variants).flatMap((variantValue): ComponentVariant[] => {
      const variant = object(variantValue, "component.variant");
      const refs = evidence(variant.evidence, allowedImageIds);
      return refs.length === 0 ? [] : [{
        id: text(variant.id, "component.variant.id"),
        name: text(variant.name, "component.variant.name"),
        description: text(variant.description, "component.variant.description"),
        evidence: refs,
      }];
    });
    if (variants.length === 0) return [];
    return [{
      id: text(item.id, "component.id"),
      name: text(item.name, "component.name"),
      category: text(item.category, "component.category"),
      description: text(item.description, "component.description"),
      variants,
    }];
  });

  return { app, generatedAt, tokens, components, flows: [] };
}

export function hydrateDesignSystem(
  snapshot: DesignSystemSnapshot,
  images: Array<{ id: number; image_url: string; description: string | null }>,
): DesignSystemSnapshot<EvidenceView> {
  const byId = new Map(images.map((image) => [image.id, image]));
  const hydrate = (ids: number[]): EvidenceView[] => ids.flatMap((imageId) => {
    const image = byId.get(imageId);
    return image ? [{ imageId, imageUrl: publicImageUrl(snapshot.app, image.image_url), description: image.description }] : [];
  });
  return {
    ...snapshot,
    tokens: snapshot.tokens.map((token) => ({ ...token, evidence: hydrate(token.evidence) })),
    components: snapshot.components.map((component) => ({
      ...component,
      variants: component.variants.map((variant) => ({ ...variant, evidence: hydrate(variant.evidence) })),
    })),
    flows: [],
  };
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/designSystem.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Record the checkpoint**

Record these files as the first logical change:

```text
src/designSystem.ts
src/designSystem.test.ts
```

This workspace has no `.git` directory, so do not run `git commit` unless the user initializes or supplies a repository.

## Task 2: Persist One Structured Snapshot per App

**Files:**
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`

- [ ] **Step 1: Add the failing persistence assertions**

Extend the existing PostgreSQL test to save and replace a snapshot:

```typescript
const { insertImage, uncaptionedImages, saveDescription, saveDesignSystem, getDesignSystem, query, closePool } = await import("./db.ts");

await saveDesignSystem("airbnb", {
  app: "airbnb",
  generatedAt: "2026-07-10T00:00:00.000Z",
  tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#FF5A5F", role: "primary action", evidence: [1] }],
  components: [],
  flows: [],
});
assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#FF5A5F");

await saveDesignSystem("airbnb", {
  app: "airbnb",
  generatedAt: "2026-07-10T01:00:00.000Z",
  tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#E31C5F", role: "primary action", evidence: [1] }],
  components: [],
  flows: [],
});
assert.equal((await getDesignSystem("airbnb"))?.tokens[0].value, "#E31C5F");
```

- [ ] **Step 2: Run the database test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/db.test.ts
```

Expected: FAIL with missing `saveDesignSystem` and `getDesignSystem`, or SKIP with the existing Postgres-not-running message. Start the existing database with `docker compose up -d postgres` if the test skips during implementation.

- [ ] **Step 3: Add the JSONB table and database helpers**

Add this table to `ensureSchema()` after `jobs`:

```sql
CREATE TABLE IF NOT EXISTS design_systems (
  app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Add these helpers to `src/db.ts`:

```typescript
import type { DesignSystemSnapshot } from "./designSystem.ts";

export async function saveDesignSystem(app: string, snapshot: DesignSystemSnapshot): Promise<void> {
  await query(
    `INSERT INTO design_systems (app_id, snapshot)
     SELECT id, $2::jsonb FROM apps WHERE name = $1
     ON CONFLICT (app_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [app, JSON.stringify(snapshot)],
  );
}

export async function getDesignSystem(app: string): Promise<DesignSystemSnapshot | undefined> {
  const result = await query<{ snapshot: DesignSystemSnapshot }>(
    `SELECT ds.snapshot
     FROM design_systems ds JOIN apps a ON a.id = ds.app_id
     WHERE a.name = $1`,
    [app],
  );
  return result.rows[0]?.snapshot;
}

export async function appImages(app: string): Promise<CrawledImage[]> {
  const result = await query<CrawledImage>(
    `SELECT i.id, a.name AS app, p.name AS platform, i.image_url, i.description
     FROM images i
     JOIN platforms p ON p.id = i.platform_id
     JOIN apps a ON a.id = p.app_id
     WHERE a.name = $1 ORDER BY i.created_at ASC`,
    [app],
  );
  return result.rows;
}
```

Add `design_systems` to the test's `TRUNCATE` statement before `apps`:

```sql
TRUNCATE design_systems, apps, platforms, images RESTART IDENTITY CASCADE
```

- [ ] **Step 4: Run the database test and verify it passes**

Run:

```bash
node --experimental-strip-types --test src/db.test.ts
```

Expected: the database test passes with the stored value replaced on the second save.

- [ ] **Step 5: Record the checkpoint**

Record `src/db.ts` and `src/db.test.ts` as the PostgreSQL snapshot-storage change.

## Task 3: Make Synthesis Produce Evidence-Backed JSON

**Files:**
- Modify: `src/prompt.ts`
- Modify: `src/synthesize.ts`
- Modify: `src/synthesize.test.ts`

- [ ] **Step 1: Replace the prompt tests with evidence-aware expectations**

Update `src/synthesize.test.ts` so the first test asserts the image ID and the second asserts that the previous JSON snapshot is included:

```typescript
test("labels every screen description with its evidence image id", () => {
  const prompt = buildSynthesisPrompt("", [image("https://cdn.example.com/a.png", "A blue button, #5E6AD2.")]);
  assert.match(prompt, /image_id=1/);
  assert.match(prompt, /A blue button, #5E6AD2\./);
});

test("later batches feed the structured snapshot back for deduplication", () => {
  const previous = JSON.stringify({ tokens: [], components: [], flows: [] });
  const prompt = buildSynthesisPrompt(previous, [image("https://cdn.example.com/b.png", "A gray badge.")]);
  assert.match(prompt, /existing structured snapshot/);
  assert.match(prompt, /"components":\[\]/);
});
```

- [ ] **Step 2: Run the synthesis test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/synthesize.test.ts
```

Expected: FAIL because prompts do not include `image_id` or structured-snapshot language.

- [ ] **Step 3: Replace the synthesis contract in `src/prompt.ts`**

Replace `SYNTHESIS_PROMPT` with:

```typescript
export const SYNTHESIS_PROMPT = `Build one evidence-backed observed design-system snapshot from the supplied screen descriptions.

Return ONLY valid JSON with this exact top-level shape:
{
  "tokens": [{
    "id": "stable-kebab-case-id",
    "kind": "color|typography|spacing|radius|border|effect",
    "name": "human-readable name",
    "value": "observed value or compact specification",
    "role": "observed usage role",
    "evidence": [123]
  }],
  "components": [{
    "id": "stable-kebab-case-id",
    "name": "human-readable name",
    "category": "Actions|Inputs|Navigation|Data display|Feedback|Layout|Other",
    "description": "observed anatomy and purpose",
    "variants": [{
      "id": "stable-kebab-case-id",
      "name": "observed variant name",
      "description": "observed visual and behavioral properties",
      "evidence": [123]
    }]
  }],
  "flows": []
}

Evidence values MUST be image_id numbers supplied with the screen descriptions. Do not add a token, component, variant, or state unless at least one supplied screen visibly supports it. Do not invent missing states. Merge duplicates across screens and preserve distinct observed variants. Keep flows empty because this capture source does not preserve reliable sequence data.`;
```

- [ ] **Step 4: Update prompt construction and persistence in `src/synthesize.ts`**

Import the new helpers:

```typescript
import { appImages, saveDesignSystem } from "./db.ts";
import { parseDesignSystemSnapshot } from "./designSystem.ts";
```

Replace `buildSynthesisPrompt` with:

```typescript
export function buildSynthesisPrompt(current: string, batch: CrawledImage[]): string {
  const screens = batch
    .map((image) => `--- image_id=${image.id} source=${image.image_url} ---\n${image.description}`)
    .join("\n\n");
  const context = current
    ? `Here is the existing structured snapshot. Merge the new observations into it without losing valid evidence:\n\n${current}`
    : "Create the first structured snapshot from these observations.";
  return `${SYNTHESIS_PROMPT}\n\n${context}\n\n${screens}`;
}
```

Replace the file-based setup inside `synthesize()` with:

```typescript
const images = (await appImages(app)).filter((image) => image.description);
const allowedImageIds = new Set(images.map((image) => image.id));
let current = "";
```

Inside the batch loop, replace the Markdown assignment and file write with:

```typescript
const raw = await session.ask(buildSynthesisPrompt(current, batch));
const snapshot = parseDesignSystemSnapshot(raw, app, allowedImageIds);
await saveDesignSystem(app, snapshot);
current = JSON.stringify(snapshot);
```

Remove `existsSync`, `mkdirSync`, `readFileSync`, and `writeFileSync` imports and update progress/error messages so they refer to a saved structured snapshot rather than a Markdown path.

- [ ] **Step 5: Run synthesis and parser tests**

Run:

```bash
node --experimental-strip-types --test src/synthesize.test.ts src/designSystem.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 6: Record the checkpoint**

Record `src/prompt.ts`, `src/synthesize.ts`, and `src/synthesize.test.ts` as the structured-synthesis change.

## Task 4: Serve the Structured Snapshot Through the API

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Replace the Markdown API test with JSON expectations**

Add dependency fakes and assert hydrated evidence:

```typescript
test("serves a hydrated structured design system", async (t) => {
  const { base, server } = await serve(createApiApp({
    getDesignSystem: async () => ({
      app: "linear",
      generatedAt: "2026-07-10T00:00:00.000Z",
      tokens: [{ id: "color-primary", kind: "color", name: "Primary", value: "#5E6AD2", role: "primary action", evidence: [7] }],
      components: [],
      flows: [],
    }),
    appImages: async () => [{ id: 7, app: "linear", platform: "web", image_url: "mobbin-bulk:0123456789abcdef", description: "Toolbar" }],
  }));
  t.after(() => close(server));

  const response = await fetch(`${base}/design-systems/linear`);
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.tokens[0].evidence[0].imageUrl, "/api/media/linear/0123456789abcdef");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("returns 404 when an app has no structured design system", async (t) => {
  const { base, server } = await serve(createApiApp({ getDesignSystem: async () => undefined }));
  t.after(() => close(server));
  assert.equal((await fetch(`${base}/design-systems/linear`)).status, 404);
});
```

Keep the existing media-file test as a separate test.

- [ ] **Step 2: Run the API test and verify it fails**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL because the API dependency type lacks the new functions and the route still reads Markdown.

- [ ] **Step 3: Replace the route implementation**

Update imports:

```typescript
import { query, createJob, listJobs, getJob, setJobStatus, getDesignSystem, appImages } from "../../../src/db.ts";
import { hydrateDesignSystem } from "../../../src/designSystem.ts";
```

Add `getDesignSystem` and `appImages` to `defaults`. Replace the existing `GET /design-systems/:app` route with:

```typescript
app.get("/design-systems/:app", async (req, res) => {
  const appSlug = req.params.app;
  if (!isAppSlug(appSlug)) {
    res.status(400).json({ error: "invalid app slug" });
    return;
  }
  const snapshot = await deps.getDesignSystem(appSlug);
  if (!snapshot) {
    res.status(404).json({ error: "design system not found" });
    return;
  }
  res.json(hydrateDesignSystem(snapshot, await deps.appImages(appSlug)));
});
```

Remove the no-longer-used `readFileSync` import. Keep `resolve` because the media route still needs it.

- [ ] **Step 4: Run the API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: all API tests pass.

- [ ] **Step 5: Record the checkpoint**

Record `services/api/src/app.ts` and `services/api/src/app.test.ts` as the structured API change.

## Task 5: Add One React Fetch Lifecycle for the Snapshot

**Files:**
- Create: `src/vitrine/useDesignSystem.ts`
- Modify: `src/vitrine/types.ts`

- [ ] **Step 1: Expose the shared view type**

Add this type-only export to `src/vitrine/types.ts`:

```typescript
export type { DesignSystemSnapshot, EvidenceView, DesignToken, DesignComponent } from "../designSystem";
```

- [ ] **Step 2: Create the fetch hook**

Create `src/vitrine/useDesignSystem.ts`:

```typescript
import { useEffect, useState } from "react";
import type { DesignSystemSnapshot, EvidenceView } from "../designSystem";

export function useDesignSystem(appId: string) {
  const [snapshot, setSnapshot] = useState<DesignSystemSnapshot<EvidenceView> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null);
    setStatus("loading");
    fetch(`/api/design-systems/${appId}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Design system returned ${response.status}`);
        return response.json() as Promise<DesignSystemSnapshot<EvidenceView>>;
      })
      .then((result) => {
        if (result) {
          setSnapshot(result);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [appId]);

  return { snapshot, status };
}
```

- [ ] **Step 3: Run the TypeScript build**

Run:

```bash
npm run build
```

Expected: build passes; the new hook is not mounted yet.

- [ ] **Step 4: Record the checkpoint**

Record `src/vitrine/useDesignSystem.ts` and `src/vitrine/types.ts` as the React data contract.

## Task 6: Replace Canned UI Elements and Flows

**Files:**
- Create: `src/vitrine/components/ComponentsPanel.tsx`
- Create: `src/vitrine/components/ComponentsPanel.test.tsx`
- Modify: `src/vitrine/components/ElementCard.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/ScreenDetail.test.tsx`
- Delete: `src/vitrine/data.ts`

- [ ] **Step 1: Write a failing evidence-card test**

Create `src/vitrine/components/ComponentsPanel.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ComponentsPanel } from "./ComponentsPanel.tsx";

test("renders app-specific components with real evidence images", () => {
  const html = renderToStaticMarkup(<ComponentsPanel components={[{
    id: "button",
    name: "Button",
    category: "Actions",
    description: "Rounded action control",
    variants: [{
      id: "button-primary",
      name: "Primary",
      description: "Filled purple button",
      evidence: [{ imageId: 7, imageUrl: "/api/media/linear/0123456789abcdef", description: "Toolbar" }],
    }],
  }]} />);
  assert.match(html, /Button/);
  assert.match(html, /1 observed variant/);
  assert.match(html, /\/api\/media\/linear\/0123456789abcdef/);
});
```

Update `src/vitrine/ScreenDetail.test.tsx` with:

```tsx
test("does not present generic flows when no captured flow data exists", () => {
  const html = renderToStaticMarkup(<ScreenDetail app={{ id: "linear", app: "Linear", cat: "Productivity", accent: "#5E6AD2", totalScreens: 0, screens: [] }} onBack={() => {}} />);
  assert.doesNotMatch(html, /The user creates an account/);
});
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
npx tsx --test src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: FAIL because `ComponentsPanel` does not exist and the canned data is still imported.

- [ ] **Step 3: Implement the pure component gallery**

Create `src/vitrine/components/ComponentsPanel.tsx`:

```tsx
import { EmptyState } from "@astryxdesign/core";
import type { DesignComponent, EvidenceView } from "../../designSystem";
import { ElementCard } from "./ElementCard";

export function ComponentsPanel({ components }: { components: DesignComponent<EvidenceView>[] }) {
  if (components.length === 0) {
    return <EmptyState title="No observed components" description="This app has no reviewed component evidence yet." />;
  }
  const categories = [...new Set(components.map((component) => component.category))];
  return <>
    {categories.map((category, categoryIndex) => {
      const items = components.filter((component) => component.category === category);
      return <section key={category} style={{ padding: "36px 0", borderTop: categoryIndex ? "1px solid var(--color-border)" : "none" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{category}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{items.length} component{items.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 20 }}>
          {items.map((component) => <ElementCard key={component.id} component={component} />)}
        </div>
      </section>;
    })}
  </>;
}
```

Replace `ElementCard`'s props and body so it uses the first observed evidence image:

```tsx
import { useState } from "react";
import type { DesignComponent, EvidenceView } from "../../designSystem";
import { PlaceholderImage } from "./PlaceholderImage";

export function ElementCard({ component }: { component: DesignComponent<EvidenceView> }) {
  const [hovered, setHovered] = useState(false);
  const evidence = component.variants[0]?.evidence[0];
  return <article
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    style={{ overflow: "hidden", borderRadius: "var(--radius-container)", border: "1px solid var(--color-border)", background: "var(--color-background-surface)", boxShadow: hovered ? "var(--shadow-med)" : "var(--shadow-low)", transform: hovered ? "translateY(-4px)" : "none", transition: "transform .22s ease, box-shadow .22s ease" }}
  >
    <div style={{ aspectRatio: "16/10", background: "var(--color-background-muted)" }}>
      <PlaceholderImage src={evidence?.imageUrl} />
    </div>
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 650 }}>{component.name}</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
        {component.variants.length} observed variant{component.variants.length === 1 ? "" : "s"}
      </div>
    </div>
  </article>;
}
```

- [ ] **Step 4: Mount structured data in `ScreenDetail`**

Remove the `ELEMENT_LIBRARY` and `FLOW_LIBRARY` import. Import `EmptyState`, `ComponentsPanel`, and `useDesignSystem`. At the start of `ScreenDetail`, add:

```typescript
const { snapshot, status: designSystemStatus } = useDesignSystem(app.id);
const components = snapshot?.components ?? [];
```

For the UI Elements tab, render:

```tsx
<ComponentsPanel components={components} />
```

For the Flows tab in this release, render an evidence-honest empty state:

```tsx
<EmptyState
  title="No captured flows yet"
  description="Flow sequences will appear after ordered web-flow capture is implemented."
/>
```

Update the tab count copy to use `components.length` and show `0 flows`. Remove element lightbox state and all generic element/flow calculations. Keep the real screen lightbox behavior unchanged.

Delete `src/vitrine/data.ts` after no imports remain.

- [ ] **Step 5: Run the focused React tests**

Run:

```bash
npx tsx --test src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: all focused tests pass and no generic flow copy appears.

- [ ] **Step 6: Record the checkpoint**

Record the new component panel, updated detail screen, updated card, tests, and deletion of `src/vitrine/data.ts` as the placeholder-removal change.

## Task 7: Render Structured Foundations

**Files:**
- Modify: `src/vitrine/components/DesignSystemPanel.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/DesignSystemPanel.test.tsx`

- [ ] **Step 1: Write the failing foundation-rendering test**

Replace the loading-only test with:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DesignSystemPanel } from "./components/DesignSystemPanel.tsx";

test("renders observed foundations with evidence counts", () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: "linear",
    generatedAt: "2026-07-10T00:00:00.000Z",
    tokens: [
      { id: "color-primary", kind: "color", name: "Primary", value: "#5E6AD2", role: "primary action", evidence: [{ imageId: 7, imageUrl: "/api/media/linear/a", description: "Toolbar" }] },
      { id: "space-8", kind: "spacing", name: "Space 8", value: "8px", role: "control gap", evidence: [{ imageId: 8, imageUrl: "/api/media/linear/b", description: "Form" }] },
    ],
    components: [],
    flows: [],
  }} status="ready" />);
  assert.match(html, /Colors/);
  assert.match(html, /#5E6AD2/);
  assert.match(html, /Spacing/);
  assert.match(html, /1 source screen/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/DesignSystemPanel.test.tsx
```

Expected: FAIL because `DesignSystemPanel` still fetches and renders Markdown.

- [ ] **Step 3: Replace the Markdown panel with a pure structured view**

Implement these props and states in `DesignSystemPanel.tsx`:

```tsx
import { EmptyState, Spinner } from "@astryxdesign/core";
import type { DesignSystemSnapshot, EvidenceView, TokenKind } from "../../designSystem";

const LABELS: Record<TokenKind, string> = {
  color: "Colors",
  typography: "Typography",
  spacing: "Spacing",
  radius: "Radii",
  border: "Borders",
  effect: "Effects",
};

export function DesignSystemPanel({
  snapshot,
  status,
}: {
  snapshot: DesignSystemSnapshot<EvidenceView> | null;
  status: "loading" | "ready" | "missing" | "error";
}) {
  if (status === "loading") return <Spinner size="lg" />;
  if (!snapshot) return <EmptyState title="No design system yet" description="Complete structured synthesis to publish observed foundations." />;
  const kinds = [...new Set(snapshot.tokens.map((token) => token.kind))];
  if (kinds.length === 0) return <EmptyState title="No observed foundations" description="No reviewed token evidence is available for this app." />;

  return <div style={{ display: "grid", gap: 32, paddingTop: 28 }}>
    {kinds.map((kind) => <section key={kind}>
      <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>{LABELS[kind]}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {snapshot.tokens.filter((token) => token.kind === kind).map((token) => <article key={token.id} style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)" }}>
          <div style={{ fontSize: 14, fontWeight: 650 }}>{token.name}</div>
          <code style={{ display: "block", marginTop: 6 }}>{token.value}</code>
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--color-text-secondary)" }}>{token.role}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-disabled)" }}>
            {token.evidence.length} source screen{token.evidence.length === 1 ? "" : "s"}
          </div>
        </article>)}
      </div>
    </section>)}
  </div>;
}
```

Pass `snapshot` and `designSystemStatus` from `ScreenDetail` instead of passing `appId`. Remove `lazy` and `Suspense`, replace the dynamic import with a direct `DesignSystemPanel` import, and render the panel directly because it no longer owns a network request.

- [ ] **Step 4: Run focused UI tests**

Run:

```bash
npx tsx --test src/vitrine/DesignSystemPanel.test.tsx src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: all focused UI tests pass.

- [ ] **Step 5: Record the checkpoint**

Record the structured foundations panel and ScreenDetail wiring as the UI completion checkpoint.

## Task 8: Verify the Complete Evidence-Core Release

**Files:**
- Verify all files listed in this plan

- [ ] **Step 1: Start the existing infrastructure required by integration tests**

Run:

```bash
docker compose up -d postgres
```

Expected: the `postgres` service is running and healthy enough for `src/db.test.ts` to execute rather than skip.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all tests pass, including structured parsing, PostgreSQL persistence, synthesis prompts, API hydration, component evidence rendering, and foundation rendering.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite completes successfully with no TypeScript or bundling errors.

- [ ] **Step 4: Run one real app synthesis smoke test**

With an already captioned app in the local database, run:

```bash
npm run synthesize -- linear chatgpt
```

Expected: progress reaches `done`, one `design_systems` row exists for `linear`, and every stored token/component variant has at least one evidence image ID belonging to Linear.

- [ ] **Step 5: Inspect the local product**

Run the existing API and Vite app, then verify:

```bash
npm run service:api
npm run dev
```

Expected behavior:

- Linear's UI Elements tab contains only synthesized app-specific components.
- Component cards use real captured evidence images.
- The Flows tab clearly states that ordered flows have not yet been captured.
- The Design System tab groups observed foundations and reports source-screen counts.
- No placeholder images or generic onboarding/checkout/2FA flows remain in these tabs.

- [ ] **Step 6: Record the release checkpoint**

List every changed file and the passing `npm test` and `npm run build` results. Do not claim a Git commit exists because `/Users/kai/works/eastplayers/Astryx` is not currently a Git repository.

## Exit Criteria

This release is complete only when:

- Structured synthesis is persisted in PostgreSQL rather than a Markdown file.
- Unsupported evidence IDs are removed at the trust boundary.
- Every published token and component variant has at least one captured image occurrence.
- The API returns browser-usable evidence URLs.
- UI Elements and Design System tabs use app-specific structured data.
- Generic component and flow libraries are deleted.
- The Flows tab is explicitly empty until reliable ordered capture is implemented.
- The full test suite and production build pass.

The next plan should implement reliable web-flow capture and screen semantics; it must not ask the model to infer flow order from the current unordered bulk-download images.
