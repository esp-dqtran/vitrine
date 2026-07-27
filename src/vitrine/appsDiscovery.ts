import type { Platform } from '../platformFromUrl.ts';
import { PUBLIC_APP_STATIC_FACETS } from '../publicFacetPreview.ts';
import { categoryNames, type App, type Screen } from './types.ts';

export type AppsFacet = {
  group: 'categories' | 'screens' | 'elements' | 'flows';
  value: string;
};

export type AppsSort = 'latest' | 'popular';
export type AppsPlatform = Platform;

export const APPS_DISCOVERY_CATEGORIES = ['AI', 'Finance', 'CRM', 'Business', 'News'];
export const APPS_DISCOVERY_STATIC_FACETS = PUBLIC_APP_STATIC_FACETS;

const searchableText = (values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(' ').toLowerCase();

const screenFacetText = (screen: Screen, facet: AppsFacet['group']) => {
  if (facet === 'screens') return searchableText([screen.type, screen.productArea]);
  if (facet === 'elements') {
    return searchableText([...(screen.componentNames ?? []), ...(screen.layoutPatterns ?? [])]);
  }
  return searchableText([...(screen.visibleStates ?? []), screen.stateContext, screen.description]);
};

export function filterAndSortApps(
  apps: App[],
  options: { query: string; facet: AppsFacet | null; platform: AppsPlatform; sort: AppsSort },
): App[] {
  const query = options.query.trim().toLowerCase();
  const filtered = apps
    .map((app, index) => ({ app, index }))
    .filter(({ app }) => {
      const platforms = app.platforms ?? app.screens.map((screen) => screen.platform as Platform);
      if (!platforms.includes(options.platform)) return false;
      if (query && !searchableText([
        app.app,
        ...categoryNames(app),
        app.description,
        ...app.screens.flatMap((screen) => [
          screen.type,
          screen.productArea,
          screen.description,
          ...(screen.componentNames ?? []),
          ...(screen.layoutPatterns ?? []),
          ...(screen.visibleStates ?? []),
        ]),
      ]).includes(query)) return false;
      if (!options.facet) return true;
      const needle = options.facet.value.toLowerCase();
      if (options.facet.group === 'categories') {
        return app.categories.some(({ name }) => name.toLowerCase() === needle);
      }
      return app.screens.some((screen) => screenFacetText(screen, options.facet!.group).includes(needle));
    });
  if (options.sort === 'latest') return filtered.map(({ app }) => app);
  return filtered
    .sort((a, b) => b.app.totalScreens - a.app.totalScreens || a.index - b.index)
    .map(({ app }) => app);
}
