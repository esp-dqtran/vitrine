# Shared Apps and Sites Discovery Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Apps and Sites ordering controls through one shared toolbar with the Apps active-tab animation, no Sites Filter button, and no toolbar bottom border.

**Architecture:** Add a small controlled `ReferenceDiscoveryToolbar` component that owns the common toolbar and ordering-tab markup while each page retains its own sort state. Apps passes its platform pill as the optional leading control; Sites renders only its ordering tabs. Move common toolbar and sort styling to shared CSS selectors and keep platform styling scoped to Apps.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core`, CSS, Node test runner, server-rendered React boundary tests.

---

## File Structure

- Create `src/vitrine/components/ReferenceDiscoveryToolbar.tsx`: shared controlled toolbar and sort-tab markup.
- Modify `src/vitrine/components/AppsDiscoveryPage.tsx`: replace inline Apps toolbar markup with the shared component.
- Modify `src/vitrine/components/SitesPage.tsx`: remove Filter state/actions and render the shared component.
- Modify `src/vitrine/AppsDiscovery.test.tsx`: verify Apps uses the shared toolbar and shared animation CSS.
- Modify `src/vitrine/Sites.test.tsx`: verify Sites uses the shared toolbar and no longer renders Filter.
- Modify `src/vitrine/styles.css`: consolidate toolbar/sort CSS and remove the bottom border.

Preserve the existing uncommitted Sites loading-state fix and do not touch `scripts/login-wait.png`. Do not commit or push unless the user explicitly requests it.

### Task 1: Shared Discovery Toolbar Component

**Files:**
- Create: `src/vitrine/components/ReferenceDiscoveryToolbar.tsx`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write the failing shared-toolbar rendering assertions**

In `src/vitrine/AppsDiscovery.test.tsx`, extend `renders the Mobbin Apps taxonomy, controls, grid, and media-first card` with:

```ts
assert.match(html, /data-reference-discovery-toolbar="true"/);
assert.match(html, /class="reference-discovery-toolbar__sort"/);
assert.match(html, /aria-label="App ordering"/);
```

- [ ] **Step 2: Run the focused Apps test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: FAIL because the Apps page does not render `data-reference-discovery-toolbar="true"`.

- [ ] **Step 3: Create the controlled shared component**

Create `src/vitrine/components/ReferenceDiscoveryToolbar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core';

interface ReferenceDiscoveryToolbarOption<T extends string> {
  value: T;
  label: string;
}

interface ReferenceDiscoveryToolbarProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<ReferenceDiscoveryToolbarOption<T>>;
  onChange: (value: T) => void;
  leading?: ReactNode;
}

export function ReferenceDiscoveryToolbar<T extends string>({
  label,
  value,
  options,
  onChange,
  leading,
}: ReferenceDiscoveryToolbarProps<T>) {
  return (
    <div data-reference-discovery-toolbar="true" className="reference-discovery-toolbar">
      {leading}
      <div role="tablist" aria-label={label} className="reference-discovery-toolbar__sort">
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace the inline Apps ordering toolbar**

In `src/vitrine/components/AppsDiscoveryPage.tsx`, add:

```ts
import { ReferenceDiscoveryToolbar } from './ReferenceDiscoveryToolbar.tsx';
```

Replace the existing `<div className="apps-discovery__toolbar">...</div>` with:

```tsx
<ReferenceDiscoveryToolbar
  label="App ordering"
  value={sort}
  options={[
    { value: 'latest', label: 'Latest' },
    { value: 'popular', label: 'Most popular' },
    { value: 'rated', label: 'Top rated' },
    { value: 'animations', label: 'Animations' },
  ]}
  onChange={setSort}
  leading={(
    <div role="radiogroup" aria-label="App platform" className="apps-discovery__platform">
      {(['ios', 'web'] as const).map((value) => (
        <Button
          key={value}
          label={value === 'ios' ? 'iOS' : 'Web'}
          variant="ghost"
          size="sm"
          role="radio"
          aria-checked={platform === value}
          onClick={() => setPlatform(value)}
        />
      ))}
    </div>
  )}
/>
```

- [ ] **Step 5: Run the focused Apps test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx
```

Expected: all Apps discovery tests PASS.

### Task 2: Sites Integration and Shared Styling

**Files:**
- Modify: `src/vitrine/components/SitesPage.tsx`
- Modify: `src/vitrine/styles.css`
- Test: `src/vitrine/Sites.test.tsx`
- Test: `src/vitrine/AppsDiscovery.test.tsx`

- [ ] **Step 1: Write failing Sites toolbar assertions**

In `src/vitrine/Sites.test.tsx`, extend `renders the Mobbin Sites catalog taxonomy and a semantic full-card link` with:

```ts
assert.match(html, /data-reference-discovery-toolbar="true"/);
assert.match(html, /class="reference-discovery-toolbar__sort"/);
assert.match(html, /aria-label="Site ordering"/);
assert.doesNotMatch(html, />Filter</);
assert.doesNotMatch(html, /sites-discovery__toolbar-actions/);
```

- [ ] **Step 2: Replace the Apps-specific CSS test with a shared-toolbar test**

In `src/vitrine/AppsDiscovery.test.tsx`, replace `styles Apps ordering labels gray with white hover and an animated active state` with:

```ts
test('shares animated discovery ordering styles without a bottom border', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const toolbarRule = css.match(/\.reference-discovery-toolbar\s*\{[^}]+\}/)?.[0] ?? '';

  assert.match(toolbarRule, /border-top:\s*1px solid var\(--color-border\)/);
  assert.doesNotMatch(toolbarRule, /border-bottom/);
  assert.match(css, /\.reference-discovery-toolbar__sort button\s*\{[\s\S]*color:\s*var\(--color-text-secondary\)\s*!important;[\s\S]*transition:\s*color/);
  assert.match(css, /\.reference-discovery-toolbar__sort button:hover,[\s\S]*\.reference-discovery-toolbar__sort button:focus-visible,[\s\S]*\.reference-discovery-toolbar__sort button\[aria-selected='true'\]\s*\{[\s\S]*background:\s*transparent\s*!important;[\s\S]*color:\s*var\(--color-text-primary\)\s*!important/);
  assert.match(css, /\.reference-discovery-toolbar__sort button::after\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*scaleX\([\d.]+\);[\s\S]*transition:/);
  assert.match(css, /\.reference-discovery-toolbar__sort button\[aria-selected='true'\]::after\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleX\(1\)/);
});
```

- [ ] **Step 3: Run the Apps and Sites tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: FAIL because Sites still renders its own toolbar and Filter button, and the shared CSS selectors do not exist.

- [ ] **Step 4: Render Sites through the shared component**

In `src/vitrine/components/SitesPage.tsx`, add:

```ts
import { ReferenceDiscoveryToolbar } from './ReferenceDiscoveryToolbar.tsx';
```

Remove:

```ts
const [filtersOpen, setFiltersOpen] = useState(true);
```

Change:

```tsx
{filtersOpen ? <div className="sites-discovery__taxonomy" aria-label="Site discovery filters">
```

to:

```tsx
<div className="sites-discovery__taxonomy" aria-label="Site discovery filters">
```

Change the taxonomy closing token from:

```tsx
</div> : null}
```

to:

```tsx
</div>
```

Replace the existing `sites-discovery__toolbar` block with:

```tsx
<ReferenceDiscoveryToolbar
  label="Site ordering"
  value={sort}
  options={[
    { value: 'latest', label: 'Latest' },
    { value: 'popular', label: 'Most popular' },
  ]}
  onChange={setSort}
/>
```

This removes the Filter button and toolbar clear action. Clicking the selected taxonomy value continues to clear the active facet through the existing `setFacet(selected ? null : ...)` handler.

- [ ] **Step 5: Consolidate the toolbar CSS**

In `src/vitrine/styles.css`, remove every legacy and Mobbin-fidelity declaration whose selector targets `.sites-discovery__toolbar`, `.sites-discovery__sort`, `.sites-discovery__sort button`, `.sites-discovery__sort button[aria-selected='true']`, `.sites-discovery__sort button[aria-selected='true']::after`, `.sites-discovery__toolbar-actions`, or `.sites-discovery__clear`. Also remove `.sites-discovery__sort button` and `.sites-discovery__clear` from the older combined button selector while preserving `.sites-discovery__facet button` and all Site-detail selectors.

Replace the Apps toolbar and sort selectors with:

```css
.reference-discovery-toolbar {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 24px;
  border-top: 1px solid var(--color-border);
}

.reference-discovery-toolbar__sort {
  min-width: 0;
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 25px;
  overflow-x: auto;
}

.reference-discovery-toolbar__sort button {
  position: relative;
  min-width: max-content !important;
  height: 64px !important;
  padding: 0 !important;
  color: var(--color-text-secondary) !important;
  font-size: 14px !important;
  transition: color 180ms ease;
}

.reference-discovery-toolbar__sort button:hover,
.reference-discovery-toolbar__sort button:focus-visible,
.reference-discovery-toolbar__sort button[aria-selected='true'] {
  background: transparent !important;
  color: var(--color-text-primary) !important;
}

.reference-discovery-toolbar__sort button::after {
  position: absolute;
  right: 0;
  bottom: 13px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--color-text-primary);
  content: '';
  opacity: 0;
  transform: scaleX(.45);
  transition: opacity 180ms ease, transform 220ms cubic-bezier(.2, .8, .2, 1);
}

.reference-discovery-toolbar__sort button[aria-selected='true']::after {
  opacity: 1;
  transform: scaleX(1);
}
```

Update the reduced-motion rule to:

```css
@media (prefers-reduced-motion: reduce) {
  .apps-discovery__platform::before,
  .apps-discovery__platform button,
  .reference-discovery-toolbar__sort button,
  .reference-discovery-toolbar__sort button::after {
    transition: none;
  }
}
```

Remove responsive selectors that reference `.sites-discovery__toolbar`, `.sites-discovery__sort button`, or `.sites-discovery__toolbar-actions`. The shared toolbar keeps a single row and its sort list scrolls horizontally at narrow widths.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx
```

Expected: all Apps and Sites tests PASS.

- [ ] **Step 7: Run final verification**

Run:

```bash
npx tsx --test src/vitrine/AppsDiscovery.test.tsx src/vitrine/Sites.test.tsx src/vitrine/App.boundary.test.ts
npm run build
git diff --check
git status --short
```

Expected:

- all selected tests pass with zero failures;
- the production build exits successfully, allowing the existing chunk-size advisory;
- `git diff --check` emits no output;
- only the requested toolbar work, the existing Sites loading fix, the approved spec/plan, and the unrelated pre-existing `scripts/login-wait.png` appear in status.

Do not commit or push unless the user explicitly requests it.
