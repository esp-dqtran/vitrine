import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDashboardShell } from './AdminDashboard.tsx';

test('renders the Users outlet inside the dedicated Admin shell', () => {
  const html = renderToStaticMarkup(
    <AdminDashboardShell
      email="admin@example.com"
      onBack={() => undefined}
      onLogout={() => undefined}
      page={<main data-admin-page="users">Users content</main>}
    />,
  );

  assert.match(html, /data-admin-dashboard="true"/);
  assert.match(html, /Vitrine Admin/);
  assert.match(html, /data-admin-page="users"/);
  assert.match(html, /Users content/);
});

test('lazy-loads Users without importing normal application state', async () => {
  const source = await readFile(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /lazy\(\(\) => import\(['"]\.\/components\/UsersPage['"]\)/);
  assert.match(source, /<Suspense fallback=\{<AdminPageSpinner \/>}/);
  assert.doesNotMatch(
    source,
    /useApps|useAppDetail|useCollections|createSearchSession|loadSubscription|ApplicationSurface|ImportDialog/,
  );
});
