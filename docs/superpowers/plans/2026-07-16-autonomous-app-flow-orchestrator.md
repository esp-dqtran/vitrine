# Astryx Autonomous App-Flow Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Astryx's durable crawler so an administrator can submit an app URL and one shared account, research the app from cited internet sources, dispatch multiple specialized discovery agents, and automatically publish complete evidence-backed Flows.

**Architecture:** Keep the existing Playwright runner, crawl ledger, evidence store, object storage, versioning, and curator workspace. Add a parent autonomous run with a cited dossier, leased missions, shared state graph, encrypted browser session, exclusive mutation lease, and an in-process agent pool; each agent converts its next bounded episode into an immutable crawl plan and executes it through the existing durable runner.

**Tech Stack:** TypeScript, Node 22 test runner, Playwright, PostgreSQL 17, RabbitMQ, Express 5, React 19, Vite 8, existing `ChatSession`/`startChatPool`, existing S3-compatible `ObjectStore`.

---

## Execution Gate: Preserve the Current Checkout

The checkout contains user-owned changes in authentication, admin users, Vitrine navigation, API routes, catalog import, `package.json`, and `src/bulkDownload.ts`. This feature overlaps `services/api/src/app.ts`, `services/import-worker/src/pipeline.ts`, `src/db.ts`, `src/queue.ts`, and `src/vitrine/components/CrawlWorkspacePanel.tsx`.

- [ ] **Step 1: Record and reconcile the base**

```bash
git status --short
git log -5 --oneline --decorate
```

Expected: design commit `382b570` and this plan commit are present; unrelated user changes remain visible.

- [ ] **Step 2: Create an isolated implementation worktree only after related dirty changes are committed**

```bash
git worktree add ../Astryx-autonomous-flows -b codex/autonomous-app-flow-orchestrator
cd ../Astryx-autonomous-flows
git status --short
```

Expected: a clean worktree based on the reconciled checkout. Do not start from an older clean commit that omits the current catalog-import or crawler work.

## File Map

- Create `migrations/0006_autonomous_crawler.sql`.
- Modify `src/db.ts`, `src/versioning.ts`, and their tests for platform-correct flow evidence.
- Create `src/autonomousCrawler.ts` and `src/autonomousCrawler.test.ts` for shared domain contracts and parsers.
- Create `src/autonomousStore.ts` and `src/autonomousStore.test.ts` for dossiers, missions, states, transitions, parent runs, sessions, and leases.
- Create `src/autonomousResearch.ts` and `src/autonomousResearch.test.ts` for cited dossier generation.
- Create `src/autonomousPlanner.ts` and `src/autonomousPlanner.test.ts` for mission planning and coverage.
- Create `src/autonomousGraph.ts` and `src/autonomousGraph.test.ts` for state identity, transitions, and graph-to-flow candidates.
- Create `src/crawlSession.ts` and `src/crawlSession.test.ts` for encrypted Playwright storage state.
- Create `src/autonomousAgent.ts` and `src/autonomousAgent.test.ts` for observation, bounded plan episodes, and existing-runner execution.
- Create `src/autonomousOrchestrator.ts` and `src/autonomousOrchestrator.test.ts` for the concurrent agent pool and completion loop.
- Modify `src/queue.ts`, `services/import-worker/src/pipeline.ts`, `services/import-worker/src/index.ts`, and tests for the parent job.
- Modify `src/crawlStore.ts`, `src/crawlRun.ts`, and tests for autonomous parent/child relationships and verified evidence reuse.
- Modify `services/api/src/app.ts`, `services/api/src/app.test.ts`, `src/vitrine/researchApi.ts`, and `src/vitrine/CrawlResearchApi.test.ts` for autonomous-run APIs.
- Modify `src/vitrine/components/CrawlWorkspacePanel.tsx` and `src/vitrine/CrawlWorkspacePanel.test.tsx` for URL/account submission and mission progress.
- Create `test/fixtures/autonomous-app/server.ts` and `src/autonomousAcceptance.test.ts` for deterministic multi-agent acceptance.
- Modify `.env.example`, `README.md`, and `docs/operations/autonomous-crawler.md`.

---

### Task 1: Repair Platform and Flow-Evidence Integrity

**Files:**
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`
- Modify: `src/versioning.ts`
- Modify: `src/versioning.test.ts`
- Modify: `src/crawlRun.ts`
- Modify: `src/crawlRun.test.ts`

- [ ] **Step 1: Write failing platform and publication tests**

Add a DB test that inserts Web and iOS images for one app and asserts each image attaches only to its platform's active version. Add a publication test that accepts version-owned `flow_step` evidence without requiring analysis while still requiring analysis for `screen` evidence.

```typescript
test("keeps image membership scoped to the image platform", async () => {
  const webImage = await insertImage("scope-app", "web", "https://cdn.example/web.png");
  const iosImage = await insertImage("scope-app", "ios", "https://cdn.example/ios.png");
  const webVersion = (await listAppVersions("scope-app", "web"))[0];
  const iosVersion = (await listAppVersions("scope-app", "ios"))[0];
  assert.deepEqual((await versionImages("scope-app", "web", webVersion.version_number)).map(({ id }) => id), [webImage]);
  assert.deepEqual((await versionImages("scope-app", "ios", iosVersion.version_number)).map(({ id }) => id), [iosImage]);
});

test("accepts owned flow-step evidence but still analyzes screens", () => {
  const candidate = {
    images: [{ id: 7, kind: "screen" as const, analysis: { pageType: "Home" } }, { id: 9, kind: "flow_step" as const, analysis: null }],
    snapshot,
    flows: [{ id: "create", title: "Create", description: "Create a record", tags: [], steps: [{ label: "Created", evidence: [9] }] }],
  };
  assert.deepEqual(validatePublication(candidate), []);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/versioning.test.ts src/db.test.ts`

Expected: platform membership or `flow_step` evidence assertions FAIL.

- [ ] **Step 3: Scope version attachment and publication queries**

Change `insertImage()` so version creation and membership use both `app_id` and `platform`:

```sql
WITH next AS (
  SELECT COALESCE(MAX(version_number), 0) + 1 AS revision
  FROM app_versions WHERE app_id = $1 AND platform = $2
)
INSERT INTO app_versions (app_id, platform, version_number, label, status)
SELECT $1, $2, revision, 'v' || revision, 'draft' FROM next
WHERE NOT EXISTS (
  SELECT 1 FROM app_versions WHERE app_id = $1 AND platform = $2 AND status IN ('draft', 'in_review')
)
```

Select the attachment target with `av.app_id = $1 AND av.platform = $2`. In `publishAppVersion()`, select `platform` with the locked version and use it for `design_systems` and `app_flows`:

```sql
SELECT snapshot FROM design_systems WHERE app_id = $1 AND platform = $2;
SELECT flows FROM app_flows WHERE app_id = $1 AND platform = $2;
```

Correlate every latest-published design-system and flow lookup by both app and platform:

```sql
AND av.version_number = (
  SELECT MAX(latest.version_number) FROM app_versions latest
  WHERE latest.app_id = av.app_id AND latest.platform = av.platform AND latest.status = 'published'
)
```

Change the publication candidate contract:

```typescript
export interface PublicationCandidate {
  images: Array<{ id: number; kind: "screen" | "flow_step"; analysis?: unknown | null }>;
  snapshot?: DesignSystemSnapshot;
  flows: DesignFlow[];
}

const screens = images.filter(({ kind }) => kind === "screen");
if (screens.length === 0) blockers.push({ code: "screens_missing", message: "Capture at least one screen." });
else if (screens.some(({ analysis }) => !analysis)) blockers.push({ code: "screen_analysis_missing", message: "Every captured screen must complete structured analysis." });
const ids = new Set(images.map(({ id }) => id));
```

- [ ] **Step 4: Require verified canonical evidence reuse**

In `captureValidatedState()`, reuse existing evidence only when its hash matches the current capture and its object metadata is present and verified. Add the dependency and guard:

```typescript
if (existing) {
  if (existing.screenshot_hash !== observedHash) throw new Error("Canonical crawl evidence changed for the same state identity");
  await verifyEvidenceObject(existing.image_id, existing.screenshot_hash);
  return reusedCapture(existing, observedHash, shortRef);
}
```

Add tests for a missing object, checksum mismatch, and changed screenshot hash.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/versioning.test.ts src/db.test.ts src/crawlRun.test.ts
git add src/db.ts src/db.test.ts src/versioning.ts src/versioning.test.ts src/crawlRun.ts src/crawlRun.test.ts
git commit -m "fix: enforce platform-owned crawler evidence"
```

Expected: focused tests PASS and no version contains another platform's new images.

### Task 2: Add the Autonomous Orchestration Schema

**Files:**
- Create: `migrations/0006_autonomous_crawler.sql`
- Modify: `src/migrations.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

```typescript
test("autonomous crawler migration defines durable missions and shared-account leases", async () => {
  const sql = await readFile(new URL("../migrations/0006_autonomous_crawler.sql", import.meta.url), "utf8");
  for (const table of ["crawl_dossiers", "crawl_missions", "crawl_states", "crawl_transitions", "crawl_account_sessions", "crawl_account_leases"]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`));
  }
  assert.match(sql, /run_kind TEXT NOT NULL DEFAULT 'planned'/);
  assert.match(sql, /CHECK \(\(run_kind = 'planned' AND plan_id IS NOT NULL\) OR \(run_kind = 'autonomous' AND plan_id IS NULL\)\)/);
  assert.match(sql, /UNIQUE \(run_id, mission_key\)/);
  assert.match(sql, /UNIQUE \(run_id, state_key\)/);
  assert.match(sql, /lease_expires_at TIMESTAMPTZ/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/migrations.test.ts`

Expected: FAIL because `0006_autonomous_crawler.sql` does not exist.

- [ ] **Step 3: Create the migration**

Create the following tables and constraints:

```sql
ALTER TABLE crawl_runs ADD COLUMN run_kind TEXT NOT NULL DEFAULT 'planned'
  CHECK (run_kind IN ('planned', 'autonomous'));
ALTER TABLE crawl_runs ADD COLUMN parent_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE RESTRICT;
ALTER TABLE crawl_runs ADD COLUMN platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE crawl_runs ADD COLUMN allow_all BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE crawl_runs ADD COLUMN pause_requested_at TIMESTAMPTZ;
ALTER TABLE crawl_runs ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE crawl_runs ADD CONSTRAINT crawl_runs_kind_plan_ck
  CHECK ((run_kind = 'planned' AND plan_id IS NOT NULL) OR (run_kind = 'autonomous' AND plan_id IS NULL));
CREATE INDEX crawl_runs_parent_idx ON crawl_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

CREATE TABLE crawl_dossiers (
  id BIGSERIAL PRIMARY KEY, run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0), dossier JSONB NOT NULL CHECK (jsonb_typeof(dossier) = 'object'),
  content_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, revision), UNIQUE (run_id, content_hash)
);

CREATE TABLE crawl_missions (
  id BIGSERIAL PRIMARY KEY, run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  mission_key TEXT NOT NULL, goal TEXT NOT NULL, product_area TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('read', 'mutate')), status TEXT NOT NULL
    CHECK (status IN ('queued', 'running', 'succeeded', 'blocked', 'failed', 'interrupted', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0, prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  budget JSONB NOT NULL, checkpoint JSONB, result JSONB, worker_id TEXT,
  heartbeat_at TIMESTAMPTZ, lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, mission_key)
);

CREATE TABLE crawl_states (
  id BIGSERIAL PRIMARY KEY, run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  state_key TEXT NOT NULL, platform TEXT NOT NULL, account_state_version INTEGER NOT NULL,
  normalized_url TEXT NOT NULL, label TEXT NOT NULL, product_area TEXT NOT NULL,
  fingerprint JSONB NOT NULL, evidence_id BIGINT REFERENCES crawl_evidence(id) ON DELETE RESTRICT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, state_key)
);

CREATE TABLE crawl_transitions (
  id BIGSERIAL PRIMARY KEY, run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  mission_id BIGINT NOT NULL REFERENCES crawl_missions(id) ON DELETE CASCADE,
  child_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE RESTRICT,
  source_state_id BIGINT REFERENCES crawl_states(id) ON DELETE RESTRICT,
  destination_state_id BIGINT REFERENCES crawl_states(id) ON DELETE RESTRICT,
  action JSONB NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('read', 'mutate')),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed', 'blocked')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crawl_account_sessions (
  id BIGSERIAL PRIMARY KEY, app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  encrypted_storage_state TEXT NOT NULL, state_version INTEGER NOT NULL CHECK (state_version > 0),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id)
);

CREATE TABLE crawl_account_leases (
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('mutation', 'authentication')),
  mission_id BIGINT REFERENCES crawl_missions(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL, heartbeat_at TIMESTAMPTZ NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (run_id, purpose)
);
```

- [ ] **Step 4: Verify migration discovery and commit**

```bash
node --experimental-strip-types --test src/migrations.test.ts
git add migrations/0006_autonomous_crawler.sql src/migrations.test.ts
git commit -m "feat: add autonomous crawler schema"
```

Expected: migration discovery and upgrade-path tests PASS. Apply `0006` only through the normal deployment migration command, never from this unit-test step.

### Task 3: Define Autonomous Domain Contracts

**Files:**
- Create: `src/autonomousCrawler.ts`
- Create: `src/autonomousCrawler.test.ts`

- [ ] **Step 1: Write failing parser and invariant tests**

```typescript
test("parses a cited dossier and rejects unsupported claims", () => {
  const dossier = parseAppDossier({ app: "linear", purpose: "Issue tracking", sources: [{ url: "https://linear.app/docs", title: "Docs", retrievedAt: "2026-07-16T00:00:00.000Z" }], claims: [{ text: "Teams manage issues", sourceUrls: ["https://linear.app/docs"], confidence: 0.9 }], roles: ["member"], capabilities: ["issue-management"], candidateFlows: [], openQuestions: [] });
  assert.equal(dossier.claims[0].confidence, 0.9);
  assert.throws(() => parseAppDossier({ ...dossier, claims: [{ text: "Unsupported", sourceUrls: ["https://other.test"], confidence: 1 }] }), /source/i);
});

test("requires explicit authorization for mutating missions", () => {
  assert.throws(() => parseMission({ missionKey: "delete", goal: "Delete item", productArea: "Settings", mode: "mutate", prerequisites: [], budget: { actions: 20, recoveries: 2 } }, false), /allow_all/i);
});
```

- [ ] **Step 2: Run and verify module-missing failure**

Run: `node --experimental-strip-types --test src/autonomousCrawler.test.ts`

Expected: FAIL because `autonomousCrawler.ts` is missing.

- [ ] **Step 3: Implement exact shared types and parsers**

```typescript
export type MissionMode = "read" | "mutate";
export type MissionStatus = "queued" | "running" | "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled";
export interface DossierSource { url: string; title: string; retrievedAt: string; }
export interface DossierClaim { text: string; sourceUrls: string[]; confidence: number; }
export interface CandidateFlow { id: string; title: string; goal: string; productArea: string; mode: MissionMode; prerequisites: string[]; sourceUrls: string[]; }
export interface AppDossier { app: string; purpose: string; sources: DossierSource[]; claims: DossierClaim[]; roles: string[]; capabilities: string[]; candidateFlows: CandidateFlow[]; openQuestions: string[]; }
export interface MissionBudget { actions: number; recoveries: number; }
export interface AutonomousMission { missionKey: string; goal: string; productArea: string; mode: MissionMode; prerequisites: string[]; budget: MissionBudget; }
export interface StateFingerprint { domHash: string; screenshotHash: string; landmarks: string[]; title: string; }
export interface AutonomousState { stateKey: string; normalizedUrl: string; label: string; productArea: string; accountStateVersion: number; fingerprint: StateFingerprint; }
export interface AgentObservation { url: string; title: string; landmarks: string[]; controls: Array<{ role: string; name: string }>; screenshotHash: string; domHash: string; }

export function parseMission(value: AutonomousMission, allowAll: boolean): AutonomousMission {
  if (!value.missionKey.trim() || !value.goal.trim() || !value.productArea.trim()) throw new Error("Mission identity is required");
  if (value.mode === "mutate" && !allowAll) throw new Error("Mutating missions require allow_all");
  if (!Number.isInteger(value.budget.actions) || value.budget.actions < 1 || value.budget.actions > 500) throw new Error("Mission action budget is invalid");
  if (!Number.isInteger(value.budget.recoveries) || value.budget.recoveries < 0 || value.budget.recoveries > 20) throw new Error("Mission recovery budget is invalid");
  return structuredClone(value);
}
```

Implement `parseAppDossier()` with strict object/array/string bounds, absolute public HTTP(S) source URLs, unique source URLs, every claim/candidate-flow citation contained in `sources`, confidence in `[0,1]`, and no secret-like keys or values.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousCrawler.test.ts
git add src/autonomousCrawler.ts src/autonomousCrawler.test.ts
git commit -m "feat: define autonomous crawler contracts"
```

### Task 4: Implement the Autonomous Store and Durable Leases

**Files:**
- Create: `src/autonomousStore.ts`
- Create: `src/autonomousStore.test.ts`
- Modify: `src/crawlStore.ts`
- Modify: `src/crawlStore.test.ts`

- [ ] **Step 1: Write failing lifecycle and contention tests**

```typescript
test("claims distinct read missions and serializes mutations", async () => {
  const parent = await store.createAutonomousRun({ app: "agent-app", platform: "web", versionId, createdBy: adminId, homepageUrl: "https://agent.test", allowAll: true });
  await store.saveMissions(parent.id, [readMission("search"), readMission("settings"), mutateMission("delete")]);
  assert.equal((await store.claimMission(parent.id, "worker-a", new Date(), 30_000))?.mission_key, "search");
  assert.equal((await store.claimMission(parent.id, "worker-b", new Date(), 30_000))?.mission_key, "settings");
  const mutation = await store.claimMission(parent.id, "worker-c", new Date(), 30_000);
  assert.equal(mutation?.mission_key, "delete");
  assert.equal(await store.acquireAccountLease(parent.id, mutation!.id, "worker-c", "mutation", new Date(), 30_000), true);
  assert.equal(await store.acquireAccountLease(parent.id, mutation!.id, "worker-d", "mutation", new Date(), 30_000), false);
});

test("reclaims an expired mission without stealing a live lease", async () => {
  const claimed = await store.claimMission(runId, "worker-a", new Date("2026-07-16T00:00:00Z"), 1_000);
  assert.ok(claimed);
  assert.equal(await store.claimMission(runId, "worker-b", new Date("2026-07-16T00:00:00.500Z"), 1_000), undefined);
  assert.equal((await store.claimMission(runId, "worker-b", new Date("2026-07-16T00:00:02Z"), 1_000))?.id, claimed!.id);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/autonomousStore.test.ts src/crawlStore.test.ts`

Expected: FAIL because autonomous store functions are missing.

- [ ] **Step 3: Implement transactional store operations**

Export a dependency-injectable store with these exact operations:

```typescript
export interface CreateAutonomousRunInput { app: string; platform: Platform; versionId: number; createdBy: number; homepageUrl: string; allowAll: boolean; environment?: Record<string, unknown>; }
export interface CrawlDossierRecord { id: string; run_id: string; revision: number; dossier: AppDossier; content_hash: string; created_at: Date; }
export interface CrawlMissionRecord extends AutonomousMission { id: string; run_id: string; status: MissionStatus; worker_id: string | null; heartbeat_at: Date | null; lease_expires_at: Date | null; checkpoint: unknown; result: unknown; }
export interface CrawlStateRecord extends AutonomousState { id: string; run_id: string; evidence_id: string | null; }
export interface CrawlTransitionRecord { id: string; run_id: string; mission_id: string; child_run_id: string | null; source_state_id: string | null; destination_state_id: string | null; action: unknown; mode: MissionMode; outcome: "completed" | "failed" | "blocked"; confidence: number; }
export interface RecordTransitionInput { runId: string; missionId: string; childRunId?: string; sourceStateId?: string; destinationStateId?: string; action: unknown; mode: MissionMode; outcome: "completed" | "failed" | "blocked"; confidence: number; }
export interface AutonomousRunDetail { run: CrawlRunRecord; dossier?: CrawlDossierRecord; missions: CrawlMissionRecord[]; states: CrawlStateRecord[]; transitions: CrawlTransitionRecord[]; }

export interface AutonomousStore {
  createAutonomousRun(input: CreateAutonomousRunInput): Promise<CrawlRunRecord>;
  saveDossier(runId: string, dossier: AppDossier): Promise<CrawlDossierRecord>;
  latestDossier(runId: string): Promise<CrawlDossierRecord | undefined>;
  saveMissions(runId: string, missions: AutonomousMission[]): Promise<CrawlMissionRecord[]>;
  claimMission(runId: string, workerId: string, now: Date, leaseMs: number): Promise<CrawlMissionRecord | undefined>;
  heartbeatMission(missionId: string, workerId: string, now: Date, leaseMs: number): Promise<void>;
  finishMission(missionId: string, workerId: string, status: Extract<MissionStatus, "succeeded" | "blocked" | "failed" | "interrupted" | "cancelled">, result: unknown): Promise<void>;
  acquireAccountLease(runId: string, missionId: string, workerId: string, purpose: "mutation" | "authentication", now: Date, leaseMs: number): Promise<boolean>;
  heartbeatAccountLease(runId: string, workerId: string, purpose: "mutation" | "authentication", now: Date, leaseMs: number): Promise<void>;
  releaseAccountLease(runId: string, workerId: string, purpose: "mutation" | "authentication"): Promise<void>;
  upsertState(runId: string, state: AutonomousState, evidenceId?: string): Promise<CrawlStateRecord>;
  recordTransition(input: RecordTransitionInput): Promise<CrawlTransitionRecord>;
  autonomousRunDetail(runId: string): Promise<AutonomousRunDetail | undefined>;
  requestPause(runId: string): Promise<void>;
  clearPause(runId: string): Promise<void>;
}
```

Use `FOR UPDATE SKIP LOCKED` for mission claims and `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE lease_expires_at <= $now` for leases. Require the worker ID for every heartbeat and terminal write.
When `pause_requested_at` is set, stop issuing new mission claims, let active episodes checkpoint, and mark the parent `interrupted` with `{ reason: "paused" }`. `clearPause()` makes those missions reclaimable for resume.

- [ ] **Step 4: Make existing run reads tolerate autonomous parents**

Change crawl-run selects from an unconditional plan join to a left join and make `plan_id` nullable only in shared record types. Keep planned-run execution strict:

```typescript
if (run.run_kind !== "planned" || !run.plan_id) throw new Error("Only planned child runs can execute through CrawlRunService");
```

Autonomous parent status changes go only through `autonomousStore`; existing `createCrawlRunService.execute()` never executes a parent.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/autonomousStore.test.ts src/crawlStore.test.ts
git add src/autonomousStore.ts src/autonomousStore.test.ts src/crawlStore.ts src/crawlStore.test.ts
git commit -m "feat: add durable autonomous mission store"
```

### Task 5: Generate a Cited Research Dossier

**Files:**
- Create: `src/autonomousResearch.ts`
- Create: `src/autonomousResearch.test.ts`
- Modify: `src/appResearch.ts`
- Modify: `src/appResearch.test.ts`

- [ ] **Step 1: Write failing source-validation and merge tests**

```typescript
test("merges parallel research reports only when citations were fetched", () => {
  const dossier = mergeResearchReports("linear", [officialReport, helpReport], fetchedSources);
  assert.deepEqual(dossier.sources.map(({ url }) => url), ["https://linear.app/docs", "https://linear.app/docs/issues"]);
  assert.throws(() => mergeResearchReports("linear", [{ ...officialReport, claims: [{ text: "Unknown", sourceUrls: ["https://fake.test"], confidence: 1 }] }], fetchedSources), /citation/i);
});

test("research prompts assign distinct product questions", () => {
  assert.deepEqual(researchAssignments().map(({ key }) => ({ key })), [
    { key: "product" }, { key: "workflows" }, { key: "roles-auth" }, { key: "pricing-risk" }, { key: "changes" },
  ]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/autonomousResearch.test.ts src/appResearch.test.ts`

Expected: FAIL because dossier research functions are missing.

- [ ] **Step 3: Implement bounded parallel research**

Use `collectResearchPages()` for app-owned pages and a `ChatSession[]` from `startChatPool()` for five fixed research assignments:

```typescript
export const researchAssignments = () => [
  { key: "product", question: "Purpose, audience, terminology and primary navigation" },
  { key: "workflows", question: "Documented end-to-end user goals and prerequisites" },
  { key: "roles-auth", question: "Roles, permissions, sign-in and onboarding" },
  { key: "pricing-risk", question: "Billing, account mutation and destructive workflows" },
  { key: "changes", question: "Recent release notes and newly documented capabilities" },
] as const;
```

Each session returns strict JSON containing source candidates, claims, candidate flows, and open questions. Validate each source with the existing public-URL policy, fetch it with bounded redirects and response-size limits, then discard claims whose citations were not fetched successfully. Merge and parse with `parseAppDossier()`.

```typescript
export interface ResearchDossierInput { app: string; homepageUrl: string; }
export interface ResearchReport { sourceCandidates: string[]; claims: DossierClaim[]; candidateFlows: CandidateFlow[]; roles: string[]; capabilities: string[]; openQuestions: string[]; }
export interface VerifiedResearchSource extends DossierSource { text: string; }
export interface ResearchDossierDependencies {
  sessions: ChatSession[];
  collectResearchPages(homepageUrl: string): Promise<ResearchPage[]>;
  fetchAndVerifySources(urls: string[], homepageUrl: string): Promise<VerifiedResearchSource[]>;
}

export async function researchDossier(input: ResearchDossierInput, dependencies: ResearchDossierDependencies): Promise<AppDossier> {
  const owned = await dependencies.collectResearchPages(input.homepageUrl);
  const reports = await Promise.all(researchAssignments().map((assignment, index) =>
    dependencies.sessions[index].ask(buildDossierPrompt(input, assignment, owned))
      .then(parseResearchReport)
  ));
  const sources = await dependencies.fetchAndVerifySources(reports.flatMap(({ sourceCandidates }) => sourceCandidates), input.homepageUrl);
  return mergeResearchReports(input.app, reports, sources);
}
```

`fetchAndVerifySources()` must resolve every hostname before connection and reject loopback, link-local, private, documentation-only address ranges, and any redirect that resolves to one of them. Cap each response at 1 MiB, accept text/HTML only, and retain the final URL plus retrieval timestamp.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousResearch.test.ts src/appResearch.test.ts
git add src/autonomousResearch.ts src/autonomousResearch.test.ts src/appResearch.ts src/appResearch.test.ts
git commit -m "feat: generate cited app research dossiers"
```

### Task 6: Plan Missions and Measure Coverage

**Files:**
- Create: `src/autonomousPlanner.ts`
- Create: `src/autonomousPlanner.test.ts`

- [ ] **Step 1: Write failing planning and completion tests**

```typescript
test("creates app-specific missions and defers destructive work", () => {
  const missions = planInitialMissions(dossier, true);
  assert.equal(missions[0].missionKey, "authentication-and-navigation");
  assert.equal(missions.at(-1)?.mode, "mutate");
  assert.equal(new Set(missions.map(({ missionKey }) => missionKey)).size, missions.length);
});

test("requires two plateau rounds before deep crawl completion", () => {
  assert.equal(coverageDecision({ queued: 0, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 0, newTransitions: 0, plateauRounds: 1 }), "continue");
  assert.equal(coverageDecision({ queued: 0, running: 0, recoverable: 0, unansweredHighValue: 0, newStates: 0, newTransitions: 0, plateauRounds: 2 }), "complete");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/autonomousPlanner.test.ts`

Expected: FAIL because planner functions are missing.

- [ ] **Step 3: Implement deterministic mission planning around LLM proposals**

```typescript
export interface CoverageSnapshot {
  queued: number;
  running: number;
  recoverable: number;
  unansweredHighValue: number;
  newStates: number;
  newTransitions: number;
  plateauRounds: number;
  ceilingReached?: boolean;
}

export function planInitialMissions(dossier: AppDossier, allowAll: boolean): AutonomousMission[] {
  const candidates = [
    { missionKey: "authentication-and-navigation", goal: "Authenticate and map primary navigation", productArea: "Account", mode: "read" as const, prerequisites: [], budget: { actions: 80, recoveries: 4 } },
    ...dossier.candidateFlows.map(({ id, title, productArea, mode, prerequisites }) => ({ missionKey: id, goal: title, productArea, mode, prerequisites, budget: { actions: 120, recoveries: 5 } })),
  ];
  const unique = [...new Map(candidates.map((mission) => [mission.missionKey, mission])).values()]
    .filter((mission) => mission.mode === "read" || allowAll);
  return unique.sort((left, right) => Number(left.mode === "mutate") - Number(right.mode === "mutate"));
}

export function coverageDecision(input: CoverageSnapshot): "continue" | "complete" | "partial" {
  if (input.ceilingReached) return "partial";
  if (input.queued || input.running || input.recoverable || input.unansweredHighValue) return "continue";
  return input.newStates === 0 && input.newTransitions === 0 && input.plateauRounds >= 2 ? "complete" : "continue";
}
```

Add `planFollowupMissions()` that accepts only cited dossier capability IDs or capabilities reported by completed missions, deduplicates by mission key, and refuses mutating work when `allow_all` is false.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousPlanner.test.ts
git add src/autonomousPlanner.ts src/autonomousPlanner.test.ts
git commit -m "feat: plan autonomous discovery missions"
```

### Task 7: Build State Identity and Graph-to-Flow Assembly

**Files:**
- Create: `src/autonomousGraph.ts`
- Create: `src/autonomousGraph.test.ts`
- Modify: `src/designSystem.ts`
- Modify: `src/designSystem.test.ts`

- [ ] **Step 1: Write failing dedupe and flow tests**

```typescript
test("distinguishes modal states on the same URL", () => {
  const base = stateKey({ normalizedUrl: "https://app.test/items", title: "Items", landmarks: ["Items", "New"], domHash: "a", screenshotHash: "1", accountStateVersion: 1 });
  const modal = stateKey({ normalizedUrl: "https://app.test/items", title: "Items", landmarks: ["Create item", "Save"], domHash: "b", screenshotHash: "2", accountStateVersion: 1 });
  assert.notEqual(base, modal);
});

test("assembles one ordered flow from a successful coherent path", () => {
  const flows = assembleGraphFlows({ runId: "1", platform: "web", missions: [completedMission], states, transitions, verifiedEvidenceIds: new Set(["10", "11", "12"]) });
  assert.deepEqual(flows[0].steps.map(({ label, evidence }) => ({ label, evidence })), [
    { label: "Items", evidence: [10] }, { label: "Create item", evidence: [11] }, { label: "Item created", evidence: [12] },
  ]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/autonomousGraph.test.ts src/designSystem.test.ts`

Expected: FAIL because graph functions and flow provenance fields are missing.

- [ ] **Step 3: Implement stable state keys and candidate flow validation**

```typescript
export interface StateIdentityInput {
  normalizedUrl: string;
  title: string;
  landmarks: string[];
  domHash: string;
  screenshotHash: string;
  accountStateVersion: number;
}

export function normalizeAutonomousUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}

export function stateKey(input: StateIdentityInput): string {
  const landmarks = [...new Set(input.landmarks.map((value) => value.trim()).filter(Boolean))].sort();
  return createHash("sha256").update(JSON.stringify({
    url: normalizeAutonomousUrl(input.normalizedUrl), title: input.title.trim(), landmarks,
    domHash: input.domHash, screenshotHash: input.screenshotHash, accountStateVersion: input.accountStateVersion,
  })).digest("hex");
}

export interface FlowProvenance {
  autonomousRunId: string;
  missionId: string;
  confidence: number;
  sourceUrls: string[];
  validationStatus: "complete" | "uncertain" | "incomplete";
}
```

Extend `DesignFlow` with optional `provenance?: FlowProvenance`. Implement `assembleGraphFlows()` so only successful transitions with destination evidence, one coherent mission goal, matching app/platform/version ownership, no repeated state, and confidence at least `0.85` return `validationStatus: "complete"`. Return rejected candidates separately with exact reasons.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousGraph.test.ts src/designSystem.test.ts
git add src/autonomousGraph.ts src/autonomousGraph.test.ts src/designSystem.ts src/designSystem.test.ts
git commit -m "feat: assemble flows from autonomous state graphs"
```

### Task 8: Encrypt and Version the Shared Browser Session

**Files:**
- Create: `src/crawlSession.ts`
- Create: `src/crawlSession.test.ts`
- Modify: `services/api/src/config.ts`
- Modify: `services/api/src/config.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing encryption and key-validation tests**

```typescript
test("encrypts authenticated storage state with authenticated encryption", () => {
  const key = randomBytes(32).toString("base64");
  const state = { cookies: [{ name: "session", value: "secret", domain: "app.test", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" as const }], origins: [] };
  const encrypted = encryptStorageState(state, key);
  assert.doesNotMatch(encrypted, /secret/);
  assert.deepEqual(decryptStorageState(encrypted, key), state);
  assert.throws(() => decryptStorageState(encrypted, randomBytes(32).toString("base64")), /authenticate|decrypt/i);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/crawlSession.test.ts services/api/src/config.test.ts`

Expected: FAIL because the session module and required configuration are missing.

- [ ] **Step 3: Implement AES-256-GCM storage-state encryption**

```typescript
import type { BrowserContext } from "playwright";
export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export function encryptStorageState(state: StorageState, encodedKey: string): string {
  const key = decodeSessionKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptStorageState(value: string, encodedKey: string): StorageState {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted crawl session");
  const decipher = createDecipheriv("aes-256-gcm", decodeSessionKey(encodedKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8"));
}
```

Require `CRAWL_SESSION_ENCRYPTION_KEY` as exactly 32 decoded bytes. Never return encrypted storage state from an API view.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test src/crawlSession.test.ts services/api/src/config.test.ts
git add src/crawlSession.ts src/crawlSession.test.ts services/api/src/config.ts services/api/src/config.test.ts .env.example
git commit -m "feat: protect shared crawler sessions"
```

### Task 9: Execute Bounded Agent Episodes Through the Existing Runner

**Files:**
- Create: `src/autonomousAgent.ts`
- Create: `src/autonomousAgent.test.ts`
- Modify: `src/smartCrawler.ts`
- Modify: `src/smartCrawler.test.ts`
- Modify: `src/crawlPlan.ts`
- Modify: `src/crawlPlan.test.ts`

- [ ] **Step 1: Write failing observation, origin, and episode tests**

```typescript
test("turns one agent decision into a strict one-flow plan", () => {
  const episode = buildEpisodePlan({ app: "agent-app", startUrl: "https://app.test/items", mission, observation, decision: { action: "click", role: "button", name: "New item", expectedState: "Create item", expectedVisible: { role: "heading", name: "Create item" }, mode: "read" } });
  assert.equal(episode.flows.length, 1);
  assert.equal(episode.flows[0].steps[0].action, "click");
  assert.equal(episode.reviewed, true);
});

test("blocks unrelated and private-network navigation", () => {
  const policy = createOriginPolicy("https://app.test", ["https://auth.app.test"]);
  assert.equal(policy.allows("https://auth.app.test/login"), true);
  assert.equal(policy.allows("https://example.org"), false);
  assert.equal(policy.allows("http://169.254.169.254/latest/meta-data"), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/autonomousAgent.test.ts src/crawlPlan.test.ts src/smartCrawler.test.ts`

Expected: FAIL because autonomous observation and episode planning are missing.

- [ ] **Step 3: Implement observation and strict episode parsing**

```typescript
export async function observePage(page: Page): Promise<AgentObservation> {
  const snapshot = await page.locator("body").ariaSnapshot({ timeout: 10_000 });
  const landmarks = await page.getByRole("heading").allTextContents();
  const controls = await page.locator("button, a, input, select, textarea").evaluateAll((nodes) => nodes.slice(0, 200).map((node) => ({
    role: node.getAttribute("role") ?? node.tagName.toLowerCase(),
    name: node.getAttribute("aria-label") ?? (node.textContent ?? "").trim().slice(0, 160),
  })).filter(({ name }) => name));
  const png = await page.screenshot({ fullPage: true });
  const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
  return { url: page.url(), title: await page.title(), landmarks, controls, screenshotHash: hash(png), domHash: hash(Buffer.from(snapshot)) };
}
```

`buildEpisodePlan()` creates one immutable reviewed flow containing one to five strict actions. Every action has an expected URL/visible state/page disposition. Parse LLM decisions through `parseCrawlStep()`, apply `createOriginPolicy()` to every `goto` and expected URL, and require `allow_all` for side-effect steps.

- [ ] **Step 4: Execute the episode as a planned child run**

Create and auto-approve an append-only mission plan linked through `research_metadata` to the autonomous parent and mission. Create a planned child run with `parent_run_id`, then call existing `createCrawlRunService.execute(childRunId)`. Record resulting evidence as states/transitions; never let the agent write evidence rows directly.

```typescript
export async function executeAgentEpisode(input: AgentEpisodeInput, dependencies: AgentEpisodeDependencies): Promise<AgentEpisodeResult> {
  const plan = buildEpisodePlan(input);
  const storedPlan = await dependencies.saveAutonomousPlan(plan, input.parentRunId, input.mission.id);
  const child = await dependencies.createChildRun({ parentRunId: input.parentRunId, missionId: input.mission.id, planId: storedPlan.id, allowSideEffects: input.allowAll });
  const run = await dependencies.executeRun(child.id);
  return dependencies.readEpisodeResult(run.id, input.mission.id);
}
```

When observation detects a login page or the child run returns an authentication blocker, checkpoint the mission and request the authentication lease. The authentication agent first loads the latest encrypted storage state; if the app still requires login, it may produce `fill` steps containing named secret references such as `$APP_TEST_EMAIL` and `$APP_TEST_PASSWORD`. Resolve those names only in the existing runtime environment substitution path, save the refreshed encrypted storage state with an incremented account-state version, release the authentication lease, and resume the original mission.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousAgent.test.ts src/crawlPlan.test.ts src/smartCrawler.test.ts
git add src/autonomousAgent.ts src/autonomousAgent.test.ts src/smartCrawler.ts src/smartCrawler.test.ts src/crawlPlan.ts src/crawlPlan.test.ts
git commit -m "feat: execute autonomous crawler episodes"
```

### Task 10: Coordinate Concurrent Research and Discovery Agents

**Files:**
- Create: `src/autonomousOrchestrator.ts`
- Create: `src/autonomousOrchestrator.test.ts`

- [ ] **Step 1: Write failing concurrency, mutation, and recovery tests**

```typescript
test("runs read missions concurrently and mutations under one lease", async () => {
  const activeReads = new Set<string>();
  let maximumReads = 0;
  let activeMutations = 0;
  await orchestrator.run(parentRunId, {
    executeMission: async (mission) => {
      if (mission.mode === "read") { activeReads.add(mission.id); maximumReads = Math.max(maximumReads, activeReads.size); await tick(); activeReads.delete(mission.id); }
      else { activeMutations++; assert.equal(activeMutations, 1); await tick(); activeMutations--; }
      return succeededResult(mission);
    },
  });
  assert.ok(maximumReads >= 2);
});

test("resumes expired missions and preserves completed graph work", async () => {
  await store.expireMission(interruptedMissionId);
  await orchestrator.run(parentRunId);
  assert.equal((await store.autonomousRunDetail(parentRunId))?.completedMissionIds.includes(completedMissionId), true);
  assert.equal((await store.mission(interruptedMissionId))?.status, "succeeded");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/autonomousOrchestrator.test.ts`

Expected: FAIL because the orchestrator is missing.

- [ ] **Step 3: Implement the parent lifecycle and bounded worker pool**

```typescript
export function createAutonomousOrchestrator(dependencies: AutonomousOrchestratorDependencies) {
  return {
    async run(runId: string): Promise<AutonomousRunDetail> {
      const parent = await dependencies.claimParent(runId);
      const dossier = await dependencies.ensureDossier(parent);
      await dependencies.ensureInitialMissions(parent, dossier);
      while (true) {
        await Promise.all(Array.from({ length: parent.environment.agentConcurrency ?? 3 }, (_, index) =>
          dependencies.runMissionLoop(parent, `agent-${index + 1}`)
        ));
        await dependencies.scheduleFollowups(parent, dossier);
        const coverage = await dependencies.coverage(parent.id);
        if (coverage.decision !== "continue") return dependencies.finalize(parent.id, coverage.decision);
      }
    },
  };
}
```

Start one `startChatPool(provider, researchConcurrency)` for research and one pool for discovery decisions. Mission loops claim DB work, heartbeat while running, acquire mutation/authentication leases when required, save checkpoints after every episode, and stop immediately on parent cancellation.

- [ ] **Step 4: Implement completion and partial-result semantics**

Parent success requires two zero-growth coverage rounds, no queued/running/recoverable mission, no live account lease, and no unanswered high-value capability. Ceilings set parent status to `interrupted` with a structured partial summary; cancellation sets `cancelled`; terminal mission failures set `failed` only when no valid recovery/follow-up exists.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test src/autonomousOrchestrator.test.ts
git add src/autonomousOrchestrator.ts src/autonomousOrchestrator.test.ts
git commit -m "feat: orchestrate autonomous discovery agents"
```

### Task 11: Add the Autonomous Queue Job and Worker Wiring

**Files:**
- Modify: `src/queue.ts`
- Modify: `src/queue.test.ts`
- Modify: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `services/import-worker/src/index.ts`

- [ ] **Step 1: Write failing queue and handler tests**

```typescript
test("parses an autonomous crawl job without accepting embedded credentials", () => {
  assert.deepEqual(parseJob({ type: "autonomous-crawl-app", name: "linear", runId: "42" }), { type: "autonomous-crawl-app", name: "linear", runId: "42" });
  assert.throws(() => parseJob({ type: "autonomous-crawl-app", name: "linear", runId: "42", password: "secret" }));
});

test("dispatches autonomous work through the durable orchestrator", async () => {
  const calls: string[] = [];
  const handler = createPipelineHandler({ autonomousOrchestrator: { run: async (runId) => { calls.push(runId); return succeededDetail(runId); } } });
  await handler({ type: "autonomous-crawl-app", name: "linear", runId: "42" });
  assert.deepEqual(calls, ["42"]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test src/queue.test.ts services/import-worker/src/pipeline.test.ts`

Expected: FAIL because the job type is rejected.

- [ ] **Step 3: Extend the strict queue contract**

Add this variant to the existing `Job` union before its shared `jobId` intersection:

```typescript
| { type: "autonomous-crawl-app"; name: string; runId: string }
```

Parse exactly `type`, `name`, `runId`, and optional `jobId`; keep the same positive-decimal run-ID rule as `smart-crawl-app`. Do not place URL, storage state, secrets, dossier, or mission payloads on RabbitMQ.

- [ ] **Step 4: Wire one parent job to the in-process durable agent pool**

In the pipeline, handle `autonomous-crawl-app` beside `smart-crawl-app`, set tracked job status from the parent terminal state, and rethrow only infrastructure/interruption errors so RabbitMQ bounded retry can resume the same run ID. Configure the orchestrator in `services/import-worker/src/index.ts` with the existing object store, crawl service, chat pool, and worker ID.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test src/queue.test.ts services/import-worker/src/pipeline.test.ts services/import-worker/src/startup.test.ts
git add src/queue.ts src/queue.test.ts services/import-worker/src/pipeline.ts services/import-worker/src/pipeline.test.ts services/import-worker/src/index.ts
git commit -m "feat: dispatch autonomous crawl jobs"
```

### Task 12: Validate and Publish Complete Autonomous Flows

**Files:**
- Modify: `src/autonomousGraph.ts`
- Modify: `src/autonomousGraph.test.ts`
- Modify: `src/autonomousStore.ts`
- Modify: `src/autonomousStore.test.ts`
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`

- [ ] **Step 1: Write failing publication-threshold tests**

```typescript
test("publishes complete high-confidence flows and retains uncertain drafts", async () => {
  const result = await finalizeAutonomousFlows(parentRunId);
  assert.deepEqual(result.published.map(({ id }) => id), ["create-item"]);
  assert.deepEqual(result.drafts.map(({ id, blockers }) => ({ id, blockers })), [
    { id: "share-item", blockers: ["confidence_below_threshold"] },
    { id: "delete-item", blockers: ["evidence_object_missing"] },
  ]);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/autonomousGraph.test.ts src/autonomousStore.test.ts src/db.test.ts`

Expected: FAIL because automatic flow finalization is missing.

- [ ] **Step 3: Implement deterministic finalization**

```typescript
export async function finalizeAutonomousFlows(runId: string, dependencies: FinalizeAutonomousDependencies): Promise<AutonomousFlowFinalization> {
  const snapshot = await dependencies.loadFinalization(runId);
  const candidates = assembleGraphFlows(snapshot);
  const verified = await dependencies.verifyEvidence(candidates.complete);
  const existing = await dependencies.getAppFlows(snapshot.app, snapshot.platform);
  const published = mergeFlows(existing, verified.valid);
  await dependencies.saveAppFlows(snapshot.app, snapshot.platform, published);
  await dependencies.analyzeCapturedScreens(snapshot.app, snapshot.platform, snapshot.versionId);
  await dependencies.ensureDesignSystem(snapshot.app, snapshot.platform, snapshot.versionId);
  const blockers = await dependencies.getVersionPublicationBlockers(snapshot.versionId);
  if (blockers.length === 0) await dependencies.publishVersion(snapshot.versionId, snapshot.createdBy);
  return { published: verified.valid, drafts: [...candidates.drafts, ...verified.invalid], versionBlockers: blockers };
}
```

Implement flow merge and autonomous finalization in `autonomousStore` inside one transaction that locks the target `app_versions` row before reading or writing `app_flows`. After that transaction commits, run the existing screen-analysis/caption and platform-scoped synthesis services for newly captured screens, then call the existing publication function. If enrichment or existing version blockers remain, keep the version draft and expose them; do not mutate the currently published version.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/autonomousGraph.test.ts src/autonomousStore.test.ts src/db.test.ts
git add src/autonomousGraph.ts src/autonomousGraph.test.ts src/autonomousStore.ts src/autonomousStore.test.ts src/db.ts src/db.test.ts
git commit -m "feat: publish validated autonomous flows"
```

### Task 13: Add Admin API and Workspace Controls

**Files:**
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`
- Modify: `src/vitrine/researchApi.ts`
- Modify: `src/vitrine/CrawlResearchApi.test.ts`
- Modify: `src/vitrine/components/CrawlWorkspacePanel.tsx`
- Modify: `src/vitrine/CrawlWorkspacePanel.test.tsx`

- [ ] **Step 1: Write failing API authorization and input tests**

```typescript
test("creates and inspects an admin-only autonomous crawl", async () => {
  const denied = await fetch(`${base}/crawl/apps/linear/autonomous-runs`, { method: "POST", headers: userJson, body: JSON.stringify(validInput) });
  assert.equal(denied.status, 403);
  const created = await fetch(`${base}/crawl/apps/linear/autonomous-runs`, { method: "POST", headers: adminJson, body: JSON.stringify(validInput) });
  assert.equal(created.status, 202);
  const view = await created.json();
  assert.equal(view.run.allow_all, true);
  assert.equal(JSON.stringify(view).includes("encrypted_storage_state"), false);
});
```

Test rejection of private URLs, credential values in request bodies, missing `allowAllAcknowledged`, invalid ceilings, normal-user reads, and retry attempts that inherit `allow_all` without a fresh acknowledgement.

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts src/vitrine/CrawlResearchApi.test.ts`

Expected: FAIL because autonomous routes/helpers are missing.

- [ ] **Step 3: Add API routes and safe views**

Add:

```text
POST /api/crawl/apps/:app/autonomous-runs
GET  /api/crawl/autonomous-runs/:runId
POST /api/crawl/autonomous-runs/:runId/pause
POST /api/crawl/autonomous-runs/:runId/cancel
POST /api/crawl/autonomous-runs/:runId/resume
PUT  /api/crawl/apps/:app/session
GET  /api/crawl/apps/:app/session
```

The create body is:

```typescript
export interface CreateAutonomousRunBody {
  homepageUrl: string;
  platform: Platform;
  provider: "chatgpt" | "claude";
  sessionId?: string;
  requiredSecrets: string[];
  allowAll: boolean;
  allowAllAcknowledged: boolean;
  ceilings: { runtimeMinutes: number; actions: number; modelRequests: number; storageBytes: number };
  agentConcurrency: number;
}
```

Validate ranges server-side, resolve secrets only inside the worker, persist the parent before publishing `{ type: "autonomous-crawl-app", name, runId }`, and mark it interrupted if queue publication fails.

- [ ] **Step 4: Add typed Vitrine commands and workspace state**

Add `createAutonomousRun`, `getAutonomousRun`, `pauseAutonomousRun`, `cancelAutonomousRun`, `resumeAutonomousRun`, and `saveCrawlSession` to `src/vitrine/researchApi.ts`. Extend the admin workspace with URL, platform, provider, shared-session status, secret-name selection, concurrency/ceiling controls, and explicit allow-all acknowledgement.

Render dossier sources, mission counters, active agents, mutation/authentication lease owner, state/transition coverage, published/draft flow counts, and exact blockers. Reuse existing polling and stop it only when the parent is terminal.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test services/api/src/app.test.ts src/vitrine/CrawlResearchApi.test.ts
npx tsx --test src/vitrine/CrawlWorkspacePanel.test.tsx
git add services/api/src/app.ts services/api/src/app.test.ts src/vitrine/researchApi.ts src/vitrine/CrawlResearchApi.test.ts src/vitrine/components/CrawlWorkspacePanel.tsx src/vitrine/CrawlWorkspacePanel.test.tsx
git commit -m "feat: add autonomous crawl workspace"
```

### Task 14: Prove Multi-Agent Discovery Against a Deterministic App

**Files:**
- Create: `test/fixtures/autonomous-app/server.ts`
- Create: `src/autonomousAcceptance.test.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/operations/autonomous-crawler.md`

- [ ] **Step 1: Create the deterministic acceptance fixture**

The fixture must expose stable routes for login, onboarding, items, item creation/edit/delete, search, sharing, settings, session expiry, popup navigation, and a billing-like confirmation. Use an in-memory account and event ledger so the test can assert mutation serialization.

```typescript
export interface FixtureEvent { at: number; actor: string; action: string; }
export function concurrentMutationCount(events: FixtureEvent[]): number {
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    if (event.action === "mutation-start") maximum = Math.max(maximum, ++active);
    if (event.action === "mutation-end") active--;
  }
  return maximum;
}
```

- [ ] **Step 2: Write the failing end-to-end test**

```typescript
test("researches, delegates, recovers, and publishes autonomous flows", async () => {
  const run = await harness.submit({ homepageUrl: fixture.url, app: "fixture", platform: "web", allowAll: true, agentConcurrency: 3 });
  await harness.expireSessionAfterFirstMission(run.id);
  const completed = await harness.waitForTerminal(run.id);
  assert.equal(completed.status, "succeeded");
  assert.ok(completed.dossier.sources.length >= 2);
  assert.ok(completed.missions.filter(({ status }) => status === "succeeded").length >= 5);
  assert.equal(concurrentMutationCount(fixture.events), 1);
  assert.ok(completed.flows.some(({ title }) => /create item/i.test(title)));
  assert.ok(completed.flows.every((flow) => flow.steps.every((step) => step.evidence.length > 0)));
});
```

- [ ] **Step 3: Run and verify failure, then implement the fixture adapters**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/autonomousAcceptance.test.ts`

Expected: FAIL until the fixture research provider, deterministic decision provider, session refresh, browser contexts, and object-store adapter are connected.

Implement those adapters without weakening production validation. The deterministic decision provider returns the same strict JSON contracts as live chat sessions.

- [ ] **Step 4: Run all verification gates**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/autonomousAcceptance.test.ts
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
git diff --check
```

Expected: every command exits `0`; acceptance publishes multiple evidence-backed flows and the fixture records no concurrent mutation.

- [ ] **Step 5: Document operation and commit**

Document configuration, session upload, `allow_all`, ceilings, worker recovery, mission/lease inspection, cancellation, partial results, object-store blockers, and authorized live-acceptance procedure.

```bash
git add test/fixtures/autonomous-app/server.ts src/autonomousAcceptance.test.ts README.md .env.example docs/operations/autonomous-crawler.md
git commit -m "test: prove autonomous app-flow discovery"
```

## Live Acceptance Gate

After all automated gates pass, run one explicitly authorized live application using the administrator-provided shared account:

1. Upload or refresh the saved session.
2. Submit the app URL with deep ceilings, three discovery agents, and explicit `allow_all` acknowledgement.
3. Record the parent run ID, dossier sources, mission assignments, lease transitions, state/transition growth, published flows, draft blockers, duration, model requests, and object bytes.
4. Simulate one worker interruption and verify the same parent run resumes.
5. Run the same app again and verify no duplicate flow IDs, cross-platform evidence, or missing/corrupt objects are published.
6. Save the acceptance evidence in the run detail and operations handoff; do not commit credentials, storage state, or secret values.

Completion requires the submitted URL to produce app-specific, ordered, evidence-backed Astryx Flows through orchestrated research and multiple discovery agents. A green unit suite without this live browser result is not completion.
