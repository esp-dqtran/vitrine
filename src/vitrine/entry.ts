const normalizedPath = (value: string): string => (
  value.length > 1 ? value.replace(/\/+$/, '') : value
);

function appDetailIdFromPath(pathname: string): string | null {
  const match = normalizedPath(pathname).match(/^\/apps\/([^/]+)(?:\/[^/]+)?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const appId = appDetailIdFromPath(window.location.pathname);
if (appId) {
  void import('./appDetailPrefetch.ts')
    .then(({ prefetchAppDetail }) => prefetchAppDetail(appId))
    .catch(() => undefined);
}
void import('./main.tsx');
