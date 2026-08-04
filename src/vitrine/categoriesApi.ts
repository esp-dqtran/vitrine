import { apiFetch } from './apiFetch.ts';
import type { Category } from './types.ts';

export interface CategorySummary extends Category {
  appCount: number;
}

export interface CategoryApp {
  id: number;
  slug: string;
  name: string;
}

export type Requester = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

async function json<T>(
  url: string,
  init: RequestInit | undefined,
  request: Requester,
): Promise<T> {
  const response = await request(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.status === 204
    ? undefined as T
    : response.json() as Promise<T>;
}

export async function fetchCatalogCategories(
  signal?: AbortSignal,
  request: Requester = apiFetch,
): Promise<CategorySummary[]> {
  const body = await json<{ categories: CategorySummary[] }>(
    '/api/catalog/categories',
    { signal },
    request,
  );
  return body.categories;
}

const jsonHeaders = { 'content-type': 'application/json' };

export async function listCategories(
  request: Requester = apiFetch,
): Promise<CategorySummary[]> {
  return (await json<{ categories: CategorySummary[] }>(
    '/api/admin/categories',
    undefined,
    request,
  )).categories;
}

export function createCategory(
  input: { name: string; slug: string },
  request: Requester = apiFetch,
): Promise<Category> {
  return json('/api/admin/categories', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }, request);
}

export function updateCategory(
  id: number,
  input: { name: string; slug: string },
  request: Requester = apiFetch,
): Promise<Category> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }, request);
}

export function deleteCategory(
  id: number,
  request: Requester = apiFetch,
): Promise<{ category: Category; removedAppCount: number }> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, request);
}

export async function listCategoryApps(
  id: number,
  request: Requester = apiFetch,
): Promise<CategoryApp[]> {
  return (await json<{ apps: CategoryApp[] }>(
    `/api/admin/categories/${encodeURIComponent(id)}/apps`,
    undefined,
    request,
  )).apps;
}

export function attachCategoryApp(
  id: number,
  app: string,
  request: Requester = apiFetch,
): Promise<{ app: string; categoryId: number }> {
  return json(`/api/admin/categories/${encodeURIComponent(id)}/apps`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ app }),
  }, request);
}

export function detachCategoryApp(
  id: number,
  app: string,
  request: Requester = apiFetch,
): Promise<void> {
  return json(
    `/api/admin/categories/${encodeURIComponent(id)}/apps/${encodeURIComponent(app)}`,
    { method: 'DELETE' },
    request,
  );
}
