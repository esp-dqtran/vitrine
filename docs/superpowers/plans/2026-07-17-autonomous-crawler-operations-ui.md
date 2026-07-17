# Autonomous Crawler Operations UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an administrator-only Crawls workspace that separates work by App and immutable run while exposing every autonomous agent, mission, action, observation, lease, evidence item, blocker, and resulting Flow.

**Architecture:** Add a redacted append-only `crawl_agent_events` ledger beside the existing autonomous mission/state/transition records, then expose App-grouped overview, App history, run detail, and cursor event APIs. Mount three Vitrine routes—fleet overview, App control room, and run control room—using existing Astryx components and two-second cursor polling; commands continue through the existing autonomous-run and shared-session endpoints.

**Tech Stack:** PostgreSQL migrations, TypeScript, Express, React, Vite, `@astryxdesign/core`, Node test runner, `tsx --test`, Playwright acceptance fixtures

---

## File map

**Backend contracts and persistence**

- Create `migrations/0007_crawl_agent_events.sql`: immutable event ledger and indexes.
- Create `src/autonomousEvents.ts`: event types, payload bounds, and durable redaction.
- Create `src/autonomousEvents.test.ts`: parser and redaction tests.
- Modify `src/autonomousStore.ts`: append/list events, overview, App history, leases, and agent summaries.
- Modify `src/autonomousStore.test.ts`: durable event and read-model tests.
- Modify `src/autonomousWorker.ts`: emit research, mission, authentication, transition, Flow, and terminal events.
- Modify `src/crawlRun.ts`: emit autonomous child-step events only after durable step writes.
- Modify `src/autonomousAcceptance.test.ts`: prove every participating agent appears in the event history.

**API**

- Modify `services/api/src/app.ts`: overview, App history, typed detail, and cursor event endpoints.
- Modify `services/api/src/app.test.ts`: admin authorization, App/run isolation, cursor behavior, and secret safety.

**Vitrine data and routing**

- Modify `src/vitrine/types.ts`: typed overview, run, agent, lease, and event views.
- Modify `src/vitrine/researchApi.ts`: crawler overview/history/detail/event clients.
- Create `src/vitrine/CrawlsApi.test.ts`: request-path and payload tests.
- Modify `src/vitrine/router.ts`: Crawls, App crawler, and run routes.
- Create `src/vitrine/router.test.ts`: parse and path-generation tests.
- Modify `src/vitrine/components/Sidebar.tsx`: administrator Crawls navigation.
- Create `src/vitrine/components/Sidebar.test.tsx`: route selection and visibility tests.

**Vitrine pages and components**

- Create `src/vitrine/useCrawlerRun.ts`: stable detail and cursor polling.
- Create `src/vitrine/useCrawlerRun.test.ts`: event merging and terminal-stop tests.
- Create `src/vitrine/components/crawler/NewCrawlDialog.tsx`: validated creation and safety acknowledgement.
- Create `src/vitrine/components/crawler/CrawlSessionEditor.tsx`: shared storage-state upload extracted from the current crawler panel.
- Create `src/vitrine/components/crawler/CrawlerRunSummary.tsx`: progress, budgets, and commands.
- Create `src/vitrine/components/crawler/CrawlerAgentRail.tsx`: agent status, heartbeat, lease, and filtering.
- Create `src/vitrine/components/crawler/CrawlerMissionTree.tsx`: product-area to action hierarchy.
- Create `src/vitrine/components/crawler/CrawlerEventTimeline.tsx`: filtered append-only activity.
- Create `src/vitrine/components/crawler/CrawlerEventInspector.tsx`: action, expectation, evidence, and blocker detail.
- Create `src/vitrine/components/crawler/CrawlerResults.tsx`: Flows, drafts, coverage, research, and diagnostics.
- Create `src/vitrine/components/CrawlsPage.tsx`: App-grouped fleet overview.
- Create `src/vitrine/components/CrawlAppPage.tsx`: App configuration, session, and history.
- Create `src/vitrine/components/CrawlRunPage.tsx`: live three-region control room.
- Create `src/vitrine/CrawlerOperations.test.tsx`: page and interaction tests.
- Modify `src/vitrine/App.tsx`: mount administrator crawler routes.
- Modify `src/vitrine/styles.css`: responsive crawler layout and reduced-motion behavior.

**Documentation**

- Modify `docs/operations/autonomous-crawler.md`: UI workflow, event inspection, and recovery.
- Modify `README.md`: link administrators to the Crawls workspace.

### Task 1: Define and redact crawler agent events

**Files:**
- Create: `src/autonomousEvents.ts`
- Create: `src/autonomousEvents.test.ts`

- [ ] **Step 1: Write the failing contract and redaction tests**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { parseAgentEventInput, redactAgentEventValue } from "./autonomousEvents.ts";

test("redacts credentials, cookie values, tokens, and sensitive URL parameters", () => {
  const redacted = redactAgentEventValue({
    url: "https://app.test/items?token=secret-token&tab=all",
    password: "hunter2",
    headers: { authorization: "Bearer abc", accept: "text/html" },
    cookie: "session=secret-cookie",
  });
  assert.deepEqual(redacted, {
    url: "https://app.test/items?tab=all",
    password: "[REDACTED]",
    headers: { authorization: "[REDACTED]", accept: "text/html" },
    cookie: "[REDACTED]",
  });
  assert.doesNotMatch(JSON.stringify(redacted), /hunter2|secret-token|secret-cookie|Bearer abc/);
});

test("accepts one bounded typed event with a stable dedupe key", () => {
  const event = parseAgentEventInput({
    runId: "41",
    missionId: "7",
    workerId: "worker:agent-1",
    agentRole: "discovery",
    eventType: "mission.claimed",
    status: "running",
    summary: "Agent claimed Search items",
    payload: { productArea: "Items" },
    dedupeKey: "mission:7:claimed:worker:agent-1",
  });
  assert.equal(event.eventType, "mission.claimed");
  assert.equal(event.dedupeKey, "mission:7:claimed:worker:agent-1");
});

test("rejects unknown event types and statuses at the persistence boundary", () => {
  assert.throws(() => parseAgentEventInput({
    runId: "41", agentRole: "discovery", eventType: "browser.did_something",
    status: "maybe", summary: "Unknown event", dedupeKey: "unknown:1",
  }), /metadata/);
});
```

- [ ] **Step 2: Run the tests and verify the module is missing**

Run: `node --experimental-strip-types --test src/autonomousEvents.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/autonomousEvents.ts`.

- [ ] **Step 3: Implement the bounded event contract and recursive redaction**

```typescript
export const AGENT_ROLES = ["orchestrator", "research", "discovery", "authentication"] as const;
export type AgentRole = typeof AGENT_ROLES[number];
export const AGENT_EVENT_STATUSES = ["queued", "running", "waiting", "succeeded", "blocked", "interrupted", "failed", "cancelled"] as const;
export type AgentEventStatus = typeof AGENT_EVENT_STATUSES[number];
export const AGENT_EVENT_TYPES = [
  "run.queued", "run.paused", "run.resumed", "run.cancelled", "run.finished",
  "research.started", "research.source_verified", "research.dossier_saved",
  "mission.queued", "mission.claimed", "mission.heartbeat", "mission.finished",
  "decision.proposed", "episode.started", "step.started", "step.completed", "step.skipped", "step.failed",
  "state.recorded", "transition.recorded", "lease.acquired", "lease.released",
  "session.refreshed", "evidence.persisted", "evidence.rejected",
  "flow.drafted", "flow.published", "flow.rejected",
] as const;
export type AgentEventType = typeof AGENT_EVENT_TYPES[number];

export interface AgentEventInput {
  runId: string;
  missionId?: string;
  childRunId?: string;
  flowId?: string;
  stepId?: string;
  workerId?: string;
  agentRole: AgentRole;
  eventType: AgentEventType;
  status: AgentEventStatus;
  summary: string;
  payload?: unknown;
  evidenceId?: string;
  dedupeKey: string;
}

const sensitiveKey = /password|passwd|pwd|secret|token|authorization|cookie|storage.?state|api.?key/i;
const sensitiveQuery = /password|passwd|pwd|secret|token|authorization|cookie|session/i;

export function redactAgentEventValue(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      for (const name of [...url.searchParams.keys()]) if (sensitiveQuery.test(name)) url.searchParams.delete(name);
      url.username = "";
      url.password = "";
      return url.toString();
    } catch {
      return value.slice(0, 2_000);
    }
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactAgentEventValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100)
    .map(([name, item]) => [name, redactAgentEventValue(item, name)]));
}

export function parseAgentEventInput(input: unknown): AgentEventInput {
  if (!input || typeof input !== "object") throw new Error("Invalid agent event");
  const value = input as Record<string, unknown>;
  if (typeof value.runId !== "string" || !/^\d+$/.test(value.runId)
    || typeof value.dedupeKey !== "string" || !value.dedupeKey.trim() || value.dedupeKey.length > 240) {
    throw new Error("Invalid agent event identity");
  }
  for (const name of ["missionId", "childRunId", "evidenceId"] as const) {
    const field = value[name];
    if (field !== undefined && (typeof field !== "string" || !/^\d+$/.test(field))) {
      throw new Error("Invalid agent event identity");
    }
  }
  for (const name of ["flowId", "stepId", "workerId"] as const) {
    const field = value[name];
    if (field !== undefined && (typeof field !== "string" || !field || field.length > 240)) {
      throw new Error("Invalid agent event identity");
    }
  }
  if (!AGENT_ROLES.includes(value.agentRole as AgentRole)
    || !AGENT_EVENT_TYPES.includes(value.eventType as AgentEventType)
    || !AGENT_EVENT_STATUSES.includes(value.status as AgentEventStatus)
    || typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 500) {
    throw new Error("Invalid agent event metadata");
  }
  return { ...value, dedupeKey: value.dedupeKey.trim(), summary: value.summary.trim(), payload: redactAgentEventValue(value.payload ?? {}) } as AgentEventInput;
}
```

- [ ] **Step 4: Run the focused tests**

Run: `node --experimental-strip-types --test src/autonomousEvents.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the contract**

```bash
git add src/autonomousEvents.ts src/autonomousEvents.test.ts
git commit -m "feat: define redacted crawler agent events"
```

### Task 2: Persist immutable events and crawler read models

**Files:**
- Create: `migrations/0007_crawl_agent_events.sql`
- Modify: `src/migrations.test.ts`
- Modify: `src/autonomousStore.ts`
- Modify: `src/autonomousStore.test.ts`

- [ ] **Step 1: Write failing migration and store tests**

Add a migration assertion:

```typescript
test("crawler event migration defines immutable ordered agent history", () => {
  const sql = readFileSync(join("migrations", "0007_crawl_agent_events.sql"), "utf8");
  assert.match(sql, /CREATE TABLE crawl_agent_events/);
  assert.match(sql, /UNIQUE \(run_id, dedupe_key\)/);
  assert.match(sql, /CREATE INDEX crawl_agent_events_run_cursor_idx/);
});
```

Add `crawl_agent_events` to the existing `fixture()` truncation list, then use that real PostgreSQL fixture:

```typescript
function agentEvent(runId: string, overrides: Partial<AgentEventInput> = {}): AgentEventInput {
  return {
    runId, workerId: "worker-a", agentRole: "discovery", eventType: "mission.claimed",
    status: "running", summary: "Claimed Search", dedupeKey: "mission:1:claimed", ...overrides,
  };
}

test("appends idempotent redacted events and lists them after a cursor", { skip: skipReason }, async (t) => {
  const { store, versionId } = await fixture(t);
  const parent = await store.createAutonomousRun({
    app: "agent-app", platform: "web", versionId, createdBy: -301,
    homepageUrl: "https://agent.test", allowAll: true,
  });
  const first = await store.appendEvent(agentEvent(parent.id, { payload: { password: "secret" } }));
  const repeated = await store.appendEvent(agentEvent(parent.id));
  assert.equal(repeated.id, first.id);
  const page = await store.listEvents(parent.id, { after: "0", limit: 50 });
  assert.deepEqual(page.events.map(({ id }) => id), [first.id]);
  assert.equal(page.nextCursor, first.id);
  assert.doesNotMatch(JSON.stringify(page), /secret/);
});

test("builds crawler overview per app without mixing historical active work", { skip: skipReason }, async (t) => {
  const { store, versionId } = await fixture(t);
  const older = await store.createAutonomousRun({
    app: "agent-app", platform: "web", versionId, createdBy: -301,
    homepageUrl: "https://agent.test", allowAll: true,
  });
  await store.appendEvent(agentEvent(older.id, { workerId: "old-worker" }));
  const latest = await store.createAutonomousRun({
    app: "agent-app", platform: "web", versionId, createdBy: -301,
    homepageUrl: "https://agent.test", allowAll: true,
  });
  await store.appendEvent(agentEvent(latest.id, { workerId: "worker-a" }));
  await store.appendEvent(agentEvent(latest.id, { workerId: "worker-b", dedupeKey: "mission:2:claimed" }));
  const overview = await store.autonomousOverview();
  assert.equal(overview[0].app, "agent-app");
  assert.equal(overview[0].latestRun.id, latest.id);
  assert.equal(overview[0].activeAgents, 2);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --experimental-strip-types --test src/migrations.test.ts src/autonomousStore.test.ts`

Expected: FAIL because migration `0007` and store event/read-model methods do not exist.

- [ ] **Step 3: Create the event table**

```sql
CREATE TABLE crawl_agent_events (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  mission_id BIGINT REFERENCES crawl_missions(id) ON DELETE SET NULL,
  child_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE SET NULL,
  flow_id TEXT,
  step_id TEXT,
  worker_id TEXT,
  agent_role TEXT NOT NULL CHECK (agent_role IN ('orchestrator','research','discovery','authentication')),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','waiting','succeeded','blocked','interrupted','failed','cancelled')),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_id BIGINT REFERENCES images(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL CHECK (length(dedupe_key) BETWEEN 1 AND 240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, dedupe_key)
);

CREATE INDEX crawl_agent_events_run_cursor_idx ON crawl_agent_events (run_id, id);
CREATE INDEX crawl_agent_events_app_created_idx ON crawl_agent_events (app_id, created_at DESC);
```

- [ ] **Step 4: Add store types and methods**

Extend `AutonomousStore` with:

```typescript
export interface CrawlAgentEventRecord extends AgentEventInput {
  id: string;
  app_id: number;
  created_at: Date;
}

export interface CrawlEventPage {
  events: CrawlAgentEventRecord[];
  nextCursor: string | null;
}

export interface CrawlAgentSummary {
  workerId: string;
  agentRole: AgentRole;
  status: AgentEventStatus;
  latestEventId: string;
  latestSummary: string;
  latestActivityAt: Date;
  missionId: string | null;
  evidenceCount: number;
}

export interface AutonomousRunHistoryItem {
  run: CrawlRunRecord;
  agentCount: number;
  completedMissions: number;
  totalMissions: number;
  publishedFlows: number;
  draftFlows: number;
  interruptionReason: string | null;
}

export interface CrawlAccountLeaseView {
  purpose: "mutation" | "authentication";
  missionId: string | null;
  workerId: string;
  heartbeatAt: Date;
  leaseExpiresAt: Date;
}

export interface AutonomousAppOverview {
  app: string;
  homepageUrl: string;
  platform: Platform;
  latestRun: CrawlRunRecord;
  activeAgents: number;
  completedMissions: number;
  totalMissions: number;
  blockedMissions: number;
  states: number;
  transitions: number;
  publishedFlows: number;
  draftFlows: number;
  sessionVersion: number | null;
  sessionUpdatedAt: Date | null;
  lastActivityAt: Date;
  blocker: string | null;
}

appendEvent(input: AgentEventInput): Promise<CrawlAgentEventRecord>;
listEvents(runId: string, options: { after?: string; limit?: number }): Promise<CrawlEventPage>;
autonomousOverview(): Promise<AutonomousAppOverview[]>;
listAutonomousRuns(app: string): Promise<AutonomousRunHistoryItem[]>;
```

Extend `AutonomousRunDetail` with `agents: CrawlAgentSummary[]` and `leases: CrawlAccountLeaseView[]`. Derive one agent summary from each worker's latest event, count evidence by worker, and list only the selected run's current lease rows.

Implement `appendEvent` by parsing through `parseAgentEventInput`, running `INSERT ... SELECT cr.app_id ... ON CONFLICT (run_id, dedupe_key) DO NOTHING RETURNING *`, and selecting the existing row by `(run_id, dedupe_key)` only when the insert returns nothing. Do not add event update or delete methods; a correction is a later event. Implement event pagination with `id > $after ORDER BY id LIMIT $limit`, clamped to 1–200. Build the overview with one `DISTINCT ON (app_id)` latest-run CTE ordered by `app_id, created_at DESC, id DESC`; pin every correlated aggregate to that selected run ID and read homepage/provider/ceilings/required-secret names from its already-sanitized environment object. Count active agents only when their latest event is `running` or `waiting`.

- [ ] **Step 5: Run migration and store tests**

Run: `node --experimental-strip-types --test src/migrations.test.ts src/autonomousStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit persistence**

```bash
git add migrations/0007_crawl_agent_events.sql src/migrations.test.ts src/autonomousStore.ts src/autonomousStore.test.ts
git commit -m "feat: persist crawler agent event history"
```

### Task 3: Emit complete autonomous lifecycle events

**Files:**
- Modify: `src/autonomousWorker.ts`
- Modify: `src/crawlRun.ts`
- Modify: `src/crawlRun.test.ts`
- Modify: `src/autonomousAcceptance.test.ts`

- [ ] **Step 1: Write failing child-step and acceptance assertions**

Add a crawl service test:

```typescript
test("autonomous children emit step events only after durable writes", async () => {
  const events: AgentEventInput[] = [];
  const service = createCrawlRunService({
    workerId: "worker-a",
    store: autonomousChildStoreFixture(),
    executeBrowser: successfulBrowserFixture(),
    recordAgentEvent: async (event) => { events.push(event); },
  });
  await service.execute("51");
  assert.deepEqual(events.map(({ eventType }) => eventType), ["step.started", "evidence.persisted", "step.completed"]);
  assert.equal(events[2].childRunId, "51");
  assert.equal(events[2].runId, "41");
});
```

Extend deterministic acceptance:

```typescript
assert.ok(completed.events.some(({ agentRole }) => agentRole === "research"));
assert.ok(completed.events.some(({ agentRole }) => agentRole === "discovery"));
assert.ok(completed.events.some(({ agentRole }) => agentRole === "authentication"));
assert.ok(completed.events.some(({ eventType }) => eventType === "flow.published"));
assert.doesNotMatch(JSON.stringify(completed.events), /fixture-password|fixture-session=valid/);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --experimental-strip-types --test src/crawlRun.test.ts src/autonomousAcceptance.test.ts`

Expected: FAIL because `recordAgentEvent` and acceptance event output are absent.

- [ ] **Step 3: Add one event helper to production orchestration**

In `createProductionAutonomousOrchestrator`, define:

```typescript
const emit = (input: AgentEventInput) => store.appendEvent(input);
```

Emit stable dedupe keys at these boundaries:

```typescript
await emit({
  runId: parent.id,
  missionId: mission.id,
  workerId: `${options.workerId}:${workerId}`,
  agentRole: authenticationRequired ? "authentication" : "discovery",
  eventType: "decision.proposed",
  status: "running",
  summary: authenticationRequired ? "Authentication agent proposed a bounded recovery episode" : `Agent proposed an episode for ${mission.goal}`,
  payload: { decision, productArea: mission.productArea },
  dedupeKey: `mission:${mission.id}:decision:${createHash("sha256").update(JSON.stringify(decision)).digest("hex")}`,
});
```

Use equivalent event writes for research pool startup/source verification/dossier save, mission creation/claim/finish, lease acquire/release, session refresh, state/transition writes, Flow validation/publication, and parent terminal decision. `flow.drafted` and `flow.rejected` payloads carry the redacted candidate plus exact blockers; `flow.published` carries the redacted published Flow plus its ordered evidence IDs so `FlowViewer` can stay run-scoped. Give every producer a stable identity: the production worker ID for orchestration, `research:<assignment>` for each research assignment, the claimed mission worker ID for discovery, and `authentication:<missionId>` for session recovery. Emit each event only after the durable write it reports has succeeded, and do not emit heartbeat events more than once per 30-second bucket.

- [ ] **Step 4: Emit child-step events after durable store writes**

Extend `CrawlRunServiceDependencies`:

```typescript
recordAgentEvent?: (event: AgentEventInput) => Promise<void>;
```

For an autonomous child, use `run.parent_run_id` as the event `runId`. Emit `step.started` after the running step row succeeds, `evidence.persisted` after the evidence row is attached, and `step.completed`, `step.skipped`, or `step.failed` after its terminal step row succeeds. Use `child:${run.id}:flow:${flow.id}:step:${step.id}:status:${status}:attempts:${attempts}` as the dedupe key.

- [ ] **Step 5: Run lifecycle and acceptance tests**

Run: `node --experimental-strip-types --test src/crawlRun.test.ts src/autonomousAcceptance.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit lifecycle events**

```bash
git add src/autonomousWorker.ts src/crawlRun.ts src/crawlRun.test.ts src/autonomousAcceptance.test.ts
git commit -m "feat: record autonomous agent activity"
```

### Task 4: Expose App-isolated crawler operations APIs

**Files:**
- Modify: `src/autonomousStore.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing API authorization and isolation tests**

```typescript
test("lists autonomous crawl apps and App-pinned history for admins", async (t) => {
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    listAutonomousOverview: async () => [overviewView],
    listAppAutonomousRuns: async (app) => app === "linear" ? [autonomousRun()] : [],
  }));
  t.after(() => close(server));
  assert.deepEqual(await (await fetch(`${base}/crawl/autonomous-runs`, { headers: adminCookie })).json(), [overviewView]);
  assert.equal((await fetch(`${base}/crawl/apps/linear/autonomous-runs`, { headers: adminCookie })).status, 200);
  assert.equal((await fetch(`${base}/crawl/apps/notion/autonomous-runs`, { headers: adminCookie })).status, 200);
});

test("paginates redacted run events and rejects cross-run cursors", async (t) => {
  const seen: unknown[] = [];
  const { base, server } = await serve(createApiApp({
    resolveSession: async () => admin,
    listAutonomousEvents: async (runId, options) => { seen.push({ runId, options }); return eventPage; },
  }));
  t.after(() => close(server));
  const response = await fetch(`${base}/crawl/autonomous-runs/41/events?after=8&limit=50`, { headers: adminCookie });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, [{ runId: "41", options: { after: "8", limit: 50 } }]);
  assert.doesNotMatch(await response.text(), /password|cookie-value|Bearer /i);
});
```

Add every new route to the existing “crawl administration routes are admin-only” test.

- [ ] **Step 2: Run the API tests and verify failure**

Run: `node --experimental-strip-types --test services/api/src/app.test.ts`

Expected: FAIL with 404 responses for overview, history, and events.

- [ ] **Step 3: Add API dependencies and routes**

Wire defaults:

```typescript
listAutonomousOverview: apiAutonomousStore.autonomousOverview,
listAppAutonomousRuns: apiAutonomousStore.listAutonomousRuns,
listAutonomousEvents: apiAutonomousStore.listEvents,
```

Add routes before `/:runId` detail matching:

```typescript
app.get("/crawl/autonomous-runs", requireAdmin, async (_req, res) => {
  res.json(await deps.listAutonomousOverview());
});

app.get("/crawl/apps/:app/autonomous-runs", requireAdmin, async (req, res) => {
  if (!isAppSlug(req.params.app)) return void res.status(400).json({ error: "invalid app slug" });
  res.json(await deps.listAppAutonomousRuns(req.params.app));
});

app.get("/crawl/autonomous-runs/:runId/events", requireAdmin, async (req, res) => {
  const runId = crawlId(req.params.runId);
  const after = req.query.after === undefined ? undefined : crawlId(String(req.query.after));
  const limit = req.query.limit === undefined ? 100 : boundedInteger(req.query.limit, 1, 200);
  if (!runId || (req.query.after !== undefined && !after) || !limit) return void res.status(400).json({ error: "invalid event cursor" });
  res.json(await deps.listAutonomousEvents(runId, { after, limit }));
});
```

Extend autonomous detail with active leases and typed event-derived agent summaries in the store. Format overview, history, and detail through a crawler operations view that whitelists homepage, provider, ceilings, concurrency, and `allow_all`; map required-secret names to `{ name, configured: deps.isCrawlSecretConfigured(name) }` using the existing dependency. Never return raw encrypted session state or an unfiltered run environment.

- [ ] **Step 4: Run API and store tests**

Run: `node --experimental-strip-types --test src/autonomousStore.test.ts services/api/src/app.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit operations APIs**

```bash
git add src/autonomousStore.ts services/api/src/app.ts services/api/src/app.test.ts
git commit -m "feat: expose crawler operations APIs"
```

### Task 5: Add typed Vitrine clients and crawler routes

**Files:**
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/researchApi.ts`
- Create: `src/vitrine/CrawlsApi.test.ts`
- Modify: `src/vitrine/router.ts`
- Create: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/components/Sidebar.tsx`
- Create: `src/vitrine/components/Sidebar.test.tsx`

- [ ] **Step 1: Write failing client, router, and sidebar tests**

```typescript
test("builds crawler overview, App history, detail, and event requests", async () => {
  await listCrawlerOverview();
  await listAppCrawlerRuns("linear");
  await getAutonomousRun("41");
  await listAutonomousEvents("41", "8");
  assert.deepEqual(seenUrls, [
    "/api/crawl/autonomous-runs",
    "/api/crawl/apps/linear/autonomous-runs",
    "/api/crawl/autonomous-runs/41",
    "/api/crawl/autonomous-runs/41/events?after=8&limit=100",
  ]);
});

test("round-trips crawler routes", () => {
  assert.deepEqual(parseRoute("/crawls"), { name: "crawls" });
  assert.deepEqual(parseRoute("/crawls/linear"), { name: "crawl-app", app: "linear" });
  assert.deepEqual(parseRoute("/crawls/linear/runs/41"), { name: "crawl-run", app: "linear", runId: "41" });
  assert.equal(routeToPath({ name: "crawl-run", app: "linear", runId: "41" }), "/crawls/linear/runs/41");
});

test("selects every crawler route with the Crawls sidebar item", () => {
  assert.equal(crawlerNavItem.match({ name: "crawls" }), true);
  assert.equal(crawlerNavItem.match({ name: "crawl-app", app: "linear" }), true);
  assert.equal(crawlerNavItem.match({ name: "crawl-run", app: "linear", runId: "41" }), true);
  assert.equal(crawlerNavItem.match({ name: "apps" }), false);
});
```

- [ ] **Step 2: Run the focused Vitrine tests and verify failure**

Run: `node --experimental-strip-types --test src/vitrine/CrawlsApi.test.ts src/vitrine/router.test.ts && tsx --test src/vitrine/components/Sidebar.test.tsx`

Expected: FAIL because typed clients and routes are absent.

- [ ] **Step 3: Add typed views and clients**

Define:

```typescript
export interface CrawlAgentEventView {
  id: string;
  runId: string;
  missionId?: string;
  childRunId?: string;
  flowId?: string;
  stepId?: string;
  workerId?: string;
  agentRole: "orchestrator" | "research" | "discovery" | "authentication";
  eventType: string;
  status: string;
  summary: string;
  payload: Record<string, unknown>;
  evidenceId?: string;
  createdAt: string;
}

export interface CrawlerOverviewView {
  app: string;
  homepageUrl: string;
  platform: "web" | "ios" | "android";
  latestRun: CrawlRunView;
  activeAgents: number;
  completedMissions: number;
  totalMissions: number;
  blockedMissions: number;
  states: number;
  transitions: number;
  publishedFlows: number;
  draftFlows: number;
  sessionVersion: number | null;
  sessionUpdatedAt: string | null;
  lastActivityAt: string;
  blocker: string | null;
}
```

Add clients matching the tested URLs and return `CrawlEventPageView` with `events` and `nextCursor`.

- [ ] **Step 4: Add routes and sidebar entry**

Extend `Route` with:

```typescript
| { name: "crawls" }
| { name: "crawl-app"; app: string }
| { name: "crawl-run"; app: string; runId: string }
```

Export `parseRoute` for direct tests. Parse the most specific run route first, then App, then overview. Export `crawlerNavItem` as `{ label: 'Crawls', route: { name: 'crawls' }, match: (route) => route.name === 'crawls' || route.name === 'crawl-app' || route.name === 'crawl-run' }` and place it between Apps and Users in `NAV_ITEMS`. `Sidebar` stays administrator-only because `App.tsx` already passes it only to the administrator `AppShell`.

- [ ] **Step 5: Run client, router, and sidebar tests**

Run: `node --experimental-strip-types --test src/vitrine/CrawlsApi.test.ts src/vitrine/router.test.ts && tsx --test src/vitrine/components/Sidebar.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit Vitrine data seams**

```bash
git add src/vitrine/types.ts src/vitrine/researchApi.ts src/vitrine/CrawlsApi.test.ts src/vitrine/router.ts src/vitrine/router.test.ts src/vitrine/components/Sidebar.tsx src/vitrine/components/Sidebar.test.tsx
git commit -m "feat: add crawler operations routes and clients"
```

### Task 6: Build stable detail and cursor polling

**Files:**
- Create: `src/vitrine/useCrawlerRun.ts`
- Create: `src/vitrine/useCrawlerRun.test.ts`

- [ ] **Step 1: Write failing merge and polling tests**

```typescript
test("merges ordered event pages without duplicating redelivered events", () => {
  const merged = mergeCrawlerEvents([event("8"), event("9")], [event("9"), event("10")]);
  assert.deepEqual(merged.map(({ id }) => id), ["8", "9", "10"]);
});

test("stops polling after a terminal detail and empty final page", async () => {
  const calls: string[] = [];
  const stop = startCrawlerRunPolling({
    runId: "41",
    intervalMs: 5,
    loadDetail: async () => terminalDetail,
    loadEvents: async (_runId, cursor) => { calls.push(cursor ?? "start"); return { events: [], nextCursor: cursor ?? null }; },
    onUpdate: () => {},
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  stop();
  assert.deepEqual(calls, ["start"]);
});

test("reports a polling failure and retries from the unchanged cursor", async () => {
  let attempts = 0;
  const errors: string[] = [];
  const stop = startCrawlerRunPolling({
    runId: "41", intervalMs: 1,
    loadDetail: async () => runningDetail,
    loadEvents: async () => { if (++attempts === 1) throw new Error("offline"); return { events: [], nextCursor: null }; },
    onUpdate: () => {}, onError: (error) => errors.push(error.message),
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  stop();
  assert.deepEqual(errors, ["offline"]);
  assert.ok(attempts >= 2);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --experimental-strip-types --test src/vitrine/useCrawlerRun.test.ts`

Expected: FAIL because the hook utilities do not exist.

- [ ] **Step 3: Implement pure polling utilities and the hook**

```typescript
export function mergeCrawlerEvents(current: CrawlAgentEventView[], incoming: CrawlAgentEventView[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((left, right) =>
    BigInt(left.id) < BigInt(right.id) ? -1 : BigInt(left.id) > BigInt(right.id) ? 1 : 0);
}

export function startCrawlerRunPolling(options: PollingOptions): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cursor: string | undefined;
  const schedule = () => { if (!stopped) timer = globalThis.setTimeout(() => void poll(), options.intervalMs); };
  const poll = async () => {
    try {
      const [detail, page] = await Promise.all([options.loadDetail(options.runId), options.loadEvents(options.runId, cursor)]);
      if (stopped) return;
      cursor = page.nextCursor ?? cursor;
      options.onUpdate(detail, page.events);
      const terminal = ["succeeded", "failed", "cancelled"].includes(detail.run.status);
      if (!(terminal && page.events.length === 0)) schedule();
    } catch (error) {
      if (!stopped) { options.onError?.(error as Error); schedule(); }
    }
  };
  void poll();
  return () => { stopped = true; if (timer !== undefined) globalThis.clearTimeout(timer); };
}
```

Wrap it in `useCrawlerRun(runId)` with loading, recoverable error, selected event, agent filter, and accumulated event state. Keep the last successful detail and events visible when `onError` fires.

- [ ] **Step 4: Run the polling tests**

Run: `node --experimental-strip-types --test src/vitrine/useCrawlerRun.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit polling**

```bash
git add src/vitrine/useCrawlerRun.ts src/vitrine/useCrawlerRun.test.ts
git commit -m "feat: poll durable crawler activity"
```

### Task 7: Build the Crawls overview and run creation

**Files:**
- Create: `src/vitrine/components/CrawlsPage.tsx`
- Create: `src/vitrine/components/crawler/NewCrawlDialog.tsx`
- Create: `src/vitrine/CrawlerOperations.test.tsx`

- [ ] **Step 1: Write failing overview and creation tests**

```tsx
test("groups the fleet by App and opens one App control room", async () => {
  const html = renderToStaticMarkup(<CrawlsPage initialOverview={[linearOverview, notionOverview]} />);
  assert.match(html, /Crawls/);
  assert.match(html, /Linear/);
  assert.match(html, /2 active agents/);
  assert.match(html, /Notion/);
  assert.match(html, /Needs attention/);
});

test("requires mutation acknowledgement and navigates to the created immutable run", async () => {
  assert.throws(
    () => buildNewCrawlRequest(formState({ allowAll: true, allowAllAcknowledged: false })),
    /acknowledge/i,
  );
  const valid = buildNewCrawlRequest(formState({ allowAll: true, allowAllAcknowledged: true }));
  assert.equal(valid.agentConcurrency, 3);
});
```

- [ ] **Step 2: Run the component test and verify failure**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: FAIL because `CrawlsPage` and `NewCrawlDialog` do not exist.

- [ ] **Step 3: Implement the overview**

Use `PageHeader`, `Button`, `EmptyState`, `Spinner`, and existing surface/text tokens. `CrawlsPage` loads `listCrawlerOverview`, filters by text/status/platform, renders one semantic article per App, and navigates with `{ name: "crawl-app", app }`. Its primary action opens `NewCrawlDialog`. For partial failure, keep successfully loaded rows visible if a refresh fails and place the retry alert beside the affected overview. Flag any server response with more than one active run for the same App as invalid instead of combining its counters.

Use visible labels rather than a percentage-only dashboard:

```tsx
<article aria-label={`${item.app} crawler status`} className="crawler-app-row">
  <div><strong>{item.app}</strong><span>{item.platform}</span></div>
  <div>{item.activeAgents} active agents</div>
  <div>{item.completedMissions}/{item.totalMissions} missions</div>
  <div>{item.states} states · {item.transitions} transitions</div>
  <div>{item.publishedFlows} published · {item.draftFlows} drafts</div>
  <Button variant="secondary" label="Open control room" clickAction={() => navigate({ name: "crawl-app", app: item.app })} />
</article>
```

- [ ] **Step 4: Implement validated run creation**

Export `buildNewCrawlRequest` as the pure validation seam. Validate the App slug, homepage URL, platform, provider, agent concurrency 1–8, named secret references, runtime/action/model/storage ceilings, optional shared-session choice, `allow_all`, and its acknowledgement. Reuse the existing `createAutonomousRun` client. Show the safety summary before submission: mutation missions are skipped without `allow_all`, while mutations and authentication stay serialized with it. On success, navigate to `{ name: "crawl-run", app, runId: created.id }`; keep validation and transport errors in an alert within the dialog.

- [ ] **Step 5: Run the overview tests**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: PASS for overview and creation cases.

- [ ] **Step 6: Commit overview and creation**

```bash
git add src/vitrine/components/CrawlsPage.tsx src/vitrine/components/crawler/NewCrawlDialog.tsx src/vitrine/CrawlerOperations.test.tsx
git commit -m "feat: add crawler fleet overview"
```

### Task 8: Build the App crawler control room

**Files:**
- Create: `src/vitrine/components/CrawlAppPage.tsx`
- Create: `src/vitrine/components/crawler/CrawlSessionEditor.tsx`
- Modify: `src/vitrine/CrawlerOperations.test.tsx`
- Modify: `src/vitrine/components/CrawlWorkspacePanel.tsx`

- [ ] **Step 1: Write failing App history and session tests**

```tsx
test("keeps crawler history isolated to the selected App", () => {
  const html = renderToStaticMarkup(<CrawlAppPage app="linear" initialRuns={[linearRun]} initialSession={sessionView} />);
  assert.match(html, /Linear crawler/);
  assert.match(html, /Session version 3/);
  assert.match(html, /Run 41/);
  assert.doesNotMatch(html, /notion/i);
});

test("historical terminal runs expose inspection but no pause or cancel controls", () => {
  const html = renderToStaticMarkup(<CrawlAppPage app="linear" initialRuns={[terminalRun]} initialSession={sessionView} />);
  assert.match(html, /Open run/);
  assert.doesNotMatch(html, />Pause</);
  assert.doesNotMatch(html, />Cancel</);
});
```

- [ ] **Step 2: Run the App page tests and verify failure**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: FAIL because `CrawlAppPage` is missing.

- [ ] **Step 3: Implement App header, session, and run history**

`CrawlAppPage` loads `listAppCrawlerRuns(app)` and `getCrawlSession(app)`, renders shared-session metadata and named-secret configured/missing status without stored values, and navigates each run to its immutable route. Each history row shows status, start time, duration, agent count, mission and Flow outcomes, and interruption reason. Extract the existing session JSON parsing/upload control from `CrawlWorkspacePanel` into `CrawlSessionEditor` and reuse it here; after saving, render only the returned state version and update time.

Render deterministic research/plan controls inside a collapsed **Advanced crawler tools** region by keeping `CrawlWorkspacePanel` focused on its existing planned-run responsibilities and removing its autonomous-discovery section after equivalent controls exist in the new pages.

- [ ] **Step 4: Run App control-room tests**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx src/vitrine/CrawlWorkspacePanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit App control room**

```bash
git add src/vitrine/components/CrawlAppPage.tsx src/vitrine/components/crawler/CrawlSessionEditor.tsx src/vitrine/components/CrawlWorkspacePanel.tsx src/vitrine/CrawlerOperations.test.tsx
git commit -m "feat: add App crawler control room"
```

### Task 9: Build agent, mission, timeline, and inspector components

**Files:**
- Create: `src/vitrine/components/crawler/CrawlerAgentRail.tsx`
- Create: `src/vitrine/components/crawler/CrawlerMissionTree.tsx`
- Create: `src/vitrine/components/crawler/CrawlerEventTimeline.tsx`
- Create: `src/vitrine/components/crawler/CrawlerEventInspector.tsx`
- Modify: `src/vitrine/CrawlerOperations.test.tsx`

- [ ] **Step 1: Write failing observability component tests**

```tsx
test("renders every agent and exposes lease ownership", () => {
  const html = renderToStaticMarkup(<CrawlerAgentRail agents={agents} selectedWorkerId={null} onSelect={() => {}} />);
  assert.match(html, /Research 1/);
  assert.match(html, /Discovery 1/);
  assert.match(html, /Authentication/);
  assert.match(html, /Mutation lease/);
});

test("filters the ordered activity timeline by agent without losing event identity", () => {
  const filtered = filterCrawlerEvents(events, { workerId: "worker:agent-2" });
  assert.deepEqual(filtered.map(({ id }) => id), ["12", "14"]);
  assert.deepEqual(filterCrawlerEvents(events, {}).map(({ id }) => id), events.map(({ id }) => id));
});

test("pauses follow mode after manual scrolling and restores it near the bottom", () => {
  assert.equal(shouldFollowLatest({ scrollHeight: 1_000, scrollTop: 700, clientHeight: 200 }), false);
  assert.equal(shouldFollowLatest({ scrollHeight: 1_000, scrollTop: 760, clientHeight: 200 }), true);
});

test("inspector shows evidence and expected versus actual state without secret fields", () => {
  const html = renderToStaticMarkup(<CrawlerEventInspector event={completedStepEvent} />);
  assert.match(html, /Expected state/);
  assert.match(html, /Actual state/);
  assert.match(html, /Evidence 88/);
  assert.doesNotMatch(html, /password|cookie-value/i);
});
```

- [ ] **Step 2: Run component tests and verify failure**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: FAIL because observability components and filter utility do not exist.

- [ ] **Step 3: Implement the agent rail and mission tree**

Derive stable display labels from role plus ordinal, not provider-generated names. Mark heartbeats stale after 45 seconds. Show status in text, latest mission/action, evidence count, budget use, and lease ownership. Group the mission tree by `productArea`, then mission, child run, action, and destination state; all nodes are buttons with `aria-pressed` selection.

- [ ] **Step 4: Implement timeline filtering and follow behavior**

Export:

```typescript
export function filterCrawlerEvents(events: CrawlAgentEventView[], filters: EventFilters) {
  return events.filter((event) =>
    (!filters.workerId || event.workerId === filters.workerId)
    && (!filters.missionId || event.missionId === filters.missionId)
    && (!filters.eventType || event.eventType === filters.eventType)
    && (!filters.status || event.status === filters.status)
    && (!filters.evidenceOnly || Boolean(event.evidenceId))
  );
}

export function shouldFollowLatest({ scrollHeight, scrollTop, clientHeight }: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">) {
  return scrollHeight - scrollTop - clientHeight <= 48;
}
```

Render events as an ordered list with an **Evidence only** filter. A scroll handler disables auto-follow when the user is more than 48 pixels from the bottom. **Jump to latest** restores it. New events use an `aria-live="polite"` summary without moving focus.

- [ ] **Step 5: Implement the inspector**

Render only the typed redacted payload fields: action, locator, source/destination URL, expected, actual, confidence, evidence, blocker, and citations. Unknown payload keys are not rendered as a generic JSON dump.

- [ ] **Step 6: Run observability component tests**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit observability components**

```bash
git add src/vitrine/components/crawler/CrawlerAgentRail.tsx src/vitrine/components/crawler/CrawlerMissionTree.tsx src/vitrine/components/crawler/CrawlerEventTimeline.tsx src/vitrine/components/crawler/CrawlerEventInspector.tsx src/vitrine/CrawlerOperations.test.tsx
git commit -m "feat: visualize every crawler agent action"
```

### Task 10: Build run summary, results, and composed run page

**Files:**
- Create: `src/vitrine/components/crawler/CrawlerRunSummary.tsx`
- Create: `src/vitrine/components/crawler/CrawlerResults.tsx`
- Create: `src/vitrine/components/CrawlRunPage.tsx`
- Modify: `src/vitrine/CrawlerOperations.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing run-page and result tests**

```tsx
test("composes the selected immutable run without mixing another App", () => {
  const html = renderToStaticMarkup(<CrawlRunPage app="linear" runId="41" initialState={runState} />);
  assert.match(html, /Run 41/);
  assert.match(html, /Agents/);
  assert.match(html, /Work/);
  assert.match(html, /Activity/);
  assert.match(html, /Results/);
  assert.doesNotMatch(html, /notion/i);
});

test("keeps incomplete candidates in Drafts with exact blockers", () => {
  const html = renderToStaticMarkup(<CrawlerResults detail={detailWithDraft} events={draftAndPublishedEvents} />);
  assert.match(html, /Drafts/);
  assert.match(html, /evidence_object_missing/);
  assert.doesNotMatch(html, /Published 1/);
});

test("keeps responsive regions and an accessible mobile tab state", () => {
  const css = readFileSync("src/vitrine/styles.css", "utf8");
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  const html = renderToStaticMarkup(<CrawlRunPage app="linear" runId="41" initialState={runState} initialMobileTab="activity" />);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"[^>]*>Activity/);
});
```

- [ ] **Step 2: Run run-page tests and verify failure**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: FAIL because run summary, results, and page composition are absent.

- [ ] **Step 3: Implement run summary and controls**

Keep mission completion, coverage, and budget use separate. Wire pause for queued/running, resume for interrupted, cancel for nonterminal, and repeat `allow_all` acknowledgement on resume. After each command, refresh detail without changing the route.

- [ ] **Step 4: Implement result tabs**

Render Flows, Drafts, Coverage, Research, and Diagnostics from the selected detail plus its run-scoped events. Use existing `FlowViewer` with the Flow and ordered evidence IDs persisted in `flow.published`. Build Drafts only from `flow.drafted`/`flow.rejected` events and show exact validation blockers. Research citations are normal external links with `rel="noreferrer"`.

- [ ] **Step 5: Compose the run control room**

Use `useCrawlerRun(runId)` and verify `detail.run.app === app`; show a route mismatch error otherwise. Desktop layout uses CSS grid areas `agents`, `work`, `activity`, and `inspector`. Tablet moves inspector into a drawer-compatible region. Mobile renders Agents, Work, Activity, and Results tabs.

Add CSS classes with existing variables:

```css
.crawler-control-room { display: grid; grid-template-columns: 240px minmax(260px, .8fr) minmax(360px, 1.4fr) minmax(280px, 1fr); gap: 12px; }
@media (max-width: 1100px) { .crawler-control-room { grid-template-columns: 220px 1fr 1fr; } .crawler-inspector { grid-column: 1 / -1; } }
@media (max-width: 720px) { .crawler-control-room { display: block; } .crawler-desktop-region[hidden] { display: none; } }
@media (prefers-reduced-motion: reduce) { .crawler-live-indicator { animation: none; } }
```

- [ ] **Step 6: Run run-page tests**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit run control room**

```bash
git add src/vitrine/components/crawler/CrawlerRunSummary.tsx src/vitrine/components/crawler/CrawlerResults.tsx src/vitrine/components/CrawlRunPage.tsx src/vitrine/CrawlerOperations.test.tsx src/vitrine/styles.css
git commit -m "feat: add autonomous run control room"
```

### Task 11: Mount the real administrator UI

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/components/Sidebar.test.tsx`
- Modify: `src/vitrine/CrawlerOperations.test.tsx`

- [ ] **Step 1: Write failing route-mount tests**

```tsx
test("mounts Crawls routes for administrators", () => {
  const source = readFileSync("src/vitrine/App.tsx", "utf8");
  assert.match(source, /isAdmin && route\.name === ['"]crawls['"].*<CrawlsPage/s);
  assert.match(source, /isAdmin && route\.name === ['"]crawl-app['"].*<CrawlAppPage/s);
  assert.match(source, /isAdmin && route\.name === ['"]crawl-run['"].*<CrawlRunPage/s);
});
```

- [ ] **Step 2: Run route-mount tests and verify failure**

Run: `tsx --test src/vitrine/CrawlerOperations.test.tsx src/vitrine/components/Sidebar.test.tsx`

Expected: FAIL because `App.tsx` does not render the crawler routes.

- [ ] **Step 3: Mount crawler pages before catalog loading gates**

Import the three pages. After the existing administrator Users route and before the Apps loading/empty branches, render:

```tsx
if (isAdmin && route.name === "crawls") return frame(<CrawlsPage />);
if (isAdmin && route.name === "crawl-app") return frame(<CrawlAppPage app={route.app} />);
if (isAdmin && route.name === "crawl-run") return frame(<CrawlRunPage app={route.app} runId={route.runId} />);
```

Normal-user access to these parsed routes returns the authenticated Apps view without issuing crawler API requests. Keep the sidebar administrator-only through the existing `AppShell` boundary.

- [ ] **Step 4: Run Vitrine route and component tests**

Run: `node --experimental-strip-types --test src/vitrine/router.test.ts src/vitrine/CrawlsApi.test.ts && tsx --test src/vitrine/CrawlerOperations.test.tsx src/vitrine/components/Sidebar.test.tsx src/vitrine/CrawlWorkspacePanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit real UI mounting**

```bash
git add src/vitrine/App.tsx src/vitrine/components/Sidebar.test.tsx src/vitrine/CrawlerOperations.test.tsx
git commit -m "feat: mount crawler operations workspace"
```

### Task 12: Document, verify, and prove the complete workflow

**Files:**
- Modify: `docs/operations/autonomous-crawler.md`
- Modify: `README.md`
- Modify: `src/autonomousAcceptance.test.ts`

- [ ] **Step 1: Extend deterministic acceptance with UI read models**

At the end of the fixture run, load overview, detail, and all event pages through the same store methods used by the API:

```typescript
function maximumConcurrentLeaseOwners(events: CrawlAgentEventRecord[]) {
  const owners = new Map<string, Set<string>>();
  let maximum = 0;
  for (const event of events) {
    if (event.eventType !== "lease.acquired" && event.eventType !== "lease.released") continue;
    const kind = String((event.payload as Record<string, unknown>).leaseKind);
    const active = owners.get(kind) ?? new Set<string>();
    if (event.eventType === "lease.acquired" && event.workerId) active.add(event.workerId);
    if (event.eventType === "lease.released" && event.workerId) active.delete(event.workerId);
    owners.set(kind, active);
    maximum = Math.max(maximum, active.size);
  }
  return maximum;
}

const overview = await store.autonomousOverview();
const detail = await store.autonomousRunDetail(parentRunId);
const page = await store.listEvents(parentRunId, { limit: 200 });
assert.equal(overview.length, 1);
assert.equal(overview[0].app, "fixture");
assert.equal(detail?.run.id, parentRunId);
assert.deepEqual(
  new Set(page.events.map(({ agentRole }) => agentRole)),
  new Set(["orchestrator", "research", "discovery", "authentication"]),
);
assert.deepEqual(page.events.map(({ id }) => id), [...page.events.map(({ id }) => id)].sort((left, right) => BigInt(left) < BigInt(right) ? -1 : 1));
assert.equal(maximumConcurrentLeaseOwners(page.events), 1);
assert.ok(page.events.some(({ eventType, evidenceId }) => eventType === "step.completed" && evidenceId));
assert.ok(page.events.some(({ eventType }) => eventType === "flow.published"));
assert.ok(page.events.some(({ eventType, payload }) => eventType === "flow.drafted" && JSON.stringify(payload).includes("evidence_object_missing")));
assert.doesNotMatch(JSON.stringify(page), /fixture-password|fixture_session=valid/);
```

- [ ] **Step 2: Run acceptance and verify it passes**

Run: `node --experimental-strip-types --test --test-concurrency=1 src/autonomousAcceptance.test.ts`

Expected: PASS.

- [ ] **Step 3: Document the administrator workflow**

Add these exact operations sections:

- Open **Crawls** from the administrator sidebar.
- Create a crawl and understand `allow_all`.
- Update the App's shared storage state.
- Select an App and immutable run.
- Filter by agent, mission, event type, status, or evidence.
- Inspect expected/actual state and evidence.
- Diagnose stale agents, expired leases, authentication interruption, draft blockers, and publication blockers.
- Pause, resume with acknowledgement, or cancel without creating a replacement parent.

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
git diff --check
```

Expected: every command exits 0; the Node suite reports no failures, the Vitrine suite reports no failures, Vite emits `dist/`, Compose validates, and Git reports no whitespace errors.

- [ ] **Step 5: Commit documentation and acceptance**

```bash
git add docs/operations/autonomous-crawler.md README.md src/autonomousAcceptance.test.ts
git commit -m "test: prove crawler operations observability"
```

## Final review checklist

- [ ] `/crawls` shows one independent overview row per App.
- [ ] `/crawls/:app` contains only the selected App's session and history.
- [ ] `/crawls/:app/runs/:runId` remains pinned to one immutable run.
- [ ] Every research, discovery, authentication, and orchestration agent appears.
- [ ] Every durable browser step can be traced through event, evidence, state, transition, and Flow outcome.
- [ ] Mutation and authentication lease ownership never appears concurrent for the same purpose.
- [ ] Persisted and returned events contain no credentials, cookies, tokens, or storage state.
- [ ] Normal users cannot access crawler routes or APIs.
- [ ] Drafts show exact blockers and never appear as published Flows.
- [ ] Polling resumes from the last cursor and stops after terminal final drain.
- [ ] Existing deterministic crawler tools remain available under the App's advanced section.
