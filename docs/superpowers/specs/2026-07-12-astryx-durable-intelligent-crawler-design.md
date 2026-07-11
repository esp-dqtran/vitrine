# Astryx Durable Intelligent Crawler Design

**Date:** 2026-07-12

**Goal:** Turn Astryx's current CLI smart crawler into a curator-operated, restart-safe workflow and prove it repeatedly against Atlassian's live public website without weakening assertions, fabricating evidence, or modifying published catalog data.

## Baseline established against the real site

The current repository already has the right separation between LLM-assisted research and deterministic Playwright execution:

- `src/appResearch.ts` researches public pages and proposes or repairs plan JSON.
- `src/crawlPlan.ts` validates the plan contract.
- `src/smartCrawler.ts` executes deterministic actions and captures Playwright screenshots.
- `src/index.ts` exposes `research`, `smart-crawl`, `record`, and `repair-flow` commands.
- PostgreSQL, RabbitMQ, the import worker, app-version publication gates, and admin UI already exist, but smart crawling is not connected to them.

The reviewed Atlassian file currently parses as eight flows, seven safe flows, one unsafe signup flow, and 53 total steps. Focused crawler tests pass, Docker Compose validates, and PostgreSQL and RabbitMQ are healthy.

An unchanged headed run on 2026-07-12 executed all seven safe flows and exited successfully with 36 ledger captures. That result exposed two acceptance failures:

1. A click returning successfully is treated as completion even when there is no observable postcondition. For example, the Rovo `Explore MCPs` click left the runner on `https://www.atlassian.com/software/rovo`; the plan has no URL, popup, or visible-state expectation proving the intended result.
2. The run grew Atlassian screenshot files and image rows from 94 to 129. There were no exact duplicate image refs, but 35 new screenshots for logically repeated states proves that screenshot-byte and volatile-body-text dedupe is not rerun-idempotent.

The run removed `report.json` because no Playwright action threw, while three stale failure screenshots remained. Therefore absence of the report is not evidence of semantic success.

## Chosen architecture

Use normalized crawl-specific records for durable state while retaining the existing `jobs` table and RabbitMQ queue as transport. The CLI, API, worker, and curator UI will call the same application service; there will not be a second execution engine.

The rejected alternatives are:

- Keeping state only in `jobs.payload`, `jobs.message`, `data/progress.json`, and `report.json`. This cannot safely represent step attempts, structured outcomes, run-specific cancellation, reviewed repairs, or restart recovery.
- Introducing a general event-sourced workflow platform. Astryx needs one durable crawler lifecycle, and a general workflow engine would add abstractions without improving the stated acceptance gates.

## Crawl-plan contract

PostgreSQL becomes the operational source of truth for editable and approved plans. `data/crawl-plans/<app>.json` remains a human-readable import/export and CLI bootstrap format. Each approved revision stores the exact validated JSON and a content hash, so a run can never silently switch plans.

Every plan contains:

- application slug, public start URL, domain description, research sources, and integer revision;
- lifecycle state: `draft`, `approved`, or `superseded`;
- the curator and timestamp that approved it;
- ordered flows with stable IDs, title, description, safety classification, required secret names, and ordered steps;
- stable step IDs, deterministic actions, one preferred locator, optional metadata, safety classification, and an observable expected outcome.

The action vocabulary stays small: `goto`, `click`, `fill`, `press`, and `waitFor`. A locator is one of role/name, visible text, or CSS. Role/name remains preferred, text is second, and CSS is accepted only with a non-empty `locatorReason` explaining why semantic location is unavailable.

An expected outcome has a required state label and at least one observable assertion:

- exact URL or bounded regular-expression URL pattern;
- visible role/name or visible text;
- page disposition: same page or newly opened page/popup.

The runner validates expected outcomes after actions and before capture. `waitFor` remains useful as an explicit assertion action, but it also names the state it proves. A required click without a postcondition is invalid plan data.

An optional step must include `optionalReason`. Optionality is limited to nonessential overlays or environmental variations such as a cookie banner; it cannot suppress a product-flow assertion.

Flow and step safety are explicit. Required secrets are names only and must match a conservative environment-variable pattern. Literal credentials or email addresses in a plan are rejected. Side-effect steps are marked individually so an approved unsafe flow can be exercised only up to its last read-only state.

The unsafe Atlassian signup flow will use a secret such as `$ATLASSIAN_TEST_EMAIL`. It remains excluded from normal runs. Exercising its read-only prefix requires `TEST_ACCOUNT=1`, all declared secrets, a curator-approved run, and a disposable-account acknowledgement. Submission is a separate side-effect step and is never executed unless the same run explicitly enables side effects. The acceptance run stops before submission.

## Durable data model

All migrations are additive and live in the existing `ensureSchema()` path.

### `crawl_plans`

Stores application, revision, validated JSON, content hash, lifecycle state, research metadata, approval identity, and timestamps. `(app_id, revision)` and `(app_id, content_hash)` are unique. Only an approved revision is runnable.

### `crawl_runs`

Stores run ID, app, draft version, approved plan revision, transport job, status, current flow and step, completed/failed/skipped counts, cancellation request, retry parent, worker/Playwright metadata without secrets, heartbeat, and lifecycle timestamps.

Statuses are `queued`, `running`, `succeeded`, `failed`, `cancelled`, and `interrupted`. A run cannot report success while any required flow or step failed.

### `crawl_run_steps`

Stores one row per run, flow, and step attempt: order, status, source URL, final URL, expected JSON, actual JSON, observed screenshot hash, canonical evidence reference, error class/message, failure screenshot reference, and timestamps. The unique run/flow/step key makes message redelivery resumable.

### `crawl_evidence`

Stores the canonical evidence state for a draft version, approved plan revision, flow, step, final normalized URL, and viewport. It references an existing `images` row and retains source URL, final URL, state label, screenshot hash, and capture time. Its logical uniqueness prevents repeated successful runs from creating a second flow-evidence record for the same approved state.

### `crawl_repairs`

Stores a proposed replacement step, the failure that motivated it, optional LLM metadata, and `proposed`, `applied`, or `rejected` review state. Applying a repair creates a new unapproved plan revision; it never mutates an approved revision in place.

## Deterministic execution

`src/smartCrawler.ts` remains the Playwright implementation but is split behind narrow dependencies:

- a plan source supplies one immutable approved revision;
- a run store records durable transitions, cancellation, steps, failures, and evidence;
- a capture store owns content-addressed files and image/version links;
- the browser runner executes only validated actions and expectations.

The CLI uses the same service with a console adapter. The worker uses the PostgreSQL adapters. No LLM call is reachable from the runner.

Each flow starts from a known page. After every action, the runner:

1. follows client-side navigation and bounded redirect chains;
2. switches to the newly opened page only when the plan expects one;
3. waits for the declared URL and/or visible-state assertion;
4. waits for bounded DOM quiet without relying on arbitrary fixed sleeps;
5. records actual URL, page disposition, and visible assertion result;
6. captures only after all required assertions pass.

Locators are resolved fresh for every attempt. Pages opened by prior steps are closed when the flow no longer needs them. Context or page closure is reported explicitly. Cleanup and final run status are written from `finally` blocks.

Retries are deterministic and bounded. Only launch failures, temporary DNS/network failures, connection resets, and interrupted redirect/navigation operations are retryable. Missing locators, wrong URLs, absent expected text, wrong popup behavior, and other semantic mismatches fail immediately. Failure diagnostics include run, flow, step, locator, source/current URL, expected outcome, actual outcome, error class, and a real stuck-state screenshot.

## Capture and idempotency

Every screenshot is produced by Playwright after a successful observable assertion. Screenshots are hashed in memory before persistence.

Exact files remain content-addressed by SHA-256 and are written atomically only when absent. An atomic database uniqueness constraint prevents concurrent duplicate image refs.

Rerun idempotency uses logical evidence identity in addition to byte identity. For the same draft version, plan revision, flow, step, final normalized URL, and viewport:

- the runner still renders, validates, screenshots in memory, and records the observed hash;
- if canonical evidence already exists, the run links that evidence and does not write another screenshot file or flow-evidence row;
- if no canonical evidence exists, the rendered screenshot becomes canonical evidence;
- a deliberate recapture into a new draft or a new approved plan revision may create new canonical evidence while still reusing an identical content-addressed file.

This makes consecutive verification runs observational rather than duplicative while preserving the fact that each run rendered and validated the state. Dynamic content can change the observed hash without silently replacing reviewed evidence. A curator can start a new draft when that drift should become publishable evidence.

Partial successful evidence remains attached to the draft run but is marked incomplete. Failed flows are never assembled as completed design flows. Stable flow ordering comes from plan order, and each flow step points to canonical evidence rather than capture timing.

After a successful run, current failure rows remain as historical run diagnostics, while stale filesystem-only screenshots and the compatibility `report.json` are archived or removed. Failure screenshots for prior runs remain accessible through their durable records.

## Queue, restart recovery, and cancellation

Add `research-app` and `smart-crawl-app` job types to the existing durable RabbitMQ queue. A smart-crawl message contains the durable run ID, not the full plan or secrets.

The worker claims a queued or interrupted run, updates a heartbeat, and resumes from the first incomplete step. RabbitMQ message redelivery uses the same run ID, so completed durable steps and canonical evidence are reused. A worker crash cannot create a false success.

Semantic failures are acknowledged after the run is marked failed; RabbitMQ does not retry them. Retryable infrastructure errors may use the existing bounded transport attempts. If the worker restarts after losing a message or heartbeat, stale `running` runs become `interrupted` and are recoverable through the same run ID or an explicitly linked retry.

Cancellation is stored per crawl run in PostgreSQL, not in the global `data/cancel-requested` file. The runner checks it between steps and flows, closes pages and context in `finally`, and writes accurate skipped counts and `cancelled` status. The legacy file remains only for existing Mobbin jobs until those jobs are migrated separately.

## API and authorization

All crawler administration routes require the existing admin middleware. Normal customer accounts receive no plan, run, failure, repair, or unpublished evidence controls.

The API supports:

- create or update an app and public homepage;
- enqueue research and inspect its sources;
- fetch, edit, validate, approve, and supersede plan revisions;
- create a full or failed-flows-only crawl run against an active draft;
- inspect run progress, step outcomes, captures, and failures;
- request and inspect a repair suggestion;
- apply or reject the repair explicitly;
- cancel a run;
- retry an interrupted, cancelled, or failed run with a durable relationship;
- inspect the resulting draft and use the existing submit/publish gates.

Starting a crawl creates or reuses one active draft version. It never changes the published version. Failed, cancelled, and retried runs all point to that draft. Existing catalog and customer reads continue resolving only published versions.

## Curator UI

Add an admin-only crawl workspace to the existing Vitrine curator surface rather than creating a separate application. It has four progressive sections:

1. **Research and plan** — app slug and homepage, research/regenerate action, sources, raw validation errors, editable flows/steps, safety and secret review, and plan approval.
2. **Run** — full or failed-flow retry, headed/headless environment summary, start, durable counters, current flow/step, cancellation, and interruption state.
3. **Evidence and failures** — ordered validated captures, incomplete labels, exact diagnostics, failure screenshots, and repair request/review/apply/reject controls.
4. **Draft and publication** — resulting draft counts and the existing submit-for-review and publish controls.

The UI polls the crawl-run endpoint initially, matching existing job polling. A streaming transport is unnecessary for the current single-worker product. Components consume typed API functions and are covered with rendered admin/user state tests.

## Atlassian plan revision

The current live information architecture is retained where it is valid:

- product catalog tabs resolve to `/software?tab=tab-1` and `/software?tab=tab-2`;
- Jira Teamwork Graph and pricing resolve to their observed public destinations;
- Confluence feature, whiteboard, and integration destinations receive explicit assertions;
- Service Collection, Marketplace, and plans receive explicit destination assertions;
- Rovo connectors, MCP, Rovo Dev, and trust states explicitly declare same-page, anchor, or new-page behavior based on live observation;
- Bitbucket Pipes and webinar destinations receive URL and visible-state assertions;
- Product Discovery tabs and Product Collection receive state and destination assertions;
- signup uses secret variables and a marked side-effect boundary.

Meaningful actions that currently rely on a later `goto` will gain their own expected outcome. If an observed Atlassian destination changed, the plan will be updated to the current equivalent product coverage rather than weakening the step.

## Delivery decomposition

Implementation is split into four independently testable phases:

1. **Contract and runner reliability:** revised strict plan schema, observable assertions, popup/navigation handling, structured diagnostics, capture-after-validation, and an accurate live Atlassian plan.
2. **Durable orchestration:** additive tables, idempotent evidence storage, run service, queue job types, worker resume/heartbeat, cancellation, repair records, and API authorization.
3. **Curator workflow:** plan editor/reviewer, durable run progress, failure/repair review, retry/cancel, evidence inspection, and draft/publication integration.
4. **Acceptance hardening:** focused and full gates, browser verification, cancellation, simulated worker interruption, three consecutive Atlassian runs, dedupe/database assertions, and stale-artifact cleanup.

Each phase uses test-driven changes against the existing seams. The dirty worktree is the baseline; work stays in the current checkout so none of the user's uncommitted implementation is omitted or overwritten.

## Verification and completion evidence

Completion requires the exact gates in the supplied goal. In addition, live run verification records, at minimum:

- run ID, plan revision, draft version, environment, status, and duration;
- every flow and step outcome with final URL;
- failure and retry counts;
- canonical evidence count, reused evidence count, new screenshot-file count, and duplicate queries;
- cancellation and worker-interruption transitions;
- browser-visible curator states and prior published catalog availability.

The second and third successful runs must create zero new logical evidence rows, zero duplicate flow references, and zero new screenshot files for the same draft and approved revision. The unsafe signup submission remains intentionally unexecuted.

## Risks and rollback

- **Live-site drift:** strict assertions intentionally turn drift into a named semantic failure. Repair creates a new unapproved plan revision.
- **Dynamic screenshots:** observed hashes may vary, but canonical logical evidence prevents rerun duplication. New publishable visual evidence requires an explicit new draft or approved revision.
- **Worker interruption:** durable steps, heartbeats, and same-run redelivery prevent false completion and make recovery measurable.
- **Dirty worktree:** edits remain narrow and no unrelated change is reset, replaced, or reformatted.
- **Rollback:** new tables and routes are additive. Disabling the new job types returns operations to the existing CLI without touching published versions; no destructive schema rollback is required.
