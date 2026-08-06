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
  // The section is addressable: /admin and /admin/insights, not local state.
  assert.match(source, /route\.section === 'insights' \? 'insights' : 'users'/);
  assert.match(source, /navigate\(\s*next === 'insights'/);
  assert.doesNotMatch(source, /useState<AdminSection>/);
  assert.match(source, /lazy\(\(\) => import\('\.\/components\/InsightsPage'\)/);
  assert.match(source, /<Suspense fallback=\{<AdminPageSpinner \/>}/);
  assert.doesNotMatch(
    source,
    /useApps|useAppDetail|useCollections|createSearchSession|loadSubscription|ApplicationSurface/,
  );
});

test('keeps /admin navigable below the rail breakpoint', async () => {
  const css = await readFile(new URL('./projectsWorkspace.css', import.meta.url), 'utf8');

  // The projects-variant shell renders no header, so hiding the rail below 980px
  // left Admin with no way to reach Insights or get back out. It reflows instead.
  assert.doesNotMatch(css, /@media \(max-width: 980px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*display:\s*none;/);
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.projects-workspace__desktop-rail\s*\{[^}]*flex-direction:\s*row;/s,
  );
  // The identity-only row opens nothing, so it does not spend width in the bar.
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.projects-workspace__desktop-workspace--static\s*\{[^}]*display:\s*none;/s,
  );
});
