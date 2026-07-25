import type { Route } from './router.ts';

const AUTHENTICATED_ROUTE_NAMES = new Set<Route['name']>([
  'signin',
  'billing-success',
  'settings-billing',
  'search',
  'app',
  'site-version',
  'projects',
  'project',
  'feature-document',
  'admin',
]);

export function requiresAuthentication(route: Route): boolean {
  return AUTHENTICATED_ROUTE_NAMES.has(route.name);
}
