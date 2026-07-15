import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'landing' }
  | { name: 'pricing' }
  | { name: 'signin' }
  | { name: 'apps' }
  | { name: 'app'; appId: string; section?: string }
  | { name: 'admin' };

function subscribe(fn: () => void) {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

function parse(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/pricing') return { name: 'pricing' };
  if (path === '/signin') return { name: 'signin' };
  if (path === '/apps') return { name: 'apps' };
  if (path === '/admin') return { name: 'admin' };
  const appMatch = path.match(/^\/apps\/([^/]+)(?:\/([^/]+))?$/);
  if (appMatch) return { name: 'app', appId: decodeURIComponent(appMatch[1]), section: appMatch[2] };
  return { name: 'landing' };
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'landing': return '/landing';
    case 'pricing': return '/pricing';
    case 'signin': return '/signin';
    case 'apps': return '/apps';
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
  return parse(pathname);
}
