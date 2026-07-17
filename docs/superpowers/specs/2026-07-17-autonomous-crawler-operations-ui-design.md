# Astryx Autonomous Crawler Operations UI Design

**Date:** 2026-07-17

**Status:** Approved design, pending written-spec review

## Goal

Give Astryx administrators one operational workspace for starting and monitoring autonomous crawls while keeping every App, run, agent, mission, action, observation, and resulting Flow clearly separated.

The UI must make the autonomous crawler understandable while it is working. An operator must be able to answer, without reading logs or querying PostgreSQL:

- Which Apps are crawling now?
- What is each agent researching or doing in the browser?
- Which action just ran, what did it observe, and what evidence did it capture?
- Who owns the shared-account mutation or authentication lease?
- Which missions are progressing, stalled, blocked, or complete?
- Which ordered Flows were published, which remain drafts, and why?

This is an administrator-only operations surface. It extends the existing autonomous crawler and Astryx design system; it does not create a separate crawler implementation.

## Chosen approach

Use a top-level **Crawls** workspace with an App-scoped control room.

Rejected alternatives:

- **One global activity stream:** simple, but interleaves unrelated Apps and makes evidence ownership difficult to understand.
- **Crawler controls only inside App detail:** keeps Apps separate, but prevents an operator from seeing concurrent crawls and failures across the fleet.
- **A second standalone crawler application:** maximizes freedom, but duplicates Astryx navigation, authentication, APIs, and design-system components.

The chosen structure has three levels:

| Route | Purpose |
|---|---|
| `/crawls` | Fleet overview grouped by App |
| `/crawls/:app` | One App's crawler control room and run history |
| `/crawls/:app/runs/:runId` | One immutable run's live agent activity and results |

The App control room defaults to its newest active run. The run ID remains in the URL so browser refreshes, shared links, and back navigation never silently switch the operator to a different crawl.

## Navigation

Add **Crawls** to the administrator sidebar beside Apps and Users. Normal users never receive the route or sidebar item.

The existing unmounted `CrawlWorkspacePanel` is not inserted wholesale. Its working run-creation and session controls become focused components inside the new workspace. Existing research-plan and deterministic-run tools remain available as an advanced section of the App control room.

Every App reference in the crawler workspace links back to its normal App detail page. App detail may link to the corresponding crawler control room, but the crawler does not become another overloaded App-detail tab.

## Crawls overview

The overview is optimized for scanning and intervention.

### Header

- Page title: **Crawls**
- Short status summary: active Apps, active agents, blocked missions, runs requiring attention
- Primary action: **New crawl**
- Filters: status, platform, and text search by App or URL

### App rows

Render one row per App that has crawler history. Each row shows:

- App identity and public homepage
- Platform
- Latest run status
- Progress: completed missions over total missions
- Active agent count
- Discovered states and transitions
- Published and draft Flow counts
- Shared-session health and version
- Last activity time
- Highest-priority blocker, when present
- **Open control room** action

Apps with multiple active runs are invalid. A historical run never contributes active counters to the latest run.

### Overview states

- **Empty:** explain autonomous crawling and present **New crawl**.
- **Loading:** use existing Astryx skeleton patterns without fake data.
- **Partial failure:** retain loaded App rows and show a scoped retry message.
- **Attention required:** visually prioritize interrupted runs, expired sessions, stale heartbeats, evidence blockers, and failed publication.

## New crawl flow

Open a focused dialog or drawer from the overview. Reuse existing Astryx form, button, select, checkbox, and alert components.

Required fields:

- App slug
- Public homepage URL
- Platform: Web, iOS, or Android
- Provider: ChatGPT or Claude
- Agent concurrency from 1 through 8
- Named secret references, never secret values
- Runtime, action, model-request, and storage ceilings
- Optional shared-session selection
- `allow_all` and its explicit shared-test-account mutation acknowledgement

Before submission, show a compact safety summary. If `allow_all` is disabled, state-changing missions will not be scheduled. If it is enabled, show that authentication and mutations remain serialized.

Successful creation navigates directly to `/crawls/:app/runs/:runId`. Validation and transport errors remain in the creation surface and do not navigate away.

## App control room

The App-scoped workspace separates configuration and history from one run's live detail.

### App header

- App identity, homepage, and platform
- Shared-session status, state version, and last refresh time
- Named secrets with configured or missing status
- **Start new run** and **Update shared session** actions
- Link back to the normal App detail page

The UI accepts Playwright storage-state JSON only inside the session update surface. It never renders stored cookies, local storage, encrypted state, or credential values after upload.

### Run history

Display newest runs first with status, start time, duration, agent count, mission outcome counts, Flow outcome counts, and interruption reason. Selecting a run changes the route and loads only that run's data.

Historical runs are read-only. Pause, resume, and cancel appear only when valid for the selected active run. Resuming an `allow_all` run requires the acknowledgement again.

## Run control room

Use one stable desktop layout with three working regions and responsive collapse for smaller widths.

### Run summary

The top summary contains:

- Run ID and status
- Elapsed time
- Mission completion
- States and transitions discovered
- Published and draft Flow counts
- Action, model-request, runtime, and storage budgets
- Pause, resume, and cancel controls
- Exact interruption or terminal summary

Progress is not represented as one misleading percentage. Mission completion, coverage growth, and budget consumption remain separate signals.

### Agent rail

Show every research, discovery, authentication, and orchestration worker associated with the run. Each agent card contains:

- Stable display identity derived from worker and mission IDs
- Agent role
- Current mission and product area
- Status: queued, running, waiting, blocked, interrupted, failed, or complete
- Current URL when safe to display
- Latest redacted action label
- Last heartbeat and stale indicator
- Action and recovery budget usage
- Mutation or authentication lease ownership
- Evidence count

Selecting an agent filters the mission tree and activity timeline. A clear-filter action returns to the whole-run view.

### Mission and Flow tree

The left region organizes work as:

- Product area
- Mission
- Episode or child run
- Ordered action
- Observed destination state

Nodes show status and evidence availability. Completed coherent paths are labeled as Flow candidates. Published, draft, rejected, or incomplete outcomes are visible without changing screens.

Selecting a node focuses the matching timeline event and opens its inspector details.

### Activity timeline

The center region is an append-only chronological stream. It combines every agent's work without losing identity.

Event types:

- Research assignment started, source verified, and dossier merged
- Mission queued, claimed, resumed, blocked, failed, and completed
- Browser observation captured
- Agent decision proposed and bounded plan approved
- Child run and step started, completed, skipped, or failed
- State and transition recorded
- Authentication or mutation lease acquired, refreshed, expired, and released
- Shared session refreshed
- Evidence persisted or rejected
- Flow candidate assembled, validated, drafted, or published
- Parent run paused, resumed, interrupted, cancelled, failed, or completed

Each event shows timestamp, agent, mission, short action, status, and evidence indicator. Secret-like fields and query parameters are redacted before persistence, not only in the React renderer.

Filters support agent, mission, event type, status, and “evidence only.” The default view follows new events while the operator remains at the bottom. Manual scrolling disables auto-follow until **Jump to latest** is selected.

### Inspector

The right region explains the selected event or node:

- Agent and mission context
- Child run, flow, and step identifiers
- Source and destination URLs after durable redaction
- Proposed action and locator
- Expected state
- Actual observed state
- Screenshot or evidence preview
- Confidence and validation result
- Retry, blocker, or recovery reason
- Dossier citations relevant to the mission

The inspector never exposes prompts containing secrets, environment values, cookies, raw storage state, or unredacted diagnostics.

## Results

The run control room provides result tabs without leaving the selected run:

- **Flows:** published and complete validated Flows with ordered evidence
- **Drafts:** uncertain or incomplete candidates with exact blockers
- **Coverage:** product areas, discovered states, transitions, and unanswered high-value capabilities
- **Research:** dossier claims, sources, confidence, and open questions
- **Diagnostics:** terminal failures, stale agents, evidence-object failures, and publication blockers

Published Flow links open the existing Astryx Flow viewer. Drafts cannot be presented as published catalog content.

## Durable event contract

The current autonomous detail response exposes missions plus raw states and transitions, but it cannot reconstruct a complete action-by-action operational timeline. Add a redacted append-only event record.

### `crawl_agent_events`

Minimum fields:

- event ID
- parent run ID
- App ID
- mission ID, child run ID, flow ID, and step ID when applicable
- worker ID and agent role
- event type and status
- redacted summary
- structured redacted payload
- evidence ID when applicable
- creation timestamp

Events are immutable. Corrections create later events instead of updating history. Event insertion belongs beside the durable state transition it reports whenever possible; the UI must not infer successful evidence persistence from a browser action alone.

### API

Add administrator-only endpoints:

- `GET /crawl/autonomous-runs` for the App-grouped overview
- `GET /crawl/apps/:app/autonomous-runs` for App run history
- `GET /crawl/autonomous-runs/:runId` for typed run detail
- `GET /crawl/autonomous-runs/:runId/events?after=:cursor` for ordered incremental events

Use cursor polling every two seconds for the first version. This fits the existing architecture, resumes cleanly after disconnects, and avoids introducing a second live-transport system. Polling stops for terminal runs after the final event page is received.

The existing control endpoints remain the command path. Queue payloads continue to carry identifiers only.

## Component boundaries

Keep components focused:

- `CrawlsPage`: route-level overview and filters
- `CrawlAppPage`: App header, session controls, and run history
- `CrawlRunPage`: selected-run composition and polling
- `NewCrawlDialog`: validated run creation
- `CrawlerRunSummary`: progress, budgets, and controls
- `CrawlerAgentRail`: all agents and selection
- `CrawlerMissionTree`: mission-to-action hierarchy
- `CrawlerEventTimeline`: cursor-fed activity
- `CrawlerEventInspector`: selected event and evidence
- `CrawlerResults`: Flows, drafts, coverage, research, and diagnostics

Reuse Astryx design-system components and tokens. Do not add a second styling system or another oversized all-in-one crawler component.

## Error and recovery behavior

- A stale agent is visible after missed heartbeats; it is not silently labeled failed.
- An expired mission lease shows reclaim eligibility and the next reclaim event.
- An authentication blocker points to the shared-session control without displaying credential details.
- An evidence failure identifies the affected mission, child run, and step and keeps the Flow as a draft.
- A transport interruption retains the same parent run ID and offers resume.
- An API polling failure leaves the current timeline visible and retries with the last cursor.
- A cancelled run stops new activity but preserves all prior events and results.
- A terminal run remains inspectable indefinitely through its immutable route.

## Accessibility and responsive behavior

- Every status uses text in addition to color.
- Agent, mission, and timeline selections are keyboard accessible.
- The timeline uses a normal list structure and announces newly appended events without stealing focus.
- Evidence images have contextual alternative text.
- Desktop uses the three-region layout. Tablet turns the inspector into a drawer. Mobile presents Agents, Work, Activity, and Results as tabs while preserving the selected run in the URL.
- Reduced-motion preferences disable animated live indicators and automatic smooth scrolling.

## Testing

### Unit and component tests

- Route parsing and path generation for every crawler route
- Admin-only sidebar and route behavior
- Overview grouping never mixes Apps or historical active counters
- Run history selection remains pinned to the route run ID
- Agent filtering and clear-filter behavior
- Ordered cursor event merging without duplicates
- Auto-follow pause and **Jump to latest** behavior
- Secret and URL redaction in all event types
- Correct pause, resume, cancel, session update, and new-run commands
- Responsive region and tab behavior

### API and store tests

- App- and run-scoped authorization
- Stable cursor ordering and terminal pagination
- Event ownership across parent, mission, child run, step, and evidence
- Idempotent event writes for retried durable operations
- No secrets, cookies, session state, or credential values in persisted events or responses
- Overview aggregation with multiple Apps and historical runs

### Acceptance test

Run the deterministic autonomous fixture with concurrent read agents, serialized mutation and authentication work, one forced session refresh, evidence capture, one blocked candidate, and one published Flow. Assert that the UI model:

- lists exactly one App and one selected parent run;
- shows every participating agent and mission;
- orders all persisted events correctly;
- identifies lease ownership without overlap;
- opens evidence for completed steps;
- preserves the blocked candidate as a draft with its exact reason;
- links the published Flow to its ordered evidence;
- contains no submitted secret values.

## Delivery boundaries

Included:

- real sidebar and router integration;
- crawler overview, App control room, and run control room;
- run creation and shared-session management;
- full agent, mission, event, evidence, and result observability;
- append-only redacted event storage and polling APIs;
- tests and deterministic acceptance coverage.

Not included:

- arbitrary chat messages sent to running agents;
- manual browser takeover;
- editing agent decisions after execution;
- WebSocket or server-sent-event infrastructure;
- customer-facing crawler access;
- changing crawler orchestration or evidence validation rules unrelated to observability.

## Success criteria

The feature is complete when an administrator can open **Crawls**, choose an App and immutable run, observe every participating agent from research through Flow publication, inspect each durable action and its evidence, understand blockers and lease ownership, control the run safely, and never confuse work or results belonging to different Apps or runs.
