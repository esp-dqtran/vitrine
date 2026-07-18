# Research Canvas Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Research Project workspace section reachable at tablet and phone widths while preserving the existing three-column desktop canvas.

**Architecture:** Move only the responsive layout properties from React inline styles into semantic classes in the existing Vitrine stylesheet. Use a single-column workspace below 1100px and a single-column lane list below 640px; keep all components, state, actions, DOM order, and API behavior unchanged.

**Tech Stack:** React 19, TypeScript, Vite, CSS media queries, Node test runner, React server rendering, Playwright with local Google Chrome for visual verification.

---

## File map

- Modify `src/vitrine/components/ResearchProjectPage.tsx`: expose page and workspace class hooks and remove layout properties that CSS must override.
- Modify `src/vitrine/components/DecisionCanvas.tsx`: expose canvas and lane-collection class hooks and remove lane-collection layout properties that CSS must override.
- Modify `src/vitrine/styles.css`: own the desktop, tablet, and phone layout rules. This file already has unrelated working-tree edits, so stage only the appended research-workspace hunk.
- Modify `src/vitrine/ResearchProjects.test.tsx`: verify the semantic hooks and the two responsive breakpoints.
- Do not modify API, persistence, synthesis, routing, feature flags, or research domain files.

### Task 1: Lock the responsive contract with failing tests

**Files:**
- Modify: `src/vitrine/ResearchProjects.test.tsx`
- Test: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Import the stylesheet reader**

Add the Node filesystem import beside the existing Node imports:

```tsx
import { readFileSync } from "node:fs";
```

- [ ] **Step 2: Add the failing semantic-hook and breakpoint tests**

Add these tests after `offers keyboard-safe evidence movement`:

```tsx
test("exposes responsive decision-canvas layout hooks", () => {
  const html = renderToStaticMarkup(
    <DecisionCanvas workspace={workspaceFixture()} disabled={false} actions={canvasActions} />,
  );

  assert.match(html, /class="research-decision-canvas"/);
  assert.match(html, /class="research-decision-canvas__lanes"/);
});

test("defines tablet and phone research-canvas layouts", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*280px minmax\(0, 1fr\) 320px;/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*1100px\)\s*\{[\s\S]*?\.research-project-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.research-decision-canvas__lanes\s*\{[^}]*grid-auto-flow:\s*row;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*overflow-x:\s*visible;/,
  );
});
```

- [ ] **Step 3: Run the focused test and verify red state**

Run:

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
```

Expected: the existing tests pass, while both new tests fail because the class hooks and media-query rules do not exist yet.

### Task 2: Implement the minimal responsive CSS layout

**Files:**
- Modify: `src/vitrine/components/ResearchProjectPage.tsx`
- Modify: `src/vitrine/components/DecisionCanvas.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Move the Research Project page layout to semantic classes**

In `ResearchProjectPage.tsx`, replace the opening `main` and workspace `div` elements with:

```tsx
<main className="research-project-page">
```

and:

```tsx
<div className="research-project-workspace">
```

Keep their children and order unchanged. Remove only the replaced inline layout objects.

- [ ] **Step 2: Move the Decision Canvas lane layout to semantic classes**

In `DecisionCanvas.tsx`, replace the root section opening tag with:

```tsx
<section aria-label="Decision canvas" className="research-decision-canvas">
```

Replace the lane collection opening tag with:

```tsx
<div className="research-decision-canvas__lanes">
```

Keep the lane sections, evidence cards, empty states, and controls unchanged. Remove only the replaced inline layout objects.

- [ ] **Step 3: Add the desktop and responsive layout rules**

Append this focused block to `src/vitrine/styles.css`:

```css
/* Research project workspace */
.research-project-page {
  max-width: 1500px;
  margin: 0 auto;
  padding: 24px 28px 64px;
}

.research-project-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.research-decision-canvas {
  min-width: 0;
}

.research-decision-canvas__lanes {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 1fr);
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 12px;
}

@media (max-width: 1100px) {
  .research-project-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .research-project-page {
    padding: 20px 16px 48px;
  }

  .research-decision-canvas__lanes {
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-template-columns: minmax(0, 1fr);
    overflow-x: visible;
  }
}
```

- [ ] **Step 4: Run the focused test and verify green state**

Run:

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
```

Expected: all Research Projects tests pass, including the semantic-hook and breakpoint assertions.

- [ ] **Step 5: Commit the tested layout change**

The working tree contains unrelated user changes, including earlier edits in `src/vitrine/styles.css`. Stage the three cleanly scoped files first, then interactively stage only the new `/* Research project workspace */` block from the stylesheet:

```bash
git add -- src/vitrine/ResearchProjects.test.tsx src/vitrine/components/ResearchProjectPage.tsx src/vitrine/components/DecisionCanvas.tsx
git add -p -- src/vitrine/styles.css
git diff --cached --check
git diff --cached --name-only
git diff --cached -- src/vitrine/styles.css
git commit -m "fix: make research canvas responsive"
```

At the `git add -p` prompt, accept only the hunk beginning with `/* Research project workspace */` and reject unrelated hunks. If Git combines it with an earlier stylesheet edit, use `s` to split the hunk; if it cannot split automatically, use `e` and retain only the added research-workspace lines. Expected staged paths are exactly the four paths listed above, and the cached stylesheet diff contains only the research-workspace block.

### Task 3: Verify behavior, build integrity, and visual parity

**Files:**
- Verify: `src/vitrine/ResearchProjects.test.tsx`
- Verify: `src/vitrine/components/ResearchProjectPage.tsx`
- Verify: `src/vitrine/components/DecisionCanvas.tsx`
- Verify: `src/vitrine/styles.css`
- Output: `/tmp/astryx-research-audit-2026-07-18/05-desktop-canvas-fixed.png`
- Output: `/tmp/astryx-research-audit-2026-07-18/06-mobile-canvas-fixed.png`

- [ ] **Step 1: Run focused and project-level automated checks**

Run:

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
npx tsc --noEmit
npm run build
```

Expected: every command exits with status 0. The focused test reports all Research Projects tests passing, TypeScript emits no diagnostics, and Vite finishes with `built in` output.

- [ ] **Step 2: Start the isolated local API on port 3011**

Use the local QA database rather than the pre-existing API on port 3010, which is connected to the remote Supabase database:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/astryx_research_qa \
PORT=3011 NODE_ENV=development \
OBJECT_STORE_BACKEND=local \
OBJECT_STORE_LOCAL_ROOT=/tmp/astryx-research-qa-objects \
ADMIN_EMAIL=designer@astryx.local \
ADMIN_PASSWORD=astryx-local-qa-password \
STRIPE_SECRET_KEY=sk_test_local_placeholder \
STRIPE_WEBHOOK_SECRET=whsec_local_placeholder \
STRIPE_PRO_MONTHLY_PRICE_ID=price_local_monthly \
STRIPE_PRO_YEARLY_PRICE_ID=price_local_yearly \
APP_URL=http://127.0.0.1:5174 \
MEDIA_SIGNING_SECRET=local-media-signing-secret-32-bytes \
CRAWL_SESSION_ENCRYPTION_KEY=i4cY3peMFMHgctXIOGOELMMaZI+PjSsh8e/rU9bgmBU= \
RESEARCH_PROJECTS_ENABLED=true \
node --import tsx services/api/src/index.ts
```

Expected: the API listens on `http://127.0.0.1:3011` without contacting the remote database.

- [ ] **Step 3: Start Vite against the isolated API**

Run in another shell:

```bash
PORT=5174 VITRINE_API_TARGET=http://127.0.0.1:3011 VITE_RESEARCH_PROJECTS_ENABLED=true \
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

Expected: Vite serves the app at `http://127.0.0.1:5174`.

- [ ] **Step 4: Capture desktop and phone states with the approved local Chrome path**

Run:

```bash
node --input-type=module <<'NODE'
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const outputDir = "/tmp/astryx-research-audit-2026-07-18";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const desktopPage = await desktop.newPage();
await desktopPage.goto("http://127.0.0.1:5174", { waitUntil: "domcontentloaded" });
await desktopPage.getByRole("textbox", { name: "Email", exact: true }).fill("designer@astryx.local");
await desktopPage.getByRole("textbox", { name: "Password", exact: true }).fill("astryx-local-qa-password");
await desktopPage.getByRole("button", { name: /sign in/i }).click();
await desktopPage.getByRole("heading", { name: "Research projects", exact: true }).waitFor();
await desktopPage.getByRole("button", { name: /Checkout patterns/ }).click();
await desktopPage.getByRole("heading", { name: "Checkout patterns", exact: true }).waitFor();
await desktopPage.screenshot({ path: `${outputDir}/05-desktop-canvas-fixed.png`, fullPage: true });
const storageState = await desktop.storageState();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState });
const mobilePage = await mobile.newPage();
await mobilePage.goto("http://127.0.0.1:5174", { waitUntil: "domcontentloaded" });
await mobilePage.getByRole("heading", { name: "Research projects", exact: true }).waitFor();
await mobilePage.getByRole("button", { name: /Checkout patterns/ }).click();
await mobilePage.getByRole("heading", { name: "Checkout patterns", exact: true }).waitFor();
await mobilePage.screenshot({ path: `${outputDir}/06-mobile-canvas-fixed.png`, fullPage: true });

const metrics = await mobilePage.evaluate(() => {
  const workspace = document.querySelector(".research-project-workspace");
  if (!(workspace instanceof HTMLElement)) throw new Error("Research workspace not found");
  const childRects = [...workspace.children].map((element) => element.getBoundingClientRect());
  return {
    viewportWidth: window.innerWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    childTops: childRects.map((rect) => rect.top),
    childrenFitWidth: childRects.every((rect) => rect.left >= 0 && rect.right <= window.innerWidth),
  };
});

if (metrics.pageScrollWidth !== metrics.viewportWidth) throw new Error(`Horizontal page overflow: ${JSON.stringify(metrics)}`);
if (!metrics.childrenFitWidth) throw new Error(`Workspace child clipped: ${JSON.stringify(metrics)}`);
if (!(metrics.childTops[0] < metrics.childTops[1] && metrics.childTops[1] < metrics.childTops[2])) {
  throw new Error(`Workspace order is not vertical: ${JSON.stringify(metrics)}`);
}

await browser.close();
console.log(metrics);
NODE
```

Expected: the script prints a 390px viewport and page width, `childrenFitWidth: true`, and three strictly increasing child top positions.

- [ ] **Step 5: Inspect the visual result against the existing references**

Compare:

- Desktop reference: `/tmp/astryx-research-audit-2026-07-18/03-decision-canvas.png`
- Desktop result: `/tmp/astryx-research-audit-2026-07-18/05-desktop-canvas-fixed.png`
- Mobile broken reference: `/tmp/astryx-research-audit-2026-07-18/04-mobile-canvas.png`
- Mobile result: `/tmp/astryx-research-audit-2026-07-18/06-mobile-canvas-fixed.png`

Acceptance criteria:

- Desktop retains Evidence, Comparison lanes, and Designer decision in one row with the existing widths and spacing.
- Mobile shows Evidence, Comparison lanes, Alternative A, Alternative B, and Designer decision in normal vertical flow.
- No content is cropped at the right edge and no page-level horizontal scrollbar is introduced.
- Existing typography, colors, borders, radii, controls, and content remain unchanged.

- [ ] **Step 6: Confirm the final diff remains scoped**

Run:

```bash
git show --stat --oneline HEAD
git status --short
```

Expected: the implementation commit contains only the four responsive-layout files. Other pre-existing working-tree changes remain untouched and uncommitted.
