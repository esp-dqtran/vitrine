import type { Route } from './router.ts';

export interface RootRouteContext {
  auth: 'loading' | 'guest' | 'member' | 'admin';
  advancedSearchEnabled: boolean;
  researchProjectsEnabled: boolean;
  projectDocumentsEnabled: boolean;
  projectDocumentsTestProjectId?: number;
}

export type RootRouteDecision =
  | { kind: 'loading' }
  | { kind: 'public'; page: 'landing' | 'not-found' | 'build-in-public' | 'pricing' | 'billing-success' | 'feature-document-share' | 'project-document-share' }
  | { kind: 'application' }
  | { kind: 'admin-dashboard' }
  | { kind: 'signin' }
  | { kind: 'redirect'; route: Route }
  | { kind: 'denied'; title: string }
  | { kind: 'unavailable'; title: string };

export function decideRootRoute(
  route: Route,
  context: RootRouteContext,
): RootRouteDecision {
  if (route.name === 'pricing'
    || route.name === 'build-in-public'
    || route.name === 'feature-document-share'
    || route.name === 'project-document-share'
    || route.name === 'not-found') {
    return { kind: 'public', page: route.name };
  }

  if (context.auth === 'loading') return { kind: 'loading' };

  switch (route.name) {
    case 'landing':
      return context.auth === 'guest'
        ? { kind: 'public', page: 'landing' }
        : { kind: 'redirect', route: { name: 'apps' } };
    case 'signin':
      return context.auth === 'guest'
        ? { kind: 'signin' }
        : { kind: 'redirect', route: { name: 'apps' } };
    case 'apps':
    case 'sites':
    case 'flows':
      return { kind: 'application' };
    case 'billing-success':
      return context.auth === 'guest'
        ? { kind: 'signin' }
        : { kind: 'public', page: 'billing-success' };
    case 'search':
      if (context.auth === 'guest') return { kind: 'signin' };
      return context.advancedSearchEnabled
        ? { kind: 'application' }
        : { kind: 'unavailable', title: 'Search is unavailable' };
    case 'projects':
    case 'project':
      if (context.auth === 'guest') return { kind: 'signin' };
      return context.researchProjectsEnabled
        ? { kind: 'application' }
        : { kind: 'unavailable', title: 'Research projects are unavailable' };
    case 'project-document':
      if (context.auth === 'guest') return { kind: 'signin' };
      if (!context.researchProjectsEnabled) {
        return { kind: 'unavailable', title: 'Research projects are unavailable' };
      }
      return context.projectDocumentsEnabled
        && route.projectId === context.projectDocumentsTestProjectId
        ? { kind: 'application' }
        : { kind: 'unavailable', title: 'Project Docs are unavailable' };
    case 'admin':
      if (context.auth === 'guest') return { kind: 'signin' };
      return context.auth === 'admin'
        ? { kind: 'admin-dashboard' }
        : { kind: 'denied', title: 'Admin access required' };
    case 'settings-billing':
    case 'app':
    case 'site-version':
    case 'feature-document':
      return context.auth === 'guest' ? { kind: 'signin' } : { kind: 'application' };
    default:
      return assertNever(route);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled route decision: ${JSON.stringify(value)}`);
}
