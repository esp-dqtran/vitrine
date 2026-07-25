# Sites Single-Page Reverse Engineering

## Goal

Allow an administrator to submit any public HTTP(S) page to Astryx Sites and
create one inspectable Site version containing:

- the page icon, metadata, category, and style classification;
- the rendered page hierarchy, layout, visual tokens, and responsive behavior;
- observed animation behavior and its scroll or time trigger;
- detected frontend, rendering, bundling, and animation technology;
- desktop and mobile visual evidence;
- an AI synthesis grounded in the captured evidence.

The crawler analyzes only the submitted page. It does not follow links, click
controls, submit forms, or discover additional pages.

## Approved Scope

- Arbitrary public page URLs are accepted by the Sites import flow.
- Mobbin Sites preview URLs continue through the existing Mobbin adapter.
- All other public URLs use the generic single-page adapter.
- Generic captures are persisted in the `sites`, `site_versions`,
  `site_pages`, and `site_sections` domain.
- The generic Sites adapter must not use `PublicPageStore`, `apps`,
  `web_pages`, `web_page_versions`, or the Apps public-page queue.
- The existing Apps/web public-page feature may remain, but it is not part of
  the Sites workflow.
- Passive navigation, scrolling, waiting, responsive resizing, DOM inspection,
  and computed-style sampling are allowed. Clicking and link traversal are not.

## Chosen Architecture

Use one Sites pipeline with source adapters:

1. The existing Mobbin adapter retains its authenticated capture and media
   preservation behavior.
2. A generic adapter reuses the existing secure Playwright page-capture
   foundation, but writes through `SitesStore`.
3. Deterministic browser inspection produces bounded evidence.
4. An optional configured multimodal provider synthesizes the evidence into a
   concise reverse-engineering report.
5. The Site detail UI exposes the stored report in an Analysis tab.

This approach reuses URL validation, redirect validation, popup blocking, lazy
content hydration, screenshot capture, section cropping, and scroll recording.
It does not reuse the Apps/web persistence layer.

## Site Identity and Versioning

`sites.source_kind` distinguishes `mobbin` from `public-page`.

For a generic page:

- `source_site_id` is `url:` followed by the SHA-256 digest of the canonical
  page URL;
- `slug` is derived from the public hostname;
- `source_url` is the canonical submitted page URL;
- `source_version_id` is `capture:` followed by a deterministic content hash;
- the content hash includes canonical URL, normalized rendered HTML, desktop
  screenshot hash, and either the mobile screenshot hash or a stable
  missing-mobile sentinel;
- a changed capture creates a new Site version;
- the newest successful generic capture becomes the latest version;
- an identical ready capture is reused.

Mobbin IDs and version semantics remain unchanged.

## Capture Stages

### 1. Secure navigation

- Accept only public HTTP(S) hosts.
- Reject credentials, localhost, private IPs, link-local IPs, and unsupported
  protocols.
- Validate every redirect and HTTP(S) resource origin.
- Block service workers and downloads.
- Close popups immediately.
- Do not read browser profile storage or authenticated state for generic pages.

### 2. Initial render and hydration

- Open a clean isolated browser context at `1440 × 900`.
- Wait for DOM content, bounded network idle, fonts, and pending images.
- Scroll through the page only to hydrate lazy content.
- Return to the top and capture the stable rendered state.
- Preserve raw rendered HTML only in the internal source-evidence object.

### 3. Structure and visual rendering

Build a stable hierarchy of:

```text
page -> region -> section -> component -> element
```

For each retained node record:

- stable evidence ID and bounded DOM selector;
- tag, role, accessible name, heading, and short text excerpt;
- parent evidence ID and document order;
- document and viewport bounding boxes;
- display, positioning, flex/grid properties, alignment, gaps, and wrapping;
- width, height, margin, padding, border, radius, background, typography, and
  color;
- transform, opacity, filter, mask, clip path, overflow, z-index, and
  `will-change`;
- fixed or sticky behavior;
- media references and lazy-loading state.

Section segmentation prefers semantic roots and meaningful visual boundaries,
then falls back to large non-overlapping page regions. It must not depend only
on `<section>` elements.

### 4. Motion tracing

Sample the rendered page at the top, bottom, section boundaries, and bounded
intermediate scroll positions.

At each position:

- wait for scroll-linked effects to settle;
- sample visible elements at approximately 0ms, 250ms, and 500ms without
  additional scrolling;
- record changes to transform matrices, opacity, filters, masks, clipping,
  background position, and geometry;
- inspect the Web Animations API and CSS keyframe definitions;
- observe attribute and child-node mutations;
- inspect known runtime signals such as GSAP timelines and ScrollTrigger when
  the runtime exposes them.

Classify each behavior as:

- `entrance`
- `scroll-linked`
- `sticky`
- `continuous`
- `ticker`
- `carousel`
- `parallax`
- `three-dimensional`
- `mask-reveal`
- `unknown`

Each motion record contains:

- target evidence ID;
- observed trigger: `load`, `viewport-enter`, `scroll-progress`, `time`, or
  `unknown`;
- affected properties;
- observed states or keyframes;
- duration, delay, easing, iteration, direction, and scroll range when
  measurable;
- desktop/mobile applicability;
- evidence references and confidence.

Hover behavior is not activated. It is reported as unknown unless static source
evidence identifies it.

### 5. Technology extraction

Inspect:

- generator metadata and framework-specific HTML attributes;
- script, stylesheet, preload, and module URLs;
- bounded inline-script signatures;
- already observed public resource and source-map metadata;
- runtime globals and version fields;
- CSS keyframes, Web Animations API objects, mutation patterns, and rendered
  behavior.

Technology findings use these states:

- `confirmed`: direct metadata, source-map, package URL, or runtime-version
  evidence;
- `observed-in-use`: runtime activity connects the technology to visible page
  behavior;
- `loaded`: the resource is present but visible use was not proven;
- `inferred`: multiple indirect signals support the finding;
- `not-detected`: the detector checked relevant bounded evidence and found no
  signal.

The detector covers at least:

- React and React DOM;
- Framer Sites and Framer Motion;
- Webflow and IX2;
- GSAP, ScrollTrigger, and SplitText;
- Three.js, Lottie, Rive, Spline, Swiper, Embla, Lenis, Anime.js, and React
  Spring;
- CSS keyframes, Web Animations API, and custom
  `requestAnimationFrame`-style motion.

Package presence never substitutes for rendered behavior analysis.

Resource inspection is bounded by count, per-resource size, aggregate size, and
timeout. Raw third-party bundle bodies are not persisted. Evidence excerpts
must remove sensitive query values.

### 6. Responsive comparison

Repeat structure and motion inspection in a clean `390 × 844` mobile context.

Record:

- visible and hidden components;
- reordered or substituted regions;
- typography and spacing changes;
- media removed or replaced;
- sticky/fixed behavior changes;
- animation count and runtime changes;
- breakpoint evidence.

The desktop page screenshot remains the Site page image. The mobile full-page
screenshot is stored as version analysis evidence.

### 7. AI synthesis

Use the existing OpenAI-compatible multimodal provider configuration:

- `RESEARCH_LLM_BASE_URL`
- `RESEARCH_LLM_API_KEY`
- `RESEARCH_LLM_MODEL`

The provider receives:

- bounded deterministic structure, motion, technology, and responsive
  evidence;
- allowed evidence IDs;
- a bounded desktop visual overview;
- no credentials, cookies, storage state, raw external bundle bodies, or
  unbounded page HTML.

It returns JSON only with:

- page purpose and category;
- structural narrative;
- rendering strategy;
- motion narrative;
- technology explanation;
- responsive differences;
- reusable visual tokens and component patterns;
- reconstruction priorities;
- unknowns and limitations;
- evidence-backed claims with confidence.

Observed, inferred, and unknown claims remain separate. The model cannot invent
evidence IDs.

If no provider is configured or the provider fails, the Site import completes
with deterministic evidence and `analysisStatus: "evidence-only"`. A failed AI
request never destroys an otherwise valid capture.

## Stored Analysis Contract

The version analysis JSON uses `schemaVersion: 1` and contains:

```text
capture
metadata
structure
visualTokens
motion
technology
responsive
synthesis
warnings
```

Every structure, motion, technology, and synthesized claim references stable
evidence IDs. The API returns the bounded analysis JSON but never returns raw
HTML or internal source objects.

A migration adds:

- `sites.source_kind`;
- nullable `site_versions.content_hash`, populated for generic captures;
- `site_versions.analysis_status`;
- `site_versions.analysis`;
- `site_versions.analysis_model`;
- `site_versions.analysis_object_key`;
- `site_versions.mobile_page_object_key`.

The internal analysis object contains the complete bounded deterministic
evidence. The JSONB column contains the client-safe report.

## Media Mapping

Generic single-page imports map into existing Sites media concepts:

- scroll preview WebM -> Site version preview;
- desktop full-page PNG -> one Site page;
- desktop section crops -> ordered Site sections;
- mobile full-page PNG -> analysis evidence;
- source capture and deterministic evidence -> internal JSON objects.

Generic sections use image media with crop bounds matching their position in
the desktop full-page screenshot. Mobbin image and video section behavior
remains unchanged.

## Queue, Worker, and API

- `POST /api/jobs` continues using `type: "import-site"`.
- URL routing recognizes exact Mobbin preview URLs first, otherwise validates a
  generic public page URL.
- Queue payloads remain identifier-only: type, canonical URL, and job ID.
- The Sites worker selects the Mobbin or generic adapter after canonical
  validation.
- Progress messages distinguish rendering, hydrating, analyzing structure,
  tracing motion, detecting technology, synthesizing, and saving.
- Existing-version lookup works for both source kinds.
- The physical queue name remains unchanged for deployment compatibility.

## Sites UI

### Import dialog

- Change the title to `Import Site`.
- Accept any public page URL.
- Explain that Astryx analyzes one submitted page only.
- Retain the existing queued and existing-version behavior.

### Site detail

Add an `Analysis` tab beside Preview and Sections.

The tab presents:

- AI summary or evidence-only status;
- page structure outline;
- layout and visual-token findings;
- motion behaviors with trigger and confidence;
- detected technology grouped by finding state;
- desktop/mobile differences;
- unknowns and evidence limitations.

The UI does not dump raw HTML, CSS, source maps, or bundle excerpts.

## Error Handling

- Invalid or private URLs fail before queue publication.
- Redirects to a private or unsupported host fail the capture.
- HTTP errors and non-renderable responses fail with a safe message.
- Unreadable cross-origin resources become analysis warnings.
- Resource and source-map limits produce partial technology evidence rather
  than an import failure.
- Pages with no semantic sections fall back to one body region.
- Pages with no measurable motion report an empty motion list.
- Mobile capture failure produces a warning and evidence-only responsive
  status; the desktop capture remains usable.
- AI provider errors produce evidence-only analysis.
- Required desktop media or object-store integrity failures fail the version.
- URLs are redacted from job failure messages where existing queue safety
  requires it.

## Testing

Follow test-first implementation.

### Domain and validation

- arbitrary public URLs canonicalize safely;
- Mobbin URLs retain their specialized identity;
- private, credentialed, and unsupported URLs are rejected;
- analysis parsers reject oversized, unordered, or unreferenced evidence;
- technology finding states and motion classifications are validated.

### Browser analyzer

Use a local fixture server with the network validator overridden. Fixtures
cover:

- semantic and non-semantic section segmentation;
- sticky and fixed layouts;
- CSS keyframes;
- JavaScript transform loops;
- Web Animations API motion;
- lazy images;
- desktop/mobile substitutions;
- framework and package signatures.

Tests must observe each new assertion fail before implementation.

### Crawler and persistence

- generic captures create one Site page and ordered image sections;
- content-identical captures reuse a ready version;
- changed content creates a new latest version;
- Mobbin imports remain unchanged;
- analysis and mobile media have complete stored-object coverage;
- AI failure still completes as evidence-only;
- persistence uses Sites tables and never Apps/web tables.

### API, queue, worker, and UI

- arbitrary public import URLs queue successfully;
- exact Mobbin URLs still queue successfully;
- invalid URLs return a bounded `400`;
- the worker selects the correct adapter;
- cancellation and safe progress behavior remain intact;
- the import dialog describes one-page analysis;
- Analysis routes and tab selection work;
- the Analysis tab renders confirmed, loaded, inferred, and not-detected
  technology findings without exposing raw evidence.

### Verification

- focused domain, browser, crawler, store, queue, API, and Sites component tests;
- migration verification;
- full test suite;
- production build.

## Acceptance Criteria

- An administrator can submit the Framer or Webflow homepage through the Sites
  import dialog without using the Apps public-page workflow.
- Each import produces one ready Site version with desktop preview, section
  crops, mobile evidence, structure analysis, motion analysis, technology
  findings, and responsive differences.
- Framer is reported with evidence for React, Framer Sites, and Framer Motion.
- Webflow is reported with evidence for Webflow/IX2, GSAP, ScrollTrigger,
  SplitText, Three.js, and loaded Swiper.
- Package state distinguishes loaded from observed in use.
- No link is followed and no page control is clicked.
- Mobbin Sites imports and media fidelity continue to work.
- Raw HTML, source maps, and bundle bodies are not exposed through the Sites
  API.
- Generic Sites persistence never writes to Apps/web capture tables.
- Focused tests, the full suite, migration verification, and the production
  build pass.
