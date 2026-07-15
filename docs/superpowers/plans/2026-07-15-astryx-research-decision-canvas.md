# Astryx Research Project and Decision Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal designer research workspace that combines entitled catalog evidence and private screenshots into comparison lanes, validates evidence-cited AI synthesis, and exports an authenticated Markdown handoff.

**Architecture:** Add normalized PostgreSQL project data, focused domain/store/retrieval/upload/synthesis modules, and a dependency-injected Express router. Add dedicated Vitrine routes and components for the project list, evidence drawer, constrained lane canvas, and insights panel. Keep generation synchronous in v1 and preserve the existing object-storage and catalog-entitlement boundaries.

**Tech Stack:** TypeScript, Node 22 test runner, Express 5, PostgreSQL 17, React 19, Vite 8, `@astryxdesign/core`, S3-compatible `ObjectStore`, native `fetch` to an OpenAI-compatible endpoint.

---

## Execution Gate: Reconcile the Dirty Checkout

The live checkout contains user-owned, uncommitted signup, authentication, user-admin, navigation, API, and catalog-import work. This feature overlaps `services/api/src/app.ts`, `src/vitrine/App.tsx`, `src/vitrine/components/Sidebar.tsx`, `src/vitrine/main.tsx`, and `src/vitrine/types.ts`.

Do not create a clean worktree from `a8f3532` and silently omit those changes. The owner must first commit the current work or select another base.

- [ ] **Step 1: Record the base state**

```bash
git status --short
git log -3 --oneline --decorate
```

Expected: `a8f3532` is present and the user-owned changes are visible.

- [ ] **Step 2: Create an isolated worktree after reconciliation**

```bash
git worktree add ../Astryx-research-canvas -b codex/research-decision-canvas
cd ../Astryx-research-canvas
git status --short
```

Expected: a clean worktree whose `HEAD` contains the reconciled auth/admin work, design, and plan.

## File Map

- Create `migrations/0006_research_projects.sql`.
- Create `src/researchProject.ts`, `researchProjectStore.ts`, `researchSuggestions.ts`, `researchUpload.ts`, `researchSynthesis.ts`, `researchSynthesisProvider.ts`, and paired tests.
- Modify `src/objectStore.ts` and its tests for owner-scoped private keys.
- Create `services/api/src/researchProjects.ts` and tests; modify `app.ts` and `index.ts` to mount/configure it.
- Create `src/vitrine/researchProjectsApi.ts` and tests.
- Modify `src/vitrine/router.ts`, `main.tsx`, `App.tsx`, and `components/Sidebar.tsx`.
- Create `ResearchProjectsPage`, `ResearchProjectPage`, `EvidenceDrawer`, `DecisionCanvas`, `EvidenceCard`, and `ProjectInsightsPanel` under `src/vitrine/components/`.
- Create `src/vitrine/ResearchProjects.test.tsx`.
- Modify `.env.example` and `README.md`.

---

### Task 1: Add the Research Project Schema

**Files:**
- Create: `migrations/0006_research_projects.sql`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
test("research migration defines owner-scoped ordered evidence", async () => {
  const sql = await readFile(new URL("../migrations/0006_research_projects.sql", import.meta.url), "utf8");
  for (const table of ["research_projects", "research_project_lanes", "research_project_items", "research_project_syntheses"]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`));
  }
  assert.match(sql, /user_id BIGINT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /UNIQUE \(project_id, position\)/);
  assert.match(sql, /UNIQUE \(lane_id, position\)/);
  assert.match(sql, /private_object_key TEXT REFERENCES stored_objects\(object_key\)/);
});
```

- [ ] **Step 2: Verify it fails**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL with `ENOENT` for migration `0006`.

- [ ] **Step 3: Create the migration**

```sql
CREATE TABLE research_projects (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 1000),
  platform_filter TEXT NOT NULL DEFAULT 'all' CHECK (platform_filter IN ('all', 'ios', 'android', 'web')),
  constraints TEXT NOT NULL DEFAULT '' CHECK (char_length(constraints) <= 4000),
  decision TEXT NOT NULL DEFAULT '' CHECK (char_length(decision) <= 8000),
  rationale TEXT NOT NULL DEFAULT '' CHECK (char_length(rationale) <= 8000),
  open_questions TEXT NOT NULL DEFAULT '' CHECK (char_length(open_questions) <= 4000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX research_projects_user_updated_idx ON research_projects (user_id, updated_at DESC);

CREATE TABLE research_project_lanes (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 4),
  conclusion TEXT NOT NULL DEFAULT '' CHECK (char_length(conclusion) <= 4000),
  UNIQUE (project_id, position)
);

CREATE TABLE research_project_items (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  lane_id BIGINT NOT NULL REFERENCES research_project_lanes(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('catalog_screen', 'catalog_flow_step', 'private_upload')),
  catalog_app TEXT, catalog_version_id BIGINT REFERENCES app_versions(id) ON DELETE RESTRICT,
  catalog_image_id BIGINT REFERENCES images(id) ON DELETE RESTRICT,
  catalog_flow_id TEXT, catalog_step_index INTEGER CHECK (catalog_step_index IS NULL OR catalog_step_index >= 0),
  private_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  step_label TEXT NOT NULL DEFAULT '' CHECK (char_length(step_label) <= 240),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  important BOOLEAN NOT NULL DEFAULT false,
  source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lane_id, position),
  CHECK ((source_kind = 'private_upload' AND private_object_key IS NOT NULL AND catalog_app IS NULL)
    OR (source_kind <> 'private_upload' AND private_object_key IS NULL AND catalog_app IS NOT NULL))
);
CREATE INDEX research_project_items_project_idx ON research_project_items (project_id);

CREATE TABLE research_project_syntheses (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  project_revision INTEGER NOT NULL CHECK (project_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  result JSONB, error_code TEXT, model TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'complete' AND result IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND result IS NULL AND error_code IS NOT NULL))
);
```

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/migrations.test.ts
npm run db:check
git add migrations/0006_research_projects.sql src/migrations.test.ts
git commit -m "feat: add research project schema"
```

Expected: tests PASS and migration discovery reports `0001`–`0006`.

### Task 2: Define Domain Types and Invariants

**Files:**
- Create: `src/researchProject.ts`
- Create: `src/researchProject.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
test("creates two default lanes", () => assert.deepEqual(defaultResearchLanes(), [
  { title: "Alternative A", position: 0 }, { title: "Alternative B", position: 1 },
]));
test("rejects stale revisions", () => assert.throws(() => assertExpectedRevision(4, 3), ResearchProjectConflictError));
test("normalizes unique tags", () => assert.deepEqual(normalizeResearchTags([" SSO ", "sso", "Trust"]), ["SSO", "Trust"]));
```

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/researchProject.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the contract**

```typescript
export const RESEARCH_LIMITS = { lanesMin: 2, lanesMax: 5, itemsMax: 100, privateUploadsMax: 25, uploadBytesMax: 10 * 1024 * 1024, tagsMax: 12 } as const;
export type ResearchPlatform = "all" | "ios" | "android" | "web";
export type ResearchSourceKind = "catalog_screen" | "catalog_flow_step" | "private_upload";
export interface ResearchEvidenceSnapshot { title: string; app?: string; platform?: string; flow?: string; step?: string; state?: string; capturedAt?: string; sourcePath?: string; description?: string; }
export interface ResearchProjectItem { id: number; projectId: number; laneId: number; position: number; sourceKind: ResearchSourceKind; stepLabel: string; note: string; tags: string[]; important: boolean; snapshot: ResearchEvidenceSnapshot; mediaUrl?: string; restricted?: boolean; }
export interface ResearchProjectLane { id: number; title: string; position: number; conclusion: string; items: ResearchProjectItem[]; }
export interface ResearchProjectWorkspace { id: number; title: string; question: string; platformFilter: ResearchPlatform; constraints: string; decision: string; rationale: string; openQuestions: string; revision: number; lanes: ResearchProjectLane[]; synthesis?: ResearchSynthesisView; createdAt: string; updatedAt: string; }
export class ResearchProjectConflictError extends Error { constructor(readonly actualRevision: number) { super("Research project revision conflict"); } }
export function assertExpectedRevision(actual: number, expected: number) { if (actual !== expected) throw new ResearchProjectConflictError(actual); }
export const defaultResearchLanes = () => [{ title: "Alternative A", position: 0 }, { title: "Alternative B", position: 1 }];
export function normalizeResearchTags(values: string[]) { const seen = new Set<string>(); return values.map((v) => v.trim()).filter((v) => { const key = v.toLowerCase(); if (!v || v.length > 40 || seen.has(key)) return false; seen.add(key); return true; }).slice(0, RESEARCH_LIMITS.tagsMax); }
```

Keep all transport types shared with Vitrine by defining these shapes in the same file:

```typescript
export interface CitedResearchText { text: string; evidenceIds: string[]; }
export interface ResearchSynthesisResult {
  executiveRead: string;
  observations: CitedResearchText[];
  differences: CitedResearchText[];
  alternatives: Array<{ title: string; tradeoff: string; evidenceIds: string[] }>;
  recommendation: CitedResearchText;
  requirements: CitedResearchText[];
  openQuestions: string[];
}
export interface ResearchSynthesisView { id: number; projectRevision: number; stale: boolean; result: ResearchSynthesisResult; createdAt: string; }
export interface ResearchProjectSummary { id: number; title: string; question: string; platformFilter: ResearchPlatform; evidenceCount: number; synthesisState: "none" | "current" | "stale"; updatedAt: string; }
export interface CreateResearchProjectInput { title: string; question: string; platformFilter: ResearchPlatform; }
export interface ProjectPatch { title?: string; question?: string; platformFilter?: ResearchPlatform; constraints?: string; decision?: string; rationale?: string; openQuestions?: string; }
export interface CreateLaneInput { projectId: number; expectedRevision: number; title: string; }
export interface UpdateLaneInput { projectId: number; laneId: number; expectedRevision: number; title?: string; conclusion?: string; position?: number; }
export interface DeleteLaneInput { projectId: number; laneId: number; expectedRevision: number; }
export interface AddResearchItemInput { projectId: number; laneId: number; expectedRevision: number; sourceKind: ResearchSourceKind; snapshot: ResearchEvidenceSnapshot; catalog?: { app: string; versionId: number; imageId: number; flowId?: string; stepIndex?: number }; privateObjectKey?: string; }
export interface UpdateResearchItemInput { projectId: number; itemId: number; expectedRevision: number; stepLabel?: string; note?: string; tags?: string[]; important?: boolean; }
export interface MoveResearchItemInput { projectId: number; itemId: number; targetLaneId: number; targetPosition: number; expectedRevision: number; }
export interface RemoveResearchItemInput { projectId: number; itemId: number; expectedRevision: number; }
export interface RecordedSynthesis { projectId: number; projectRevision: number; status: "complete" | "failed"; result?: ResearchSynthesisResult; errorCode?: string; model: string; schemaVersion: number; }
```

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/researchProject.test.ts
git add src/researchProject.ts src/researchProject.test.ts
git commit -m "feat: define research project domain"
```

Expected: PASS for limits, ordering, tags, empty-lane deletion, and conflicts.

### Task 3: Implement Owner-Scoped Persistence

**Files:**
- Create: `src/researchProjectStore.ts`
- Create: `src/researchProjectStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Inject a `DatabaseQuery` port like `objectStoreDb.ts`. Assert owner filtering, two-lane creation in one transaction, `SELECT ... FOR UPDATE`, revision checks, duplicate without syntheses, empty-only lane deletion, and normalized cross-lane moves.

```typescript
test("loads through project ownership", async () => {
  const calls: string[] = [];
  await createResearchProjectStore(async (sql) => { calls.push(sql); return { rows: [], rowCount: 0 } as never; }).getProject(7, 11);
  assert.ok(calls.some((sql) => /user_id/.test(sql)));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/researchProjectStore.test.ts`

Expected: FAIL because the store is missing.

- [ ] **Step 3: Implement one store interface**

```typescript
export interface ResearchProjectStore {
  listProjects(userId: number): Promise<ResearchProjectSummary[]>;
  createProject(userId: number, input: CreateResearchProjectInput): Promise<ResearchProjectWorkspace>;
  getProject(userId: number, projectId: number): Promise<ResearchProjectWorkspace | undefined>;
  updateProject(userId: number, projectId: number, expectedRevision: number, patch: ProjectPatch): Promise<ResearchProjectWorkspace | undefined>;
  duplicateProject(userId: number, projectId: number): Promise<ResearchProjectWorkspace | undefined>;
  deleteProject(userId: number, projectId: number): Promise<{ deleted: boolean; privateObjectKeys: string[] }>;
  createLane(userId: number, input: CreateLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  updateLane(userId: number, input: UpdateLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  deleteEmptyLane(userId: number, input: DeleteLaneInput): Promise<ResearchProjectWorkspace | undefined>;
  addItem(userId: number, input: AddResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  updateItem(userId: number, input: UpdateResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  moveItem(userId: number, input: MoveResearchItemInput): Promise<ResearchProjectWorkspace | undefined>;
  removeItem(userId: number, input: RemoveResearchItemInput): Promise<{ project?: ResearchProjectWorkspace; unreferencedPrivateObjectKey?: string }>;
  recordSynthesis(userId: number, input: RecordedSynthesis): Promise<ResearchSynthesisView | undefined>;
}
```

Every mutation locks the owned project, compares revision, applies changes, and increments revision/updated time in one transaction.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/researchProjectStore.test.ts
git add src/researchProjectStore.ts src/researchProjectStore.test.ts
git commit -m "feat: persist research project workspaces"
```

Expected: PASS.

### Task 4: Add Deterministic Suggestions

**Files:**
- Create: `src/researchSuggestions.ts`
- Create: `src/researchSuggestions.test.ts`

- [ ] **Step 1: Write a failing ranking test**

```typescript
test("ranks and explains relevant evidence", () => {
  const [first] = rankResearchSuggestions("b2b sso onboarding", [
    fixture({ id: "a", flowTitle: "Invite teammate" }),
    fixture({ id: "b", flowTitle: "SSO onboarding", appCategory: "B2B" }),
  ], { platform: "web", limit: 20 });
  assert.equal(first.id, "b");
  assert.deepEqual(first.matchedFields, ["flow title", "app category"]);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/researchSuggestions.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement scoring**

```typescript
export function rankResearchSuggestions(query: string, candidates: ResearchSuggestionCandidate[], options: SuggestionOptions) {
  const tokens = normalizedTokens(query);
  return candidates.filter((item) => options.platform === "all" || item.platform === options.platform)
    .map((item) => scoreCandidate(tokens, item)).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.capturedAt ?? "0") - Date.parse(a.capturedAt ?? "0"))
    .slice(0, options.limit);
}
```

Score flow title/description/category/tags/steps and screen type/product area/description/text/states/components/layouts. Return match explanations. Do not add embeddings.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/researchSuggestions.test.ts
git add src/researchSuggestions.ts src/researchSuggestions.test.ts
git commit -m "feat: rank research evidence suggestions"
```

Expected: PASS for exact/partial matches, platform, recency tie-break, and access-filtered input.

### Task 5: Add Private Screenshot Storage

**Files:**
- Modify: `src/objectStore.ts`
- Modify: `src/objectStore.test.ts`
- Create: `src/researchUpload.ts`
- Create: `src/researchUpload.test.ts`

- [ ] **Step 1: Write failing key and upload tests**

```typescript
test("research keys are owner scoped", () => assert.equal(researchUploadObjectKey(42, "a".repeat(64), "png"), `research/42/${"a".repeat(64)}.png`));
test("accepts only bounded raster files", () => {
  assert.equal(validateResearchUpload(Buffer.from([1]), "image/png").extension, "png");
  assert.throws(() => validateResearchUpload(Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"), /10 MiB/);
  assert.throws(() => validateResearchUpload(Buffer.from([1]), "image/svg+xml"), /Unsupported/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/objectStore.test.ts src/researchUpload.test.ts`

Expected: FAIL because helpers are missing.

- [ ] **Step 3: Implement storage**

```typescript
export function researchUploadObjectKey(userId: number, sha256: string, extension: string): string {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !SHA256_PATTERN.test(sha256)) throw new Error("Invalid research upload identity");
  return `research/${userId}/${sha256}.${checkedExtension(extension)}`;
}
```

`researchUpload.ts` validates PNG/JPEG/WebP and 10 MiB, stores with `accessClass: "protected"`, attaches `stored_objects` metadata and project item transactionally, deletes newly created bytes on DB failure, authorizes reads by owner, and deletes bytes only after the final reference.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/objectStore.test.ts src/researchUpload.test.ts
git add src/objectStore.ts src/objectStore.test.ts src/researchUpload.ts src/researchUpload.test.ts
git commit -m "feat: store private research screenshots"
```

Expected: PASS for type/size, metadata conflict, rollback cleanup, shared reference, and final deletion.

### Task 6: Implement Cited Synthesis and Markdown

**Files:**
- Create: `src/researchSynthesis.ts`
- Create: `src/researchSynthesis.test.ts`
- Create: `src/researchSynthesisProvider.ts`
- Create: `src/researchSynthesisProvider.test.ts`

- [ ] **Step 1: Write failing validation tests**

```typescript
test("rejects unknown evidence", () => {
  assert.throws(() => validateSynthesisResult(resultFixture({ observations: [{ text: "Two apps defer SSO.", evidenceIds: ["missing"] }] }), new Set(["e1"])), /unknown evidence/i);
});
```

Cover uncited observations, one retry, second failure closed, timeout, stale revision, deterministic Markdown, escaping, and authenticated paths rather than signed URLs.

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/researchSynthesis.test.ts src/researchSynthesisProvider.test.ts`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement fail-closed orchestration**

```typescript
export interface ResearchSynthesisProvider { readonly model: string; generate(input: ResearchSynthesisPrompt, signal: AbortSignal): Promise<unknown>; }
export async function synthesizeResearchProject(workspace: ResearchProjectWorkspace, provider: ResearchSynthesisProvider, timeoutMs = 60_000) {
  const prompt = buildResearchSynthesisPrompt(workspace); const allowed = new Set(prompt.evidence.map(({ id }) => id)); let validationError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await provider.generate({ ...prompt, validationError }, AbortSignal.timeout(timeoutMs));
    try { return validateSynthesisResult(raw, allowed); } catch (error) { validationError = error instanceof Error ? error.message : "Invalid synthesis"; if (attempt === 1) throw error; }
  }
  throw new Error("Synthesis failed validation");
}
```

Prompt only question, constraints, lane conclusions, snapshots, notes, tags, and opaque IDs.

- [ ] **Step 4: Implement environment-backed provider**

Use native injected `fetch` against `${RESEARCH_LLM_BASE_URL}/chat/completions`, bearer `RESEARCH_LLM_API_KEY`, `RESEARCH_LLM_MODEL`, `response_format: { type: "json_object" }`, and a 0.2 temperature. Return `undefined` if any variable is missing; redact credentials from errors.

- [ ] **Step 5: Implement Markdown, verify, and commit**

`renderResearchProjectMarkdown` includes designer fields, lanes, source paths, and current synthesis labeled AI-generated; stale synthesis is omitted by default.

```bash
node --experimental-strip-types --test src/researchSynthesis.test.ts src/researchSynthesisProvider.test.ts
git add src/researchSynthesis.ts src/researchSynthesis.test.ts src/researchSynthesisProvider.ts src/researchSynthesisProvider.test.ts
git commit -m "feat: synthesize cited research decisions"
```

Expected: PASS with no network calls.

### Task 7: Add the Research Projects API

**Files:**
- Create: `services/api/src/researchProjects.ts`
- Create: `services/api/src/researchProjects.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing route tests**

Cover auth, ownership, CRUD, `409 revision_conflict`, limits, entitlement checks on add/read, ordered full-flow insert, `415`/`413` uploads, private media, `422` insufficient evidence, `503` missing provider, `504` timeout, failed-closed synthesis, and Markdown headers.

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test services/api/src/researchProjects.test.ts`

Expected: FAIL because routes are missing.

- [ ] **Step 3: Implement a focused router**

```typescript
export interface ResearchProjectRouteDependencies { store: ResearchProjectStore; objectStore?: ObjectStore; synthesisProvider?: ResearchSynthesisProvider; canAccessApp: typeof canAccessApp; listPublishedCandidates(userId: number): Promise<ResearchSuggestionCandidate[]>; recordAccessEvent: typeof recordAccessEvent; enabled: boolean; }
export function mountResearchProjectRoutes(app: express.Express, deps: ResearchProjectRouteDependencies) {
  app.get("/research-projects", async (_req, res) => res.json(await deps.store.listProjects(res.locals.user.id)));
}
```

Mount this exact route set, with the listed store/service call and status contract:

| Method and path | Operation | Success |
|---|---|---|
| `GET /research-projects` | `store.listProjects` | `200` summaries |
| `POST /research-projects` | `store.createProject` | `201` workspace |
| `GET /research-projects/:id` | `store.getProject` plus current entitlement redaction | `200` workspace |
| `PATCH /research-projects/:id` | `store.updateProject` | `200` workspace |
| `DELETE /research-projects/:id` | `store.deleteProject` plus upload cleanup | `204` |
| `POST /research-projects/:id/duplicate` | `store.duplicateProject` | `201` workspace |
| `POST /research-projects/:id/lanes` | `store.createLane` | `201` workspace |
| `PATCH /research-projects/:id/lanes/:laneId` | `store.updateLane` | `200` workspace |
| `DELETE /research-projects/:id/lanes/:laneId` | `store.deleteEmptyLane` | `200` workspace |
| `POST /research-projects/:id/items` | validate catalog access, then `store.addItem` | `201` workspace |
| `PATCH /research-projects/:id/items/:itemId` | `store.updateItem` | `200` workspace |
| `POST /research-projects/:id/items/:itemId/move` | `store.moveItem` | `200` workspace |
| `DELETE /research-projects/:id/items/:itemId` | `store.removeItem` plus final-reference cleanup | `200` workspace |
| `GET /research-projects/:id/suggestions` | accessible published candidates plus ranker | `200` suggestions |
| `POST /research-projects/:id/uploads` | raw parser plus upload service | `201` workspace |
| `GET /research-projects/:id/private-media/:itemId` | owner check plus `sendStoredObject` | image/redirect |
| `POST /research-projects/:id/synthesize` | preconditions plus synthesis/store | `201` synthesis |
| `GET /research-projects/:id/export.md` | render current workspace | Markdown attachment |

Every invalid ID/body returns `400`; an absent owned record returns `404`; stale revision returns `409` with `{ error, code: "revision_conflict", project }`; existing catalog access failures retain the current `403 upgrade_required` contract.

Move only generic validation/serving helpers required by both route modules. Reuse session and entitlement logic. Parse uploads with `express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "10mb" })`.

- [ ] **Step 4: Wire provider configuration**

Add to `.env.example`:

```dotenv
RESEARCH_LLM_BASE_URL=https://api.openai.com/v1
RESEARCH_LLM_API_KEY=
RESEARCH_LLM_MODEL=
RESEARCH_PROJECTS_ENABLED=false
VITE_RESEARCH_PROJECTS_ENABLED=false
```

Create the provider once in `index.ts`. Missing provider configuration disables synthesis only. When `RESEARCH_PROJECTS_ENABLED` is false, the API router returns `404`; when the Vite flag is false, project navigation is absent. Tests cover both states.

Record privacy-safe product events through the existing `recordAccessEvent` dependency: `research_project_created`, `research_first_evidence_added`, `research_project_activated`, `research_synthesis_requested`, `research_synthesis_completed`, `research_synthesis_failed`, and `research_project_exported`. Store only user ID, action, numeric volume, and outcome; never store the question, notes, filenames, image contents, model text, or decision text.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test services/api/src/researchProjects.test.ts services/api/src/app.test.ts
git add services/api/src/researchProjects.ts services/api/src/researchProjects.test.ts services/api/src/app.ts services/api/src/index.ts .env.example
git commit -m "feat: expose research project API"
```

Expected: PASS without regressing auth, admin, media, collections, or billing.

### Task 8: Add Typed Frontend Transport and Routes

**Files:**
- Create: `src/vitrine/researchProjectsApi.ts`
- Create: `src/vitrine/researchProjectsApi.test.ts`
- Modify: `src/vitrine/router.ts`
- Modify: `src/vitrine/main.tsx`

- [ ] **Step 1: Write failing route/client tests**

```typescript
test("maps project routes", () => {
  assert.equal(routeToPath({ name: "projects" }), "/projects");
  assert.equal(routeToPath({ name: "project", projectId: 17 }), "/projects/17");
});
```

Also test invalid IDs, deep-link authentication, typed errors, revisions, raw upload, and Markdown filename.

- [ ] **Step 2: Verify failure**

Run: `node --experimental-strip-types --test src/vitrine/researchProjectsApi.test.ts`

Expected: FAIL because route variants/client are missing.

- [ ] **Step 3: Implement routes and client**

Add `{ name: "projects" }` and `{ name: "project"; projectId: number }`, parsing positive safe IDs. Logged-out project links render `SignIn` while retaining path. Export typed list/create/get/update/duplicate/delete, lane/item mutations, suggestions, raw upload, synthesis, and Markdown download. Throw `ResearchProjectApiError` with status, code, and optional latest project.

```typescript
export function uploadResearchScreenshot(projectId: number, laneId: number, revision: number, file: File) {
  return request(`/api/research-projects/${projectId}/uploads?laneId=${laneId}&revision=${revision}`, { method: "POST", headers: { "content-type": file.type, "x-upload-filename": file.name }, body: file });
}
```

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/vitrine/researchProjectsApi.test.ts
git add src/vitrine/researchProjectsApi.ts src/vitrine/researchProjectsApi.test.ts src/vitrine/router.ts src/vitrine/main.tsx
git commit -m "feat: add research project routes and client"
```

Expected: PASS.

### Task 9: Build Project List and App Entry

**Files:**
- Create: `src/vitrine/components/ResearchProjectsPage.tsx`
- Modify: `src/vitrine/components/Sidebar.tsx`
- Modify: `src/vitrine/App.tsx`
- Create: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Write failing tests**

Test empty/list states, metadata, stale/current labels, create validation, duplicate, delete, navigation for user/admin, and project rendering before catalog data loads.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/vitrine/ResearchProjects.test.tsx`

Expected: FAIL because the page is missing.

- [ ] **Step 3: Implement with existing design primitives**

Use `PageHeader`, `Button`, `EmptyState`, cards, and tokens. Require title/question and offer All/iOS/Android/Web. Branch on project routes before catalog-dependent loading/error UI.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
git add src/vitrine/components/ResearchProjectsPage.tsx src/vitrine/components/Sidebar.tsx src/vitrine/App.tsx src/vitrine/ResearchProjects.test.tsx
git commit -m "feat: add research project entry"
```

Expected: PASS.

### Task 10: Build the Decision Canvas

**Files:**
- Create: `src/vitrine/components/ResearchProjectPage.tsx`
- Create: `src/vitrine/components/DecisionCanvas.tsx`
- Create: `src/vitrine/components/EvidenceCard.tsx`
- Modify: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Write failing canvas tests**

Test default lanes, limits, ordered cards, move earlier/later/to lane, labels/notes/tags/importance, empty-only lane deletion, restricted evidence, mutation loading, and conflict reload.

```tsx
test("offers keyboard-safe movement", () => {
  const html = renderToStaticMarkup(<DecisionCanvas workspace={workspaceFixture()} disabled={false} actions={noopActions} />);
  assert.match(html, /Move earlier/); assert.match(html, /Move later/); assert.match(html, /Move to Alternative B/);
});
```

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/vitrine/ResearchProjects.test.tsx`

Expected: FAIL because canvas components are missing.

- [ ] **Step 3: Implement constrained lanes**

`ResearchProjectPage` serializes mutations and replaces local state with server responses. On conflict, show a message and load the returned project. Use CSS grid/flex with horizontal overflow, not an infinite-canvas dependency. Provide buttons/menus for movement before optional drag and drop.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
git add src/vitrine/components/ResearchProjectPage.tsx src/vitrine/components/DecisionCanvas.tsx src/vitrine/components/EvidenceCard.tsx src/vitrine/ResearchProjects.test.tsx
git commit -m "feat: build research decision canvas"
```

Expected: PASS.

### Task 11: Add Evidence Drawer and Upload

**Files:**
- Create: `src/vitrine/components/EvidenceDrawer.tsx`
- Modify: `src/vitrine/components/ResearchProjectPage.tsx`
- Modify: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Write failing drawer tests**

Test suggestions, match reasons, platform filter, manual search, full-flow count confirmation, target lane, entitlement error, upload validation/retry, and no-suggestion recovery.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/vitrine/ResearchProjects.test.tsx`

Expected: FAIL because drawer is missing.

- [ ] **Step 3: Implement drawer**

Keep search local. Show `matchedFields`; preview flow steps before insertion. Use `accept="image/png,image/jpeg,image/webp"` and validate 10 MiB locally. Successful changes replace workspace and stale synthesis. Failed uploads create no item and remain retryable.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
git add src/vitrine/components/EvidenceDrawer.tsx src/vitrine/components/ResearchProjectPage.tsx src/vitrine/ResearchProjects.test.tsx
git commit -m "feat: gather research evidence"
```

Expected: PASS.

### Task 12: Add Insights and Handoff

**Files:**
- Create: `src/vitrine/components/ProjectInsightsPanel.tsx`
- Modify: `src/vitrine/components/ResearchProjectPage.tsx`
- Modify: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Write failing insights tests**

```tsx
test("labels AI output and preserves designer decisions", () => {
  const html = renderToStaticMarkup(<ProjectInsightsPanel workspace={workspaceWithSynthesis()} actions={noopInsightActions} />);
  assert.match(html, /AI-generated draft/); assert.match(html, /Observed evidence/); assert.match(html, /Designer decision/);
});
```

Also test disabled synthesis before two populated lanes, provider unavailable, timeout/invalid response, citations, stale state, explicit Accept, and `DESIGN.md` download.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/vitrine/ResearchProjects.test.tsx`

Expected: FAIL because panel is missing.

- [ ] **Step 3: Implement panel and export**

Save designer fields explicitly. Keep generated text separate. Accept copies only one section into an unsaved field. Citations open the referenced card. Download reads `Content-Disposition`, creates an object URL, clicks a temporary anchor, and revokes the URL.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
git add src/vitrine/components/ProjectInsightsPanel.tsx src/vitrine/components/ResearchProjectPage.tsx src/vitrine/ResearchProjects.test.tsx
git commit -m "feat: add cited research handoff"
```

Expected: PASS.

### Task 13: Document and Verify the Vertical Slice

**Files:**
- Modify: `README.md`
- Test: all files above

- [ ] **Step 1: Document feature and configuration**

Document Projects, private-evidence privacy, existing app entitlements, both feature flags, provider variables, missing-provider behavior, privacy-safe metrics, and the 60-second limit.

- [ ] **Step 2: Run focused backend tests**

```bash
node --experimental-strip-types --test src/migrations.test.ts src/researchProject.test.ts src/researchProjectStore.test.ts src/researchSuggestions.test.ts src/researchUpload.test.ts src/researchSynthesis.test.ts src/researchSynthesisProvider.test.ts services/api/src/researchProjects.test.ts services/api/src/app.test.ts
```

Expected: zero failures.

- [ ] **Step 3: Run focused frontend tests**

```bash
node --experimental-strip-types --test src/vitrine/researchProjectsApi.test.ts
npx tsx --test src/vitrine/ResearchProjects.test.tsx src/vitrine/ResearchTools.test.tsx
```

Expected: zero failures.

- [ ] **Step 4: Run full verification**

```bash
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 5: Verify disposable migrations**

```bash
MIGRATION_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres MIGRATION_TEST_ALLOW_DROP=1 npm run db:verify
```

Expected: empty and upgrade paths succeed through `0006`.

- [ ] **Step 6: Run browser acceptance**

Verify: create project; two default lanes; add entitled evidence from two apps; add a complete flow; upload/reload a PNG; keyboard-move cards; save notes/tags/decision; synthesize with a test provider; open citations; make synthesis stale; download `DESIGN.md`; confirm another customer cannot access project/private media; repeat at narrow width.

Expected: the journey works without console errors, unauthorized data, object keys, or signed URLs in export.

- [ ] **Step 7: Commit docs and record evidence**

```bash
git add README.md
git commit -m "docs: document research decision canvas"
git status --short
git log --oneline --decorate -15
```

Expected: clean feature worktree and ordered task commits.
