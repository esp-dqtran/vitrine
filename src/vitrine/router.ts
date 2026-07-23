import { useSyncExternalStore } from 'react';
import type { Platform } from '../platformFromUrl.ts';

export type Route =
  | { name: 'landing' }
  | { name: 'build-in-public' }
  | { name: 'pricing' }
  | { name: 'billing-success' }
  | { name: 'settings-billing' }
  | { name: 'signin' }
  | { name: 'search' }
  | { name: 'apps' }
  | {
      name: 'app';
      appId: string;
      section?: string;
      platform?: Platform;
      version?: number;
      evidence?: string;
      flow?: string;
      step?: number;
    }
  | { name: 'sites' }
  | { name: 'site-version'; siteId: number; versionId: number; section?: string }
  | { name: 'projects' }
  | { name: 'project'; projectId: number }
  | { name: 'feature-document'; documentId: number }
  | { name: 'feature-document-share'; token: string }
  | { name: 'admin' };

function subscribe(fn: () => void) {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

export function parseRoutePath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/build-in-public') return { name: 'build-in-public' };
  if (path === '/pricing') return { name: 'pricing' };
  if (path === '/billing/success') return { name: 'billing-success' };
  if (path === '/settings/billing') return { name: 'settings-billing' };
  if (path === '/signin') return { name: 'signin' };
  if (path === '/search') return { name: 'search' };
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
  const featureDocumentMatch = path.match(/^\/feature-documents\/([1-9]\d*)$/);
  if (featureDocumentMatch) {
    const documentId = Number(featureDocumentMatch[1]);
    return Number.isSafeInteger(documentId) ? { name: 'feature-document', documentId } : { name: 'landing' };
  }
  const featureDocumentShareMatch = path.match(/^\/feature-document-shares\/([^/]+)$/);
  if (featureDocumentShareMatch) return { name: 'feature-document-share', token: decodeURIComponent(featureDocumentShareMatch[1]) };
  if (path === '/admin') return { name: 'admin' };
  const appMatch = path.match(/^\/apps\/([^/]+)(?:\/([^/]+))?$/);
  if (appMatch) return { name: 'app', appId: decodeURIComponent(appMatch[1]), section: appMatch[2] };
  return { name: 'landing' };
}

function positive(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function bounded(value: string | null, pattern: RegExp, maximum = 240): string | undefined {
  return value && value.length <= maximum && pattern.test(value) ? value : undefined;
}

export function parseRouteLocation(pathname: string, search = ''): Route {
  const route = parseRoutePath(pathname);
  if (route.name !== 'app') return route;
  const params = new URLSearchParams(search);
  const rawPlatform = params.get('platform');
  const platform = rawPlatform === 'ios' || rawPlatform === 'android' || rawPlatform === 'web'
    ? rawPlatform
    : undefined;
  const version = positive(params.get('version'));
  const evidence = bounded(
    params.get('evidence'),
    /^(?:SCREEN|FLOW|UI-ELEMENT)-[A-Za-z0-9-]+$/,
    300,
  );
  const flow = bounded(params.get('flow'), /^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
  const step = positive(params.get('step'));
  return {
    ...route,
    ...(platform ? { platform } : {}),
    ...(version ? { version } : {}),
    ...(evidence ? { evidence } : {}),
    ...(flow ? { flow } : {}),
    ...(step ? { step } : {}),
  };
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'landing': return '/landing';
    case 'build-in-public': return '/build-in-public';
    case 'pricing': return '/pricing';
    case 'billing-success': return '/billing/success';
    case 'settings-billing': return '/settings/billing';
    case 'signin': return '/signin';
    case 'search': return '/search';
    case 'apps': return '/apps';
    case 'sites': return '/sites';
    case 'site-version': return `/sites/${route.siteId}/versions/${route.versionId}${route.section ? `/${encodeURIComponent(route.section)}` : ''}`;
    case 'projects': return '/projects';
    case 'project': return `/projects/${route.projectId}`;
    case 'feature-document': return `/feature-documents/${route.documentId}`;
    case 'feature-document-share': return `/feature-document-shares/${encodeURIComponent(route.token)}`;
    case 'admin': return '/admin';
    case 'app': {
      const path = `/apps/${encodeURIComponent(route.appId)}${route.section ? `/${encodeURIComponent(route.section)}` : ''}`;
      const params = new URLSearchParams();
      if (route.platform) params.set('platform', route.platform);
      if (route.version) params.set('version', String(route.version));
      if (route.evidence) params.set('evidence', route.evidence);
      if (route.flow) params.set('flow', route.flow);
      if (route.step) params.set('step', String(route.step));
      const search = params.toString();
      return search ? `${path}?${search}` : path;
    }
  }
}

export function navigate(route: Route) {
  const path = routeToPath(route);
  if (path === `${window.location.pathname}${window.location.search}`) return;
  window.history.pushState(null, '', path);
  // pushState doesn't fire popstate itself — dispatch one so useRoute() re-reads the path.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const location = useSyncExternalStore(
    subscribe,
    () => `${window.location.pathname}${window.location.search}`,
  );
  const split = location.indexOf('?');
  return parseRouteLocation(
    split < 0 ? location : location.slice(0, split),
    split < 0 ? '' : location.slice(split),
  );
}
