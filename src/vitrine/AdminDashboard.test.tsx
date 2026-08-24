import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDashboardShell } from './AdminDashboard.tsx';

test('renders the Users outlet inside the dedicated Admin shell', () => {
  const html = renderToStaticMarkup(
    <AdminDashboardShell
      section="users"
      onSectionChange={() => undefined}
      onBack={() => undefined}
      page={<main data-admin-page="users">Users content</main>}
    />,
  );

  assert.match(html, /data-admin-page="users"/);
  assert.match(html, /Users content/);
  assert.doesNotMatch(html, /Categories/);
  // Admin publishes its chrome to the hoisted shell exactly like the project
  // surfaces, so a static render carries the outlet only.
  assert.doesNotMatch(html, /projects-workspace__desktop-rail/);
  assert.doesNotMatch(html, /projects-workspace__context-bar/);
  assert.doesNotMatch(html, /astryx-side-nav|SideNav/);
});

test('publishes the Admin rail through the shared chrome provider', async () => {
  const source = await readFile(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /useWorkspaceChrome\(/);
  assert.doesNotMatch(source, /<WorkspaceShell|<WorkspaceRail|<WorkspaceHeader/);
  assert.match(source, /'data-admin-dashboard': 'true'/);
  // Admin has no workspace to switch to, so the rail publishes no workspace row.
  assert.doesNotMatch(source, /workspace: \{/);
  assert.match(source, /admin: true/);
  // Rail is nav only now: no footer action and no account block, so the brand
  // link is the way back and Log out lives in the app's own account menu.
  assert.match(source, /onSettings: null/);
  assert.doesNotMatch(source, /railFooter:|admin-workspace__account|label="Log out"/);
  assert.match(source, /onBrandSelect: onBack/);
  assert.match(source, /className: 'admin-workspace'/);
});

test('lazy-loads Users without importing normal application state', async () => {
  const source = await readFile(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /lazy\(\(\) => import\(['"]\.\/components\/UsersPage['"]\)/);
  assert.doesNotMatch(source, /CategoriesPage/);
  // Each Admin section is route-addressable rather than being held in local state.
  assert.match(source, /route\.section === 'insights'/);
  assert.match(source, /route\.section === 'threads'/);
  assert.match(source, /navigate\(\s*next === 'insights'/);
  assert.match(source, /next === 'threads'/);
  assert.doesNotMatch(source, /useState<AdminSection>/);
  assert.match(source, /lazy\(\(\) => import\('\.\/components\/InsightsPage'\)/);
  assert.match(source, /lazy\(\(\) => import\('\.\/components\/ThreadsMarketingPage'\)/);
  assert.match(source, /<Suspense fallback=\{<AdminPageSpinner \/>}/);
  assert.doesNotMatch(
    source,
    /useApps|useAppDetail|useCollections|createSearchSession|loadSubscription|ApplicationSurface/,
  );
});

test('keeps Threads publishing actions disabled until the channel is configured', async () => {
  const source = await readFile(new URL('./components/ThreadsMarketingPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /isDisabled=\{Boolean\(busy\) \|\| !dashboard\?\.configured\}/);
  assert.match(source, /Publishing and metric refresh stay disabled until the connection is ready/);
});

test('keeps /admin navigable below the rail breakpoint', async () => {
  const css = await readFile(new URL('./projectsWorkspace.css', import.meta.url), 'utf8');

  // The compact shell keeps the rail available as an off-canvas drawer rather
  // than removing Admin navigation at the mobile breakpoint.
  assert.doesNotMatch(css, /@media \(max-width: 700px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*display:\s*none;/);
  assert.match(
    css,
    /@media \(max-width: 700px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*position:\s*fixed;[^}]*flex-direction:\s*column;[^}]*transform:\s*translateX\(-100%\);/s,
  );
  assert.match(
    css,
    /@media \(max-width: 700px\)[\s\S]*?\.projects-workspace\.is-rail-open \.projects-workspace__desktop-rail\s*\{[^}]*transform:\s*translateX\(0\);/s,
  );
});
