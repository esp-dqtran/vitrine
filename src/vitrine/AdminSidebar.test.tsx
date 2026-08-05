import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminSidebar } from './components/AdminSidebar.tsx';

test('renders Users as the only selected destination', () => {
  const html = renderToStaticMarkup(
    <AdminSidebar
      email="admin@example.com"
      section="users"
      onSectionChange={() => undefined}
      onBack={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.match(html, /Vitrines Admin/);
  assert.match(html, /Users/);
  assert.doesNotMatch(html, /Categories/);
  assert.match(html, /Back to Vitrines/);
  assert.match(html, /admin@example\.com/);
  assert.match(html, /Log out/);
  assert.doesNotMatch(html, />Search</);
  assert.doesNotMatch(html, />Projects</);
  assert.doesNotMatch(html, />References</);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
});
