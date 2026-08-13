import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeModeProvider } from './theme.tsx';
import { SettingsWorkspacePage } from './components/SettingsWorkspacePage.tsx';
import type { SubscriptionView } from './billingApi.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

const free: SubscriptionView = {
  plan: 'free',
  entitlementSource: 'free',
  promotionExpiresAt: null,
  status: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  graceExpiresAt: null,
  hasBillingCustomer: false,
  freeUnlocks: ['linear'],
  freeUnlocksRemaining: 2,
  exportUsage: { used: 0, limit: 20, resetAt: null },
};

test('renders the Lumin-style full Settings workspace with Profile as its default section', () => {
  const html = renderToStaticMarkup(
    <ThemeModeProvider>
      <SettingsWorkspacePage
        user={{ id: 7, email: 'owner@example.com', role: 'user' }}
        subscription={free}
        onUpgrade={() => undefined}
        onEntitlementsChanged={() => undefined}
        onBack={() => undefined}
        onSignOut={() => undefined}
      />
    </ThemeModeProvider>,
  );

  assert.doesNotMatch(html, /Vitrines libraries/);
  // Settings sections live in the workspace rail; there is no second sub-menu.
  assert.doesNotMatch(html, /aria-label="Settings sections"/);
  // "Back to App" and the section rows live in the published rail, verified in
  // the source below rather than in this content-only render.
  const source = readFileSync(
    new URL('./components/SettingsWorkspacePage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /label: 'Back to App'/);
  // The section names are rail rows (published chrome); the content panel shows
  // the active section, which defaults to Profile.
  assert.match(source, /SETTINGS_SECTIONS\.map/);
  assert.doesNotMatch(source, /label: 'Security'/);
  assert.doesNotMatch(source, /label: 'Teams'/);
  assert.match(source, /label: 'Integrations'/);
  assert.match(source, /CommandIcon/);
  assert.doesNotMatch(source, /label: 'Appearance'/);
  assert.match(source, /section === 'integrations'/);
  assert.match(source, /Add Vitrines in Codex/);
  assert.match(source, /Streamable HTTP/);
  assert.match(source, /Copy URL/);
  assert.match(source, /settings-workspace__integration-revoke/);
  assert.match(source, /title="Revoke this access token\?"/);
  assert.match(source, /actionVariant="destructive"/);
  assert.match(source, /label="Create token" size="sm" variant="primary"/);
  assert.match(source, /settings-workspace__integration-copy-url/);
  assert.match(source, /role="table" aria-label="Active Flow MCP access tokens"/);
  assert.doesNotMatch(source, /Token active/);
  assert.match(html, /Profile/);
  assert.match(html, /owner@example\.com/);
  assert.match(html, /Appearance/);
  assert.match(html, /Theme/);
  assert.doesNotMatch(html, /1 of 3 apps unlocked/);
  assert.doesNotMatch(html, /Developer settings/);
  // Settings uses the same shell as Projects: rail + content panel, no header
  // bar, so the header profile popover is gone.
  assert.doesNotMatch(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /settings-profile-menu/);
  // Settings publishes its chrome to the hoisted shell, so the static render is
  // the settings content only.
  assert.doesNotMatch(html, /projects-workspace__desktop-rail/);
  assert.match(html, /settings-workspace__content/);
});

test('opens Billing when the billing route selects that Settings section', () => {
  const html = renderToStaticMarkup(
    <ThemeModeProvider>
      <SettingsWorkspacePage
        user={{ id: 7, email: 'owner@example.com', role: 'user' }}
        subscription={free}
        initialSection="billing"
        onUpgrade={() => undefined}
        onEntitlementsChanged={() => undefined}
        onBack={() => undefined}
        onSignOut={() => undefined}
      />
    </ThemeModeProvider>,
  );

  assert.match(html, /Subscription/);
  assert.match(html, /Manage and view your Vitrines plan/);
  assert.doesNotMatch(html, /Manage your Vitrines account details/);
});

test('defines the measured desktop Settings shell and collapsed mobile menu', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-workspace \.projects-workspace__desktop-settings\.is-active svg\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.settings-workspace__body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  // The shared content panel owns the border and inset now, not this body.
  assert.match(
    css,
    /\.settings-workspace__body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*gap:\s*0;\s*\}/s,
  );
  assert.match(css, /\.settings-workspace__content\s*\{[^}]*border-radius:\s*16px 16px 0 0;/s);
  assert.doesNotMatch(css, /\.settings-workspace__header\s*\{[^}]*border-bottom:/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('inherits the color-scheme-aware Vitrines roles across the Settings workspace', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /--color-background-body:\s*var\(--vitrine-color-page\);/);
  assert.match(css, /--color-background-surface:\s*var\(--vitrine-color-surface\);/);
  assert.match(css, /--color-text-primary:\s*var\(--vitrine-color-text-primary\);/);
  assert.match(css, /--settings-nav-active:\s*var\(--vitrine-color-surface-muted\);/);
  assert.doesNotMatch(css, /color-scheme:\s*light;/);
});

test('aligns Settings text inputs with the dropdown control rhythm', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-workspace \.astryx-text-input\s*\{[^}]*min-height:\s*32px;[^}]*padding:\s*8px 12px;[^}]*font-size:\s*14px;[^}]*line-height:\s*20px;/s);
});

test('gives Team management a responsive card hierarchy', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.team-settings__grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 400px\), 1fr\)\);/s);
  assert.match(css, /\.team-settings__card\s*\{[^}]*border-radius:\s*12px;[^}]*background:\s*var\(--color-background-surface\);/s);
  assert.match(css, /\.team-settings__member\s*\{[^}]*align-items:\s*center;[^}]*padding:\s*14px 20px;/s);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.team-settings__invite-form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
});

test('matches the measured Lumin account-menu shell', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-profile-menu\s*\{[^}]*top:\s*calc\(100% \+ 4px\);[^}]*right:\s*0;[^}]*width:\s*min\(320px, calc\(100vw - 32px\)\);[^}]*gap:\s*8px;[^}]*padding:\s*8px;[^}]*border-radius:\s*8px;/s);
  assert.match(css, /\.settings-profile-menu__card\s*\{[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--color-background-surface\);/s);
  assert.match(css, /\.settings-profile-menu__actions button\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*8px;[^}]*border-radius:\s*8px;/s);
});
