import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminSidebar } from './components/AdminSidebar.tsx';

test('renders one Users destination plus Back to Vitrine and account controls', () => {
  const html = renderToStaticMarkup(
    <AdminSidebar
      email="admin@example.com"
      onBack={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.match(html, /Vitrine Admin/);
  assert.match(html, /Users/);
  assert.match(html, /Back to Vitrine/);
  assert.match(html, /admin@example\.com/);
  assert.match(html, /Log out/);
  assert.doesNotMatch(html, />Search</);
  assert.doesNotMatch(html, />Projects</);
  assert.doesNotMatch(html, />References</);
});
