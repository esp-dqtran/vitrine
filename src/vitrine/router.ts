import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'landing' }
  | { name: 'pricing' }
  | { name: 'billing-success' }
  | { name: 'signin' }
  | { name: 'apps' }
  | { name: 'app'; appId: string; section?: string }
  | { name: 'sites' }
  | { name: 'site-version'; siteId: number; versionId: number; section?: string }
  | { name: 'projects' }
  | { name: 'project'; projectId: number }
  | { name: 'admin' };

function subscribe(fn: () => void) {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

export function parseRoutePath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/pricing') return { name: 'pricing' };
  if (path === '/billing/success') return { name: 'billing-success' };
  if (path === '/signin') return { name: 'signin' };
  if (path === '/apps') return { name: 'apps' };
  if (path === '/sites') return { name: 'sites' };
  const siteMatch = path.match(/^\/sites\/([1-9]\d*)\/versions\/([1-9]\d*)(?:\/([^/]+))?$/);
  if (siteMatch) {
    const siteId = Number(siteMatch[1]);
    const versionId = Number(siteMatch[2]);
    return Number.isSafeInteger(siteId) && Number.isSafeInteger(versionId)
      ? {
          name: 'site-version',
          siteId,
          versionId,
          ...(siteMatch[3] ? { section: decodeURIComponent(siteMatch[3]) } : {}),
        }
      : { name: 'landing' };
  }
  if (path === '/projects') return { name: 'projects' };
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = Number(projectMatch[1]);
    return Number.isSafeInteger(projectId) && projectId > 0
      ? { name: 'project', projectId }
      : { name: 'landing' };
  }
  if (path === '/admin') return { name: 'admin' };
  const appMatch = path.match(/^\/apps\/([^/]+)(?:\/([^/]+))?$/);
  if (appMatch) return { name: 'app', appId: decodeURIComponent(appMatch[1]), section: appMatch[2] };
  return { name: 'landing' };
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'landing': return '/landing';
    case 'pricing': return '/pricing';
    case 'billing-success': return '/billing/success';
    case 'signin': return '/signin';
    case 'apps': return '/apps';
    case 'sites': return '/sites';
    case 'site-version': return `/sites/${route.siteId}/versions/${route.versionId}${route.section ? `/${encodeURIComponent(route.section)}` : ''}`;
    case 'projects': return '/projects';
    case 'project': return `/projects/${route.projectId}`;
    case 'admin': return '/admin';
    case 'app': return `/apps/${encodeURIComponent(route.appId)}${route.section ? `/${route.section}` : ''}`;
  }
}

export function navigate(route: Route) {
  const path = routeToPath(route);
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  // pushState doesn't fire popstate itself — dispatch one so useRoute() re-reads the path.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoutePath(pathname);
}
