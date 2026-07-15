# Astryx Autonomous App-Flow Orchestrator Design

**Date:** 2026-07-16

**Status:** Approved design, pending written-spec review

## Goal

Let an Astryx administrator submit an application URL and have an autonomous, research-informed agent system discover the application's meaningful user journeys, execute them with one shared account, capture durable evidence, and automatically populate Astryx Flows.

The system must improve the current durable intelligent crawler rather than introduce a second crawler. The existing Playwright executor, crawl runs, step ledger, screenshots, object storage, retries, cancellation, curator review, versioning, and `app_flows` publication remain the operational foundation.

## Product outcome

One submitted URL produces:

- a cited research dossier explaining the product, terminology, roles, navigation, and expected workflows;
- a durable set of specialized discovery missions;
- an evidence-backed state and transition graph of the application;
- ordered Astryx Flow records with titles, descriptions, steps, interactions, and screenshots;
- exact incomplete or blocked-flow diagnostics when discovery cannot finish;
- automatic publication for complete, high-confidence flows, while uncertain or incomplete flows remain curator-reviewable drafts.

The feature is an autonomous product-understanding system, not a breadth-first link scraper and not a collection of prewritten flow scripts.

## Existing baseline

Astryx already separates research, deterministic execution, and durable evidence:

- `src/appResearch.ts` researches an app and produces plan data.
- `src/crawlPlan.ts` validates crawler plans.
- `src/smartCrawler.ts` executes Playwright actions.
- `src/crawlRun.ts` and `src/crawlStore.ts` own durable runs, steps, evidence, retries, recovery, and flow assembly.
- `services/import-worker` runs queued crawler work.
- the API and Vitrine curator UI expose research, approval, runs, failures, repairs, and publication.
- `app_flows` and `app_flow_versions` store draft and published flows.

The autonomous design retains these seams. The new orchestrator supplies dynamic missions and bounded actions to the existing executor. It does not let an LLM write directly to evidence or publication tables.

## Chosen approach

Use a research-first, goal-directed orchestrator backed by a durable state graph.

Rejected alternatives:

- **DOM breadth-first crawling:** cheap and deterministic, but produces noisy paths, misses intent, and treats every navigation element as equally meaningful.
- **Uncoordinated agent swarm:** flexible, but duplicates work, races on the shared account, and cannot provide a reliable completion boundary.
- **One unconstrained browser agent:** simple initially, but difficult to resume, audit, parallelize, or convert into stable evidence-backed flows.

The chosen approach separates reasoning from execution:

1. research agents gather and cite public knowledge;
2. the orchestrator converts that knowledge into bounded missions;
3. discovery agents reason about their assigned goals;
4. the existing crawler executes and records each chosen browser action;
5. the orchestrator merges results, measures coverage, and assigns follow-up missions;
6. a deterministic validator assembles and publishes only valid flows.

## Orchestration architecture

```text
Submitted app URL and shared account
  -> parent autonomous crawl run
  -> internet research agents
  -> versioned app dossier
  -> orchestrator mission planner
       -> onboarding/authentication mission
       -> core-workflow missions
       -> search/navigation mission
       -> collaboration/sharing mission
       -> settings/account mission
       -> billing/destructive-action mission
  -> discovery agents using durable browser execution
  -> shared state/transition graph
  -> coverage analysis and follow-up missions
  -> flow validator and assembler
  -> published flows or curator-reviewable drafts
```

One parent run owns the dossier, missions, states, transitions, evidence, coverage, and publication result. Every subagent receives a narrow mission and reports structured observations to the parent. Subagents cannot independently publish flows or create unrelated work.

## Research dossier

Before browser discovery, the orchestrator assigns parallel research tasks covering authoritative and useful public sources:

- official product pages and documentation;
- help center and onboarding material;
- pricing and plan descriptions;
- release notes and changelogs;
- public tutorials and product walkthroughs;
- app-store listings when relevant;
- publicly indexed integration, role, and permission documentation.

Research output is stored as one versioned dossier containing:

- app identity, product purpose, audience, and terminology;
- known roles and permissions;
- expected primary navigation and product areas;
- candidate user goals and flows;
- authentication and onboarding behavior;
- prerequisites, feature flags, and likely account state;
- risky, irreversible, billing, or destructive actions;
- source URLs, retrieval timestamps, claims, and confidence;
- open questions that must be verified inside the actual application.

The dossier is guidance, not evidence. Only browser-observed states can become Flow evidence. Unsupported research claims remain questions until a discovery agent verifies them.

## Mission planning

The orchestrator converts dossier capabilities and direct app observations into durable missions. A mission has:

- one app-specific goal;
- required starting state and account prerequisites;
- read-only or mutating execution mode;
- expected success signals derived from research, without requiring an exact predetermined route;
- maximum action and recovery budgets;
- known related states and flows to avoid duplicating;
- dependencies on other missions;
- priority, lease, heartbeat, status, and structured result.

Initial missions cover the product areas supported by the dossier. New capabilities found inside the app create follow-up missions. A mission remains small enough for one agent to understand and resume independently.

The orchestrator prioritizes:

1. authentication and navigation-map discovery;
2. high-value primary workflows;
3. supporting workflows and settings;
4. collaboration, billing, and account-management workflows;
5. destructive or irreversible workflows last.

## Discovery-agent behavior

Each discovery agent receives the current dossier, its mission, the relevant state-graph slice, and shared-account access. It repeatedly:

1. observes the current URL, page title, visible semantic controls, accessibility tree, dialogs, and screenshots;
2. describes the current product state in app-specific terms;
3. proposes candidate actions relevant to its mission;
4. chooses one action based on expected information gain and goal progress;
5. submits the action through the existing validated crawler executor;
6. waits for and validates the resulting observable state;
7. records the transition and durable evidence;
8. reports success, a new capability, a blocker, or a recovery request.

Agents prefer semantic role/name locators, then visible text, then justified CSS. Every completed action requires an observable state change or assertion. Arbitrary clicking, unbounded scrolling, and fixed-sleep-only completion are invalid.

An agent may navigate within app-owned origins discovered from the submitted URL, verified redirects, and dossier sources. Private-network destinations, local addresses, browser-internal URLs, and unrelated third-party origins remain blocked. Authentication origins may be added after the orchestrator verifies that they belong to the submitted app's login path.

## Shared-account coordination

All discovery agents use one shared application account, supporting both:

- an encrypted saved browser storage state created by an administrator;
- named secret references for username, password, one-time-code integration, or reauthentication.

Read-only missions may run concurrently in isolated browser contexts cloned from the same saved session. State-changing missions must acquire the parent run's exclusive mutation lease before executing.

The mutation lease:

- is durable in PostgreSQL;
- names the owning mission and worker;
- has a heartbeat and expiry;
- is released after the agent records and reconciles the resulting account state;
- prevents two agents from concurrently editing, submitting, purchasing, deleting, or otherwise mutating shared account data.

After a mutation, the orchestrator records the new shared-account facts and invalidates stale assumptions held by other missions. Agents refresh before continuing when the changed account state could affect them.

Destructive missions run after non-destructive discovery. The administrator may start an `allow_all` run, authorizing the agent to execute discovered actions including mutations and destructive actions. This mode is admin-only, explicit per run, audit logged, and never inherited by retries unless the retry repeats the acknowledgement.

## Authentication recovery

The orchestrator owns authentication recovery so agents do not race to replace the shared session.

When an agent detects expiry or an authentication challenge:

1. it pauses its mission at the last durable state;
2. it requests the shared authentication lease;
3. the orchestrator tries the saved session, then named credentials;
4. successful storage state is encrypted and versioned;
5. affected browser contexts refresh from the new session;
6. missions resume from their last validated state.

Secrets never appear in plans, dossier text, logs, screenshots, failure objects, or agent prompts beyond the minimum runtime substitution boundary. Existing masking and redaction remain mandatory.

## State and transition graph

The state graph is the orchestrator's shared memory and coverage model.

A state records:

- app, platform, account-state version, and parent run;
- normalized app-owned URL;
- semantic state label and product area;
- page title and bounded structural fingerprint;
- screenshot perceptual/content hashes;
- visible landmark summary;
- canonical evidence reference;
- first and last observation timestamps.

A transition records:

- source and destination state;
- chosen action and semantic target;
- agent mission and durable crawl step;
- read-only or mutating classification;
- observed result, error, or recovery outcome;
- evidence and confidence.

State identity combines normalized URL, semantic structure, stable visible landmarks, screenshot similarity, and relevant account-state version. No single signal is sufficient. This prevents both infinite loops on visually identical routes and false merging of distinct modal, tab, or workflow states.

## Deep-crawl completion

Deep crawling does not stop at a fixed number of flows. It continues while useful coverage increases.

The orchestrator completes the parent run when:

- all current missions are terminal;
- dossier questions are answered, explicitly blocked, or marked uncertain;
- no high-value capability lacks a mission;
- repeated coverage-analysis rounds produce no meaningful new states, transitions, or candidate flows;
- no expired mission or mutation lease remains recoverable.

A configurable runtime, action, model-cost, and storage ceiling provides an emergency bound. Reaching a ceiling produces a partial result with exact remaining missions; it never produces false success.

## Flow assembly

The orchestrator proposes candidate flows from successful graph paths. Deterministic assembly then verifies that each flow:

- represents one coherent user goal;
- has a stable title and app-specific description;
- contains ordered, nonduplicate states;
- includes the observed interaction for every transition;
- references only evidence owned by the same app, platform, version, and parent run;
- has accessible object-store bytes with matching metadata;
- contains no secret-bearing screenshots or diagnostics;
- is not a lower-confidence duplicate of another flow.

Research sources may explain why a flow matters, but screenshots and ordering come only from observed graph transitions.

Complete, high-confidence flows are written automatically into the active draft. The orchestrator then runs the existing version publication blockers and publishes the new version only when every existing gate passes; otherwise the flow and version remain draft with exact blockers. Uncertain, contradictory, incomplete, or missing-evidence flows always remain drafts with specific curator-review reasons. Existing published versions are never mutated in place.

## Required current-crawler corrections

Autonomous discovery would amplify existing flow-integrity bugs, so the following corrections are prerequisites rather than separate refactors:

- make image-to-version attachment platform-scoped;
- make design-system and flow selection platform-scoped during publication;
- validate and publish version-owned `flow_step` evidence instead of checking flow references only against `screen` images;
- verify evidence object existence and checksum before canonical reuse or publication;
- enforce app-owned origin policy for every dynamically chosen navigation;
- reject or explicitly time-bound empty record-mode missions in headless workers;
- report partial flow discovery rather than returning success after all per-flow attempts fail.

These changes stay in the shared storage, validation, and execution seams so both deterministic and autonomous crawling benefit.

## Minimal durable additions

Add only the records required for concurrent orchestration:

### `crawl_dossiers`

One versioned dossier per parent run, storing structured research, cited sources, open questions, confidence, and timestamps.

### `crawl_missions`

Durable subagent work with goal, prerequisites, mode, dependencies, budgets, priority, lease, heartbeat, status, checkpoint, and structured result.

### `crawl_states`

Deduplicated observed app states linked to canonical crawl evidence and account-state version.

### `crawl_transitions`

Observed actions between states linked to mission, run step, evidence, classification, and outcome.

### `crawl_account_leases`

The exclusive mutation or authentication lease for the parent run's shared account, with owner, purpose, heartbeat, and expiry.

Existing `crawl_runs`, `crawl_run_steps`, `crawl_evidence`, `images`, `stored_objects`, `app_flows`, and version tables remain authoritative for execution, media, and publication.

## API and curator experience

The existing admin crawl workspace gains one autonomous-run entry point:

- app URL;
- app/platform identity;
- saved-session selection;
- named credential-secret selection;
- deep-crawl ceilings;
- explicit `allow_all` acknowledgement;
- start, pause, cancel, and resume controls.

Run inspection shows:

- research progress and cited dossier;
- active, queued, completed, blocked, and failed missions;
- read-only concurrency and current mutation-lease owner;
- discovered state graph and coverage changes;
- candidate, published, draft, incomplete, and duplicate flows;
- exact authentication, browser, evidence, and publication blockers.

Normal customers see only published flows through the existing product surfaces. They never receive research prompts, agent reasoning, credentials, unpublished states, or admin controls.

## Failure and recovery

- Mission workers update heartbeats and checkpoints. Expired mission leases are reclaimable by another worker.
- Browser crashes interrupt only the owning mission. The parent run and other read-only missions continue.
- Authentication failure pauses affected missions and triggers one coordinated recovery attempt.
- Mutation-agent failure retains the lease until expiry and requires account-state reconciliation before another mutation begins.
- Internet-source failures reduce dossier confidence but do not block direct app discovery.
- Duplicate states, unchanged transitions, redirect loops, and repeated failed actions close unproductive branches.
- Missing or corrupt object-store evidence blocks flow publication and schedules recapture when possible.
- Partial research, states, transitions, and valid flows remain durable after cancellation or ceilings.
- Parent-run success requires no required mission to remain failed, interrupted, or silently abandoned.

## Verification strategy

### Unit and contract tests

- dossier source validation, citation retention, and secret rejection;
- mission generation, dependencies, budgets, leases, heartbeat expiry, and retry;
- shared-account mutation and authentication serialization;
- app-owned origin enforcement for dynamic navigation;
- state fingerprinting, deduplication, account-state versioning, and loop prevention;
- graph-to-flow assembly, confidence, duplicate detection, and validation;
- platform-owned `screen` and `flow_step` evidence publication;
- object existence and checksum requirements;
- automatic publication threshold and curator-draft fallback.

### Integration tests

Use a deterministic local test application containing authentication, onboarding, navigation, CRUD, search, sharing, settings, billing-like confirmation, popups, redirects, session expiry, and destructive actions. Verify that multiple agents:

- research and plan distinct missions;
- explore read-only areas concurrently;
- serialize shared-account mutations;
- recover one expired session without racing;
- resume interrupted missions;
- avoid duplicate states and loops;
- produce stable ordered flows with real evidence;
- leave uncertain or broken flows unpublished.

### Live acceptance

An administrator submits one authorized live application URL with the shared account and `allow_all` acknowledgement. Completion evidence must show:

- a cited dossier;
- multiple orchestrated research and discovery agents;
- durable mission and lease transitions;
- discovered app-specific flows rather than generic link paths;
- screenshots and evidence objects for every published step;
- no cross-platform or cross-version evidence;
- automatic publication of complete flows;
- explicit drafts or blockers for incomplete flows;
- recovery from one simulated browser-worker interruption;
- a second run that reuses verified states/evidence without duplicating published flows.

## Out of scope

- replacing Playwright with a second browser executor;
- allowing customer accounts to start autonomous crawls;
- agents writing directly to publication or object-storage metadata tables;
- unrestricted private-network crawling;
- automatic creation of additional application accounts;
- generalized orchestration for non-crawler workloads;
- a new customer-facing graph visualization.

## Rollout

1. Correct shared platform/evidence/publication defects.
2. Add dossier, mission, state, transition, and account-lease records.
3. Add research orchestration and cited dossier generation.
4. Add mission planning and read-only discovery agents.
5. Add shared-account authentication and mutation serialization.
6. Add graph-based flow assembly and automatic publication policy.
7. Add curator visibility, controls, and partial-result review.
8. Complete deterministic local multi-agent acceptance and one authorized live crawl.

Each phase uses the existing durable crawler service and remains independently testable. Unrelated dirty-worktree changes are preserved and excluded from implementation commits.

## Acceptance criteria

The design is complete when an administrator can submit a URL and shared account, start a deep autonomous run, and observe the orchestrator:

1. research the app from cited internet sources;
2. create a durable app-understanding dossier;
3. assign multiple specialized discovery agents;
4. explore read-only missions concurrently and mutations serially;
5. recover authentication and interrupted missions;
6. build a deduplicated evidence-backed state graph;
7. infer coherent app-specific user flows;
8. automatically publish only complete high-confidence flows;
9. retain uncertain or incomplete flows with exact curator blockers;
10. finish only after coverage plateaus or report an explicit resource-ceiling partial result.
