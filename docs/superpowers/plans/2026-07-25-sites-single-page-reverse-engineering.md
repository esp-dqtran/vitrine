# Sites Single-Page Reverse Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import any public page into Astryx Sites as one evidence-backed Site version with structure, motion, technology, responsive, and optional AI analysis while preserving the Mobbin adapter.

**Architecture:** Keep `publicPageBrowser.ts` as the secure browser/capture foundation and move rich inspection into focused analysis modules. A new generic Sites crawler converts that result into the existing Sites media model and persists through Sites-owned methods; import routing selects Mobbin or generic capture without touching Apps/web persistence. The Site detail API and UI expose a bounded analysis report.

**Tech Stack:** TypeScript, Node test runner, Playwright, Sharp, PostgreSQL migrations, Express, React, existing OpenAI-compatible multimodal provider.

---

## Current-Branch Safety

The user explicitly authorized implementation on `main`. The checkout already
contains unrelated uncommitted work, including changes in Sites files.

- Never reset, checkout, stash, clean, or discard existing changes.
- Before editing an existing file, inspect its current contents and diff.
- Commit new files when they are isolated.
- For an already-dirty file, stage only the exact agent-owned hunk. If safe
  hunk-only staging is not possible, leave the file unstaged and report it.
- Before every commit, run `git diff --cached --name-only` and confirm it lists
  only files or hunks owned by this plan.

## File Responsibilities

- `src/siteAnalysis.ts`: versioned analysis contract, validation, evidence IDs,
  technology states, and AI result parsing.
- `src/siteAnalysis.test.ts`: contract and validation tests.
- `src/siteTechnology.ts`: bounded technology signatures and classification.
- `src/siteTechnology.test.ts`: Framer and Webflow fixture detection.
- `src/siteResourceEvidence.ts`: collect already-loaded script/style bodies and
  bounded public source maps without persisting third-party source.
- `src/siteResourceEvidence.test.ts`: resource limits, source-map resolution,
  and query-redaction tests.
- `src/sitePageInspection.ts`: browser-side structure, visual, motion, and
  responsive inspection.
- `src/sitePageInspection.test.ts`: pure classification and browser-fixture
  tests.
- `src/publicPageBrowser.ts`: orchestrate desktop/mobile capture and call the
  focused inspector without changing Apps persistence.
- `src/publicPageBrowser.test.ts`: integration assertions for rich analysis.
- `src/siteAnalysisProvider.ts`: evidence-grounded multimodal synthesis.
- `src/siteAnalysisProvider.test.ts`: provider mapping and output validation.
- `src/genericSiteCrawler.ts`: map one public capture to Sites media and stored
  evidence.
- `src/genericSiteCrawler.test.ts`: reuse, object coverage, evidence-only AI,
  and cancellation behavior.
- `migrations/0023_sites_single_page_analysis.sql`: source kind, generic content
  hash, analysis JSON, analysis objects, and mobile evidence.
- `src/sitesStore.ts`: generic begin/complete/fail methods and analysis reads.
- `src/sitesStore.test.ts`: generic Sites persistence and read mapping.
- `src/sites.ts`: source-kind routing while keeping Mobbin validation.
- `src/sites.test.ts`: Mobbin-first and generic URL routing tests.
- `src/sitesQueue.ts`: accept canonical arbitrary public URLs.
- `src/sitesQueue.test.ts`: queue validation tests.
- `services/sites-import-worker/src/index.ts`: select Mobbin or generic adapter.
- `services/sites-import-worker/src/pipeline.ts`: source-neutral progress.
- `services/sites-import-worker/src/pipeline.test.ts`: adapter-safe pipeline
  behavior.
- `services/api/src/app.ts`: accept arbitrary public `import-site` URLs.
- `services/api/src/app.test.ts`: API queue and existing-version behavior.
- `services/api/src/sites.ts`: return bounded analysis and mobile evidence.
- `services/api/src/sites.test.ts`: analysis API contract.
- `src/vitrine/types.ts`: client analysis types.
- `src/vitrine/sitesApi.ts`: validate returned analysis.
- `src/vitrine/sitesApi.test.ts`: parser tests.
- `src/vitrine/components/SiteImportDialog.tsx`: one-page URL copy.
- `src/vitrine/components/SiteVersionPage.tsx`: Analysis tab.
- `src/vitrine/Sites.test.tsx`: analysis rendering and route tests.
- `src/vitrine/styles.css`: responsive Analysis layout.
- `src/sitesIsolation.test.ts`: assert generic Sites never imports Apps stores.

### Task 1: Add the versioned analysis domain

**Files:**
- Create: `src/siteAnalysis.ts`
- Create: `src/siteAnalysis.test.ts`

- [ ] **Step 1: Write failing contract tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSiteAnalysis,
  siteEvidenceId,
  type SiteAnalysis,
} from "./siteAnalysis.ts";

const fixture: SiteAnalysis = {
  schemaVersion: 1,
  status: "ready",
  evidence: [{ id: "TECH-1", kind: "script-url", value: "motion.mjs" }],
  structure: [],
  visualTokens: [],
  motion: [],
  technology: [{
    id: "TECHNOLOGY-1",
    name: "Framer Motion",
    category: "animation",
    state: "confirmed",
    evidenceIds: ["TECH-1"],
    confidence: 1,
  }],
  responsive: [],
  synthesis: null,
  warnings: [],
};

test("parses evidence-backed Site analysis", () => {
  assert.deepEqual(parseSiteAnalysis(fixture), fixture);
  assert.equal(siteEvidenceId("technology", 7), "TECHNOLOGY-7");
});

test("rejects findings that invent evidence IDs", () => {
  assert.throws(
    () => parseSiteAnalysis({
      ...fixture,
      technology: [{ ...fixture.technology[0], evidenceIds: ["MISSING-1"] }],
    }),
    /evidence/i,
  );
});

test("keeps loaded, observed, inferred, and not-detected states distinct", () => {
  for (const state of ["confirmed", "observed-in-use", "loaded", "inferred", "not-detected"] as const) {
    assert.equal(parseSiteAnalysis({
      ...fixture,
      technology: [{ ...fixture.technology[0], state }],
    }).technology[0].state, state);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --experimental-strip-types --test src/siteAnalysis.test.ts
```

Expected: FAIL because `src/siteAnalysis.ts` does not exist.

- [ ] **Step 3: Implement the bounded contract**

Create these exported contracts and validators:

```typescript
export type SiteTechnologyState =
  | "confirmed"
  | "observed-in-use"
  | "loaded"
  | "inferred"
  | "not-detected";

export type SiteAnalysisStatus = "ready" | "evidence-only";

export interface SiteEvidence {
  id: string;
  kind:
    | "metadata"
    | "dom"
    | "computed-style"
    | "animation"
    | "mutation"
    | "script-url"
    | "source-map"
    | "runtime"
    | "frame";
  value: string;
}

export interface SiteTechnologyFinding {
  id: string;
  name: string;
  version?: string;
  category: "framework" | "renderer" | "bundler" | "animation" | "media" | "service";
  state: SiteTechnologyState;
  evidenceIds: string[];
  confidence: number;
}

export interface SiteMotionFinding {
  id: string;
  targetEvidenceId: string;
  type:
    | "entrance"
    | "scroll-linked"
    | "sticky"
    | "continuous"
    | "ticker"
    | "carousel"
    | "parallax"
    | "three-dimensional"
    | "mask-reveal"
    | "unknown";
  trigger: "load" | "viewport-enter" | "scroll-progress" | "time" | "unknown";
  properties: string[];
  states: Array<Record<string, string | number>>;
  durationMs?: number;
  delayMs?: number;
  easing?: string;
  iterations?: number | "infinite";
  scrollRange?: { start: number; end: number };
  viewports: Array<"desktop" | "mobile">;
  evidenceIds: string[];
  confidence: number;
}

export interface SiteAnalysis {
  schemaVersion: 1;
  status: SiteAnalysisStatus;
  evidence: SiteEvidence[];
  structure: Array<Record<string, unknown> & { id: string }>;
  visualTokens: Array<Record<string, unknown> & { id: string }>;
  motion: SiteMotionFinding[];
  technology: SiteTechnologyFinding[];
  responsive: Array<Record<string, unknown> & { id: string }>;
  synthesis: null | {
    purpose: string;
    category: string;
    structure: string[];
    rendering: string[];
    motion: string[];
    technology: string[];
    responsive: string[];
    reconstructionPriorities: string[];
    unknowns: string[];
    claims: Array<{
      kind: "observed" | "inferred" | "unknown";
      text: string;
      evidenceIds: string[];
      confidence: number;
    }>;
  };
  warnings: string[];
}

export function siteEvidenceId(
  kind: "structure" | "visual" | "motion" | "technology" | "responsive",
  position: number,
): string {
  const prefixes = {
    structure: "STRUCTURE",
    visual: "VISUAL",
    motion: "MOTION",
    technology: "TECHNOLOGY",
    responsive: "RESPONSIVE",
  } as const;
  if (!Number.isSafeInteger(position) || position < 0) throw new Error("Invalid Site evidence position");
  return `${prefixes[kind]}-${position}`;
}
```

`parseSiteAnalysis()` must:

- accept only `schemaVersion: 1`;
- bound evidence to 2,000 items and findings to 500 per collection;
- bound strings to 2,048 characters and warnings to 100;
- require confidence from zero to one;
- reject duplicate IDs;
- require every `evidenceIds` value to exist in `evidence`;
- require every motion `targetEvidenceId` to exist in `structure`;
- reject unknown keys at the root;
- return normalized plain objects without modifying semantic values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --experimental-strip-types --test src/siteAnalysis.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit isolated new files**

```bash
git add src/siteAnalysis.ts src/siteAnalysis.test.ts
git diff --cached --name-only
git commit -m "feat: define Sites analysis evidence"
```

Expected staged paths: only the two files above.

### Task 2: Detect frontend and animation technology

**Files:**
- Create: `src/siteTechnology.ts`
- Create: `src/siteTechnology.test.ts`

- [ ] **Step 1: Write failing Framer and Webflow tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { detectSiteTechnology } from "./siteTechnology.ts";

test("confirms Framer, React, and Framer Motion from direct evidence", () => {
  const result = detectSiteTechnology({
    generator: ["Framer 94de808"],
    htmlAttributes: { "data-framer-hydrate-v2": "{}" },
    scriptUrls: ["https://cdn.example/react.mjs", "https://cdn.example/motion.mjs"],
    stylesheetUrls: [],
    resourceUrls: [],
    inlineScripts: ["version:`18.2.0`,rendererPackageName:`react-dom`"],
    sourceMapSources: ["https:/app.framerstatic.com/framer-motion.DNR7HTEP.mjs"],
    runtimes: { reactDom: "18.2.0" },
    activeRuntimeSignals: ["framer-motion:VisualElement", "framer-motion:useScroll"],
  });
  assert.deepEqual(result.filter((item) => item.state !== "not-detected").map((item) => item.name), [
    "Framer Sites", "React DOM", "Framer Motion",
  ]);
  assert.equal(result.find((item) => item.name === "Framer Motion")?.state, "observed-in-use");
});

test("separates loaded Swiper from active GSAP on Webflow", () => {
  const result = detectSiteTechnology({
    generator: ["Webflow"],
    htmlAttributes: { "data-wf-site": "site", class: "w-mod-ix3" },
    scriptUrls: [
      "https://cdn.example/gsap/3.15.0/gsap.min.js",
      "https://cdn.example/gsap/3.15.0/ScrollTrigger.min.js",
      "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js",
    ],
    stylesheetUrls: [],
    resourceUrls: [],
    inlineScripts: ["gsap.registerPlugin(ScrollTrigger,SplitText)"],
    sourceMapSources: [],
    runtimes: { gsap: "3.15.0", scrollTrigger: "3.15.0", three: "128" },
    activeRuntimeSignals: ["gsap:timeline:73", "scroll-trigger:1"],
  });
  assert.equal(result.find((item) => item.name === "GSAP")?.state, "observed-in-use");
  assert.equal(result.find((item) => item.name === "Swiper")?.state, "loaded");
  assert.equal(result.find((item) => item.name === "Framer Motion")?.state, "not-detected");
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/siteTechnology.test.ts
```

Expected: FAIL because `detectSiteTechnology` is missing.

- [ ] **Step 3: Implement the signature registry**

Create:

```typescript
export interface SiteTechnologySignals {
  generator: string[];
  htmlAttributes: Record<string, string>;
  scriptUrls: string[];
  stylesheetUrls: string[];
  resourceUrls: string[];
  inlineScripts: string[];
  sourceMapSources: string[];
  runtimes: Record<string, string>;
  activeRuntimeSignals: string[];
}

export interface DetectedTechnology {
  name: string;
  version?: string;
  category: "framework" | "renderer" | "bundler" | "animation" | "media" | "service";
  state: import("./siteAnalysis.ts").SiteTechnologyState;
  evidence: Array<{ kind: import("./siteAnalysis.ts").SiteEvidence["kind"]; value: string }>;
  confidence: number;
}

export function detectSiteTechnology(input: SiteTechnologySignals): DetectedTechnology[];
```

Use one ordered registry for:

```typescript
[
  "Framer Sites", "React", "React DOM", "Framer Motion", "Webflow",
  "Webflow IX2", "GSAP", "ScrollTrigger", "SplitText", "Three.js",
  "Lottie", "Rive", "Spline", "Swiper", "Embla", "Lenis", "Anime.js",
  "React Spring", "CSS Keyframes", "Web Animations API", "Custom JavaScript Motion",
]
```

Rules:

- direct runtime activity upgrades `confirmed` or `loaded` to
  `observed-in-use`;
- a package URL or source-map path is `confirmed`;
- a resource present without activity is `loaded`;
- two independent indirect signatures may be `inferred`;
- a checked registry entry with no evidence is `not-detected`;
- extract versions only from bounded direct URL or runtime matches;
- redact query values from evidence URLs;
- cap inline signatures to 512 characters each and return at most three pieces
  of evidence per finding.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
node --experimental-strip-types --test src/siteTechnology.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit isolated files**

```bash
git add src/siteTechnology.ts src/siteTechnology.test.ts
git diff --cached --name-only
git commit -m "feat: detect Site animation technology"
```

### Task 3: Inspect structure, rendering, motion, and responsive states

**Files:**
- Create: `src/siteResourceEvidence.ts`
- Create: `src/siteResourceEvidence.test.ts`
- Create: `src/sitePageInspection.ts`
- Create: `src/sitePageInspection.test.ts`
- Modify: `src/publicPageBrowser.ts`
- Modify: `src/publicPageBrowser.test.ts`

- [ ] **Step 1: Write failing pure-classification tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMotionSample,
  responsiveDifferences,
} from "./sitePageInspection.ts";
import {
  sanitizeSiteResourceUrl,
  sourceMapReferences,
  sourceMapSources,
} from "./siteResourceEvidence.ts";

test("redacts resource query values and fragments", () => {
  assert.equal(
    sanitizeSiteResourceUrl("https://cdn.example/motion.mjs?v=secret#source"),
    "https://cdn.example/motion.mjs",
  );
});

test("retains source-map names without source contents", () => {
  assert.deepEqual(sourceMapSources(JSON.stringify({
    version: 3,
    sources: ["framer-motion.mjs", "react.mjs"],
    sourcesContent: ["private source", "private source"],
  })), ["framer-motion.mjs", "react.mjs"]);
});

test("resolves only declared source maps", () => {
  assert.deepEqual(
    sourceMapReferences(
      "console.log(1);\\n//# sourceMappingURL=motion.mjs.map",
      "https://cdn.example/motion.mjs",
    ),
    ["https://cdn.example/motion.mjs.map"],
  );
});

test("classifies fixed-position time changes as continuous motion", () => {
  assert.equal(classifyMotionSample({
    scrollChanged: false,
    timeChanged: true,
    sticky: false,
    threeDimensional: false,
    properties: ["transform"],
  }), "continuous");
});

test("classifies matrix3d changes separately", () => {
  assert.equal(classifyMotionSample({
    scrollChanged: true,
    timeChanged: true,
    sticky: false,
    threeDimensional: true,
    properties: ["transform"],
  }), "three-dimensional");
});

test("records components removed on mobile", () => {
  assert.deepEqual(
    responsiveDifferences(
      [{ key: "#hero-video", visible: true, media: "video" }],
      [{ key: "#hero-video", visible: false, media: "video" }],
    ),
    [{ key: "#hero-video", change: "hidden-on-mobile" }],
  );
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/siteResourceEvidence.test.ts src/sitePageInspection.test.ts
```

Expected: FAIL because the resource and inspection modules are missing.

- [ ] **Step 3: Implement bounded resource evidence**

Export:

```typescript
export interface SiteResourceEvidence {
  url: string;
  kind: "script" | "stylesheet" | "source-map";
  text: string;
}

export interface SiteResourceCollector {
  attach(page: import("playwright").Page): void;
  snapshot(): Promise<SiteResourceEvidence[]>;
}

export function createSiteResourceCollector(input: {
  validateNavigation(url: string): Promise<void>;
  maximumResources?: number;
  maximumResourceBytes?: number;
  maximumTotalBytes?: number;
}): SiteResourceCollector;

export function sanitizeSiteResourceUrl(value: string): string;
export function sourceMapReferences(source: string, baseUrl: string): string[];
export function sourceMapSources(sourceMap: string): string[];
```

The collector must:

- attach before navigation and inspect only successful script or stylesheet
  responses the page already requested;
- ignore bodies larger than 512 KiB;
- retain no more than 128 resources and 8 MiB total;
- parse `sourceMappingURL` from retained JavaScript;
- resolve at most 16 public source-map URLs;
- validate each source-map URL with the same public-network validator before
  GET;
- reject redirects outside the validated public destination;
- remove usernames, passwords, fragments, and query values from retained URLs;
- retain source-map `sources` names but not `sourcesContent`;
- expose bounded text only to in-process detection and never persist complete
  third-party bodies.

Use a fake Playwright response and request port in
`siteResourceEvidence.test.ts` to assert that a 513 KiB response is discarded,
the 129th response is ignored, aggregate bytes never exceed 8 MiB, and a
validated source-map request contributes only its `sources` names.

- [ ] **Step 4: Implement pure classifiers and Playwright inspection ports**

Export:

```typescript
export interface SiteViewportInspection {
  viewport: "desktop" | "mobile";
  width: number;
  height: number;
  document: { width: number; height: number };
  structure: Array<Record<string, unknown> & { id: string; key: string }>;
  visualTokens: Array<Record<string, unknown> & { id: string }>;
  animationSamples: Array<Record<string, unknown>>;
  technologySignals: import("./siteTechnology.ts").SiteTechnologySignals;
  mutations: { attributes: number; childNodes: number };
  warnings: string[];
}

export async function inspectSiteViewport(
  page: import("playwright").Page,
  viewport: "desktop" | "mobile",
  resources: import("./siteResourceEvidence.ts").SiteResourceEvidence[],
): Promise<SiteViewportInspection>;

export function buildSiteAnalysis(
  desktop: SiteViewportInspection,
  mobile?: SiteViewportInspection,
): import("./siteAnalysis.ts").SiteAnalysis;
```

`inspectSiteViewport()` must:

- return no more than 1,000 retained structure nodes;
- retain semantic roots plus large visible component boundaries;
- record computed layout and visual properties listed in the design;
- collect CSS keyframes with cross-origin stylesheet failures converted to
  warnings;
- sample a maximum of 12 scroll positions;
- compare visible computed state at 0ms, 250ms, and 500ms;
- record Web Animations API timing and keyframes;
- count MutationObserver attribute and child-node changes;
- read bounded runtime values for GSAP, ScrollTrigger, SplitText, React DOM,
  Three.js, Swiper, and Webflow IX2;
- inspect no more than 128 resource URLs and 8 MiB of aggregate text;
- never click or follow links.

- [ ] **Step 5: Run pure tests and verify GREEN**

```bash
node --experimental-strip-types --test src/siteResourceEvidence.test.ts src/sitePageInspection.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add a failing browser integration assertion**

Extend the current local-fixture test in `src/publicPageBrowser.test.ts` with:

```typescript
assert.equal(result.analysis.schemaVersion, 1);
assert.equal(result.analysis.status, "evidence-only");
assert.ok(result.analysis.structure.length > 0);
assert.ok(result.analysis.motion.some((item) => item.type === "continuous"));
assert.ok(result.analysis.technology.some((item) => item.name === "CSS Keyframes"));
assert.equal(result.mobilePageImage.subarray(1, 4).toString("ascii"), "PNG");
```

The fixture HTML must include:

```html
<style>
  #sticky { position: sticky; top: 0 }
  #loop { animation: slide 1s linear infinite }
  @keyframes slide { to { transform: translateX(20px) } }
  @media (max-width: 600px) { video { display: none } }
</style>
<section><h1>Fixture</h1><div id="sticky"></div><div id="loop"></div><video></video></section>
```

- [ ] **Step 7: Run integration test and verify RED**

```bash
node --experimental-strip-types --test src/publicPageBrowser.test.ts
```

Expected: FAIL because `analysis` and `mobilePageImage` are absent.

- [ ] **Step 8: Orchestrate desktop and mobile inspection**

Extend `PublicPageBrowserResult`:

```typescript
export interface PublicPageBrowserResult {
  capture: PublicPageCapture;
  pageImage: Buffer;
  mobilePageImage: Buffer;
  analysis: SiteAnalysis;
  sectionImages: Array<{ position: number; body: Buffer }>;
  preview: Buffer;
  scroll: { durationMs: number; stops: 0 };
}
```

In `capturePublicPage()`:

1. attach a resource collector before desktop navigation;
2. call `inspectSiteViewport(page, "desktop", await collector.snapshot())`
   after lazy hydration;
3. retain the current desktop screenshot, section crops, and scroll preview;
4. open a second isolated context at `390 × 844` with the same routing and
   popup protections;
5. attach a separate collector, hydrate, inspect, and capture the mobile
   full-page PNG;
6. call `buildSiteAnalysis(desktop, mobile)`;
7. close both contexts in `finally`.

Do not change `PublicPageStore` or Apps/web persistence.

- [ ] **Step 9: Run browser tests and verify GREEN**

```bash
node --experimental-strip-types --test src/siteResourceEvidence.test.ts src/sitePageInspection.test.ts src/publicPageBrowser.test.ts
```

Expected: PASS.

- [ ] **Step 10: Stage only owned hunks**

Commit the new inspection files. Stage modifications to existing browser files
only after confirming no pre-existing diff exists in those files:

```bash
git diff -- src/publicPageBrowser.ts src/publicPageBrowser.test.ts
git add src/siteResourceEvidence.ts src/siteResourceEvidence.test.ts src/sitePageInspection.ts src/sitePageInspection.test.ts
git add src/publicPageBrowser.ts src/publicPageBrowser.test.ts
git diff --cached --name-only
git commit -m "feat: inspect Site structure and motion"
```

### Task 4: Add evidence-grounded AI synthesis

**Files:**
- Create: `src/siteAnalysisProvider.ts`
- Create: `src/siteAnalysisProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSiteEvidence,
  type SiteAnalysisProvider,
} from "./siteAnalysisProvider.ts";

test("accepts only synthesis claims that cite supplied evidence", async () => {
  const provider: SiteAnalysisProvider = {
    model: "fixture",
    analyze: async () => ({
      purpose: "Website builder",
      category: "Design tool",
      structure: [], rendering: [], motion: [], technology: [], responsive: [],
      reconstructionPriorities: [], unknowns: [],
      claims: [{ kind: "observed", text: "Uses motion", evidenceIds: ["TECH-1"], confidence: 1 }],
    }),
  };
  const result = await analyzeSiteEvidence(provider, {
    evidenceIds: ["TECH-1"],
    evidence: { technology: [] },
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  });
  assert.equal(result.claims[0].evidenceIds[0], "TECH-1");
});

test("rejects invented provider evidence IDs", async () => {
  const provider: SiteAnalysisProvider = {
    model: "fixture",
    analyze: async () => ({
      purpose: "", category: "", structure: [], rendering: [], motion: [],
      technology: [], responsive: [], reconstructionPriorities: [], unknowns: [],
      claims: [{ kind: "inferred", text: "Invented", evidenceIds: ["NOPE-1"], confidence: 0.5 }],
    }),
  };
  await assert.rejects(() => analyzeSiteEvidence(provider, {
    evidenceIds: ["TECH-1"],
    evidence: {},
    image: { bytes: Buffer.from("png"), contentType: "image/png" },
    signal: new AbortController().signal,
  }), /evidence/i);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/siteAnalysisProvider.test.ts
```

Expected: FAIL because the provider module is missing.

- [ ] **Step 3: Implement provider adaptation**

Export:

```typescript
export interface SiteAnalysisProvider {
  readonly model: string;
  analyze(
    input: {
      evidenceIds: string[];
      evidence: unknown;
      image: import("./evidenceAnalysisProvider.ts").RasterImage;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export function siteAnalysisProviderFromMultimodal(
  provider: import("./evidenceAnalysisProvider.ts").MultimodalJsonProvider,
): SiteAnalysisProvider;

export async function analyzeSiteEvidence(
  provider: SiteAnalysisProvider,
  input: {
    evidenceIds: string[];
    evidence: unknown;
    image: import("./evidenceAnalysisProvider.ts").RasterImage;
    signal: AbortSignal;
  },
): Promise<NonNullable<import("./siteAnalysis.ts").SiteAnalysis["synthesis"]>>;
```

The system prompt must require:

- JSON only;
- observed, inferred, and unknown claims remain separate;
- every observed or inferred claim cites supplied IDs;
- no claim about source code or exact original design tokens without evidence;
- concise bounded arrays using the exact synthesis shape.

Validate output with an allowed-evidence set and maximum 50 claims.

- [ ] **Step 4: Run and verify GREEN**

```bash
node --experimental-strip-types --test src/siteAnalysisProvider.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit isolated files**

```bash
git add src/siteAnalysisProvider.ts src/siteAnalysisProvider.test.ts
git diff --cached --name-only
git commit -m "feat: synthesize Site analysis"
```

### Task 5: Persist generic page captures in Sites

**Files:**
- Create: `migrations/0023_sites_single_page_analysis.sql`
- Modify: `src/sites.ts`
- Modify: `src/sites.test.ts`
- Modify: `src/sitesStore.ts`
- Modify: `src/sitesStore.test.ts`

- [ ] **Step 1: Write failing source-routing tests**

Add to `src/sites.test.ts`:

```typescript
test("routes exact Mobbin URLs to Mobbin and other public URLs to one-page capture", () => {
  assert.equal(classifySiteImportUrl(approvedMobbinUrl).kind, "mobbin");
  const sourceSiteId = `url:${createHash("sha256").update("https://www.framer.com/").digest("hex")}`;
  assert.deepEqual(classifySiteImportUrl("https://www.framer.com/#hero"), {
    kind: "public-page",
    canonicalUrl: "https://www.framer.com/",
    sourceSiteId,
  });
});

test("rejects private generic Site URLs", () => {
  assert.throws(() => classifySiteImportUrl("http://127.0.0.1/"), /public/i);
});
```

Import `canonicalPublicPageUrl` internally; keep
`canonicalMobbinSitesUrl()` unchanged.

- [ ] **Step 2: Run routing tests and verify RED**

```bash
node --experimental-strip-types --test src/sites.test.ts
```

Expected: FAIL because `classifySiteImportUrl` is missing.

- [ ] **Step 3: Implement source routing**

Add:

```typescript
export type SiteImportIdentity =
  | ({ kind: "mobbin" } & MobbinSitesIdentity)
  | {
      kind: "public-page";
      canonicalUrl: string;
      sourceSiteId: string;
    };

export function classifySiteImportUrl(value: string): SiteImportIdentity {
  try {
    return { kind: "mobbin", ...canonicalMobbinSitesUrl(value) };
  } catch {
    const canonicalUrl = canonicalPublicPageUrl(value).requestedUrl;
    return {
      kind: "public-page",
      canonicalUrl,
      sourceSiteId: `url:${createHash("sha256").update(canonicalUrl).digest("hex")}`,
    };
  }
}
```

- [ ] **Step 4: Run routing tests and verify GREEN**

```bash
node --experimental-strip-types --test src/sites.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the migration**

Create:

```sql
ALTER TABLE sites
  ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'mobbin'
    CHECK (source_kind IN ('mobbin', 'public-page'));

ALTER TABLE site_versions
  ADD COLUMN content_hash TEXT
    CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'evidence-only'
    CHECK (analysis_status IN ('ready', 'evidence-only')),
  ADD COLUMN analysis JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(analysis) = 'object'),
  ADD COLUMN analysis_model TEXT,
  ADD COLUMN analysis_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT,
  ADD COLUMN mobile_page_object_key TEXT REFERENCES stored_objects(object_key) ON DELETE RESTRICT;

CREATE UNIQUE INDEX site_versions_public_content_unique
  ON site_versions (site_id, content_hash)
  WHERE content_hash IS NOT NULL;
```

- [ ] **Step 6: Write failing generic-store tests**

Add a store test that calls:

```typescript
const begin = await store.beginGenericImport({
  identity: classifySiteImportUrl("https://example.com/pricing"),
  name: "Example",
  description: "Pricing",
  iconUrl: "https://example.com/icon.png",
  categories: ["Business"],
  styles: ["Minimal"],
  contentHash: "a".repeat(64),
  analysis,
});
assert.equal(begin.reused, false);
```

After `completeGenericImport()`, assert recorded SQL contains inserts into:

```text
sites
site_versions
site_pages
site_sections
stored_objects
```

and does not contain:

```text
apps
web_pages
web_page_versions
web_page_sections
```

- [ ] **Step 7: Run store tests and verify RED**

```bash
node --experimental-strip-types --test src/sitesStore.test.ts
```

Expected: FAIL because generic store methods are missing.

- [ ] **Step 8: Implement generic store methods**

Extend `SitesStore`:

```typescript
beginGenericImport(input: GenericSiteBeginInput): Promise<
  | { reused: true; siteId: number; versionId: number }
  | { reused: false; siteId: number; versionId: number }
>;
completeGenericImport(
  input: GenericSiteCompleteInput,
  objects: ObjectMetadata[],
): Promise<{ siteId: number; versionId: number }>;
failGenericImport(url: string, message: string): Promise<void>;
```

`completeGenericImport()` must:

- lock the importing generic version;
- insert verified stored objects;
- replace only that version's page and sections;
- create exactly one page;
- create ordered image sections with required crop bounds;
- store bounded client analysis in `site_versions.analysis`;
- store the internal analysis object and mobile screenshot references;
- set previous generic versions for the same Site to `is_latest = false`;
- transition the new version to ready atomically.

Extend `readyVersionByCanonicalUrl()` to use `classifySiteImportUrl()` and query
both source kinds. Extend `readyVersionDetail()` to return:

```typescript
analysisStatus: "ready" | "evidence-only";
analysis: SiteAnalysis | null;
analysisModel?: string;
mobilePageUrl?: string;
```

Extend `siteMediaObject()` and its input kind union with `"mobile"`; resolve it
only from `site_versions.mobile_page_object_key` and never accept a record ID.

- [ ] **Step 9: Run store and migration tests**

```bash
node --experimental-strip-types --test src/sites.test.ts src/sitesStore.test.ts src/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 10: Stage only owned migration and hunks**

Because Sites files are already dirty, inspect and stage exact new hunks only.
Do not stage existing metadata or Mobbin-fidelity changes.

```bash
git add migrations/0023_sites_single_page_analysis.sql
git diff -- src/sites.ts src/sites.test.ts src/sitesStore.ts src/sitesStore.test.ts
git add -p src/sites.ts src/sites.test.ts src/sitesStore.ts src/sitesStore.test.ts
git diff --cached --name-only
git commit -m "feat: persist generic Site analysis"
```

### Task 6: Build the generic Sites crawler

**Files:**
- Create: `src/genericSiteCrawler.ts`
- Create: `src/genericSiteCrawler.test.ts`

- [ ] **Step 1: Write failing crawler tests**

Use real capture bytes with small valid PNG and WebM signatures and a fake
object store. Assert:

```typescript
const result = await crawlGenericSite("https://example.com/pricing", deps);
assert.deepEqual(result, {
  siteId: 7,
  versionId: 9,
  pageCount: 1,
  sectionCount: 2,
});
assert.equal(state.completed?.analysis.status, "evidence-only");
assert.equal(state.completed?.sections.length, 2);
assert.ok(state.objectKeys.some((key) => key.includes("/mobile/")));
```

Add separate tests for:

- ready version reuse;
- cancellation before capture and before completion;
- provider success changing status to `ready`;
- provider failure retaining `evidence-only`;
- mismatched section image count failing permanently;
- no call to `PublicPageStore`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/genericSiteCrawler.test.ts
```

Expected: FAIL because `crawlGenericSite` is missing.

- [ ] **Step 3: Implement the crawler**

Export:

```typescript
export interface GenericSiteCrawlerDependencies {
  browser: Pick<import("./publicPageBrowser.ts").PublicPageBrowser, "capture">;
  objectStore: import("./objectStore.ts").ObjectStore;
  sitesStore: Pick<
    import("./sitesStore.ts").SitesStore,
    "beginGenericImport" | "completeGenericImport" | "failGenericImport"
  >;
  analysisProvider?: import("./siteAnalysisProvider.ts").SiteAnalysisProvider;
  isCancelled(): Promise<boolean>;
  report?(message: string): Promise<void>;
}

export async function crawlGenericSite(
  url: string,
  deps: GenericSiteCrawlerDependencies,
): Promise<{ siteId: number; versionId: number; pageCount: 1; sectionCount: number }>;
```

Flow:

1. validate `public-page` identity;
2. render through `browser.capture()`;
3. create a bounded AI overview with
   `sharp(pageImage).resize({ width: 768, height: 4096, fit: "inside" })`;
4. optionally run AI synthesis with that overview and a bounded 60-second
   abort;
5. apply provider category and style output only as inferred metadata; retain
   deterministic icon and publisher metadata as observed evidence;
6. hash canonical URL, HTML, desktop PNG, and mobile PNG;
7. begin generic import and reuse a ready match;
8. store source JSON, analysis JSON, desktop PNG, mobile PNG, preview WebM,
   and section PNGs with verified metadata;
9. map capture sections to one Site page and ordered image Site sections;
10. complete atomically;
11. fail the generic version safely on an error after begin.

- [ ] **Step 4: Run and verify GREEN**

```bash
node --experimental-strip-types --test src/genericSiteCrawler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit isolated new files**

```bash
git add src/genericSiteCrawler.ts src/genericSiteCrawler.test.ts
git diff --cached --name-only
git commit -m "feat: crawl public pages into Sites"
```

### Task 7: Route queue, API, and worker by source kind

**Files:**
- Modify: `src/sitesQueue.ts`
- Modify: `src/sitesQueue.test.ts`
- Modify: `services/sites-import-worker/src/index.ts`
- Modify: `services/sites-import-worker/src/pipeline.ts`
- Modify: `services/sites-import-worker/src/pipeline.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/app.test.ts`

- [ ] **Step 1: Write failing queue and API tests**

Add:

```typescript
test("Sites queue accepts one arbitrary public page", () => {
  assert.deepEqual(parseSitesJob({
    type: "import-site",
    url: "https://www.framer.com/#hero",
    jobId: 7,
  }), {
    type: "import-site",
    url: "https://www.framer.com/",
    jobId: 7,
  });
});
```

Update the API test to expect:

```typescript
POST /jobs
{ "type": "import-site", "url": "https://www.framer.com/" }
```

to publish a Sites job and return `201`, while `http://127.0.0.1/` returns
`400` with `import-site requires a public HTTP(S) URL`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/sitesQueue.test.ts services/api/src/app.test.ts
```

Expected: FAIL because only Mobbin URLs are accepted.

- [ ] **Step 3: Generalize URL validation**

Replace Mobbin-only canonicalization in the Sites queue and `POST /jobs` branch
with:

```typescript
const identity = classifySiteImportUrl(url);
const canonicalUrl = identity.canonicalUrl;
```

Keep exact Mobbin matching first inside `classifySiteImportUrl()`.

- [ ] **Step 4: Run queue and API tests and verify GREEN**

```bash
node --experimental-strip-types --test src/sitesQueue.test.ts services/api/src/app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write a failing worker adapter-selection test**

Refactor worker construction behind:

```typescript
export interface SitesSourceCrawlers {
  mobbin(url: string, controls: SitesCrawlControls): Promise<SitesCrawlResult>;
  publicPage(url: string, controls: SitesCrawlControls): Promise<SitesCrawlResult>;
}

export function selectSitesCrawler(
  url: string,
  crawlers: SitesSourceCrawlers,
): SitesSourceCrawlers["mobbin"];
```

Test exact Mobbin URL selects `mobbin`; Framer selects `publicPage`.

- [ ] **Step 6: Run and verify RED**

```bash
node --experimental-strip-types --test services/sites-import-worker/src/pipeline.test.ts
```

Expected: FAIL because source selection is missing.

- [ ] **Step 7: Wire the worker**

In `services/sites-import-worker/src/index.ts`:

- retain `createMobbinSitesBrowserPorts()` for Mobbin;
- create `PublicPageBrowser` for generic jobs;
- create the existing multimodal provider and adapt it with
  `siteAnalysisProviderFromMultimodal()`;
- call `crawlGenericSite()` with `SitesStore`, not `PublicPageStore`;
- close the selected browser in `finally`.

- [ ] **Step 8: Run worker tests and verify GREEN**

```bash
node --experimental-strip-types --test services/sites-import-worker/src/pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 9: Stage exact owned hunks**

```bash
git diff -- src/sitesQueue.ts src/sitesQueue.test.ts services/sites-import-worker/src/index.ts services/sites-import-worker/src/pipeline.ts services/sites-import-worker/src/pipeline.test.ts services/api/src/app.ts services/api/src/app.test.ts
git add -p src/sitesQueue.ts src/sitesQueue.test.ts services/sites-import-worker/src/index.ts services/sites-import-worker/src/pipeline.ts services/sites-import-worker/src/pipeline.test.ts services/api/src/app.ts services/api/src/app.test.ts
git diff --cached --name-only
git commit -m "feat: route public URLs through Sites"
```

### Task 8: Expose and render Site analysis

**Files:**
- Modify: `services/api/src/sites.ts`
- Modify: `services/api/src/sites.test.ts`
- Modify: `src/vitrine/types.ts`
- Modify: `src/vitrine/sitesApi.ts`
- Modify: `src/vitrine/sitesApi.test.ts`
- Modify: `src/vitrine/components/SiteImportDialog.tsx`
- Modify: `src/vitrine/components/SiteVersionPage.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing client parser and component tests**

Extend the detail fixture with:

```typescript
analysisStatus: "ready",
analysisModel: "fixture-model",
mobilePageUrl: "/api/sites/7/versions/9/media/mobile",
analysis: {
  schemaVersion: 1,
  status: "ready",
  evidence: [{ id: "TECH-1", kind: "runtime", value: "GSAP 3.15.0" }],
  structure: [{ id: "STRUCTURE-1", label: "Sticky hero" }],
  visualTokens: [],
  motion: [{
    id: "MOTION-1",
    targetEvidenceId: "STRUCTURE-1",
    type: "scroll-linked",
    trigger: "scroll-progress",
    properties: ["transform"],
    states: [],
    viewports: ["desktop"],
    evidenceIds: ["TECH-1"],
    confidence: 0.9,
  }],
  technology: [{
    id: "TECHNOLOGY-1",
    name: "GSAP",
    version: "3.15.0",
    category: "animation",
    state: "observed-in-use",
    evidenceIds: ["TECH-1"],
    confidence: 1,
  }],
  responsive: [],
  synthesis: {
    purpose: "Marketing platform",
    category: "Website builder",
    structure: ["Sticky hero"],
    rendering: ["Webflow DOM runtime"],
    motion: ["Scroll-linked hero"],
    technology: ["GSAP drives visible motion"],
    responsive: ["Mobile disables the hero ScrollTrigger"],
    reconstructionPriorities: ["Rebuild sticky hero first"],
    unknowns: [],
    claims: [],
  },
  warnings: [],
},
```

Assert static markup for section `analysis` contains:

```text
Analysis
GSAP
Observed in use
Scroll-linked hero
Mobile disables the hero ScrollTrigger
```

Assert the import dialog contains `Analyze one public page` and no longer says
`Import Site from Mobbin`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/vitrine/sitesApi.test.ts
tsx --test src/vitrine/Sites.test.tsx
```

Expected: FAIL because analysis is not parsed or rendered.

- [ ] **Step 3: Extend API and client contracts**

Add to `SiteVersionDetail`:

```typescript
analysisStatus: "ready" | "evidence-only";
analysis: SiteAnalysis | null;
analysisModel?: string;
mobilePageUrl?: string;
```

Parse analysis with a client-safe equivalent of the server contract; reject
unknown status values, invalid confidence, and malformed arrays.

Add a protected media route:

```text
GET /sites/:siteId/versions/:versionId/media/mobile
```

backed by `mobile_page_object_key`.

- [ ] **Step 4: Render the Analysis tab**

Change:

```typescript
export type SiteDetailSection = "preview" | "sections" | "analysis";
```

Render a focused `SiteAnalysisPanel` with:

- synthesis purpose/category and evidence-only notice;
- structure and reconstruction priorities;
- motion cards showing type, trigger, viewport, and confidence;
- technology groups ordered:
  `observed-in-use`, `confirmed`, `loaded`, `inferred`, `not-detected`;
- responsive findings and warnings;
- no raw evidence value, HTML, CSS, or bundle excerpt.

Use existing core `Button`, `Heading`, `Text`, and semantic lists. Add responsive
CSS under `.site-analysis`.

- [ ] **Step 5: Run focused API/UI tests and verify GREEN**

```bash
node --experimental-strip-types --test services/api/src/sites.test.ts src/vitrine/sitesApi.test.ts
tsx --test src/vitrine/Sites.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Stage exact owned hunks**

```bash
git diff -- services/api/src/sites.ts services/api/src/sites.test.ts src/vitrine/types.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts src/vitrine/components/SiteImportDialog.tsx src/vitrine/components/SiteVersionPage.tsx src/vitrine/Sites.test.tsx src/vitrine/styles.css
git add -p services/api/src/sites.ts services/api/src/sites.test.ts src/vitrine/types.ts src/vitrine/sitesApi.ts src/vitrine/sitesApi.test.ts src/vitrine/components/SiteImportDialog.tsx src/vitrine/components/SiteVersionPage.tsx src/vitrine/Sites.test.tsx src/vitrine/styles.css
git diff --cached --name-only
git commit -m "feat: show Site reverse engineering"
```

### Task 9: Enforce isolation and complete verification

**Files:**
- Modify: `src/sitesIsolation.test.ts`
- Modify: `design-qa.md` only if the user-owned current changes leave a safe
  dedicated section for this feature.

- [ ] **Step 1: Write a failing isolation assertion**

Add:

```typescript
test("generic Site capture never persists through Apps web tables", async () => {
  const crawler = await readFile(new URL("./genericSiteCrawler.ts", import.meta.url), "utf8");
  const worker = await readFile(
    new URL("../services/sites-import-worker/src/index.ts", import.meta.url),
    "utf8",
  );
  for (const source of [crawler, worker]) {
    assert.doesNotMatch(source, /PublicPageStore|createPublicPageStore|web_page_versions|web_page_sections/);
  }
  assert.match(worker, /crawlGenericSite/);
  assert.match(worker, /createSitesStore/);
});
```

- [ ] **Step 2: Run and verify RED if an isolation leak exists**

```bash
node --experimental-strip-types --test src/sitesIsolation.test.ts
```

Expected before final wiring: FAIL until worker and crawler imports are
Sites-only. If it already passes because Tasks 6–7 established the boundary,
temporarily point the assertion at the forbidden Apps worker, verify it fails,
then restore the intended assertion and rerun.

- [ ] **Step 3: Run the focused feature suite**

```bash
node --experimental-strip-types --test \
  src/siteAnalysis.test.ts \
  src/siteTechnology.test.ts \
  src/sitePageInspection.test.ts \
  src/publicPageBrowser.test.ts \
  src/siteAnalysisProvider.test.ts \
  src/genericSiteCrawler.test.ts \
  src/sites.test.ts \
  src/sitesStore.test.ts \
  src/sitesQueue.test.ts \
  src/sitesIsolation.test.ts \
  services/sites-import-worker/src/pipeline.test.ts \
  services/api/src/sites.test.ts \
  services/api/src/app.test.ts \
  src/vitrine/sitesApi.test.ts
tsx --test src/vitrine/Sites.test.tsx
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 4: Verify migrations**

```bash
npm run db:check
npm run db:verify
```

Expected: both exit zero.

- [ ] **Step 5: Run the complete suite**

```bash
npm test
```

Expected: exit zero with no failing tests.

- [ ] **Step 6: Run the production build**

```bash
npm run build
```

Expected: Vite exits zero and writes the production bundle.

- [ ] **Step 7: Review requirements and final diff**

```bash
git status --short
git diff --check
git diff --stat
git log --oneline -10
```

Confirm:

- arbitrary public URL import is Sites-owned;
- Mobbin still uses the Mobbin adapter;
- only one page is inspected;
- no click or link-following code exists;
- structure, motion, technology, responsive, and AI/evidence-only analysis are
  stored and displayed;
- raw HTML and resource bodies are not returned by the API;
- unrelated dirty changes remain present and were not reset.

- [ ] **Step 8: Commit any remaining agent-owned clean files or hunks**

Stage only paths or hunks introduced by this plan, run focused verification
again for anything newly staged, then commit:

```bash
git diff --cached --name-only
git commit -m "test: verify Sites reverse engineering"
```

If nothing remains safely stageable because a file contains mixed user changes,
leave it unstaged and enumerate it in the handoff.
