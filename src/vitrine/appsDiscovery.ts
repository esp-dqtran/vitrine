import type { Platform } from '../platformFromUrl.ts';
import type { App, Screen } from './types.ts';

export type AppsFacet = {
  group: 'categories' | 'screens' | 'elements' | 'flows';
  value: string;
};

export type AppsSort = 'latest' | 'popular' | 'rated' | 'animations';
export type AppsPlatform = Extract<Platform, 'ios' | 'web'>;

export const APPS_DISCOVERY_FACETS = [
  { group: 'categories', label: 'Categories', values: ['Productivity', 'Business', 'Finance', 'Health & Fitness', 'Developer Tools'] },
  { group: 'screens', label: 'Screens', values: ['Filter & Sort', 'Chat Bot', 'Signup', 'Settings & Preferences', 'Charts'] },
  { group: 'elements', label: 'UI Elements', values: ['Navigation Menu', 'Dialog', 'Card', 'Dropdown Menu', 'Text Field'] },
  { group: 'flows', label: 'Flows', values: ['Setting Up', 'Searching & Finding', 'Filtering & Sorting', 'Resetting Password', 'Reporting'] },
] as const;

const searchableText = (values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(' ').toLowerCase();

const screenFacetText = (screen: Screen, facet: AppsFacet['group']) => {
  if (facet === 'screens') return searchableText([screen.type, screen.productArea]);
  if (facet === 'elements') {
    return searchableText([...(screen.componentNames ?? []), ...(screen.layoutPatterns ?? [])]);
  }
  return searchableText([...(screen.visibleStates ?? []), screen.stateContext, screen.description]);
};

export interface AppsFacetPreview {
  app: string;
  screenType: string;
  url: string;
}

const screenMatchesFacet = (screen: Screen, facet: AppsFacet): boolean =>
  screenFacetText(screen, facet.group).includes(facet.value.toLowerCase());

export function previewForAppsFacet(
  apps: App[],
  facet: AppsFacet,
  platform: AppsPlatform,
): AppsFacetPreview | null {
  for (const app of apps) {
    const platformScreens = app.screens.filter((screen) => screen.platform === platform);
    if (platformScreens.length === 0) continue;
    if (facet.group === 'categories' && app.cat.toLowerCase() !== facet.value.toLowerCase()) continue;

    const screen = facet.group === 'categories'
      ? platformScreens[0]
      : platformScreens.find((candidate) => screenMatchesFacet(candidate, facet));
    if (!screen) continue;

    const url = screen.thumbnailUrl || screen.url;
    if (url) return { app: app.app, screenType: screen.type, url };
  }
  return null;
}

const meanConfidence = (app: App) => {
  const values = app.screens.flatMap((screen) => screen.confidence == null ? [] : [screen.confidence]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

const capturedAt = (app: App) => Date.parse(app.lastCapturedAt ?? '') || 0;

export function filterAndSortApps(
  apps: App[],
  options: { query: string; facet: AppsFacet | null; platform: AppsPlatform; sort: AppsSort },
): App[] {
  const query = options.query.trim().toLowerCase();
  return apps
    .map((app, index) => ({ app, index }))
    .filter(({ app }) => {
      const platforms = app.platforms ?? app.screens.map((screen) => screen.platform as Platform);
      if (!platforms.includes(options.platform)) return false;
      if (query && !searchableText([
        app.app,
        app.cat,
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
      if (options.facet.group === 'categories') return app.cat.toLowerCase() === needle;
      return app.screens.some((screen) => screenFacetText(screen, options.facet!.group).includes(needle));
    })
    .sort((a, b) => {
      if (options.sort === 'latest') return capturedAt(b.app) - capturedAt(a.app) || a.index - b.index;
      if (options.sort === 'popular') return b.app.totalScreens - a.app.totalScreens || a.index - b.index;
      if (options.sort === 'rated') {
        return meanConfidence(b.app) - meanConfidence(a.app)
          || (b.app.analyzedScreens ?? 0) - (a.app.analyzedScreens ?? 0)
          || a.index - b.index;
      }
      return Number(Boolean(b.app.previewVideoUrl)) - Number(Boolean(a.app.previewVideoUrl))
        || a.index - b.index;
    })
    .map(({ app }) => app);
}
