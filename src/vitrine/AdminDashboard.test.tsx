import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDashboardShell } from './AdminDashboard.tsx';

test('renders the Users outlet inside the dedicated Admin shell', () => {
  const html = renderToStaticMarkup(
    <AdminDashboardShell
      email="admin@example.com"
      section="users"
      onSectionChange={() => undefined}
      onBack={() => undefined}
      onLogout={() => undefined}
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
  assert.match(source, /label: 'Vitrines Admin'/);
  assert.match(source, /admin: true/);
  assert.match(source, /label="Log out"/);
  assert.match(source, /settingsLabel: 'Back to Vitrines'/);
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
