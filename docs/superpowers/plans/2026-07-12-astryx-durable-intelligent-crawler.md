# Astryx Durable Intelligent Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one durable, curator-operated intelligent-crawl workflow and prove the reviewed Atlassian plan succeeds idempotently against the live public site.

**Architecture:** Extend the existing plan parser and Playwright runner, add normalized PostgreSQL plan/run/step/evidence/repair records, use the existing RabbitMQ `jobs` queue as transport, and add an admin-only Vitrine workspace. The CLI and worker share the same deterministic execution service; LLM research and repair remain outside the execution loop.

**Tech Stack:** TypeScript 5.7, Node test runner, Playwright, Express 5, PostgreSQL 17, RabbitMQ/amqplib, React 19, Vite 8, Docker Compose.

**Design reference:** `docs/superpowers/specs/2026-07-12-astryx-durable-intelligent-crawler-design.md`

**Dirty-worktree rule:** The existing modified and untracked files are the user's baseline. Do not reset, discard, or stage whole pre-existing files merely to create intermediate commits. Use narrow patches, verify diffs, and leave staging decisions to the final handoff unless a newly created file can be committed independently.

---

## File map

- Modify `src/crawlPlan.ts`: strict revisioned plan and observable outcome contract.
- Modify `src/crawlPlan.test.ts`: parser, safety, optionality, CSS-reason, secret, and expectation coverage.
- Modify `src/appResearch.ts` and `src/appResearch.test.ts`: draft/repair prompts emit the revised contract and never approve it.
- Modify `src/smartCrawler.ts` and `src/smartCrawler.test.ts`: deterministic execution, popup/page switching, postcondition validation, bounded transient retries, structured results, cleanup, and capture callbacks.
- Create `src/crawlRun.ts` and `src/crawlRun.test.ts`: run domain types and orchestration service independent of Express/RabbitMQ.
- Create `src/crawlStore.ts` and `src/crawlStore.test.ts`: PostgreSQL adapters for plans, runs, steps, evidence, repairs, heartbeat, cancellation, and recovery.
- Modify `src/db.ts` and `src/db.test.ts`: additive schema, atomic image identity, and draft-version linkage.
- Modify `src/queue.ts`: `research-app` and `smart-crawl-app` job messages plus retry classification.
- Modify `services/import-worker/src/pipeline.ts` and its test: research/smart-crawl dispatch, semantic failure acknowledgement, and same-run resume.
- Modify `services/import-worker/src/index.ts`: stale-run recovery before consumption.
- Modify `services/api/src/app.ts` and its test: admin-only plan, run, repair, cancellation, retry, and failure-media routes.
- Modify `src/vitrine/researchApi.ts`, `src/vitrine/types.ts`: typed curator crawl API.
- Create `src/vitrine/components/CrawlWorkspacePanel.tsx` and `src/vitrine/CrawlWorkspacePanel.test.tsx`: complete admin workflow.
- Modify `src/vitrine/Home.tsx` or `src/vitrine/components/ScreenDetail.tsx`: mount the crawler workspace only for admins using the existing navigation seam.
- Modify `data/crawl-plans/atlassian.json`: revisioned observable plan and secret-only signup.
- Modify `docker-compose.yml`: headless worker profile/runtime environment.
- Modify `package.json` only if a focused verification script materially shortens repeated acceptance checks; add no dependency.

---

### Task 1: Strengthen the crawl-plan contract

**Files:**

- Modify: `src/crawlPlan.ts`
- Modify: `src/crawlPlan.test.ts`
- Modify: `src/appResearch.ts`
- Modify: `src/appResearch.test.ts`

- [ ] **Step 1: Replace the valid-plan fixture with the revisioned observable contract**

Use this shape in `src/crawlPlan.test.ts`:

```ts
const validPlan = {
  app: "atlassian",
  revision: 1,
  startUrl: "https://www.atlassian.com",
  domain: "Team collaboration and developer tools.",
  sources: ["https://www.atlassian.com/software/jira"],
  reviewed: false,
  flows: [{
    id: "browse-products",
    title: "Browse products",
    description: "Open Jira from the catalog.",
    safe: true,
    requiredSecrets: [],
    steps: [{
      id: "open-software",
      action: "goto",
      url: "/software",
      safety: "read",
      expected: { state: "Software catalog", url: "https://www.atlassian.com/software", visible: { text: "Explore Atlassian products" } },
    }],
  }],
};
```

- [ ] **Step 2: Add failing parser tests for every new invariant**

Tests must reject duplicate step IDs, missing expected state, expectations without URL/visible/hidden assertions, invalid URL globs, `optional: true` without `optionalReason`, CSS without `locatorReason`, literal email/credential values, invalid secret names, `side-effect` steps inside a safe flow, and a flow that declares a `$VAR` without listing it in `requiredSecrets`.

Run:

```bash
node --experimental-strip-types --test src/crawlPlan.test.ts
```

Expected: failures because the current parser ignores the new fields.

- [ ] **Step 3: Implement the minimal public contract**

Add these types to `src/crawlPlan.ts` and validate every field strictly:

```ts
export interface CrawlLocator {
  role?: string;
  name?: string;
  text?: string;
  css?: string;
}

export interface ExpectedState {
  state: string;
  url?: string;
  urlPattern?: string; // `*` wildcard only; escape all other regex syntax
  page?: "same" | "new";
  visible?: CrawlLocator;
  hidden?: CrawlLocator;
}

export interface CrawlStep extends CrawlLocator {
  id: string;
  action: CrawlAction;
  url?: string;
  key?: string;
  value?: string;
  optional?: boolean;
  optionalReason?: string;
  locatorReason?: string;
  safety: "read" | "side-effect";
  expected: ExpectedState;
}

export interface CrawlFlow {
  id: string;
  title: string;
  description: string;
  safe: boolean;
  requiredSecrets: string[];
  steps: CrawlStep[];
}

export interface CrawlPlan {
  app: string;
  revision: number;
  startUrl: string;
  domain: string;
  sources: string[];
  reviewed: boolean;
  flows: CrawlFlow[];
}
```

Export `urlMatchesExpectation(actual, expected)` and implement wildcard matching by escaping the expected string then converting `*` to `.*`. Do not evaluate plan-provided raw regular expressions.

- [ ] **Step 4: Make secret validation fail closed**

Only `$[A-Z][A-Z0-9_]*` values resolve from the environment. Reject other values that look like email addresses, bearer tokens, passwords, or private keys. A flow's `requiredSecrets` must exactly cover all referenced variables, and a missing runtime variable must name only the variable, never a value.

- [ ] **Step 5: Update research and repair prompts**

The generated plan prompt must include the exact revised JSON contract, semantic locator priority, observable expectation rules, safety fields, and `reviewed: false`. `sanitizeDraft()` must force `revision: 1`, `reviewed: false`, every flow `safe: false`, and every step safety to `side-effect` unless a human later reviews it.

Repair output remains one replacement step. Applying it increments the file revision and resets `reviewed: false`.

- [ ] **Step 6: Run focused tests**

```bash
node --experimental-strip-types --test src/crawlPlan.test.ts src/appResearch.test.ts
```

Expected: all plan and research tests pass.

- [ ] **Step 7: Check the narrow diff**

```bash
git diff --check -- src/crawlPlan.ts src/crawlPlan.test.ts src/appResearch.ts src/appResearch.test.ts
```

Expected: no output.

---

### Task 2: Validate observable outcomes and page disposition

**Files:**

- Modify: `src/smartCrawler.ts`
- Modify: `src/smartCrawler.test.ts`

- [ ] **Step 1: Expand the local fixture**

Add a client-side navigation button, a popup link, a delayed panel, and a link that deliberately stays on the wrong page:

```html
<button id="spa" onclick="history.pushState({}, '', '/spa'); document.querySelector('h1').textContent='SPA state'">SPA</button>
<a id="popup" href="/popup" target="_blank">Open popup</a>
<button id="late" onclick="setTimeout(() => document.querySelector('#late-state').hidden=false, 80)">Late state</button>
<p id="late-state" hidden>Loaded later</p>
<button id="no-op">No-op</button>
```

- [ ] **Step 2: Write failing execution tests**

Cover:

- same-page client navigation plus URL and visible assertion;
- expected popup returns the popup as the active page;
- missing expected popup is a semantic failure;
- delayed visible state succeeds through Playwright auto-waiting;
- wrong URL and missing text report expected and actual values;
- optional overlay absence returns `skipped` with the declared reason;
- locators are resolved fresh after a DOM replacement.

Run:

```bash
node --experimental-strip-types --test --test-name-pattern="observable|popup|optional|stale" src/smartCrawler.test.ts
```

Expected: failures against the current `interpretStep(): Promise<void>` behavior.

- [ ] **Step 3: Introduce explicit step results**

Use these result types:

```ts
export interface StepActual {
  sourceUrl: string;
  finalUrl: string;
  page: "same" | "new";
  visible?: boolean;
  hidden?: boolean;
}

export type StepResult =
  | { status: "completed"; page: Page; actual: StepActual }
  | { status: "skipped"; page: Page; actual: StepActual; reason: string };

export class SemanticStepError extends Error {
  constructor(
    message: string,
    readonly expected: ExpectedState,
    readonly actual: StepActual,
  ) { super(message); }
}
```

Change execution to return the active `Page`. When `expected.page === "new"`, arm `context.waitForEvent("page")` before the action, wait for the new page's DOM content, and validate on it. Otherwise validate on the current page and close unexpected popup pages.

- [ ] **Step 4: Validate URL and visible/hidden outcomes**

Implement `assertExpectedState(page, expected, sourceUrl, disposition)`. Use `page.waitForURL()` for exact/glob URLs and a fresh semantic locator for visible/hidden assertions. Capture `page.url()` after redirects settle. Do not treat the action's successful return as proof.

- [ ] **Step 5: Run the complete crawler unit test**

```bash
node --experimental-strip-types --test src/smartCrawler.test.ts
```

Expected: all local Playwright fixture tests pass.

---

### Task 3: Make flow execution structured, cancellable, and cleanup-safe

**Files:**

- Modify: `src/smartCrawler.ts`
- Modify: `src/smartCrawler.test.ts`

- [ ] **Step 1: Write failing flow-result tests**

Require `runFlow()` to return this shape instead of `StepFailure | null`:

```ts
export interface FlowRunResult {
  flowId: string;
  status: "completed" | "failed" | "cancelled";
  completed: number;
  skipped: number;
  failed: number;
  steps: Array<{
    stepId: string;
    status: "completed" | "skipped" | "failed";
    actual?: StepActual;
    error?: StructuredFailure;
  }>;
}
```

Tests must prove a semantic failure is not retried, a transient navigation failure is attempted at most twice, cancellation stops before the next step, a failed flow does not become completed evidence, and context cleanup runs after thrown errors.

- [ ] **Step 2: Add narrow transient classification**

`isTransientBrowserError()` may match Playwright/network errors containing `ERR_NAME_NOT_RESOLVED`, `ERR_CONNECTION_RESET`, `ERR_CONNECTION_CLOSED`, `ERR_TIMED_OUT`, `Target page, context or browser has been closed`, or interrupted navigation. `SemanticStepError`, locator timeouts, wrong URLs, and missing expected text are never transient.

- [ ] **Step 3: Persist failure screenshots through an injected callback**

Replace direct report-directory writes inside `runFlow()` with:

```ts
export interface RunnerHooks {
  cancelled(): Promise<boolean> | boolean;
  stepStarted(flow: CrawlFlow, step: CrawlStep, index: number): Promise<void>;
  stepFinished(flow: CrawlFlow, step: CrawlStep, index: number, result: StepResult): Promise<void>;
  capture(page: Page, flow: CrawlFlow, step: CrawlStep | undefined, state: string): Promise<void>;
  failure(page: Page, failure: StructuredFailure): Promise<string | undefined>;
}
```

Keep a filesystem/console hook for CLI compatibility. Durable hooks arrive in Task 6.

- [ ] **Step 4: Put context closing and final status in `finally`**

`smartCrawl()` returns a `CrawlExecutionResult` with flow results and counts. It writes compatibility `report.json` only after the structured result exists. A run with any failed required flow returns `failed`, never `done`.

- [ ] **Step 5: Run focused tests and diff check**

```bash
node --experimental-strip-types --test src/smartCrawler.test.ts
git diff --check -- src/smartCrawler.ts src/smartCrawler.test.ts
```

Expected: all tests pass and diff check is silent.

---

### Task 4: Add durable plan, run, step, evidence, and repair persistence

**Files:**

- Modify: `src/db.ts`
- Modify: `src/db.test.ts`
- Create: `src/crawlStore.ts`
- Create: `src/crawlStore.test.ts`

- [ ] **Step 1: Write the database lifecycle test first**

Against `astryx_test`, verify:

1. save draft plan revision 1;
2. approve it as an admin;
3. create a crawl run linked to one draft version;
4. claim and heartbeat the run;
5. upsert completed and failed steps;
6. request and observe cancellation;
7. create an interrupted retry linked to the original;
8. propose, reject, then propose and apply a repair;
9. applying repair creates revision 2 with `reviewed: false` and leaves revision 1 immutable.

Run:

```bash
node --experimental-strip-types --test src/crawlStore.test.ts
```

Expected: module/table failures.

- [ ] **Step 2: Add schema tables and constraints**

Add the five tables from the design to `ensureSchema()`. Use `BIGSERIAL` run IDs, JSONB expected/actual/plan fields, foreign keys to `apps`, `app_versions`, `users`, `jobs`, and `images`, and database `CHECK` constraints for statuses.

The logical evidence uniqueness key is:

```sql
UNIQUE (version_id, plan_id, flow_id, step_id, final_url, viewport_width, viewport_height)
```

The run-step key is:

```sql
PRIMARY KEY (run_id, flow_id, step_id)
```

- [ ] **Step 3: Make image insertion atomic per app platform**

Create a unique index on `(platform_id, image_url)` after consolidating any duplicate rows while preserving all `version_images` membership. Change `insertImage()` to use `ON CONFLICT (platform_id, image_url) DO UPDATE ... RETURNING id`. Keep existing callers compatible.

- [ ] **Step 4: Implement `crawlStore.ts`**

Export typed functions for plan CRUD/approval, run creation/claim/update/list, step upsert, evidence find/create, cancellation, repair review, heartbeat, stale-run interruption, and retry creation. Accept an injectable query function in a factory for unit isolation while exporting a PostgreSQL-backed default.

- [ ] **Step 5: Prove published versions are untouched**

Extend `src/db.test.ts` so a failed/cancelled crawl attached to a draft cannot change `publishedImages()`, `getVersionDesignSystem()`, or the latest published status.

- [ ] **Step 6: Run persistence tests**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/db.test.ts src/crawlStore.test.ts
```

Expected: all persistence tests pass against PostgreSQL.

---

### Task 5: Make capture storage rerun-idempotent

**Files:**

- Create: `src/crawlRun.ts`
- Create: `src/crawlRun.test.ts`
- Modify: `src/smartCrawler.ts`
- Modify: `src/smartCrawler.test.ts`
- Modify: `src/imageSource.ts`
- Modify: `src/imageSource.test.ts`

- [ ] **Step 1: Write a two-run idempotency test**

The same draft, plan revision, flow, step, URL, and viewport is executed twice with different in-memory PNG bytes. Assert:

- both run-step rows retain their observed screenshot hashes;
- only one canonical `crawl_evidence` row exists;
- only one image row and screenshot file exist;
- both runs link the same canonical evidence;
- a new draft version may create a new logical evidence row but reuses the file when bytes match.

- [ ] **Step 2: Implement an atomic capture store**

`captureValidatedState()` must:

1. take the real Playwright screenshot into memory;
2. compute a full SHA-256 observation hash and the existing 16-character media ref;
3. ask the store for canonical logical evidence;
4. if present, return it without writing a file;
5. otherwise write to a temporary path and rename atomically only if the target does not exist;
6. atomically insert/reuse the image row and `crawl_evidence` row;
7. attach the image to the draft version.

- [ ] **Step 3: Assemble flows from canonical evidence**

Replace timing-ledger assembly with plan-order assembly. Include only flows whose required steps completed, retain partial evidence separately through run-step records, and upsert the existing `app_flows` working draft by stable flow ID.

- [ ] **Step 4: Run capture tests**

```bash
node --experimental-strip-types --test src/crawlRun.test.ts src/smartCrawler.test.ts src/imageSource.test.ts
```

Expected: all tests pass and the two-run fixture writes one canonical file.

---

### Task 6: Build the durable crawl-run service

**Files:**

- Modify: `src/crawlRun.ts`
- Modify: `src/crawlRun.test.ts`
- Modify: `src/smartCrawler.ts`

- [ ] **Step 1: Write service tests with fake store and browser runner**

Cover full run, failed-flows-only retry, unsafe-flow skip, missing-secret refusal, approved unsafe prefix stopping before a side-effect step, cancellation, semantic failure, transient interruption, and same-run resume after completed steps.

- [ ] **Step 2: Implement `createCrawlRunService()`**

Expose:

```ts
export interface CrawlRunService {
  create(input: CreateRunInput): Promise<CrawlRun>;
  execute(runId: number): Promise<CrawlRun>;
  cancel(runId: number): Promise<CrawlRun>;
  retry(runId: number, mode: "failed" | "full"): Promise<CrawlRun>;
  recoverStaleRuns(staleBefore: Date): Promise<number[]>;
}
```

The service loads one immutable approved plan, creates/reuses one active draft, filters requested flows, validates unsafe gates without logging values, wires durable runner hooks, and writes terminal status exactly once.

- [ ] **Step 3: Resume rather than replay completed durable steps**

On RabbitMQ redelivery of the same run ID, skip completed run-step rows only after confirming their expected result and canonical evidence are recorded. Resume the first missing/incomplete step. A new user-requested retry gets a new run ID and `retry_of_run_id`.

- [ ] **Step 4: Run service tests**

```bash
node --experimental-strip-types --test src/crawlRun.test.ts
```

Expected: all lifecycle tests pass.

---

### Task 7: Add research and smart-crawl queue jobs with recovery

**Files:**

- Modify: `src/queue.ts`
- Modify: `services/import-worker/src/pipeline.ts`
- Modify: `services/import-worker/src/pipeline.test.ts`
- Modify: `services/import-worker/src/index.ts`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write worker tests first**

Tests must prove:

- `research-app` invokes research and saves a draft unapproved plan;
- `smart-crawl-app` executes the supplied run ID;
- a semantic failed run is acknowledged without throwing to RabbitMQ;
- a transient infrastructure exception marks the run interrupted and throws for bounded transport retry;
- a cancelled run is not replayed;
- startup recovery marks stale running runs interrupted before consumption.

- [ ] **Step 2: Extend the `Job` union**

```ts
| { type: "research-app"; name: string; homepageUrl: string; provider?: string }
| { type: "smart-crawl-app"; name: string; runId: number }
```

Messages contain identifiers and public URLs only. They never contain secret values or full plan JSON.

- [ ] **Step 3: Dispatch through injected services**

Add `researchAppJob()` and `crawlRunService.execute()` dependencies to `createPipelineHandler()`. Preserve existing Mobbin behavior. Only retryable infrastructure exceptions escape the handler.

- [ ] **Step 4: Configure the container for headless public crawling**

Set `HEADLESS=true` and a Linux-specific crawl-profile suffix/root for `import-worker`. Keep the host macOS headed profile separate. Do not copy or print host credentials.

- [ ] **Step 5: Run worker and compose tests**

```bash
node --experimental-strip-types --test services/import-worker/src/pipeline.test.ts
docker compose config --quiet
```

Expected: tests and Compose validation pass.

---

### Task 8: Add admin-only crawl APIs

**Files:**

- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Add failing authorization and validation tests**

Every route below must return `403` for a normal authenticated user and avoid calling its dependency. Invalid app slugs, public URLs, plan bodies, run modes, IDs, and repair decisions return `400`.

- [ ] **Step 2: Add plan/research routes**

Implement:

```text
POST   /crawl/apps/:app/research
GET    /crawl/apps/:app/plans
GET    /crawl/plans/:planId
PUT    /crawl/plans/:planId
POST   /crawl/plans/:planId/approve
```

Research enqueues `research-app`. Editing parses the complete plan before saving a new draft revision. Approval records the admin ID and supersedes the previously approved revision atomically.

- [ ] **Step 3: Add run routes**

Implement:

```text
POST   /crawl/apps/:app/runs
GET    /crawl/apps/:app/runs
GET    /crawl/runs/:runId
POST   /crawl/runs/:runId/cancel
POST   /crawl/runs/:runId/retry
GET    /crawl/runs/:runId/failures/:stepId/screenshot
```

Run creation persists first, then publishes the transport job. Publish failure marks the run interrupted and returns `503` with IDs but no secrets.

- [ ] **Step 4: Add repair routes**

Implement:

```text
POST   /crawl/runs/:runId/repairs
POST   /crawl/repairs/:repairId/apply
POST   /crawl/repairs/:repairId/reject
```

Repair suggestion may enqueue or call the existing LLM boundary, but apply/reject always requires a separate admin action. Applying creates a new unapproved plan revision.

- [ ] **Step 5: Run API tests**

```bash
node --experimental-strip-types --test services/api/src/app.test.ts
```

Expected: all existing and new API tests pass.

---

### Task 9: Upgrade the Atlassian plan from live evidence

**Files:**

- Modify: `data/crawl-plans/atlassian.json`

- [ ] **Step 1: Add stable IDs, revision, safety, secrets, and expected states**

Every meaningful action receives a state label and URL/visible assertion. Preserve seven safe product-coverage flows. Use role/name locators where the live accessible tree supports them, text second, and CSS only with a real reason.

- [ ] **Step 2: Correct the signup flow**

Replace the literal email with `$ATLASSIAN_TEST_EMAIL`, declare it in `requiredSecrets`, mark the flow unsafe, mark submission `side-effect`, and make the preceding read-only state observable. Keep normal runs from selecting the flow.

- [ ] **Step 3: Validate the plan locally**

```bash
npx tsx -e "import {readFileSync} from 'node:fs'; import {parseCrawlPlan} from './src/crawlPlan.ts'; const p=parseCrawlPlan(readFileSync('data/crawl-plans/atlassian.json','utf8')); console.log(JSON.stringify({revision:p.revision, safe:p.flows.filter(f=>f.safe).length, unsafe:p.flows.filter(f=>!f.safe).length, steps:p.flows.reduce((n,f)=>n+f.steps.length,0)}))"
```

Expected: one valid reviewed revision, seven safe flows, one unsafe flow, and no literal credential.

- [ ] **Step 4: Run the headed CLI baseline with strict assertions**

```bash
env -u HEADLESS npm run smart-crawl -- atlassian
```

Expected: each safe flow either completes with exact observable outcomes or produces a structured semantic failure naming flow, step, current/final URL, expected state, actual state, and screenshot. Do not weaken a failed assertion.

- [ ] **Step 5: Inspect and repair live mismatches**

Use the real page URL, accessible roles/names, text, popup behavior, and redirects. Generic browser/runner failures are fixed in code with a failing local fixture test. Only Atlassian information-architecture changes modify the plan.

Repeat Steps 3-5 until one headed strict run has zero semantic failures.

---

### Task 10: Add typed curator API functions and models

**Files:**

- Modify: `src/vitrine/researchApi.ts`
- Modify: `src/vitrine/types.ts`
- Create: `src/vitrine/CrawlWorkspacePanel.test.tsx`

- [ ] **Step 1: Define serializable view models**

Add `CrawlPlanSummary`, `CrawlPlanView`, `CrawlRunView`, `CrawlRunStepView`, `CrawlRepairView`, and `CrawlFailureView`. Never include secret values; required secrets are names and configured/missing booleans only.

- [ ] **Step 2: Add typed API helpers**

Add functions matching Task 8 routes for research, plan save/approve, run create/list/get/cancel/retry, and repair request/apply/reject.

- [ ] **Step 3: Add a rendered normal-user exclusion test**

The component rendered with `role="user"` must contain no research, approve, start, cancel, repair, retry, or publish controls.

Run:

```bash
npx tsx --test src/vitrine/CrawlWorkspacePanel.test.tsx
```

Expected: fail until the component exists.

---

### Task 11: Build the curator crawl workspace

**Files:**

- Create: `src/vitrine/components/CrawlWorkspacePanel.tsx`
- Modify: `src/vitrine/CrawlWorkspacePanel.test.tsx`
- Modify: `src/vitrine/Home.tsx` or `src/vitrine/components/ScreenDetail.tsx`
- Modify: `src/vitrine/styles.css` only for shared responsive layout rules not expressible with the existing components.

- [ ] **Step 1: Render research and plan editing states**

Test empty input, research queued/running/error, sources, editable flow/step fields, safety badges, missing-secret names, validation errors, approved revision, and regeneration returning to unapproved state.

- [ ] **Step 2: Render durable run states**

Test queued, running, succeeded, failed, cancelled, and interrupted states; current flow/step; counters; full/failed retry; cancel; headed/headless metadata; and polling cleanup on unmount.

- [ ] **Step 3: Render evidence, failure, and repair states**

Test ordered validated captures, incomplete labels, exact expected/actual diagnostics, failure screenshots, proposed repair diff, apply/reject, and the rule that a repair produces an unapproved revision.

- [ ] **Step 4: Reuse the existing draft/publication panel**

Show the resulting draft version and delegate submission/publishing to the current version APIs. Do not duplicate publication logic inside the crawler panel.

- [ ] **Step 5: Mount only for admins**

Place the workspace in the existing curator navigation. Customer screens and routes stay unchanged.

- [ ] **Step 6: Run all rendered UI tests**

```bash
npx tsx --test src/vitrine/*.test.tsx
```

Expected: all rendered React tests pass.

---

### Task 12: Verify cancellation and worker interruption live

**Files:**

- Modify tests only if a live failure reveals a missing deterministic fixture.

- [ ] **Step 1: Start the stack**

Use non-secret local admin values through environment variables and never echo them. Start PostgreSQL, RabbitMQ, API, worker, and Vite. Verify `/health`, worker connection, and signed-in admin UI.

- [ ] **Step 2: Cancel an Atlassian run mid-flow**

Start a headless worker run, wait until at least one step completes, request cancellation through the UI, and verify PostgreSQL shows `cancelled`, accurate counts, no steps after the cancellation checkpoint, a closed browser context, and a retry action.

- [ ] **Step 3: Retry the cancelled run**

Retry full or failed scope as appropriate. Verify `retry_of_run_id`, stable draft version, canonical evidence reuse, and eventual terminal accuracy.

- [ ] **Step 4: Simulate a worker interruption**

During a running Atlassian job, stop only the import worker, verify the run never becomes succeeded, restart the worker, and verify either same-run resume or accurate `interrupted` state followed by an explicitly linked retry.

- [ ] **Step 5: Verify published data throughout**

Before failure, after cancellation, during interruption, and after retry, query the published version and load the customer catalog. The published version ID and visible catalog remain unchanged.

---

### Task 13: Verify the complete curator workflow in the browser

**Files:**

- Modify implementation/tests only for observed defects.

- [ ] **Step 1: Sign in as an administrator in the real Vitrine UI**

Verify the crawl workspace is visible. In a separate normal-user session, verify it is absent and direct crawler endpoints return `403`.

- [ ] **Step 2: Exercise the 16 curator operations**

In order: enter app/homepage, generate research, inspect sources/plan, edit, review safety/secrets, approve, start, watch progress, cancel safely, inspect captures/failures, request repair, apply or reject explicitly, retry failed/full, inspect draft, submit, and publish through existing gates. Use a disposable test app/plan for destructive workflow checks; do not publish incomplete Atlassian data merely to satisfy UI navigation.

- [ ] **Step 3: Verify failure media and diagnostics visually**

Open a real failure screenshot from the UI and confirm the displayed flow, step, locator, expected result, actual URL/result, and screenshot all refer to the same durable failure row.

- [ ] **Step 4: Verify the Atlassian draft**

Open the draft version, inspect ordered flows and captures, and confirm every published-candidate observation is backed by a real screenshot from a completed validated state.

---

### Task 14: Pass every automated and live acceptance gate

**Files:**

- Modify: only defects found by the gates.
- Remove/archive: stale current Atlassian compatibility failure artifacts after a later successful run.

- [ ] **Step 1: Run focused suites**

```bash
node --experimental-strip-types --test --test-concurrency=1 src/crawlPlan.test.ts src/appResearch.test.ts src/smartCrawler.test.ts src/crawlRun.test.ts src/crawlStore.test.ts services/import-worker/src/pipeline.test.ts services/api/src/app.test.ts
npx tsx --test src/vitrine/CrawlWorkspacePanel.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run repository gates**

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
docker compose config --quiet
```

Expected: every command exits 0. Record exact test counts and any non-blocking build warning.

- [ ] **Step 3: Run three consecutive successful Atlassian crawls**

Required sequence:

1. one strict headed local run;
2. one headless import-worker run;
3. one additional run using either environment.

All seven safe flows must complete with zero semantic failures and zero unhandled exceptions. The unsafe signup flow is skipped; separately verify only its read-only prefix under the full test-account gates without submitting.

- [ ] **Step 4: Prove rerun idempotency with before/after queries**

For runs two and three, record screenshot-file count, image-row count/distinct refs, canonical evidence count, run-step count, flow evidence arrays, draft version ID, and published version ID before and after. Assert zero new screenshot files, no duplicate database images, no duplicate logical evidence, stable flow order, and no new version.

- [ ] **Step 5: Verify current failure cleanup**

The successful latest run has no current failure report. Historical failures remain reachable through durable run records. Remove or archive the three stale compatibility screenshots only after their newer successful flow states are confirmed.

- [ ] **Step 6: Prepare the completion report**

Report final architecture/data flow, every changed file, schema/API additions, exact Atlassian flows, exact commands and results, live run IDs/outcomes, capture/reuse/dedupe counts per run, browser evidence, intentionally skipped signup submission, and any genuine residual risk.

---

## Execution choice

Use **subagent-driven execution**. Dispatch bounded implementation tasks after the main agent reads the required TDD and subagent-development skills; review each task for spec compliance and code quality before proceeding. Keep live Atlassian diagnosis and CodeGraph-based structural tracing in the main agent as required by `AGENTS.md`.
