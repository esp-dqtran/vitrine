# Wappalyzer Sites Technology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Site `Analysis` tab with a focused `Technology` tab that stores and renders Wappalyzer detections with their real technology icons.

**Architecture:** Keep deterministic page capture unchanged. A separately configured Wappalyzer adapter launches an isolated persistent Chromium context, returns normalized findings, and falls back without failing the crawl. The generic Sites crawler merges those findings into Site Analysis schema version 2; the UI exposes `/technology` while accepting `/analysis` as an alias.

**Tech Stack:** TypeScript, Playwright Chromium extension APIs, React, Node test runner, Vite.

**Project execution rule:** Work directly on `main`, preserve unrelated changes, and do not commit or push unless the user requests it.

---

### Task 1: Add the version-2 technology finding contract

**Files:**
- Modify: `src/siteAnalysis.ts`
- Modify: `src/siteAnalysis.test.ts`
- Create: `src/wappalyzerTechnology.ts`
- Create: `src/wappalyzerTechnology.test.ts`

- [ ] **Step 1: Write failing schema and normalization tests**

Add tests proving that version 2 accepts Wappalyzer fields and version 1 remains readable:

```typescript
test("parses Wappalyzer technology findings in schema version 2", () => {
  const parsed = parseSiteAnalysis({
    ...fixture,
    schemaVersion: 2,
    technology: [{
      id: "TECH-WAPPALYZER-NEXT-JS",
      name: "Next.js",
      slug: "next-js",
      categories: ["Web frameworks"],
      icon: "Next.js.svg",
      source: "wappalyzer",
      state: "confirmed",
      evidenceIds: [],
      confidence: 1,
    }],
  });
  assert.equal(parsed.technology[0]?.icon, "Next.js.svg");
});
```

Add normalization tests for confidence conversion, unsafe icon rejection,
category mapping, stable IDs, duplicate merging, and native fallback retention.

- [ ] **Step 2: Run the tests and verify the expected red state**

Run:

```bash
npx tsx --test src/siteAnalysis.test.ts src/wappalyzerTechnology.test.ts
```

Expected: failures because schema version 2 and the Wappalyzer normalizer do not
exist.

- [ ] **Step 3: Implement the minimal version-2 contract**

Extend `SiteAnalysis.schemaVersion` to `1 | 2` and add optional normalized
Wappalyzer fields to `SiteTechnologyFinding`:

```typescript
slug?: string;
categories?: string[];
icon?: string;
source?: "wappalyzer" | "native";
```

`parseSiteAnalysis` must use the strict version-1 key set for old records and
the extended key set for version 2. Icon filenames must match a bounded safe
filename pattern and must not accept schemes, slashes, backslashes, or control
characters.

Create `normalizeWappalyzerTechnology` and `mergeWappalyzerTechnology` in
`src/wappalyzerTechnology.ts`. Convert Wappalyzer confidence from `0..100` to
`0..1`, retain category names, map a primary category into the existing
presentation union, and prefer Wappalyzer metadata when both detectors identify
the same slug/name.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npx tsx --test src/siteAnalysis.test.ts src/wappalyzerTechnology.test.ts
```

Expected: all tests pass.

### Task 2: Add the isolated Wappalyzer browser adapter

**Files:**
- Create: `src/wappalyzerBrowser.ts`
- Create: `src/wappalyzerBrowser.test.ts`

- [ ] **Step 1: Write failing adapter contract tests**

Use injected launch, proxy, temporary-directory, and cleanup ports so the tests
exercise orchestration without a proprietary extension fixture. Cover:

- missing/invalid extension configuration;
- unique profile creation;
- only the submitted URL is navigated;
- telemetry is disabled before navigation;
- bounded readiness and detection timeouts;
- malformed `Driver.getDetections()` output;
- context, proxy, and profile cleanup after success and failure.

- [ ] **Step 2: Verify the adapter tests fail**

Run:

```bash
npx tsx --test src/wappalyzerBrowser.test.ts
```

Expected: failure because `createWappalyzerBrowser` is missing.

- [ ] **Step 3: Implement the minimal adapter**

Expose:

```typescript
export interface WappalyzerTechnologyDetector {
  detect(url: string): Promise<SiteTechnologyFinding[]>;
}

export async function createWappalyzerTechnologyDetector(
  options: WappalyzerBrowserOptions,
): Promise<WappalyzerTechnologyDetector>;
```

For each `detect` call:

1. Validate the canonical public URL.
2. Create a unique temporary profile.
3. Create a pinned public proxy.
4. Call `chromium.launchPersistentContext` with `channel: "chromium"`,
   `serviceWorkers: "allow"`, and only the configured extension.
5. Wait for the extension worker.
6. Set Wappalyzer's cached `tracking` option to `false` before navigation.
7. Navigate one active tab to the submitted URL.
8. Wait until `Driver.getDetections()` returns a stable array.
9. Normalize the result.
10. Close and remove everything in `finally`.

The adapter never downloads or vendors the extension.

- [ ] **Step 4: Run adapter tests**

Run:

```bash
npx tsx --test src/wappalyzerBrowser.test.ts
```

Expected: all tests pass.

### Task 3: Merge Wappalyzer into the generic Sites crawl

**Files:**
- Modify: `src/genericSiteCrawler.ts`
- Modify: `src/genericSiteCrawler.test.ts`
- Modify: `services/sites-import-worker/src/index.ts`
- Modify: `services/sites-import-worker/src/startup.test.ts`
- Modify: `.dev.vars.example`

- [ ] **Step 1: Write failing crawler tests**

Add tests proving:

- successful Wappalyzer results replace duplicate native findings and produce
  schema version 2;
- detection failure completes with native findings and a safe warning;
- no detector leaves current capture behavior unchanged;
- the detector receives the final canonical URL after capture redirect.

- [ ] **Step 2: Verify crawler tests fail**

Run:

```bash
npx tsx --test src/genericSiteCrawler.test.ts
```

Expected: failure because `technologyDetector` is not a crawler dependency.

- [ ] **Step 3: Implement the crawler seam and worker configuration**

Add optional dependency:

```typescript
technologyDetector?: Pick<WappalyzerTechnologyDetector, "detect">;
```

After deterministic capture and canonical-URL validation, call the detector,
merge results into a new capture value, and pass that value to synthesis and
persistence. On detector failure, add the safe warning:

```text
Extended technology detection was unavailable; browser evidence was retained.
```

In the Sites worker, create the detector only when
`SITE_TECH_WAPPALYZER_EXTENSION_PATH` is configured. Pass the configured timeout
and close no shared user state because each call owns its persistent context.

- [ ] **Step 4: Run crawler and worker tests**

Run:

```bash
npx tsx --test src/genericSiteCrawler.test.ts services/sites-import-worker/src/startup.test.ts
```

Expected: all tests pass.

### Task 4: Replace Analysis with the icon-based Technology view

**Files:**
- Modify: `src/vitrine/components/SiteVersionPage.tsx`
- Replace content in: `src/vitrine/components/SiteAnalysisPanel.tsx`
- Modify: `src/vitrine/Sites.test.tsx`
- Modify: `src/vitrine/router.test.ts`
- Modify: `src/vitrine/styles.css`

- [ ] **Step 1: Write failing route and UI tests**

Add assertions that:

- the admin tab label and page heading are `Technology`;
- clicking the tab emits section `technology`;
- `section="analysis"` and `section="technology"` both show Technology;
- normal users still see only Preview and Sections;
- Wappalyzer findings render icon URLs such as
  `https://www.wappalyzer.com/images/icons/Next.js.svg`;
- unsafe or failed icons render the neutral code icon;
- old Analysis report headings do not render;
- negative findings do not render.

- [ ] **Step 2: Verify the UI tests fail**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx src/vitrine/router.test.ts
```

Expected: failures showing the existing `Analysis` label and report.

- [ ] **Step 3: Implement the focused Technology view**

Change `SiteDetailSection` to:

```typescript
type SiteDetailSection = "preview" | "sections" | "technology";
```

Resolve both `analysis` and `technology` to `technology`, but emit only
`technology` from navigation.

Replace `SiteAnalysisPanel`'s report body with:

- page heading `Technology`;
- a compact detected count;
- Wappalyzer category groups;
- technology cards containing icon, name, optional version, category, and
  confidence;
- native fallback notice when no Wappalyzer source exists;
- an empty state for older captures without detections.

Export and test a `wappalyzerIconUrl(icon)` helper that returns an approved
Wappalyzer icon URL only for safe filenames. Use an inline neutral code glyph
when it returns `undefined` or when the image `onError` fires.

- [ ] **Step 4: Add focused responsive styles**

Use an auto-fit grid with compact cards. Icons must remain 32px square, names
must wrap without clipping, and category groups must stack at narrow widths.

- [ ] **Step 5: Run UI tests**

Run:

```bash
npx tsx --test src/vitrine/Sites.test.tsx src/vitrine/router.test.ts
```

Expected: all tests pass.

### Task 5: Verify the integrated change

**Files:**
- Verify all files changed by Tasks 1–4.

- [ ] **Step 1: Run focused technology tests**

```bash
npx tsx --test \
  src/siteAnalysis.test.ts \
  src/wappalyzerTechnology.test.ts \
  src/wappalyzerBrowser.test.ts \
  src/genericSiteCrawler.test.ts \
  services/sites-import-worker/src/startup.test.ts \
  src/vitrine/router.test.ts \
  src/vitrine/Sites.test.tsx
```

Expected: all pass with zero failures.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Vite exits 0.

- [ ] **Step 3: Check patch formatting**

```bash
git diff --check
```

Expected: no output and exit 0.

- [ ] **Step 4: Run the optional live extension smoke test**

When an approved local extension path is available:

```bash
SITE_TECH_WAPPALYZER_EXTENSION_PATH=/approved/unpacked/extension \
npx tsx --test src/wappalyzerBrowser.live.test.ts
```

Expected: the configured test page reports its known technologies. This smoke
test is not part of required CI and must not download the extension.

