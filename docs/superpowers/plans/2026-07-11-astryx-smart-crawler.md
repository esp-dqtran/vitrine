# Astryx Smart Crawler Design & Implementation Plan

> Execute inline in this workspace. First-party capture only records what a real browser actually rendered; never synthesize screens, steps, or flows that were not observed or human-authored.

**Goal:** Capture application screens ourselves — beyond Mobbin — by researching a target app's public web presence, deriving its user flows, and running a deterministic per-flow crawler that screenshots every state along each flow.

**Architecture:** Three phases with a hard boundary between intelligence and execution. Phase A (Research) scrapes the target's public pages and uses the existing browser-driven LLM sessions (`llmChat.ts`) to produce a reviewable *crawl plan* — a domain summary plus flows with human-language steps. Phase B (Grounding) turns each step into a resilient Playwright locator spec, still offline, still human-reviewed. Phase C (Runner) executes plans deterministically with zero LLM involvement, capturing and deduping screens into the existing `insertImage` pipeline and emitting born-tagged `DesignFlow` records via `saveAppFlows`. Record mode (a human driving while the capture core watches) is the same runner with an empty step list, and is the permanent fallback for apps where generated plans fail.

**Constraints:**
- No paid API calls — all LLM work goes through `llmChat.ts` web sessions, and only in Phases A/B (never in the crawl loop).
- No new runtime dependency.
- Unsafe flows (anything side-effectful: payments, sends, deletes, invites) never run without a human marking them `safe` against a designated test account.
- Reuse existing infrastructure verbatim where it fits: persistent browser profile + login-wait polling (`crawler.ts`), local image storage + serving (`imageSource.ts`, `data/images/<app>/<hash>.<ext>`), progress/cancel (`progress.ts`), flow manifest validation style (`flows.ts`).

---

## Design

### Data model: the crawl plan

One JSON file per app at `data/crawl-plans/<app-slug>.json`, produced by Phase A/B, edited and approved by a human, consumed by Phase C:

```jsonc
{
  "app": "linear",
  "startUrl": "https://linear.app",
  "domain": "Issue tracking and product development for software teams.",
  "sources": ["https://linear.app/features", "https://linear.app/docs", "..."],
  "reviewed": false,            // runner refuses the whole plan until a human flips this
  "flows": [
    {
      "id": "onboarding",
      "title": "Sign up and create a workspace",
      "description": "First-run experience from landing page to an empty workspace.",
      "safe": false,            // side-effectful — only runs with TEST_ACCOUNT=1
      "steps": [
        { "action": "goto",  "url": "/signup" },
        { "action": "click", "role": "button", "name": "Continue with email" },
        { "action": "fill",  "role": "textbox", "name": "Email", "value": "$TEST_EMAIL" },
        { "action": "click", "text": "Create workspace" },
        { "action": "waitFor", "text": "Invite your team" }
      ]
    },
    {
      "id": "record-issues",
      "title": "Issue management (record mode)",
      "safe": true,
      "steps": []               // empty steps = record mode: human drives, capture core watches
    }
  ]
}
```

Step IR — the complete action vocabulary (resist growing it):

| action    | fields                        | meaning                                        |
|-----------|-------------------------------|------------------------------------------------|
| `goto`    | `url` (absolute or plan-relative) | navigate                                   |
| `click`   | one locator                   | click the resolved element                     |
| `fill`    | one locator + `value`         | fill input; `$VAR` values resolve from env     |
| `press`   | `key`                         | keyboard key (Enter, Escape)                   |
| `waitFor` | one locator                   | wait until visible — an assertion step         |

A locator is exactly one of: `{role, name}` → `getByRole(role, {name})`, `{text}` → `getByText(text)`, `{css}` → `locator(css)` (escape hatch, discouraged in generated plans). Semantic locators are the point: they let doc-language ("click New Project") ground onto a live DOM without knowing the app's markup, and they survive redesigns better than CSS. Any step may set `"optional": true` (cookie banners, one-time tips): if its locator doesn't resolve in 5s, skip the step instead of failing the flow.

### Phase C — Runner and capture core (build first)

`src/smartCrawler.ts`. Build order rationale: it is testable immediately with a hand-written plan for one app, its input format freezes what Phases A/B must emit, and it doubles as record mode from day one.

**Runner.** Reuses `launchMobbinContext`'s pattern with its own profile dir (`data/browser-profile-<app-slug>`) so each target app keeps its own login; first run is headed, human logs in, `waitUntilVisible`-style polling gates the start. Then per flow, sequentially: reset to `startUrl`, interpret steps one by one with a per-step timeout (10s default). On step failure: screenshot the stuck state to `data/crawl-reports/<app>/<flow>-<step>.png`, append a JSON failure record `{flow, stepIndex, step, error, screenshot}` to `data/crawl-reports/<app>/report.json`, abort *that flow only*, continue with the next. No retries, no improvisation — the report is the input to the human/LLM patch loop, not something the runner works around. Record-mode flows (empty steps) print "drive the app now" and capture until the human closes the window or cancels.

**Capture core.** Two triggers, both passive:
- every main-frame navigation (`page.on("framenavigated")`),
- DOM settle after a mutation burst — a `MutationObserver` injected via `addInitScript` sets a dirty flag; the runner polls it and captures ~600ms after mutations stop (modal opened, tab switched, wizard advanced).

Each capture: `page.screenshot({ fullPage: true })`. Dedupe key = normalized URL (origin + path, query dropped) + SHA-256 of `document.body.innerText` + viewport size — computed *before* screenshotting so duplicate states cost nothing. In-memory `Set` per flow run, cross-run dedupe via the existing `imageExists` check on the stored ref. `// ponytail:` text-hash dedupe misses image-only changes and over-fires on timestamps/counters; upgrade to a perceptual hash only if real runs show it matters.

**Storage & integration.** Screenshot bytes go to the existing layout `data/images/<app>/<sha256-16>.png`; the DB ref reuses the established local-ref scheme with a new prefix `capture:<hash>` (one added alternative in `imageSource.ts`'s ref regex — `publicImageUrl`/`findBulkImage` then serve it through `/api/media/<app>/<hash>` unchanged). Recorded via `insertImage(app, "web", ref, { sourceUrl, viewportWidth, viewportHeight, stateContext: "<flowId>/<stepLabel>" })`. After a full run, captured screens are assembled into `DesignFlow` objects (one per plan flow, steps carrying evidence image ids in capture order) and persisted with `saveAppFlows` — screens are born flow-tagged, no post-hoc grouping.

### Phase A — Research

`src/appResearch.ts`. Input: app name + homepage URL. A plain Playwright pass (no login) fetches the public surface: the homepage, then same-registrable-domain links matching a small allowlist (`/features`, `/product`, `/pricing`, `/docs`, `/guide`, `/help`, `/changelog`, plus `docs.` / `help.` / `support.` subdomains), capped at ~30 pages, extracting `innerText` per page. The concatenated corpus (truncated to fit a chat message) goes to one `ChatSession.ask()` call with a prompt that demands strictly the crawl-plan JSON shape above with *human-language* steps only (no selectors — grounding is Phase B's job) and `safe: false` on every flow by default. Output is validated by `parseCrawlPlan` (same defensive style as `parseFlowManifest`: typed field checks, duplicate-id rejection, unknown-action rejection) and written to `data/crawl-plans/<app>.json` with `reviewed: false`. Invalid LLM output → one re-ask with the validator errors appended, then give up and surface the raw reply for manual fixing.

### Phase B — Grounding

Merged into the same `ask()` conversation where possible: the research prompt already requests steps in the step IR (role/name/text locators are human-language enough for an LLM to produce from docs). A separate grounding pass exists only as a *repair* loop: given a failure report entry (step + error + the stuck-state screenshot uploaded via `ask(prompt, filePath)`), ask for a corrected step and patch the plan after human approval. `// ponytail:` no automated DOM-snapshot-to-LLM grounding pass; the repair loop plus human review covers it until proven otherwise.

### Human review gate (the safety boundary)

The runner hard-refuses any plan with `reviewed: false` and any flow with `safe: false` unless `TEST_ACCOUNT=1` is set (operator's assertion that the logged-in profile is a disposable test account). Review means a human read the flows, deleted or fixed nonsense, marked genuinely read-only flows `safe: true`, and flipped `reviewed`. There is no flag to skip the gate.

### Failure model (first-run failure is the normal case)

plan → run → `report.json` → patch (human directly, or repair-loop `ask` with the failure screenshot) → re-run. Re-runs are cheap: dedupe makes already-captured states free, and fixed flows only re-execute their own steps. An app redesign breaks locators, not the system — the plan file gets patched, nothing is retrained.

### CLI

Three commands in `index.ts`, mirroring the existing style:

- `research <appName> <homepageUrl>` — Phase A, writes the draft plan.
- `smart-crawl <appName>` — Phase C, runs the reviewed plan (respects `TEST_ACCOUNT`, `HEADLESS`).
- `record <appName> <startUrl>` — record mode without needing a plan file.

### Explicitly out of scope (v1)

- Mobile app capture (emulators/devices — a different project; Mobbin remains the mobile source).
- Autonomous click-exploration outside authored steps.
- Perceptual-hash dedupe, viewport matrix (mobile-width captures), auth automation (humans log in, as with Mobbin).
- LLM calls anywhere in the crawl loop.

---

## Task 1: Plan schema and parser

**Files:**
- Create: `src/crawlPlan.ts`
- Create: `src/crawlPlan.test.ts`

1. Write failing tests: valid plan round-trip; rejection of duplicate flow ids, unknown actions, steps with zero or multiple locators, missing `reviewed`/`safe`; `$VAR` substitution from env; relative-URL resolution against `startUrl`.
2. Confirm the tests fail because the module is absent.
3. Implement `parseCrawlPlan` (defensive style of `parseFlowManifest`) plus the `CrawlPlan`/`CrawlFlow`/`CrawlStep` types.
4. Confirm the tests pass.

## Task 2: Capture core

**Files:**
- Create: `src/smartCrawler.ts` (capture half)
- Create: `src/smartCrawler.test.ts`
- Modify: `src/imageSource.ts`, `src/imageSource.test.ts`

1. Write failing tests: dedupe key stability (same URL+text+viewport → one capture), query-string normalization, `capture:<hash>` refs resolving through `publicImageUrl`/`findBulkImage`.
2. Implement the dedupe key, screenshot persistence to `data/images/<app>/`, `insertImage` recording with `stateContext`, and the `capture:` ref prefix in `imageSource.ts`.
3. Confirm the tests pass.

## Task 3: Runner + record mode

**Files:**
- Modify: `src/smartCrawler.ts` (runner half), `src/smartCrawler.test.ts`
- Modify: `src/index.ts`

1. Write failing tests against a local fixture page (Playwright, same pattern as existing crawler-adjacent tests): step interpreter resolves each locator kind; `optional` steps skip on timeout; a failing step writes a report entry and aborts only its flow; `reviewed:false` and unsafe-without-`TEST_ACCOUNT` are refused.
2. Implement the interpreter, per-flow reset, report writing, record mode, progress/cancel wiring, and post-run `saveAppFlows` assembly.
3. Wire `smart-crawl` and `record` into `index.ts`.
4. Confirm the tests pass, then hand-write a small plan for one real app and verify screens land in the gallery flow-tagged.

## Task 4: Research phase

**Files:**
- Create: `src/appResearch.ts`
- Create: `src/appResearch.test.ts`
- Modify: `src/index.ts`

1. Write failing tests: public-page allowlist filtering, same-domain restriction, page cap, corpus truncation, prompt includes the plan JSON contract, validator-error re-ask happens exactly once (LLM session mocked).
2. Implement scrape → `ask()` → `parseCrawlPlan` → write draft plan with `reviewed: false`.
3. Wire `research` into `index.ts`.
4. Confirm the tests pass, then run end-to-end on one real app and review the generated plan by hand.

## Task 5: Repair loop

**Files:**
- Modify: `src/appResearch.ts`, `src/appResearch.test.ts`

1. Write failing tests: a report entry + screenshot produces a repair prompt with the failed step inline; the returned step replaces the failed one only after explicit confirmation; plan stays `reviewed: true` only if the human confirms.
2. Implement `repairFlow(app, flowId)` reading `data/crawl-reports/<app>/report.json`, uploading the stuck screenshot via `ask(prompt, filePath)`, and patching the plan on approval.
3. Confirm the tests pass.
