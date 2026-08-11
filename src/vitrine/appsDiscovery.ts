import type { Platform } from '../platformFromUrl.ts';
import { PUBLIC_APP_STATIC_FACETS } from '../publicFacetPreview.ts';
import { categoryNames, type App, type Screen } from './types.ts';

export type AppsFacet = {
  group: 'categories' | 'screens' | 'elements' | 'flows';
  value: string;
};

export type AppsSort = 'latest' | 'popular' | 'trending';
export type AppsPlatform = Platform;

export interface AppsFilterOption {
  value: string;
  section: string;
  count?: number;
  previewUrl?: string | null;
  previewLabel?: string;
  description?: string;
  aliases?: string[];
  sectionPosition?: number;
  position?: number;
}

export interface AppsDiscoveryScreenResult {
  app: App;
  screen: Screen;
}

export const APPS_DISCOVERY_CATEGORIES = ['AI', 'Finance', 'CRM', 'Business', 'News'];
export const APPS_DISCOVERY_STATIC_FACETS = PUBLIC_APP_STATIC_FACETS;

// Full Apps values (from `/api/apps/facets`), used to seed the toolbar filter
// dropdowns so they don't need a live facet query. APPS_DISCOVERY_CATEGORIES above stays
// a short curated list for the taxonomy quick-links panel.
export const ALL_APPS_CATEGORIES = [
  'AI', 'Business', 'CRM', 'Collaboration', 'Communication', 'Crypto & Web3',
  'Developer Tools', 'Education', 'Entertainment', 'Finance', 'Food & Drink',
  'Graphics & Design', 'Health & Fitness', 'Jobs & Recruitment', 'Lifestyle',
  'Maps & Navigation', 'Medical', 'Music & Audio', 'News', 'Photo & Video',
  'Productivity', 'Real Estate', 'Reference', 'Shopping', 'Social Networking',
  'Sports', 'Travel & Transportation', 'Utilities',
];

export const ALL_APPS_SCREENS = [
  'Account Setup', 'Achievements & Awards', 'Acknowledgement & Success', 'Action Option',
  'Add & Create', 'Article Detail', 'Audio & Video Recorder', 'Audio Player', 'Ban & Block',
  'Billing', 'Bookmarks & Collections', 'Browse & Discover', 'Calendar', 'Call', 'Cancel',
  'Canvas', 'Cart & Bag', 'Charts', 'Chat Bot', 'Chat Detail', 'Checkout',
  'Class & Lesson Detail', 'Code Editor', 'Command Palette', 'Comments', 'Confirmation',
  'Dark Mode', 'Dashboard', 'Date & Time', 'Delete', 'Delete & Deactivate Account',
  'Draw & Annotate', 'Edit', 'Emails & Messages', 'Empty State', 'Error', 'Event Detail',
  'Favorite & Pin', 'Feature Info', 'Feedback', 'Filter & Sort', 'Flag & Report',
  'Follow & Subscribe', 'Followers & Following', 'Forgot Password', 'Goal & Task',
  'Guided Tour & Tutorial', 'Help & Support', 'Home', 'Import & Export', 'Internal Tool',
  'Invite & Refer Friends', 'Invite Teammates', 'Kanban Board', 'Leaderboard', 'Like & Upvote',
  'Loading', 'Login', 'Map', 'Media Editor', 'Misc', 'Move', 'Multi-Column Layout',
  'My Account & Profile', 'News Feed', 'Note Detail', 'Notifications', 'Order Confirmation',
  'Order Detail', 'Order History', 'Other Action', 'Other Content', 'Payment Method',
  'Permission', 'Playlists', 'Post Detail', 'Pricing', 'Preview', 'Product Detail', 'Progress',
  'Promotions & Rewards', 'Publish', 'QR Code', 'Quiz', 'Recipe Detail', 'Reorder',
  'Reviews & Ratings', 'Save', 'Schedule', 'Search', 'Select', 'Set', 'Settings & Preferences',
  'Share', 'Shop & Storefront', 'Signup', 'Social Feed', 'Song & Podcast Detail', 'Stories',
  'Subscription & Paywall', 'Suggestions & Similar Items', 'TV Show & Movie Detail',
  'Timeline & History', 'Timer & Clock', 'Transfer & Send Money', 'Trash & Archive',
  'Upload & Download', 'User / Group Profile', 'Verification', 'Video Player',
  'Wallet & Balance', 'Wallpaper',
];

const searchableText = (values: Array<string | null | undefined>) =>
  values.filter(Boolean).join(' ').toLowerCase();

const screenFacetText = (screen: Screen, facet: AppsFacet['group']) => {
  if (facet === 'screens') return searchableText([screen.type, screen.productArea]);
  if (facet === 'elements') {
    return searchableText([...(screen.componentNames ?? []), ...(screen.layoutPatterns ?? [])]);
  }
  return searchableText([...(screen.visibleStates ?? []), screen.stateContext, screen.description]);
};

const SCREEN_FACET_ALIASES: Record<string, string[]> = {
  'my account & profile': ['my account', 'profile', 'account', 'settings', 'preferences'],
};

const facetNeedles = (facet: AppsFacet) => {
  const needle = facet.value.toLowerCase();
  return facet.group === 'screens'
    ? SCREEN_FACET_ALIASES[needle] ?? [needle]
    : [needle];
};

const facetsFromOptions = (
  facet: AppsFacet | AppsFacet[] | null | undefined,
): AppsFacet[] => Array.isArray(facet) ? facet : facet ? [facet] : [];

const appMatchesFacet = (app: App, facet: AppsFacet) => {
  const needles = facetNeedles(facet);
  if (facet.group === 'categories') {
    return app.categories.some(({ name }) => needles.includes(name.toLowerCase()));
  }
  return app.screens.some((screen) => {
    const text = screenFacetText(screen, facet.group);
    return needles.some((needle) => text.includes(needle));
  });
};

const screenMatchesFacet = (app: App, screen: Screen, facet: AppsFacet) => {
  if (facet.group === 'categories') return appMatchesFacet(app, facet);
  const text = screenFacetText(screen, facet.group);
  return facetNeedles(facet).some((needle) => text.includes(needle));
};

const facetsMatchByGroup = (
  facets: AppsFacet[],
  matches: (facet: AppsFacet) => boolean,
) => {
  const grouped = new Map<AppsFacet['group'], AppsFacet[]>();
  facets.forEach((facet) => {
    grouped.set(facet.group, [...(grouped.get(facet.group) ?? []), facet]);
  });
  return [...grouped.values()].every((groupFacets) => groupFacets.some(matches));
};

export function filterAndSortApps(
  apps: App[],
  options: {
    query: string;
    facet?: AppsFacet | AppsFacet[] | null;
    facets?: AppsFacet[];
    platform: AppsPlatform;
    sort: AppsSort;
  },
): App[] {
  const query = options.query.trim().toLowerCase();
  const facets = options.facets ?? facetsFromOptions(options.facet);
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
          screen.stateContext,
          ...(screen.visibleText ?? []),
        ]),
      ]).includes(query)) return false;
      return facetsMatchByGroup(facets, (facet) => appMatchesFacet(app, facet));
    });
  if (options.sort === 'latest') return filtered.map(({ app }) => app);
  return filtered
    .sort((a, b) => b.app.totalScreens - a.app.totalScreens || a.index - b.index)
    .map(({ app }) => app);
}

export function filterAppsDiscoveryScreens(
  apps: App[],
  options: {
    query: string;
    facets: AppsFacet[];
    platform: AppsPlatform;
    sort: AppsSort;
  },
): AppsDiscoveryScreenResult[] {
  const query = options.query.trim().toLowerCase();
  const results = apps.flatMap((app) => app.screens
    .filter((screen) => screen.platform === options.platform)
    .filter((screen) =>
      facetsMatchByGroup(options.facets, (facet) => screenMatchesFacet(app, screen, facet)))
    .filter((screen) => !query || searchableText([
      app.app,
      ...categoryNames(app),
      screen.type,
      screen.productArea,
      screen.description,
      ...(screen.componentNames ?? []),
      ...(screen.layoutPatterns ?? []),
      ...(screen.visibleStates ?? []),
      screen.stateContext,
      ...(screen.visibleText ?? []),
    ]).includes(query))
    .map((screen, index) => ({ app, screen, index })));
  if (options.sort === 'latest') {
    return results
      .sort((left, right) => {
        const rightTime = Date.parse(right.screen.capturedAt ?? right.app.lastCapturedAt ?? '');
        const leftTime = Date.parse(left.screen.capturedAt ?? left.app.lastCapturedAt ?? '');
        return (Number.isFinite(rightTime) ? rightTime : 0)
          - (Number.isFinite(leftTime) ? leftTime : 0);
      })
      .map(({ app, screen }) => ({ app, screen }));
  }
  return results
    .sort((left, right) =>
      (right.screen.confidence ?? 0) - (left.screen.confidence ?? 0)
      || right.app.totalScreens - left.app.totalScreens
      || left.index - right.index)
    .map(({ app, screen }) => ({ app, screen }));
}

export function buildAppsFilterOptions(
  apps: App[],
): Record<AppsFacet['group'], AppsFilterOption[]> {
  const groups: Record<AppsFacet['group'], Map<string, AppsFilterOption>> = {
    categories: new Map(),
    screens: new Map(),
    elements: new Map(),
    flows: new Map(),
  };
  const add = (
    group: AppsFacet['group'],
    value: string | null | undefined,
    section: string,
    app?: App,
    screen?: Screen,
  ) => {
    const normalized = value?.trim();
    if (!normalized || groups[group].has(normalized)) return;
    groups[group].set(normalized, {
      value: normalized,
      section,
      previewUrl: screen?.thumbnailUrl ?? screen?.url ?? app?.iconUrl,
      previewLabel: app ? `${app.app} · ${normalized}` : normalized,
    });
  };

  ALL_APPS_CATEGORIES.forEach((value) => add('categories', value, 'Categories'));
  ALL_APPS_SCREENS.forEach((value) => add('screens', value, 'Screens'));
  APPS_DISCOVERY_STATIC_FACETS.forEach(({ group, label, values }) => {
    if (group === 'screens') return;
    values.forEach((value) => add(group, value, label));
  });
  apps.forEach((app) => {
    app.categories.forEach(({ name }) => add('categories', name, 'Categories', app, app.screens[0]));
    app.screens.forEach((screen) => {
      add('screens', screen.type, screen.productArea || 'Screens', app, screen);
      (screen.componentNames ?? []).forEach((value) => add('elements', value, 'UI Elements', app, screen));
      (screen.layoutPatterns ?? []).forEach((value) => add('elements', value, 'Layout Patterns', app, screen));
      (screen.visibleStates ?? []).forEach((value) => add('flows', value, 'Flows', app, screen));
      add('flows', screen.stateContext, 'Flows', app, screen);
    });
  });
  return Object.fromEntries(
    Object.entries(groups).map(([group, options]) => [
      group,
      [...options.values()].sort((left, right) =>
        (left.sectionPosition ?? Number.MAX_SAFE_INTEGER)
          - (right.sectionPosition ?? Number.MAX_SAFE_INTEGER)
        || (left.position ?? Number.MAX_SAFE_INTEGER)
          - (right.position ?? Number.MAX_SAFE_INTEGER)
        || left.section.localeCompare(right.section)
        || left.value.localeCompare(right.value)),
    ]),
  ) as Record<AppsFacet['group'], AppsFilterOption[]>;
}
