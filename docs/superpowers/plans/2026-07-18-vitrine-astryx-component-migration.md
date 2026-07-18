# Vitrine Astryx Component Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@astryxdesign/core` the sole source of reusable Vitrine UI primitives while preserving all existing behavior, layout, accessibility, and product-specific component boundaries.

**Architecture:** Keep domain composites local and replace their internal generic controls with direct Astryx imports. Use a TypeScript-AST compliance test with an exact, shrinking baseline so every migration batch starts red and ends green; do not introduce a compatibility component layer. Preserve Framer Motion, GSAP, and Recharts for specialized animation and visualization.

**Tech Stack:** React 19, TypeScript, Vite, `@astryxdesign/core` 0.1.4, Node test runner, `tsx`, TypeScript compiler API, Storybook.

---

## File structure

- Create `src/vitrine/astryxComponentCompliance.test.ts` to own the source-level native-control guard.
- Modify existing production components under `src/vitrine` in six behavior-focused batches.
- Modify existing Vitrine tests only where Astryx changes the rendered DOM contract while preserving user-observable behavior.
- Do not add generic wrappers. Local product composites continue to own product behavior and import Astryx primitives directly.
- Do not touch the four local diagnostic scripts: `_caption_retry_tmp.ts`, `src/_diag_context_theory.ts`, `src/_login_window.ts`, and `src/_login_window_prefill.ts`.

### Task 1: Add the exact native-control compliance baseline

**Files:**
- Create: `src/vitrine/astryxComponentCompliance.test.ts`

- [ ] **Step 1: Add the AST inventory test with the audited baseline**

Create a Node test that parses production Vitrine TSX with TypeScript, counts JSX `button`, `input`, `textarea`, and `select` elements, excludes test/story files, and compares the result to this exact baseline:

```ts
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const vitrineRoot = dirname(fileURLToPath(import.meta.url));
const nativeTags = new Set(['button', 'input', 'textarea', 'select']);

const allowedNativeControls = {
  'Home.tsx': {button: 9, input: 1},
  'Pricing.tsx': {button: 6},
  'SignIn.tsx': {button: 2},
  'components/ArrowButton.tsx': {button: 1},
  'components/CollectionsPanel.tsx': {button: 5, input: 1, textarea: 1},
  'components/CommandPalette.tsx': {button: 6, input: 1},
  'components/CrawlWorkspacePanel.tsx': {button: 15, input: 9, textarea: 2, select: 2},
  'components/CuratorReviewPanel.tsx': {button: 8},
  'components/DecisionCanvas.tsx': {button: 2, input: 1, textarea: 1},
  'components/EvidenceCard.tsx': {button: 4, input: 2, textarea: 1},
  'components/EvidenceDrawer.tsx': {button: 2, input: 2, select: 1},
  'components/ExportPanel.tsx': {button: 4, input: 2},
  'components/FilterChips.tsx': {button: 1},
  'components/FlowDocEditor.tsx': {button: 3, textarea: 1},
  'components/FlowViewer.tsx': {button: 1},
  'components/FlowsPanel.tsx': {button: 1},
  'components/HeroButton.tsx': {button: 1},
  'components/Lightbox.tsx': {button: 1},
  'components/ProjectInsightsPanel.tsx': {button: 4, textarea: 4},
  'components/ResearchProjectPage.tsx': {button: 2},
  'components/ResearchProjectsPage.tsx': {button: 3, input: 2, select: 1},
  'components/ScreenDetail.tsx': {button: 4},
  'components/ScrollToTopButton.tsx': {button: 1},
  'components/SearchInput.tsx': {button: 1, input: 1},
  'components/SearchResults.tsx': {button: 1},
  'components/SearchTrigger.tsx': {button: 2},
  'components/SettingsPanel.tsx': {button: 3, input: 2},
  'components/VersionPanel.tsx': {button: 5, input: 1},
} as const;

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true})
    .flatMap(entry => entry.isDirectory()
      ? productionTsxFiles(resolve(directory, entry.name))
      : [resolve(directory, entry.name)])
    .filter(file => file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('.stories.'))
    .sort();
}

function controlsIn(file: string): Record<string, number> {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const counts: Record<string, number> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (nativeTags.has(tag)) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return counts;
}

test('Vitrine native interactive controls match the shrinking Astryx migration baseline', () => {
  const actual = Object.fromEntries(
    productionTsxFiles(vitrineRoot)
      .map(file => [relative(vitrineRoot, file), controlsIn(file)] as const)
      .filter(([, counts]) => Object.keys(counts).length > 0),
  );
  assert.deepEqual(actual, allowedNativeControls);
});

test('every native-control baseline entry names an existing production file', () => {
  for (const file of Object.keys(allowedNativeControls)) {
    assert.equal(existsSync(resolve(vitrineRoot, file)), true, `${file} does not exist`);
  }
});
```

Node's deep-equality diff provides the readable per-file mismatch. The second assertion prevents deleted or renamed files from silently remaining allowlisted.

- [ ] **Step 2: Run the guard and verify the characterization passes**

Run: `node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts`

Expected: PASS with the current audited inventory.

- [ ] **Step 3: Commit the characterization test**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts
git commit -m "test: guard Vitrine Astryx component adoption"
```

### Task 2: Migrate shared leaf controls and overlays

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/components/ArrowButton.tsx`
- Modify: `src/vitrine/components/FilterChips.tsx`
- Modify: `src/vitrine/components/FlowViewer.tsx`
- Modify: `src/vitrine/components/HeroButton.tsx`
- Modify: `src/vitrine/components/Lightbox.tsx`
- Modify: `src/vitrine/components/ScrollToTopButton.tsx`
- Modify: `src/vitrine/components/SearchInput.tsx`
- Modify: `src/vitrine/components/SearchResults.tsx`
- Modify: `src/vitrine/components/SearchTrigger.tsx`
- Test: `src/vitrine/ResearchTools.test.tsx`
- Test: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Remove the nine leaf files from the compliance baseline**

Delete their entries from `allowedNativeControls` before modifying production code.

- [ ] **Step 2: Run the guard and verify RED**

Run: `node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts`

Expected: FAIL listing the nine files and their remaining native controls.

- [ ] **Step 3: Replace the leaf primitives**

Use these direct mappings:

```tsx
<IconButton label={accessibleName} icon={<Icon name={iconName} />} variant="ghost" size="sm" onClick={handler} />
<Button label={visibleLabel} variant="ghost" size="sm" onClick={handler} />
<TextInput label="Search" isLabelHidden value={query} onChange={onQueryChange} width="100%" />
```

Keep the local `Lightbox` composite because it owns `PlaceholderImage` fallback behavior, but render its overlay through Astryx `Dialog` and its controls through `IconButton`. Keep `FilterChips` as a local animated product composite and replace its native buttons with Astryx `ToggleButton` using the current selected-state semantics.

- [ ] **Step 4: Run focused tests and the guard**

Run:

```bash
npx tsx --test src/vitrine/ResearchTools.test.tsx src/vitrine/ScreenDetail.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

Expected: all commands PASS.

- [ ] **Step 5: Commit the shared-control migration**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/components/ArrowButton.tsx src/vitrine/components/FilterChips.tsx src/vitrine/components/FlowViewer.tsx src/vitrine/components/HeroButton.tsx src/vitrine/components/Lightbox.tsx src/vitrine/components/ScrollToTopButton.tsx src/vitrine/components/SearchInput.tsx src/vitrine/components/SearchResults.tsx src/vitrine/components/SearchTrigger.tsx src/vitrine/ResearchTools.test.tsx src/vitrine/ScreenDetail.test.tsx
git commit -m "refactor: use Astryx shared interaction controls"
```

### Task 3: Migrate feature panels and forms

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/components/CollectionsPanel.tsx`
- Modify: `src/vitrine/components/CuratorReviewPanel.tsx`
- Modify: `src/vitrine/components/ExportPanel.tsx`
- Modify: `src/vitrine/components/FlowDocEditor.tsx`
- Modify: `src/vitrine/components/FlowsPanel.tsx`
- Modify: `src/vitrine/components/SettingsPanel.tsx`
- Modify: `src/vitrine/components/VersionPanel.tsx`
- Test: `src/vitrine/ResearchTools.test.tsx`
- Test: `src/vitrine/components/FlowsPanel.test.tsx`

- [ ] **Step 1: Remove the seven feature-panel files from the compliance baseline**

- [ ] **Step 2: Run the guard and verify RED**

Expected failure: the guard reports native actions and fields in all seven files.

- [ ] **Step 3: Replace panel primitives while preserving behavior**

Use `Card` for bordered panel surfaces, `Button` for visible actions, `IconButton` for icon-only close actions, `TextInput` and `TextArea` for controlled fields, and `CheckboxInput` for export-scope checkboxes. Use `clickAction` for existing async save, delete, publish, and export actions so Astryx owns the pending state without changing the underlying API call.

```tsx
<TextArea label="Document" isLabelHidden value={source} onChange={setSource} rows={24} width="100%" />
<CheckboxInput label={component.name} value={selectedComponents.includes(component.id)} onChange={checked => updateSelection(component.id, checked)} />
<Button label="Save" variant="primary" isDisabled={!dirty} clickAction={save} />
```

Do not add confirmation dialogs or change destructive-action behavior in this refactor.

- [ ] **Step 4: Run focused tests, guard, and TypeScript**

```bash
npx tsx --test src/vitrine/ResearchTools.test.tsx src/vitrine/components/FlowsPanel.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit the panel migration**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/components/CollectionsPanel.tsx src/vitrine/components/CuratorReviewPanel.tsx src/vitrine/components/ExportPanel.tsx src/vitrine/components/FlowDocEditor.tsx src/vitrine/components/FlowsPanel.tsx src/vitrine/components/SettingsPanel.tsx src/vitrine/components/VersionPanel.tsx src/vitrine/ResearchTools.test.tsx src/vitrine/components/FlowsPanel.test.tsx
git commit -m "refactor: use Astryx components in feature panels"
```

### Task 4: Migrate the Research Project workflow

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/components/DecisionCanvas.tsx`
- Modify: `src/vitrine/components/EvidenceCard.tsx`
- Modify: `src/vitrine/components/EvidenceDrawer.tsx`
- Modify: `src/vitrine/components/ProjectInsightsPanel.tsx`
- Modify: `src/vitrine/components/ResearchProjectPage.tsx`
- Modify: `src/vitrine/components/ResearchProjectsPage.tsx`
- Test: `src/vitrine/ResearchProjects.test.tsx`

- [ ] **Step 1: Remove the six Research Project files from the compliance baseline**

- [ ] **Step 2: Run the guard and verify RED**

Expected failure: native buttons, text fields, textareas, selectors, checkboxes, and file input remain in the six files.

- [ ] **Step 3: Replace Research Project primitives**

Use `TextInput` for project title, research question, and lane title; `Selector` for platform and target lane; `TextArea` for conclusions, notes, constraints, decision, rationale, and open questions; `CheckboxInput` for importance; `FileInput` for private screenshots; `Card`/`ClickableCard` for project and evidence surfaces; and `Button`/`IconButton` for actions.

```tsx
<FileInput
  label="Upload private screenshot"
  value={uploadFile}
  onChange={file => setUploadFile(file as File | null)}
  changeAction={async file => upload(file as File | null)}
  accept="image/png,image/jpeg,image/webp"
  maxSize={RESEARCH_LIMITS.uploadBytesMax}
  isDisabled={disabled}
/>
```

Preserve revision-conflict handling, lane ordering, blur-triggered lane saves, citation behavior, and the responsive class names added by the previous responsive-layout work.

- [ ] **Step 4: Run the Research Project tests, guard, and TypeScript**

```bash
npx tsx --test src/vitrine/ResearchProjects.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit the Research Project migration**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/components/DecisionCanvas.tsx src/vitrine/components/EvidenceCard.tsx src/vitrine/components/EvidenceDrawer.tsx src/vitrine/components/ProjectInsightsPanel.tsx src/vitrine/components/ResearchProjectPage.tsx src/vitrine/components/ResearchProjectsPage.tsx src/vitrine/ResearchProjects.test.tsx
git commit -m "refactor: compose research projects from Astryx"
```

### Task 5: Migrate catalog navigation and command surfaces

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/components/CommandPalette.tsx`
- Modify: `src/vitrine/components/ScreenDetail.tsx`
- Test: `src/vitrine/ScreenDetail.test.tsx`

- [ ] **Step 1: Remove `CommandPalette.tsx` and `ScreenDetail.tsx` from the baseline**

- [ ] **Step 2: Run the guard and verify RED**

- [ ] **Step 3: Replace command and detail controls**

Keep `CommandPalette` as the product-specific command composite, render its modal shell with Astryx `Dialog`, and use `TextInput`, `Button`, `IconButton`, `Selector`, and `SegmentedControl` inside it. Convert Screen Detail section switching to Astryx `SegmentedControl`/`SegmentedControlItem` and convert navigation/lightbox actions to `Button` or `IconButton`.

Preserve Escape handling, initial input focus, arrow-key navigation, selected section, collection state, and lazy design-system loading.

- [ ] **Step 4: Run focused tests, guard, and TypeScript**

```bash
npx tsx --test src/vitrine/ScreenDetail.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit catalog navigation**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/components/CommandPalette.tsx src/vitrine/components/ScreenDetail.tsx src/vitrine/ScreenDetail.test.tsx
git commit -m "refactor: use Astryx catalog navigation controls"
```

### Task 6: Migrate the crawler operations workspace

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/components/CrawlWorkspacePanel.tsx`
- Test: `src/vitrine/CrawlWorkspacePanel.test.tsx`

- [ ] **Step 1: Remove `CrawlWorkspacePanel.tsx` from the compliance baseline**

- [ ] **Step 2: Run the guard and verify RED**

Expected failure: 15 buttons, 9 inputs, 2 textareas, and 2 selects remain.

- [ ] **Step 3: Replace every crawler control with an Astryx primitive**

Map text and URL fields to `TextInput`, plan/reason fields to `TextArea`, mode/state choices to `Selector`, acknowledgements to `CheckboxInput`, and run/repair/review actions to `Button`. Use `Card`, `Badge`, `Text`, `Heading`, and existing Astryx feedback components for repeated run, step, failure, and repair surfaces.

Preserve admin gating, secret-name handling, plan revision rules, safe/unsafe acknowledgement dependencies, polling, run recovery, exact failure-object pinning, and separate propose/apply/reject actions.

- [ ] **Step 4: Run crawler tests, guard, and TypeScript**

```bash
npx tsx --test src/vitrine/CrawlWorkspacePanel.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit crawler workspace migration**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/components/CrawlWorkspacePanel.tsx src/vitrine/CrawlWorkspacePanel.test.tsx
git commit -m "refactor: use Astryx crawler workspace controls"
```

### Task 7: Migrate public Home, Pricing, and Sign In controls

**Files:**
- Modify: `src/vitrine/astryxComponentCompliance.test.ts`
- Modify: `src/vitrine/Home.tsx`
- Modify: `src/vitrine/Pricing.tsx`
- Modify: `src/vitrine/SignIn.tsx`
- Test: `src/vitrine/SignIn.test.tsx`

- [ ] **Step 1: Remove the final three files from the compliance baseline**

At this point `allowedNativeControls` must become an empty object.

- [ ] **Step 2: Run the guard and verify RED**

Expected failure: Home, Pricing, and Sign In report their remaining controls.

- [ ] **Step 3: Replace public-page actions and fields**

Use `Button` for visible navigation/CTA actions, `IconButton` for icon-only search and password-visibility actions, `TextInput` for text entry, and existing Astryx typography/navigation components for reusable content. Keep the current GSAP motion hooks, responsive composition, route callbacks, validation messages, and authentication behavior.

Astryx variants may replace one-off border/background styling, but layout styles that position animated artwork, pricing sections, or responsive navigation remain local.

- [ ] **Step 4: Run public-page tests, guard, and TypeScript**

```bash
npx tsx --test src/vitrine/SignIn.test.tsx
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
npx tsc --noEmit
```

Expected: the compliance guard passes with zero allowed native controls.

- [ ] **Step 5: Commit public-page migration**

```bash
git add src/vitrine/astryxComponentCompliance.test.ts src/vitrine/Home.tsx src/vitrine/Pricing.tsx src/vitrine/SignIn.tsx src/vitrine/SignIn.test.tsx
git commit -m "refactor: use Astryx components on public pages"
```

### Task 8: Migrate reusable surfaces and typography

**Files:**
- Modify: `src/vitrine/components/AppCard.tsx`
- Modify: `src/vitrine/components/ElementCard.tsx`
- Modify: `src/vitrine/components/FlowCard.tsx`
- Modify: `src/vitrine/components/ImportingAppCard.tsx`
- Modify: `src/vitrine/components/OverviewPanel.tsx`
- Modify: `src/vitrine/components/ScreenGridCard.tsx`
- Modify: `src/vitrine/components/PlaceholderImage.tsx`
- Test: `src/vitrine/DesignSystemPanel.test.tsx`
- Test: `src/vitrine/components/ComponentsPanel.test.tsx`
- Test: `src/vitrine/components/FlowsPanel.test.tsx`
- Test: `src/vitrine/ImportDialog.test.tsx`

- [ ] **Step 1: Add behavior assertions for interactive and informational cards**

Assert that an app or screen card remains keyboard-accessible through its Astryx `ClickableCard`, that nested secondary actions do not trigger the card action, and that loading/empty card states retain their current accessible labels.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx tsx --test src/vitrine/DesignSystemPanel.test.tsx src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/ImportDialog.test.tsx`

Expected: at least one new card-semantic assertion fails before migration.

- [ ] **Step 3: Replace reusable surfaces and text primitives**

Use `ClickableCard` for whole-card navigation/action, `Card` for bordered informational surfaces, and Astryx `Heading`, `Text`, `Badge`, `EmptyState`, `Skeleton`, and `Spinner` for repeated content states. Preserve Framer Motion by wrapping or rendering motion around Astryx surfaces without reimplementing their border/state styling.

Keep `PlaceholderImage` local because it implements protected-media fallback behavior, not a generic UI primitive.

- [ ] **Step 4: Run focused tests and TypeScript**

```bash
npx tsx --test src/vitrine/DesignSystemPanel.test.tsx src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/ImportDialog.test.tsx
npx tsc --noEmit
```

- [ ] **Step 5: Commit the surface migration**

```bash
git add src/vitrine/components/AppCard.tsx src/vitrine/components/ElementCard.tsx src/vitrine/components/FlowCard.tsx src/vitrine/components/ImportingAppCard.tsx src/vitrine/components/OverviewPanel.tsx src/vitrine/components/ScreenGridCard.tsx src/vitrine/components/PlaceholderImage.tsx src/vitrine/DesignSystemPanel.test.tsx src/vitrine/components/ComponentsPanel.test.tsx src/vitrine/components/FlowsPanel.test.tsx src/vitrine/ImportDialog.test.tsx
git commit -m "refactor: use Astryx surfaces across Vitrine"
```

### Task 9: Remove obsolete primitive styles and verify the whole frontend

**Files:**
- Modify: production Vitrine files touched above only where unused primitive style constants remain
- Modify: `src/vitrine/styles.css` only for now-unused primitive selectors; preserve layout, responsive, motion, and token rules
- Test: `src/vitrine/astryxComponentCompliance.test.ts`

- [ ] **Step 1: Remove dead primitive styles and imports**

Delete only style objects and CSS selectors that became unreferenced through the migration. Do not run a broad formatter or rewrite unrelated styles.

- [ ] **Step 2: Verify source compliance**

Run:

```bash
node --experimental-strip-types --test src/vitrine/astryxComponentCompliance.test.ts
rg -n "<(button|input|textarea|select)([[:space:]>])" src/vitrine -g '*.tsx' -g '!*.test.tsx' -g '!*.stories.tsx'
```

Expected: guard PASS; `rg` returns no production matches other than comments, if any.

- [ ] **Step 3: Run complete automated verification**

```bash
npm test
npx tsc --noEmit
npm run build
npm run build-storybook
```

Expected: all tests pass, TypeScript exits 0, Vite build exits 0, and Storybook build exits 0. The existing Vite large-chunk warning is non-blocking.

- [ ] **Step 4: Run visual and interaction verification**

Start the existing Vite app and inspect representative public, catalog, admin/crawler, and populated Research Project states at 1440px and 390px. Check focus visibility, selectors, text inputs, textareas, checkboxes, file upload, loading/disabled states, dialogs, card activation, and page-level horizontal overflow. Compare pre- and post-migration screenshots at matching viewports and states; fix unintended differences before completion.

- [ ] **Step 5: Review the final diff and commit cleanup**

```bash
git diff --check
git status --short
git add -u -- src/vitrine
git commit -m "refactor: complete Astryx component adoption"
```

- [ ] **Step 6: Push the completed feature branch**

```bash
git push origin feat/flow-md-and-teams-foundation
```

Expected: local `HEAD` and `origin/feat/flow-md-and-teams-foundation` resolve to the same commit; the four diagnostic scripts remain untracked and are not pushed.
