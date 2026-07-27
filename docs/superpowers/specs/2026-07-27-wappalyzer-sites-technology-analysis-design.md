# Wappalyzer-Powered Sites Technology Analysis

Date: 2026-07-27

Status: Approved, implementation pending

## Purpose

Replace the Sites `Analysis` tab with a focused `Technology` tab that answers:

- Which frameworks and libraries power this page?
- Is it React, Next.js, or another renderer?
- Which UI, styling, CMS, hosting, analytics, and security tools are present?
- Which detected facts are strong enough to trust?

Wappalyzer becomes the primary technology-detection engine. Astryx's existing
native detector remains a fallback so a technology failure never prevents a
site capture.

The Technology tab is not a general analysis report. Its content is the
Wappalyzer result for the captured page.

## Scope

This design applies to the existing Crawl Sites flow for one submitted public
URL.

In scope:

- Detect technologies for the submitted page with a pinned Wappalyzer browser
  extension.
- Store normalized positive detections with category, confidence, optional
  version, source, and evidence references.
- Rename the admin-only `Analysis` tab to `Technology`.
- Use `/sites/:siteId/versions/:versionId/technology` for new navigation while
  treating the old `analysis` section value as a backwards-compatible alias.
- Show the Wappalyzer technology profile as the tab's content.
- Show the real technology logo supplied by Wappalyzer for each result.
- Keep deterministic capture and technology detection isolated.
- Preserve the shared Sites catalog behavior; imported sites are catalog
  records, not private per-user records.
- Preserve the current no-link-following boundary.

Out of scope:

- Crawling linked pages or an entire domain.
- Installing the extension in a user's Chrome profile.
- Reusing cookies, sessions, or credentials from a user browser.
- Turning Astryx into a code-writing agent.
- Generating or downloading a ZIP.
- Showing the old structure, motion, synthesis, reconstruction, mobile-render,
  evidence-claim, and limitations sections on the Technology tab.

## Validated feasibility

An isolated Playwright spike loaded the current Wappalyzer Chrome extension in
headless Chromium using a persistent context and analyzed `https://vercel.com`.
The extension reported 17 technologies, including Next.js, React, Radix UI,
Tailwind CSS, Vercel, Payload CMS, Sentry, and Vercel Analytics.

The spike established that the extension works in the crawler environment, but
also exposed two production constraints:

1. Chromium extensions require a persistent browser context.
2. Wappalyzer requires an extension service worker, while the existing capture
   path deliberately blocks page service workers for deterministic output.

The production design therefore uses two isolated browser passes.

## Architecture

### 1. Existing capture pass remains unchanged

`createPublicPageBrowser` continues to launch the normal Playwright browser and
capture the submitted page through the existing pinned public proxy and network
validator. It continues blocking page service workers and produces screenshots,
sections, browser evidence, motion evidence, and the native technology report.

This pass remains the source of truth for visual capture and the replication
blueprint.

### 2. Separate Wappalyzer detection pass

Add a narrow `WappalyzerBrowserAdapter` behind a technology-detector interface.
For each import it:

1. Creates a unique empty temporary `userDataDir`.
2. Launches `chromium.launchPersistentContext` with the bundled Chromium channel.
3. Loads only the pinned unpacked Wappalyzer extension.
4. Applies the same public-network validation and pinned proxy boundary as the
   capture pass.
5. Navigates only to the submitted canonical URL.
6. Waits for the extension service worker and detection completion signal.
7. Reads detections through one isolated adapter method.
8. Closes the persistent context and removes the temporary profile.

The adapter owns every dependency on Wappalyzer's internal extension API. No
other crawler or domain module may access its service worker globals directly.
If a Wappalyzer update changes that private contract, only the adapter and its
contract tests should need to change.

Detection readiness must use a bounded condition based on extension state. The
production implementation must not copy the spike's arbitrary 15-second wait.

### 3. Orchestration and fallback

The generic Sites crawler requests technology detection as part of the same
single-page import job. The orchestration order is:

```text
validate URL
    |
    +--> deterministic capture pass
    |
    +--> isolated Wappalyzer pass
              |
              +--> normalize detections
              |
              +--> on failure, retain native detections and add a warning
    |
persist one completed shared Site version
```

The safest initial implementation may run the two passes sequentially. This
avoids doubling concurrent browser resource use on a worker. Parallel execution
can be considered later from measured worker capacity.

A Wappalyzer timeout, crash, missing service worker, changed `Driver` API, or
malformed response must not fail the capture. The job records a structured
warning and completes with Astryx's native detector output.

## Extension packaging and supply chain

The crawler must never download Wappalyzer from the Chrome Web Store during a
job.

Before production release:

- Confirm that Astryx is permitted to bundle and redistribute the chosen
  Wappalyzer extension package.
- Pin the approved extension version in the worker image.
- Pin and verify the package SHA-256 during the image build.
- Validate the expected manifest version, extension ID, permissions, service
  worker entry point, and adapter contract.
- Fail the worker build when the hash or required manifest shape differs.

If redistribution permission is not available, the release must use an approved
Wappalyzer API integration or ship with only the native detector. Licensing is a
release gate, not a runtime fallback.

## Security and privacy

Every Wappalyzer run uses a new empty profile. The profile is never shared
between jobs and is deleted in `finally`, including after failure.

The detection pass must:

- Use no logged-in user browser state.
- Persist no target-site cookies after the job.
- Preserve SSRF protection, redirect validation, DNS pinning, request limits,
  and the existing public proxy boundary.
- Visit only the submitted page and its normal subresources; it must not follow
  discovered page links.
- Restrict loaded extensions to the approved Wappalyzer package.
- Disable Wappalyzer telemetry before navigation. If telemetry cannot be
  disabled reliably in extension storage, block Wappalyzer-owned telemetry
  endpoints at the browser/network boundary.
- Emit no page contents, cookies, or browsing identifiers to Wappalyzer.

Cleanup failures are logged and measured. They do not permit profile reuse.

## Data model

Introduce Site Analysis schema version 2 while preserving read compatibility
with stored version 1 analyses.

Each positive technology finding has this normalized shape:

```typescript
interface SiteTechnologyFindingV2 {
  id: string;
  name: string;
  slug: string;
  categories: string[];
  icon?: string;
  version?: string;
  confidence: number;
  source: "wappalyzer" | "native";
  evidenceIds: string[];
}
```

Rules:

- Store only positive detections. Do not persist a catalog of
  `not-detected` technologies.
- Normalize confidence to `0..1`.
- Preserve all reported Wappalyzer categories; do not force them into the
  current six-category union.
- Keep category labels stable enough for grouping, but retain the raw normalized
  category names so new Wappalyzer categories do not require a schema change.
- Generate a stable ID from source and slug.
- Store a version only when the detector reports one. Never infer it.
- Store only the Wappalyzer icon filename, not arbitrary detector-supplied URLs.
  The filename must be normalized and converted to the approved Wappalyzer icon
  endpoint by the UI.
- Evidence IDs may reference captured HTML, headers, scripts, cookies, or
  extension evidence that Astryx can disclose safely. A detection without
  displayable raw evidence may still be stored with its source and confidence;
  the UI must not invent evidence.
- Schema parsing must accept existing version 1 records and map them into the
  view model without mutating stored history.

Add a structured analysis warning for degraded technology detection. It should
carry a machine-readable code such as `WAPPALYZER_UNAVAILABLE` and a safe
user-facing message without internal paths or stack traces.

## Category presentation

Map raw categories into a small presentation taxonomy without losing the raw
values:

1. Frameworks and rendering
2. UI and styling
3. Content and commerce
4. Platforms and infrastructure
5. Analytics and security
6. Other

This mapping belongs in presentation/domain mapping code, not in the persisted
Wappalyzer adapter result. Unknown categories automatically fall into "Other."

Within each group:

- Show the technology name first.
- Show the version only when reported.
- Show confidence compactly.
- Make the detection source and supporting evidence available through a small
  disclosure, not as competing primary content.
- Sort high-confidence findings first, then alphabetically.

## Technology tab information architecture

The admin-only Site detail navigation contains `Preview`, `Sections`, and
`Technology`. Selecting `Technology` navigates to the `/technology` section.
Existing `/analysis` links resolve to the same Technology view so saved links do
not break.

The Technology view contains category groups and only detected technologies. It
must not show a long list of negative results or the previous general analysis
sections.

Each result card contains:

- The Wappalyzer technology icon.
- Technology name.
- Wappalyzer category.
- Version when reported.
- Confidence.

The icon has an empty alt attribute because the adjacent technology name is the
accessible label. If the icon is absent or fails to load, the card shows a
neutral code icon without hiding the technology name.

When Wappalyzer falls back, show a compact notice:

> Extended technology detection was unavailable. Showing browser-evidence
> results.

Do not label deterministic results as AI-generated.

## Failure handling

| Failure | Result |
|---|---|
| Extension package absent or invalid | Worker starts without Wappalyzer only when the feature flag permits fallback; otherwise fail readiness |
| Persistent context cannot launch | Complete capture with native detections and warning |
| Extension service worker does not become ready | Bounded timeout, native fallback, warning |
| Internal detection API is missing or changed | Contract failure, native fallback, warning and metric |
| Wappalyzer returns malformed data | Reject only the external result, native fallback |
| Target navigation is blocked by network policy | Preserve the existing import failure behavior |
| Temporary profile cleanup fails | Log and measure; never reuse the profile |

## Configuration

Use explicit worker configuration:

- `SITE_TECH_WAPPALYZER_ENABLED`
- `SITE_TECH_WAPPALYZER_EXTENSION_PATH`
- `SITE_TECH_WAPPALYZER_TIMEOUT_MS`
- `SITE_TECH_WAPPALYZER_EXPECTED_VERSION`
- `SITE_TECH_WAPPALYZER_EXPECTED_SHA256`

Production readiness must verify the enabled extension path and expected
manifest during worker startup. Secrets are not required.

## Testing

### Unit tests

- Normalize Wappalyzer names, slugs, categories, versions, and confidence.
- Reject malformed or oversized extension output.
- Map raw categories into the six presentation groups.
- Sort detections predictably.
- Parse schema versions 1 and 2.
- Confirm schema version 1 negative findings are hidden in the new UI.
- Merge Wappalyzer and native results without duplicate technologies.
- Prefer Wappalyzer data while retaining native evidence when both identify the
  same technology.

### Adapter contract tests

- Use a small fixture extension that exposes the expected service-worker
  contract; do not commit a redistributable Wappalyzer package until licensing
  is approved.
- Verify startup, readiness, result extraction, timeout, malformed output, and
  cleanup.
- Verify telemetry blocking/disablement before target navigation.

### Browser integration tests

- Run against a local fixture page with known React/Next-like signatures and
  known supporting technologies.
- Assert the adapter visits only the submitted page.
- Assert a fresh temporary profile is used for each test job.
- Assert the deterministic capture path still blocks page service workers and
  produces unchanged screenshots/evidence.

### UI tests

- The Site detail tab and page heading say `Technology`, not `Analysis`.
- New navigation uses `/technology`; `/analysis` remains a compatible alias.
- Detected technologies are grouped and versions are optional.
- Each Wappalyzer finding renders its technology icon and adjacent name.
- Unsafe icon filenames are rejected and fall back to the neutral code icon.
- Negative findings are absent.
- Native fallback shows a compact notice.
- The previous structure, motion, synthesis, evidence, mobile-render, and
  limitations sections are absent.
- Older schema version 1 records remain readable.

### Opt-in smoke test

Provide a non-blocking, manually invoked smoke test for an approved public URL.
External-site behavior must not become a required CI dependency.

## Rollout

1. Resolve extension redistribution and telemetry requirements.
2. Add the adapter, schema version 2, normalization, and fallback behind the
   feature flag.
3. Deploy to non-production in shadow mode and compare native and Wappalyzer
   detection results.
4. Measure detection duration, detected-technology count, adapter failure rate,
   fallback rate, profile cleanup failures, and worker memory.
5. Enable the Wappalyzer result in the non-production UI.
6. Release to production only after security, licensing, worker-capacity, and
   capture-regression checks pass.

## Acceptance criteria

- A fresh Vercel page import displays the current framework and platform
  detections returned by Wappalyzer; acceptance does not hard-code a framework
  because the target's production stack can change.
- The admin-only Site detail tab and page heading are named `Technology`.
- Selecting the tab uses `/sites/:siteId/versions/:versionId/technology`, while
  an existing `/analysis` link still opens Technology.
- The tab contains the Wappalyzer result rather than the previous general
  analysis report.
- Positive detections are grouped into understandable categories and show their
  Wappalyzer icons.
- Negative detections are not shown.
- The capture completes with native detections and a clear warning when
  Wappalyzer fails.
- Screenshot and section capture behavior does not change.
- Each job uses a unique empty detection profile with reliable cleanup.
- Wappalyzer telemetry is disabled or blocked before navigation.
- The crawler analyzes only the submitted page and does not follow links.
- The completed import remains a shared Sites catalog record.
- Existing Site Analysis schema version 1 records remain readable.
- No Wappalyzer package is bundled in production without explicit
  redistribution approval and hash pinning.
