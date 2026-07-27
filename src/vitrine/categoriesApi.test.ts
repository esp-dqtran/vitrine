import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachCategoryApp,
  createCategory,
  deleteCategory,
  detachCategoryApp,
  fetchCatalogCategories,
  listCategories,
  listCategoryApps,
  updateCategory,
} from './categoriesApi.ts';

test('loads published Category summaries from the public catalog route', async () => {
  let requested = '';
  const categories = [
    { id: 2, name: 'Business', slug: 'business', appCount: 127 },
    { id: 7, name: 'Productivity', slug: 'productivity', appCount: 101 },
  ];
  const result = await fetchCatalogCategories(undefined, async (input) => {
    requested = String(input);
    return Response.json({ categories });
  });

  assert.equal(requested, '/api/catalog/categories');
  assert.deepEqual(result, categories);
});

test('reports a Category API failure', async () => {
  await assert.rejects(
    () => fetchCatalogCategories(undefined, async () =>
      Response.json({ error: 'Categories unavailable' }, { status: 503 })),
    /Categories unavailable/,
  );
});

test('calls every admin Category endpoint with the exact method and body', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/apps') && (!init?.method || init.method === 'GET')) {
      return Response.json({ apps: [{ id: 42, slug: 'linear', name: 'Linear' }] });
    }
    if (url === '/api/admin/categories' && !init?.method) {
      return Response.json({ categories: [] });
    }
    if (init?.method === 'DELETE' && url.endsWith('/apps/linear')) {
      return new Response(null, { status: 204 });
    }
    if (init?.method === 'DELETE') {
      return Response.json({
        category: { id: 7, name: 'Productivity', slug: 'productivity' },
        removedAppCount: 1,
      });
    }
    if (url.endsWith('/apps')) {
      return Response.json({ app: 'linear', categoryId: 7 });
    }
    return Response.json({ id: 7, name: 'Productivity', slug: 'productivity' });
  };

  await listCategories(request);
  await createCategory({ name: 'Productivity', slug: 'productivity' }, request);
  await updateCategory(7, { name: 'Work', slug: 'work' }, request);
  await deleteCategory(7, request);
  await listCategoryApps(7, request);
  await attachCategoryApp(7, 'linear', request);
  await detachCategoryApp(7, 'linear', request);

  assert.deepEqual(calls.map(({ url, init }) => [url, init?.method ?? 'GET']), [
    ['/api/admin/categories', 'GET'],
    ['/api/admin/categories', 'POST'],
    ['/api/admin/categories/7', 'PATCH'],
    ['/api/admin/categories/7', 'DELETE'],
    ['/api/admin/categories/7/apps', 'GET'],
    ['/api/admin/categories/7/apps', 'POST'],
    ['/api/admin/categories/7/apps/linear', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    name: 'Productivity',
    slug: 'productivity',
  });
  assert.deepEqual(JSON.parse(String(calls[5]?.init?.body)), { app: 'linear' });
});
