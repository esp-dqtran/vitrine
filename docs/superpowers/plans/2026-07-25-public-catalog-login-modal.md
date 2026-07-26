# Public Catalog Login Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two public catalog authentication actions with one primary Login button that opens the existing authentication experience in a modal without changing routes.

**Architecture:** Give `SignIn` an embedded presentation mode so the same authentication behavior can serve both `/signin` and a dialog. Add a small `LoginDialog` wrapper, then let `App` own its open state and auth-context wiring. Keep the dialog adjacent to public Apps and Sites page content so it is available from either shared header.

**Tech Stack:** React 19, TypeScript, `@astryxdesign/core` Dialog, existing AuthProvider, Node test runner, server-rendered React and source-boundary tests.

---

## File Structure

- Modify `src/vitrine/components/GuestCatalogControls.tsx`: render one primary Login action.
- Modify `src/vitrine/GuestCatalogControls.test.tsx`: verify the single-button contract.
- Modify `src/vitrine/SignIn.tsx`: add embedded layout behavior without changing authentication logic.
- Modify `src/vitrine/SignIn.test.tsx`: verify page and embedded presentation boundaries.
- Create `src/vitrine/components/LoginDialog.tsx`: wrap embedded SignIn in a controlled Dialog.
- Create `src/vitrine/LoginDialog.test.tsx`: verify dialog markup and embedded form reuse.
- Modify `src/vitrine/App.tsx`: own modal state and connect existing auth functions.
- Modify `src/vitrine/App.boundary.test.ts`: verify catalog modal wiring and route preservation.

Preserve all current uncommitted toolbar and Sites-loading changes. Do not touch `scripts/login-wait.png`. Do not commit or push unless the user explicitly requests it.

### Task 1: Single Guest Login Action

**Files:**
- Modify: `src/vitrine/components/GuestCatalogControls.tsx`
- Test: `src/vitrine/GuestCatalogControls.test.tsx`

- [ ] **Step 1: Write the failing single-action test**

Replace the authentication assertions in `src/vitrine/GuestCatalogControls.test.tsx` with:

```ts
assert.match(html, /data-guest-catalog-controls="true"/);
assert.equal((html.match(/<button /g) ?? []).length, 1);
assert.match(html, />Login</);
assert.match(html, /data-variant="primary"/);
assert.doesNotMatch(html, /Log in|Get started/);
assert.doesNotMatch(html, /Account|Collections|Settings|Log out/);
```

Rename the rendered prop:

```tsx
<controls.GuestCatalogControls onLogin={() => undefined} />
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/GuestCatalogControls.test.tsx
```

Expected: FAIL because the component still requires `onSignIn` and renders two buttons.

- [ ] **Step 3: Implement the single primary action**

Replace `src/vitrine/components/GuestCatalogControls.tsx` with:

```tsx
import { Button } from '@astryxdesign/core';

export function GuestCatalogControls({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      data-guest-catalog-controls="true"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <Button label="Login" variant="primary" size="sm" clickAction={onLogin} />
    </div>
  );
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/GuestCatalogControls.test.tsx
```

Expected: the guest-control test PASS.

### Task 2: Embedded SignIn and LoginDialog

**Files:**
- Modify: `src/vitrine/SignIn.tsx`
- Modify: `src/vitrine/SignIn.test.tsx`
- Create: `src/vitrine/components/LoginDialog.tsx`
- Create: `src/vitrine/LoginDialog.test.tsx`

- [ ] **Step 1: Write the failing embedded SignIn test**

Add to `src/vitrine/SignIn.test.tsx`:

```tsx
test("renders the shared authentication form in an embedded layout", () => {
  const html = renderToStaticMarkup(
    <SignIn
      embedded
      authenticate={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      register={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      onSignedIn={() => {}}
    />,
  );

  assert.match(html, /data-sign-in-layout="embedded"/);
  assert.match(html, /Welcome back/);
  assert.match(html, /Email/);
  assert.match(html, /Password/);
  assert.doesNotMatch(html, /min-height:100vh/);
  assert.doesNotMatch(html, /data-sign-in-showcase="true"/);
});
```

Extend the existing full-page authentication test with:

```ts
assert.match(html, /data-sign-in-layout="page"/);
assert.match(html, /data-sign-in-showcase="true"/);
```

- [ ] **Step 2: Run SignIn tests and verify RED**

Run:

```bash
npx tsx --test src/vitrine/SignIn.test.tsx
```

Expected: FAIL because `SignIn` does not accept `embedded` and has no layout markers.

- [ ] **Step 3: Add embedded presentation to SignIn**

In `src/vitrine/SignIn.tsx`, extend the component signature:

```tsx
export function SignIn({
  authenticate,
  register,
  onSignedIn,
  embedded = false,
}: {
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, referralToken?: string) => Promise<AuthUser>;
  onSignedIn: (user: AuthUser) => void;
  embedded?: boolean;
}) {
```

Change the outer layout element to:

```tsx
<div
  data-sign-in-layout={embedded ? 'embedded' : 'page'}
  style={{
    display: 'flex',
    minHeight: embedded ? undefined : '100vh',
    width: '100%',
    background: 'var(--color-background-surface)',
  }}
>
```

Change the form-column layout to:

```tsx
<div
  style={{
    flex: embedded ? '1 1 auto' : isCompact ? '1 1 auto' : '1 1 480px',
    minWidth: embedded || isCompact ? 0 : 380,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: embedded ? 0 : '40px 32px',
  }}
>
```

Change the showcase condition and add a stable marker:

```tsx
{!embedded && !isCompact && (
  <div data-sign-in-showcase="true" style={{ flex: '1 1 55%', minWidth: 0 }}>
    <Showcase />
  </div>
)}
```

Do not change form state, validation, referral handling, submit logic, success timing, or mode switching.

- [ ] **Step 4: Run SignIn tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/SignIn.test.tsx
```

Expected: all SignIn tests PASS.

- [ ] **Step 5: Write the failing LoginDialog test**

Create `src/vitrine/LoginDialog.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginDialog } from './components/LoginDialog.tsx';

test('renders shared authentication inside the catalog login dialog', () => {
  const html = renderToStaticMarkup(
    <LoginDialog
      isOpen
      onClose={() => undefined}
      authenticate={async () => ({ id: 1, email: 'guest@example.com', role: 'user' })}
      register={async () => ({ id: 1, email: 'guest@example.com', role: 'user' })}
      onSignedIn={() => undefined}
    />,
  );

  assert.match(html, /data-login-dialog="true"/);
  assert.match(html, /data-sign-in-layout="embedded"/);
  assert.match(html, /Welcome back/);
  assert.doesNotMatch(html, /data-sign-in-showcase="true"/);
});
```

- [ ] **Step 6: Run the dialog test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/LoginDialog.test.tsx
```

Expected: FAIL because `LoginDialog.tsx` does not exist.

- [ ] **Step 7: Create LoginDialog**

Create `src/vitrine/components/LoginDialog.tsx`:

```tsx
import { Dialog } from '@astryxdesign/core';
import type { AuthUser } from '../authApi.ts';
import { SignIn } from '../SignIn.tsx';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, referralToken?: string) => Promise<AuthUser>;
  onSignedIn: (user: AuthUser) => void;
}

export function LoginDialog({
  isOpen,
  onClose,
  authenticate,
  register,
  onSignedIn,
}: LoginDialogProps) {
  const complete = (user: AuthUser) => {
    onSignedIn(user);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="form"
      width={460}
    >
      <div data-login-dialog="true">
        <SignIn
          embedded
          authenticate={authenticate}
          register={register}
          onSignedIn={complete}
        />
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 8: Run modal tests and verify GREEN**

Run:

```bash
npx tsx --test src/vitrine/SignIn.test.tsx src/vitrine/LoginDialog.test.tsx
```

Expected: all SignIn and LoginDialog tests PASS.

### Task 3: App Modal State and Auth Wiring

**Files:**
- Modify: `src/vitrine/App.tsx`
- Modify: `src/vitrine/App.boundary.test.ts`

- [ ] **Step 1: Write failing App boundary assertions**

Add to `src/vitrine/App.boundary.test.ts`:

```ts
test('opens guest catalog authentication in a modal without changing routes', async () => {
  const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[loginOpen, setLoginOpen\] = useState\(false\)/);
  assert.match(source, /<GuestCatalogControls onLogin=\{\(\) => setLoginOpen\(true\)\} \/>/);
  assert.match(source, /<LoginDialog/);
  assert.match(source, /isOpen=\{loginOpen\}/);
  assert.match(source, /onClose=\{\(\) => setLoginOpen\(false\)\}/);
  assert.match(source, /authenticate=\{authenticate\}/);
  assert.match(source, /register=\{register\}/);
  assert.match(source, /onSignedIn=\{completeLogin\}/);
});
```

- [ ] **Step 2: Run the App boundary test and verify RED**

Run:

```bash
npx tsx --test src/vitrine/App.boundary.test.ts
```

Expected: FAIL because `App` has no login-modal state or dialog wiring.

- [ ] **Step 3: Wire auth functions and modal state into App**

In `src/vitrine/App.tsx`, add:

```ts
import { LoginDialog } from './components/LoginDialog.tsx';
```

Change the auth destructure to:

```ts
const { user, authenticate, register, completeLogin, logout } = useAuth();
```

Add near the other local state:

```ts
const [loginOpen, setLoginOpen] = useState(false);
```

Remove:

```ts
const openSignIn = () => navigate({ name: 'signin' });
```

Set the guest palette upgrade action to:

```ts
const paletteUpgrade = isGuest ? () => setLoginOpen(true) : openPricing;
```

Replace the guest controls branch with:

```tsx
<GuestCatalogControls onLogin={() => setLoginOpen(true)} />
```

Define after `accountControls`:

```tsx
const catalogLoginDialog = isGuest ? (
  <LoginDialog
    isOpen={loginOpen}
    onClose={() => setLoginOpen(false)}
    authenticate={authenticate}
    register={register}
    onSignedIn={completeLogin}
  />
) : null;
```

Wrap the Sites catalog branch so the dialog remains adjacent to the page:

```tsx
if (route.name === 'sites') {
  return (
    <>
      <SitesPage
        isAdmin={isAdmin}
        query={siteQuery}
        onQueryChange={setSiteQuery}
        memberControls={accountControls}
      />
      {catalogLoginDialog}
    </>
  );
}
```

In the Apps catalog return, render:

```tsx
{catalogLoginDialog}
```

immediately after `<AppsDiscoveryPage ... />` and before admin import/dialog overlays.

- [ ] **Step 4: Run the focused authentication and catalog tests**

Run:

```bash
npx tsx --test \
  src/vitrine/GuestCatalogControls.test.tsx \
  src/vitrine/SignIn.test.tsx \
  src/vitrine/LoginDialog.test.tsx \
  src/vitrine/App.boundary.test.ts \
  src/vitrine/AppsDiscovery.test.tsx \
  src/vitrine/Sites.test.tsx
```

Expected: all selected tests PASS.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm run build
git diff --check
git status --short
```

Expected:

- the production build exits successfully, allowing the existing chunk-size advisory;
- `git diff --check` emits no output;
- status contains the requested login-modal work, the current approved toolbar and Sites-loading work, their specs/plans, and the unrelated pre-existing `scripts/login-wait.png`.

Do not commit or push unless the user explicitly requests it.
