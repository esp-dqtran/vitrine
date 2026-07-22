# GetDesign Native Design-System Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all 44 validated public GetDesign systems into native Astryx web snapshots and visibly render them in each matched app's existing Design System page without changing iOS or Android data.

**Architecture:** Pin the public GetDesign npm package as the repeatable source of the 44 Markdown templates, parse its YAML frontmatter and Markdown guidance into native `DesignSystemSnapshot` values, and apply each replacement transactionally with append-only rollback history. Mark the current design-system row as imported operationally so entitled users can read it when no published version exists, while keeping that source metadata out of the response and UI.

**Tech Stack:** TypeScript, Node.js test runner, PostgreSQL migrations/transactions, React 19 server-rendered component tests, `yaml` 2.9.0, `getdesign` 0.6.24.

---

## File structure

- Create `src/getdesignCatalog.ts` — the explicit 44-entry source-slug to Astryx-app mapping.
- Create `src/getdesignParser.ts` — pure frontmatter/body parsing, normalization, deterministic IDs, and imported-snapshot validation.
- Create `src/getdesignParser.test.ts` — parser and mapping unit tests using focused fixtures.
- Create `src/getdesignImportStore.ts` — preflight, transactional replace, imported-current lookup, and rollback.
- Create `src/getdesignImportStore.test.ts` — integration tests against the repository test database.
- Create `src/getdesignImportRunner.ts` — dry-run/apply/rollback orchestration and structured reporting with dependency injection.
- Create `src/getdesignImportRunner.test.ts` — runner behavior, all-or-nothing per app, and redaction tests.
- Create `scripts/import-getdesign-design-systems.ts` — thin CLI that reads pinned package templates and calls the runner.
- Create `migrations/0015_getdesign_imports.sql` — `design_systems.origin` plus append-only rollback history.
- Modify `src/designSystem.ts` — optional native snapshot summary.
- Modify `src/db.ts` — reset origin to `observed` when native synthesis overwrites an imported current snapshot.
- Modify `services/api/src/app.ts` — entitled fallback to the imported current snapshot when no published snapshot exists.
- Modify `services/api/src/app.test.ts` — fallback and non-fallback API tests.
- Modify `src/vitrine/components/DesignSystemPanel.tsx` — theme summary and evidence-free imported presentation.
- Modify `src/vitrine/DesignSystemPanel.test.tsx` — imported visual-system rendering tests.
- Modify `src/exportEngine.ts` — evidence-neutral language when an imported snapshot has no source screens.
- Modify `src/exportEngine.test.ts` — imported exports remain useful and do not claim screenshot evidence.
- Modify `package.json` and `package-lock.json` — pinned import dependencies and operator scripts.

## Task 1: Pin the source catalog and explicit mappings

**Files:**
- Create: `src/getdesignCatalog.ts`
- Create: `src/getdesignParser.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the pinned parser and catalog packages**

Run:

```bash
npm install --save-dev getdesign@0.6.24 yaml@2.9.0
```

Expected: `package.json` and `package-lock.json` record exact versions `0.6.24` and `2.9.0`; no application source changes.

- [ ] **Step 2: Write the failing 44-mapping test**

Create the first test in `src/getdesignParser.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { GETDESIGN_APP_MAPPINGS } from "./getdesignCatalog.ts";

test("defines 44 unique GetDesign-to-Astryx web mappings", () => {
  assert.equal(GETDESIGN_APP_MAPPINGS.length, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ sourceSlug }) => sourceSlug)).size, 44);
  assert.equal(new Set(GETDESIGN_APP_MAPPINGS.map(({ app }) => app)).size, 44);
  assert.deepEqual(
    GETDESIGN_APP_MAPPINGS.filter(({ createWebPlatform }) => createWebPlatform).map(({ app }) => app).sort(),
    ["my-bmw", "playstation-app", "raycast", "starbucks", "tesla"],
  );
  assert.ok(GETDESIGN_APP_MAPPINGS.every(({ platform }) => platform === "web"));
});
```

- [ ] **Step 3: Run the mapping test and verify it fails**

Run:

```bash
node --experimental-strip-types --test src/getdesignParser.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/getdesignCatalog.ts`.

- [ ] **Step 4: Implement the explicit mapping**

Create `src/getdesignCatalog.ts` with this public contract and all 44 entries from the approved spec:

```ts
export interface GetDesignAppMapping {
  sourceSlug: string;
  app: string;
  platform: "web";
  createWebPlatform?: true;
}

const direct = [
  "airbnb", "airtable", "apple", "binance", "claude", "clay", "cohere", "coinbase",
  "cursor", "discord", "elevenlabs", "figma", "framer", "intercom", "kraken", "lovable",
  "mintlify", "miro", "nike", "notion", "pinterest", "resend", "revolut", "sentry",
  "shopify", "slack", "spotify", "stripe", "supabase", "uber", "vercel", "webflow",
  "wise", "zapier",
] as const;

export const GETDESIGN_APP_MAPPINGS: readonly GetDesignAppMapping[] = [
  ...direct.map((app) => ({ sourceSlug: app, app, platform: "web" as const })),
  { sourceSlug: "bmw", app: "my-bmw", platform: "web", createWebPlatform: true },
  { sourceSlug: "cal", app: "cal-com", platform: "web" },
  { sourceSlug: "linear.app", app: "linear", platform: "web" },
  { sourceSlug: "mistral.ai", app: "mistral-ai", platform: "web" },
  { sourceSlug: "playstation", app: "playstation-app", platform: "web", createWebPlatform: true },
  { sourceSlug: "raycast", app: "raycast", platform: "web", createWebPlatform: true },
  { sourceSlug: "runwayml", app: "runway", platform: "web" },
  { sourceSlug: "starbucks", app: "starbucks", platform: "web", createWebPlatform: true },
  { sourceSlug: "superhuman", app: "superhuman-mail", platform: "web" },
  { sourceSlug: "tesla", app: "tesla", platform: "web", createWebPlatform: true },
].sort((left, right) => left.sourceSlug.localeCompare(right.sourceSlug));
```

- [ ] **Step 5: Run the mapping test**

Run:

```bash
node --experimental-strip-types --test src/getdesignParser.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 6: Commit the catalog boundary**

```bash
git add package.json package-lock.json src/getdesignCatalog.ts src/getdesignParser.test.ts
git commit -m "feat: define GetDesign import catalog"
```

## Task 2: Parse GetDesign into native snapshots

**Files:**
- Create: `src/getdesignParser.ts`
- Modify: `src/getdesignParser.test.ts`
- Modify: `src/designSystem.ts:81-96`

- [ ] **Step 1: Write failing frontmatter-token tests**

Add a compact representative fixture and assertions to `src/getdesignParser.test.ts`:

```ts
import { parseGetDesignMarkdown, validateImportedSnapshot } from "./getdesignParser.ts";

const fixture = `---
version: alpha
name: Example-design-analysis
description: "Dark, precise product UI."
colors:
  primary: "#5e6ad2"
  canvas: "#010102"
typography:
  display:
    fontFamily: Linear Display
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.1
rounded:
  md: 8px
spacing:
  sm: 12px
borders:
  hairline: 1px solid #23252a
effects:
  card: 0 8px 30px rgba(0,0,0,.25)
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: "#828fff"
---

## Responsive behavior
Use one column below 720px and preserve compact controls.
`;

test("parses GetDesign foundations into native tokens", () => {
  const snapshot = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  assert.equal(snapshot.summary, "Dark, precise product UI.");
  assert.deepEqual(snapshot.tokens.map(({ kind }) => kind), [
    "color", "color", "typography", "radius", "spacing", "border", "effect",
  ]);
  assert.ok(snapshot.tokens.every(({ evidence }) => evidence.length === 0));
  assert.doesNotThrow(() => validateImportedSnapshot(snapshot));
});
```

- [ ] **Step 2: Write failing component and rule tests**

```ts
test("groups component states and converts Markdown guidance to rules", () => {
  const snapshot = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  assert.deepEqual(snapshot.components.map(({ id }) => id), ["button-primary"]);
  assert.deepEqual(snapshot.components[0].variants.map(({ name }) => name), ["Default", "Hover"]);
  assert.equal(snapshot.components[0].variants[0].reconstruction?.fill, "#5e6ad2");
  assert.equal(snapshot.components[0].variants[0].reconstruction?.radius, 8);
  assert.equal(snapshot.rules?.[0].kind, "responsive");
  assert.match(snapshot.rules?.[0].description ?? "", /one column below 720px/i);
});

test("uses deterministic ids and rejects empty or duplicate structures", () => {
  const first = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  const second = parseGetDesignMarkdown(fixture, "linear", "2026-07-22T00:00:00.000Z");
  assert.deepEqual(first, second);
  assert.throws(
    () => validateImportedSnapshot({ ...first, tokens: [] }),
    /at least one design token/,
  );
  assert.throws(
    () => validateImportedSnapshot({ ...first, tokens: [first.tokens[0], first.tokens[0]] }),
    /duplicate token id/,
  );
});
```

- [ ] **Step 3: Run parser tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/getdesignParser.test.ts
```

Expected: FAIL because `getdesignParser.ts` and `summary` do not exist.

- [ ] **Step 4: Add the optional native summary**

Modify `DesignSystemSnapshot` in `src/designSystem.ts`:

```ts
summary?: string;
```

Place this field directly after `generatedAt: string;`; all existing fields and rule types remain unchanged.

- [ ] **Step 5: Implement the pure parser**

Create `src/getdesignParser.ts`. Use `parseDocument` from `yaml`, reject aliases/custom tags, split only the first `---` frontmatter block, and keep these exported functions:

```ts
import { parseDocument } from "yaml";
import type { DesignComponent, DesignSystemSnapshot, DesignToken, TokenKind } from "./designSystem.ts";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
const stateSuffix = /-(hover|pressed|focus|focused|active|selected|disabled|default|inverse|featured)$/;
const tokenKinds = new Set<TokenKind>(["color", "typography", "spacing", "radius", "border", "effect"]);

export function splitGetDesignDocument(markdown: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(markdown.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("GetDesign document must contain YAML frontmatter");
  const document = parseDocument(match[1], { maxAliasCount: 0, schema: "core" });
  if (document.errors.length) throw new Error(`Invalid GetDesign frontmatter: ${document.errors[0].message}`);
  const frontmatter = document.toJS({ maxAliasCount: 0 });
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) throw new Error("GetDesign frontmatter must be an object");
  return { frontmatter: frontmatter as Record<string, unknown>, body: match[2] };
}

export function parseGetDesignMarkdown(markdown: string, app: string, generatedAt = new Date().toISOString()): DesignSystemSnapshot {
  const { frontmatter, body } = splitGetDesignDocument(markdown);
  const references = new Map<string, string>();
  const tokens = parseTokenSections(frontmatter, references, [
    ["colors", "color"],
    ["typography", "typography"],
    ["spacing", "spacing"],
    ["rounded", "radius"],
    ["borders", "border"],
    ["effects", "effect"],
  ]);
  const components: DesignComponent[] = parseComponents(frontmatter.components, references);
  const rules = parseGuidanceRules(body);
  const snapshot = {
    app,
    generatedAt,
    summary: typeof frontmatter.description === "string" ? frontmatter.description.trim() : undefined,
    tokens,
    components,
    flows: [],
    rules,
  } satisfies DesignSystemSnapshot;
  validateImportedSnapshot(snapshot);
  return snapshot;
}

export function validateImportedSnapshot(snapshot: DesignSystemSnapshot): void {
  if (!snapshot.app.trim()) throw new Error("Imported snapshot app is required");
  if (!Number.isFinite(Date.parse(snapshot.generatedAt))) throw new Error("Imported snapshot generatedAt is invalid");
  if (!snapshot.tokens.length) throw new Error("Imported snapshot requires at least one design token");
  unique(snapshot.tokens.map(({ id }) => id), "token");
  unique(snapshot.components.map(({ id }) => id), "component");
  unique((snapshot.rules ?? []).map(({ id }) => id), "rule");
  for (const token of snapshot.tokens) {
    if (!tokenKinds.has(token.kind)) throw new Error(`Unsupported token kind: ${token.kind}`);
    if (token.evidence.length) throw new Error(`Imported token ${token.id} must not claim screenshot evidence`);
  }
  for (const component of snapshot.components) {
    if (!component.variants.length) throw new Error(`Imported component ${component.id} requires a variant`);
    unique(component.variants.map(({ id }) => id), `variant in ${component.id}`);
    if (component.variants.some(({ evidence }) => evidence.length)) throw new Error(`Imported component ${component.id} must not claim screenshot evidence`);
  }
  if ((snapshot.rules ?? []).some(({ evidence }) => evidence.length)) throw new Error("Imported rules must not claim screenshot evidence");
}
```

Implement the helpers in the same file with these fixed behaviors:

- scalar colors become `color-*` tokens;
- each typography object becomes one `typography-*` token whose value contains `font-family`, `font-size`, `font-weight`, `line-height`, and `letter-spacing` when present;
- `rounded` maps to `radius`, and the remaining sections map by name;
- `{colors.primary}` and equivalent component references resolve from the frontmatter map;
- component keys sharing the listed state suffixes become one family with named variants;
- numeric `padding`, `height`, and radius values populate `reconstruction`; background/text/border values populate `fill`/`stroke` and `observedProperties`;
- Markdown H2/H3 sections become deterministic rules; heading keywords select `responsive`, `imagery`, `icon`, `interaction`, or `content`, otherwise `layout`.

- [ ] **Step 6: Run focused parser tests**

Run:

```bash
node --experimental-strip-types --test src/getdesignParser.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit the native parser**

```bash
git add src/designSystem.ts src/getdesignParser.ts src/getdesignParser.test.ts
git commit -m "feat: parse GetDesign into native snapshots"
```

## Task 3: Add transactional replacement and rollback history

**Files:**
- Create: `migrations/0015_getdesign_imports.sql`
- Create: `src/getdesignImportStore.ts`
- Create: `src/getdesignImportStore.test.ts`
- Modify: `src/db.ts:575-581`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the migration**

Create `migrations/0015_getdesign_imports.sql`:

```sql
ALTER TABLE design_systems
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'observed'
  CHECK (origin IN ('observed', 'imported'));

CREATE TABLE design_system_import_history (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_slug TEXT NOT NULL,
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  previous_origin TEXT CHECK (previous_origin IN ('observed', 'imported')),
  previous_snapshot JSONB,
  imported_snapshot JSONB NOT NULL,
  created_platform BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  UNIQUE (run_id, app_id, platform)
);

CREATE INDEX design_system_import_history_app_created_idx
  ON design_system_import_history (app_id, platform, created_at DESC);
```

- [ ] **Step 2: Extend migration discovery tests**

Update the expected migration head in `src/migrations.test.ts` from 14 to 15 and add assertions that `design_systems.origin` and `design_system_import_history` exist after migration.

- [ ] **Step 3: Write failing store tests**

Create `src/getdesignImportStore.test.ts` using the same `TEST_DATABASE_URL`/truncate conventions as `src/db.test.ts`:

```ts
test("replaces web atomically, creates only an approved missing web platform, and records history", async () => {
  await seedApp("tesla", ["ios"], observedSnapshot("tesla"));
  const imported = importedSnapshot("tesla");
  const result = await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000001",
    app: "tesla",
    platform: "web",
    sourceSlug: "tesla",
    sourceHash: "a".repeat(64),
    snapshot: imported,
    allowCreateWebPlatform: true,
  });
  assert.equal(result.createdPlatform, true);
  assert.deepEqual(await platformNames("tesla"), ["ios", "web"]);
  assert.equal((await getImportedCurrentDesignSystem(pool, "tesla", "web"))?.summary, imported.summary);
  assert.deepEqual(await currentDesignSystem("tesla", "ios"), observedSnapshot("tesla"));
  assert.equal(await historyCount("tesla", "web"), 1);
});

test("rejects an unexpected missing web platform without changing mobile data", async () => {
  await seedApp("linear", ["ios"], observedSnapshot("linear"));
  await assert.rejects(() => replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000002",
    app: "linear", platform: "web", sourceSlug: "linear.app", sourceHash: "b".repeat(64),
    snapshot: importedSnapshot("linear"), allowCreateWebPlatform: false,
  }), /web platform is missing/);
  assert.deepEqual(await platformNames("linear"), ["ios"]);
});

test("rollback restores the prior existing-web snapshot", async () => {
  const prior = observedSnapshot("linear");
  await seedApp("linear", ["web"], prior);
  await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000003", app: "linear", platform: "web",
    sourceSlug: "linear.app", sourceHash: "c".repeat(64), snapshot: importedSnapshot("linear"),
    allowCreateWebPlatform: false,
  });
  await rollbackImportedDesignSystem(pool, "linear");
  assert.deepEqual(await currentDesignSystem("linear", "web"), prior);
  assert.equal(await historyRolledBack("linear", "web"), true);
});

test("rollback removes an importer-created web platform without touching iOS", async () => {
  const ios = observedSnapshot("tesla");
  await seedApp("tesla", ["ios"], ios);
  await replaceImportedDesignSystem(pool, {
    runId: "00000000-0000-4000-8000-000000000004", app: "tesla", platform: "web",
    sourceSlug: "tesla", sourceHash: "d".repeat(64), snapshot: importedSnapshot("tesla"),
    allowCreateWebPlatform: true,
  });
  await rollbackImportedDesignSystem(pool, "tesla");
  assert.deepEqual(await platformNames("tesla"), ["ios"]);
  assert.deepEqual(await currentDesignSystem("tesla", "ios"), ios);
});
```

- [ ] **Step 4: Run store tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/getdesignImportStore.test.ts
```

Expected: FAIL because the store module and migration are not implemented in the test database.

- [ ] **Step 5: Implement the store**

Create `src/getdesignImportStore.ts` with injected `pg.Pool` and these exports:

```ts
export interface ReplaceImportedDesignSystemInput {
  runId: string;
  app: string;
  platform: "web";
  sourceSlug: string;
  sourceHash: string;
  snapshot: DesignSystemSnapshot;
  allowCreateWebPlatform: boolean;
}

export async function replaceImportedDesignSystem(
  pool: pg.Pool,
  input: ReplaceImportedDesignSystemInput,
): Promise<{ historyId: string; changed: boolean; createdPlatform: boolean }> {
  return transaction(pool, async (client) => {
    const app = await client.query<{ id: number }>("SELECT id FROM apps WHERE name = $1 FOR UPDATE", [input.app]);
    if (!app.rowCount) throw new Error(`Mapped app not found: ${input.app}`);
    const appId = app.rows[0].id;
    const platform = await client.query("SELECT 1 FROM platforms WHERE app_id = $1 AND name = 'web'", [appId]);
    const createdPlatform = !platform.rowCount;
    if (createdPlatform && !input.allowCreateWebPlatform) throw new Error(`Mapped app web platform is missing: ${input.app}`);
    if (createdPlatform) await client.query("INSERT INTO platforms (app_id, name) VALUES ($1, 'web')", [appId]);
    const previous = await client.query<{ snapshot: DesignSystemSnapshot; origin: "observed" | "imported" }>(
      "SELECT snapshot, origin FROM design_systems WHERE app_id = $1 AND platform = 'web' FOR UPDATE",
      [appId],
    );
    const changed = JSON.stringify(previous.rows[0]?.snapshot) !== JSON.stringify(input.snapshot)
      || previous.rows[0]?.origin !== "imported";
    const history = await client.query<{ id: string }>(`INSERT INTO design_system_import_history
      (run_id, app_id, platform, source_slug, source_hash, previous_origin, previous_snapshot, imported_snapshot, created_platform)
      VALUES ($1, $2, 'web', $3, $4, $5, $6::jsonb, $7::jsonb, $8) RETURNING id`, [
      input.runId, appId, input.sourceSlug, input.sourceHash, previous.rows[0]?.origin ?? null,
      previous.rows[0] ? JSON.stringify(previous.rows[0].snapshot) : null,
      JSON.stringify(input.snapshot), createdPlatform,
    ]);
    await client.query(`INSERT INTO design_systems (app_id, platform, snapshot, origin)
      VALUES ($1, 'web', $2::jsonb, 'imported')
      ON CONFLICT (app_id, platform) DO UPDATE
      SET snapshot = EXCLUDED.snapshot, origin = 'imported', updated_at = now()`, [appId, JSON.stringify(input.snapshot)]);
    return { historyId: history.rows[0].id, changed, createdPlatform };
  });
}

export async function getImportedCurrentDesignSystem(
  pool: pg.Pool,
  app: string,
  platform: string,
): Promise<DesignSystemSnapshot | undefined> {
  const result = await pool.query<{ snapshot: DesignSystemSnapshot }>(`SELECT ds.snapshot
    FROM apps a JOIN design_systems ds ON ds.app_id = a.id
    WHERE a.name = $1 AND ds.platform = $2 AND ds.origin = 'imported'`, [app, platform]);
  return result.rows[0]?.snapshot;
}
```

Also export `inspectGetDesignTarget(pool, mapping)`, which selects the mapped app and its platform names without mutation, and `rollbackImportedDesignSystem(pool, app)`. Rollback runs in one transaction: lock the latest non-rolled-back web history row; restore `previous_snapshot` and `previous_origin` or delete the current imported row when no prior snapshot exists; remove an importer-created web platform only after proving no web images or design-system versions reference it; then set that history row's `rolled_back_at`. Throw before mutation if no eligible history exists or if an importer-created platform has gained references.

- [ ] **Step 6: Make native synthesis reset the operational origin**

Modify `saveDesignSystem` in `src/db.ts` so ordinary Astryx synthesis takes ownership again:

```sql
INSERT INTO design_systems (app_id, platform, snapshot, origin)
SELECT id, $2, $3::jsonb, 'observed' FROM apps WHERE name = $1
ON CONFLICT (app_id, platform) DO UPDATE
SET snapshot = EXCLUDED.snapshot, origin = 'observed', updated_at = now()
```

- [ ] **Step 7: Run migration and store tests**

Run:

```bash
node --experimental-strip-types --test src/migrations.test.ts src/getdesignImportStore.test.ts src/db.test.ts
```

Expected: PASS with no migration gaps and all transaction/rollback cases green.

- [ ] **Step 8: Commit persistence and recovery**

```bash
git add migrations/0015_getdesign_imports.sql src/migrations.test.ts src/getdesignImportStore.ts src/getdesignImportStore.test.ts src/db.ts
git commit -m "feat: store GetDesign imports with rollback"
```

## Task 4: Build dry-run, apply, rollback, and reporting

**Files:**
- Create: `src/getdesignImportRunner.ts`
- Create: `src/getdesignImportRunner.test.ts`
- Create: `scripts/import-getdesign-design-systems.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing runner tests**

Create `src/getdesignImportRunner.test.ts` with injected template reader and store functions:

```ts
test("dry-run parses all 44 mappings without mutation", async () => {
  const applied: string[] = [];
  const report = await runGetDesignImport({ mode: "dry-run" }, {
    mappings: GETDESIGN_APP_MAPPINGS,
    readTemplate: async (slug) => validTemplate(slug),
    inspectTarget: async (mapping) => ({ appFound: true, webPlatformFound: !mapping.createWebPlatform }),
    replace: async (input) => { applied.push(input.app); return fakeReplace(); },
    rollback: async () => fakeRollback(),
    now: () => new Date("2026-07-22T00:00:00.000Z"),
    runId: () => "00000000-0000-4000-8000-000000000003",
  });
  assert.equal(report.expected, 44);
  assert.equal(report.valid, 44);
  assert.equal(report.applied, 0);
  assert.deepEqual(applied, []);
});

test("apply continues after one per-app failure and reports exact outcomes", async () => {
  const report = await runGetDesignImport({ mode: "apply" }, {
    mappings: GETDESIGN_APP_MAPPINGS,
    readTemplate: async (slug) => validTemplate(slug),
    inspectTarget: async (mapping) => ({ appFound: true, webPlatformFound: !mapping.createWebPlatform }),
    replace: async (input) => {
      if (input.app === "linear") throw new Error("write failed");
      return fakeReplace();
    },
    rollback: async () => fakeRollback(),
    now: () => new Date("2026-07-22T00:00:00.000Z"),
    runId: () => "00000000-0000-4000-8000-000000000004",
  });
  assert.equal(report.applied, 43);
  assert.equal(report.failed, 1);
  assert.equal(report.results.length, 44);
  assert.equal(report.results.find(({ app }) => app === "linear")?.error, "write failed");
});

test("redacts database URLs and credentials from report errors", () => {
  assert.equal(redactImportError(new Error("postgres://user:secret@db/app failed"), "postgres://user:secret@db/app"), "[redacted] failed");
});

test("requires exactly one mode and a named app for rollback", () => {
  assert.deepEqual(parseGetDesignImportArgs(["--dry-run"]), { mode: "dry-run" });
  assert.deepEqual(parseGetDesignImportArgs(["--rollback", "tesla"]), { mode: "rollback", app: "tesla" });
  assert.throws(() => parseGetDesignImportArgs([]), /exactly one mode/);
});
```

- [ ] **Step 2: Run runner tests and verify they fail**

Run:

```bash
node --experimental-strip-types --test src/getdesignImportRunner.test.ts
```

Expected: FAIL because `getdesignImportRunner.ts` does not exist.

- [ ] **Step 3: Implement the runner**

Create `src/getdesignImportRunner.ts` with the exact result shape:

```ts
export interface GetDesignImportResult {
  sourceSlug: string;
  app: string;
  sourceHash?: string;
  status: "valid" | "applied" | "unchanged" | "failed" | "rolled_back";
  createdPlatform?: boolean;
  historyId?: string;
  error?: string;
}

export interface GetDesignImportReport {
  mode: "dry-run" | "apply" | "rollback";
  runId: string;
  expected: number;
  valid: number;
  applied: number;
  unchanged: number;
  failed: number;
  results: GetDesignImportResult[];
}
```

`runGetDesignImport` must read and parse all templates before the first mutation, hash raw content with SHA-256, verify the five `createWebPlatform` flags match actual missing-web state, and then apply valid entries one at a time so one transaction failure does not roll back other apps. Dry-run returns only `valid`/`failed`; rollback accepts only a mapped Astryx app.

- [ ] **Step 4: Implement the thin CLI**

Create `scripts/import-getdesign-design-systems.ts`:

```ts
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { databasePoolOptions } from "../src/dbPoolConfig.ts";
import { GETDESIGN_APP_MAPPINGS } from "../src/getdesignCatalog.ts";
import { runGetDesignImport, parseGetDesignImportArgs, redactImportError } from "../src/getdesignImportRunner.ts";
import { inspectGetDesignTarget, replaceImportedDesignSystem, rollbackImportedDesignSystem } from "../src/getdesignImportStore.ts";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("getdesign/package.json"));

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: databaseUrl, ...databasePoolOptions(process.env), max: 2 });
  try {
    const report = await runGetDesignImport(parseGetDesignImportArgs(process.argv.slice(2)), {
      mappings: GETDESIGN_APP_MAPPINGS,
      readTemplate: (slug) => readFile(join(packageRoot, "templates", `${slug}.md`), "utf8"),
      inspectTarget: (mapping) => inspectGetDesignTarget(pool, mapping),
      replace: (input) => replaceImportedDesignSystem(pool, input),
      rollback: (app) => rollbackImportedDesignSystem(pool, app),
      now: () => new Date(),
      runId: () => randomUUID(),
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(redactImportError(error, process.env.DATABASE_URL ?? ""));
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Add operator scripts**

Add to `package.json`:

```json
"design-systems:getdesign:dry-run": "node --env-file=.env --import tsx scripts/import-getdesign-design-systems.ts --dry-run",
"design-systems:getdesign:apply": "node --env-file=.env --import tsx scripts/import-getdesign-design-systems.ts --apply",
"design-systems:getdesign:rollback": "node --env-file=.env --import tsx scripts/import-getdesign-design-systems.ts --rollback"
```

The rollback script is invoked as `npm run design-systems:getdesign:rollback -- <app>`; `parseGetDesignImportArgs` accepts that positional app after `--rollback`.

- [ ] **Step 6: Run runner tests**

Run:

```bash
node --experimental-strip-types --test src/getdesignImportRunner.test.ts
```

Expected: PASS for dry-run, partial apply failure, redaction, and argument parsing.

- [ ] **Step 7: Commit orchestration**

```bash
git add src/getdesignImportRunner.ts src/getdesignImportRunner.test.ts scripts/import-getdesign-design-systems.ts package.json package-lock.json
git commit -m "feat: add GetDesign import operations"
```

## Task 5: Serve imported systems to entitled app pages

**Files:**
- Modify: `services/api/src/app.ts:5-45,271-306,1810-1837,2594-2639`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing API fallback tests**

Add tests using `startApi` dependency overrides:

```ts
test("serves imported current web design when no published design system exists", async () => {
  const imported = importedSnapshot("linear");
  const { base, close } = await startApi({
    canAccessApp: async () => true,
    getVersionDesignSystem: async () => undefined,
    getImportedCurrentDesignSystem: async (app, platform) => app === "linear" && platform === "web" ? imported : undefined,
    getAppFlows: async () => [],
    appImages: async () => [],
  });
  try {
    const response = await fetch(`${base}/design-systems/linear?platform=web`, { headers: userCookie });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary, imported.summary);
  } finally { await close(); }
});

test("does not use imported-current fallback for an explicit version", async () => {
  let fallbackReads = 0;
  const { base, close } = await startApi({
    canAccessApp: async () => true,
    getVersionDesignSystem: async () => undefined,
    getImportedCurrentDesignSystem: async () => { fallbackReads += 1; return importedSnapshot("linear"); },
    getAppFlows: async () => [],
    appImages: async () => [],
  });
  try {
    const response = await fetch(`${base}/design-systems/linear?platform=web&version=2`, { headers: userCookie });
    assert.equal(response.status, 404);
    assert.equal(fallbackReads, 0);
  } finally { await close(); }
});
```

Add the equivalent export-route test so `POST /design-systems/:app/exports` can export an imported current snapshot when no published version exists.

- [ ] **Step 2: Run the focused API tests and verify failure**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: FAIL because `getImportedCurrentDesignSystem` is not a dependency and the routes do not call it.

- [ ] **Step 3: Wire the imported-current dependency**

Import `getImportedCurrentDesignSystem` from `src/getdesignImportStore.ts`, expose a default closure that passes the shared database pool, and use this selection rule in both GET and export routes:

```ts
const importedCurrent = requestedVersion === undefined && !versioned
  ? await deps.getImportedCurrentDesignSystem(appSlug, platform)
  : undefined;
const snapshot = versioned?.snapshot
  ?? importedCurrent
  ?? (res.locals.user.role === "admin" ? await deps.getDesignSystem(appSlug, platform) : undefined);
```

For the export POST, `requestedVersion` is absent; use imported fallback after `getVersionDesignSystem` and before the admin-only current snapshot. Keep `canAccessApp` as the authorization gate. Never return the `origin` column or history metadata.

- [ ] **Step 4: Run API tests**

Run:

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: PASS, including existing publication/access tests and the new fallback tests.

- [ ] **Step 5: Commit the page delivery seam**

```bash
git add services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: serve imported design systems"
```

## Task 6: Render the imported system visibly in the existing page

**Files:**
- Modify: `src/vitrine/components/DesignSystemPanel.tsx:1-248`
- Modify: `src/vitrine/DesignSystemPanel.test.tsx`

- [ ] **Step 1: Write the failing imported-page test**

Add to `src/vitrine/DesignSystemPanel.test.tsx`:

```tsx
test("renders an evidence-free imported system as visual native sections", () => {
  const html = renderToStaticMarkup(<DesignSystemPanel snapshot={{
    app: "linear",
    generatedAt: "2026-07-22T00:00:00.000Z",
    summary: "Dark, precise product UI.",
    tokens: [
      { id: "color-primary", kind: "color", name: "Primary", value: "#5e6ad2", role: "Brand color", evidence: [] },
      { id: "type-display", kind: "typography", name: "Display", value: "font-family: Linear Display; font-size: 56px; font-weight: 600", role: "Display typography", evidence: [] },
      { id: "space-sm", kind: "spacing", name: "Small", value: "12px", role: "Spacing scale", evidence: [] },
      { id: "radius-md", kind: "radius", name: "Medium", value: "8px", role: "Corner radius", evidence: [] },
    ],
    components: [{
      id: "button-primary", name: "Button primary", category: "Button", description: "Primary action",
      variants: [{ id: "button-primary-hover", name: "Hover", description: "Hover state", evidence: [], reconstruction: { fill: "#828fff", radius: 8, visibleText: "Button primary" } }],
    }],
    flows: [],
    rules: [{ id: "responsive-layout", kind: "responsive", name: "Responsive layout", description: "Use one column below 720px", evidence: [] }],
  }} status="ready" />);
  assert.match(html, /Theme summary/);
  assert.match(html, /Dark, precise product UI/);
  assert.match(html, /Colors/);
  assert.match(html, /Typography/);
  assert.match(html, /Spacing/);
  assert.match(html, /Radii/);
  assert.match(html, /Components/);
  assert.match(html, /Responsive layout/);
  assert.doesNotMatch(html, /source screen|confidence|Needs review/i);
  assert.doesNotMatch(html, /GetDesign/i);
});
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run:

```bash
npx tsx --test src/vitrine/DesignSystemPanel.test.tsx
```

Expected: FAIL because the theme-summary section is missing.

- [ ] **Step 3: Add the theme summary and evidence-free behavior**

Add a compact first section in `DesignSystemPanel.tsx`:

```tsx
function ThemeSummary({ index, summary }: { index: number; summary: string }) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <SectionEyebrow index={index} label="Theme summary" />
      <Card padding={4}>
        <Text as="p" type="body" color="secondary" style={{ margin: 0, maxWidth: 880 }}>{summary}</Text>
      </Card>
    </section>
  );
}
```

Render it before colors when `snapshot.summary` is non-empty. Keep `EvidenceLinks` returning `null` for empty arrays and `ReviewFooter` returning `null` when both fields are absent. Update the empty-state copy from evidence-specific language to `No design tokens, components, or rules are available for this app.`

For typography previews, parse the `font-size` declaration before falling back to the first pixel value:

```ts
const typographySize = (value: string) => {
  const match = /font-size:\s*(-?\d+(?:\.\d+)?)px/i.exec(value);
  return match ? Number(match[1]) : pxValue(value);
};
```

- [ ] **Step 4: Run UI tests**

Run:

```bash
npx tsx --test src/vitrine/DesignSystemPanel.test.tsx src/vitrine/ScreenDetail.test.tsx
```

Expected: PASS; observed snapshots still show evidence, imported snapshots do not.

- [ ] **Step 5: Commit the visual page**

```bash
git add src/vitrine/components/DesignSystemPanel.tsx src/vitrine/DesignSystemPanel.test.tsx
git commit -m "feat: render imported design systems"
```

## Task 7: Make every export evidence-neutral when needed

**Files:**
- Modify: `src/exportEngine.ts:25-174,220-261,284-307`
- Modify: `src/exportEngine.test.ts`

- [ ] **Step 1: Write failing imported-export tests**

Add to `src/exportEngine.test.ts`:

```ts
test("exports evidence-free imported systems without observed-screen claims", () => {
  const imported: DesignSystemSnapshot = {
    app: "linear", generatedAt: "2026-07-22T00:00:00.000Z", summary: "Dark product UI",
    tokens: [{ id: "primary", kind: "color", name: "Primary", value: "#5e6ad2", role: "Brand", evidence: [] }],
    components: [{ id: "button", name: "Button", category: "Actions", description: "Primary action", variants: [{ id: "default", name: "Default", description: "Default state", evidence: [] }] }],
    flows: [], rules: [],
  };
  const markdown = buildExportArtifact(imported, [], "design-md", whole).content.toString();
  assert.match(markdown, /Dark product UI/);
  assert.doesNotMatch(markdown, /observed|evidence screen/i);
  const react = buildExportArtifact(imported, [], "react", whole).content.toString();
  assert.doesNotMatch(react, /Evidence:/);
  const figma = buildExportArtifact(imported, [], "figma", whole).content.toString();
  assert.doesNotMatch(figma, /Every generated .* backed by the evidence|Evidence screens:/);
});
```

- [ ] **Step 2: Run export tests and verify failure**

Run:

```bash
node --experimental-strip-types --test src/exportEngine.test.ts
```

Expected: FAIL because current output always says `observed` and `Evidence screens`.

- [ ] **Step 3: Implement evidence-aware copy**

Add one helper and use it across DESIGN.md, React comments, Figma descriptions/readme, CSS header, and component specs:

```ts
const hasEvidence = (snapshot: DesignSystemSnapshot): boolean => [
  ...snapshot.tokens.flatMap(({ evidence }) => evidence),
  ...snapshot.components.flatMap(evidenceForComponent),
  ...snapshot.flows.flatMap(({ steps }) => steps.flatMap(({ evidence }) => evidence)),
  ...(snapshot.rules ?? []).flatMap(({ evidence }) => evidence),
].length > 0;
```

When false, describe the artifact as `Astryx design system for <app>`, use `snapshot.summary` in the DESIGN.md overview, omit evidence comments/labels/reference frames, and keep tokens/components/rules unchanged. When true, retain existing observed/evidence language byte-for-byte where practical so current tests remain stable.

- [ ] **Step 4: Run export tests**

Run:

```bash
node --experimental-strip-types --test src/exportEngine.test.ts
```

Expected: PASS for existing evidence-backed exports and new imported exports.

- [ ] **Step 5: Commit export compatibility**

```bash
git add src/exportEngine.ts src/exportEngine.test.ts
git commit -m "fix: export evidence-free design systems"
```

## Task 8: Full-catalog dry run, apply, and live verification

**Files:**
- Modify only if verification exposes a proven defect in the files above.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and the Vite build exits 0. Do not run the configured-database migration check until migration 0015 has been applied.

- [ ] **Step 2: Apply migration 0015**

Run:

```bash
npm run db:migrate
npm run db:check
```

Expected: migration 15 applies once; the follow-up check reports current migrations.

- [ ] **Step 3: Run the 44-system dry run**

Run:

```bash
npm run design-systems:getdesign:dry-run
```

Expected JSON:

```json
{
  "mode": "dry-run",
  "expected": 44,
  "valid": 44,
  "applied": 0,
  "failed": 0
}
```

Also require exactly five results to report `createdPlatform: true` or `wouldCreatePlatform: true`: `my-bmw`, `playstation-app`, `raycast`, `starbucks`, and `tesla`. Do not apply if any other mapping lacks web.

- [ ] **Step 4: Capture pre-apply mobile hashes**

Run a read-only PostgreSQL query through a short Node command that records SHA-256 hashes of every iOS/Android `design_systems.snapshot` for the 44 mapped apps. Keep the output in the terminal/session, not a repository file.

Expected: a deterministic app/platform/hash list used for post-apply reconciliation.

- [ ] **Step 5: Apply all valid imports**

Run:

```bash
npm run design-systems:getdesign:apply
```

Expected JSON: `expected: 44`, `applied + unchanged: 44`, `failed: 0`, and five created web platforms on the first run.

- [ ] **Step 6: Prove idempotence**

Run the apply command again:

```bash
npm run design-systems:getdesign:apply
```

Expected JSON: `expected: 44`, `unchanged: 44`, `failed: 0`, and no new platform rows.

- [ ] **Step 7: Reconcile database and API state**

Run read-only checks proving:

```text
44/44 mapped apps exist
44/44 have a web platform
44/44 web design_systems rows have origin=imported
44/44 snapshots contain at least one token
44/44 snapshots contain no non-empty evidence arrays
5/5 approved mobile-only apps gained web and retained their mobile platforms
all captured iOS/Android snapshot hashes are unchanged
44 import-history rows exist for the first apply run
```

For at least `linear`, `spotify`, `apple`, and `tesla`, call the authenticated design-system API and confirm the response contains summary/tokens/components/rules but no origin/history/source fields.

- [ ] **Step 8: Browser-verify representative pages**

Open the real app and inspect these routes as an entitled user:

```text
/apps/linear/design-system       dark, typography-heavy
/apps/apple/design-system        light, spacious
/apps/spotify/design-system      strong color and media styling
/apps/tesla/design-system        newly created web platform
```

Verify visible theme summary, color swatches, typography, spacing/radii, components, and rules; no raw Markdown; no GetDesign label/link; no `0 evidence`, confidence, or review UI.

- [ ] **Step 9: Exercise rollback on one non-production-safe test target before final handoff**

Use a temporary test database or dedicated fixture app, not a live customer app. Override `DATABASE_URL` explicitly so the package script cannot read the live value from `.env`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/astryx_getdesign_test npm run design-systems:getdesign:rollback -- tesla
```

Expected: previous snapshot restored or importer-created test web platform removed, history marked rolled back, and mobile data unchanged. Reapply in the test database and confirm the page returns.

- [ ] **Step 10: Commit any verification-only corrections, then verify clean status**

If no corrections were needed, do not create an empty commit. Otherwise stage only the proven fix and its test, commit with a focused message, rerun the affected test plus `npm test` and `npm run build`, then run:

```bash
git status --short
```

Expected: only the user's pre-existing `docs/design-extracts/` remains untracked; no implementation files are unstaged.
