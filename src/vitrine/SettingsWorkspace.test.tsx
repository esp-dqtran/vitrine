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

test('renders the Lumin-style full Settings workspace around real Vitrine billing', () => {
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

  assert.match(html, /aria-label="Workspace navigation"/);
  assert.doesNotMatch(html, /aria-label="Vitrine libraries"/);
  assert.match(html, /aria-label="Settings sections"/);
  assert.match(html, /Profile/);
  assert.match(html, /Teams/);
  assert.match(html, /Billing/);
  assert.match(html, /Security/);
  assert.match(html, /Appearance/);
  assert.match(html, /Subscription/);
  assert.match(html, /Free/);
  assert.match(html, /1 of 3 apps unlocked/);
  assert.match(html, /Upgrade/);
  assert.doesNotMatch(html, /Developer settings/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-controls="settings-profile-menu"/);
});

test('defines the measured desktop Settings shell and collapsed mobile menu', () => {
  const css = readFileSync(new URL('./settingsWorkspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-workspace \.projects-workspace__desktop-settings\.is-active svg\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.settings-workspace__body\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\);/s);
  assert.match(css, /\.settings-workspace__body\s*\{[^}]*border-top:\s*1px solid var\(--color-border\);[^}]*border-left:\s*1px solid var\(--color-border\);/s);
  assert.match(css, /\.settings-workspace__content\s*\{[^}]*border-radius:\s*16px 16px 0 0;/s);
  assert.doesNotMatch(css, /\.settings-workspace__header\s*\{[^}]*border-bottom:/s);
  assert.match(css, /\.settings-workspace__section-nav nav button\s*\{[^}]*height:\s*40px;[^}]*border-radius:\s*8px;/s);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.settings-workspace__section-nav\s*\{[^}]*width:\s*min\(280px, calc\(100vw - 32px\)\);[^}]*transform:\s*translateX\(-100%\);/s);
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
