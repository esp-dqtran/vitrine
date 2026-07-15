import type { CrawledImage } from "./db.ts";
import type { DesignFlow, DesignSystemSnapshot, TokenKind } from "./designSystem.ts";

export type CatalogEntityKind = "app" | "screen" | "component" | "token" | "flow" | "pattern";

export interface CatalogSearchItem {
  id: string;
  kind: CatalogEntityKind;
  app: string;
  title: string;
  description: string;
  evidenceIds: number[];
  pageType?: string;
  productArea?: string;
  theme?: "light" | "dark" | "mixed";
  states: string[];
  layoutPatterns: string[];
  componentNames: string[];
  appCategory?: string;
  searchText: string;
}

export interface CatalogSearchOptions {
  query: string;
  kind?: CatalogEntityKind | "all";
  theme?: string;
  pageType?: string;
  productArea?: string;
  state?: string;
  layout?: string;
  component?: string;
  appCategory?: string;
  limit?: number;
}

export interface CatalogResearchSource {
  images: CrawledImage[];
  systems: DesignSystemSnapshot[];
  flows: Array<{ app: string; flows: DesignFlow[] }>;
  appCategories?: Record<string, string>;
}

export interface CatalogSearchResult {
  items: Array<Omit<CatalogSearchItem, "searchText">>;
  facets: {
    kinds: Record<CatalogEntityKind, number>;
    themes: string[];
    pageTypes: string[];
    productAreas: string[];
    states: string[];
    layouts: string[];
    components: string[];
    appCategories: string[];
  };
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const STOP_WORDS = new Set(['show', 'where', 'does', 'this', 'app', 'apps', 'use', 'using', 'similar', 'to', 'system', 'systems', 'with', 'find', 'every', 'which', 'is', 'are', 'the']);
const words = (value: string): string[] => (value.toLocaleLowerCase().match(/[\p{L}\p{N}#]+/gu) ?? [])
  .filter((word) => !STOP_WORDS.has(word))
  .map((word) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word);
const evidenceForComponent = (component: DesignSystemSnapshot["components"][number]): number[] =>
  unique(component.variants.flatMap(({ evidence }) => evidence));
const evidenceForFlow = (flow: DesignFlow): number[] => unique(flow.steps.flatMap(({ evidence }) => evidence));

function indexCatalog({ images, systems, flows, appCategories = {} }: CatalogResearchSource): CatalogSearchItem[] {
  const items: CatalogSearchItem[] = [];
  const appNames = unique([
    ...images.map(({ app }) => app),
    ...systems.map(({ app }) => app),
    ...flows.map(({ app }) => app),
  ]);

  for (const app of appNames) {
    const appImages = images.filter((image) => image.app === app);
    items.push({
      id: `app:${app}`,
      kind: "app",
      app,
      title: app,
      description: `${appImages.length} observed web screens`,
      evidenceIds: appImages.map(({ id }) => id),
      states: [],
      layoutPatterns: [], componentNames: [], appCategory: appCategories[app],
      searchText: [app, ...appImages.flatMap(({ analysis }) => [analysis?.pageType, analysis?.productArea])].filter(Boolean).join(" "),
    });
  }

  for (const image of images) {
    const analysis = image.analysis;
    const title = analysis?.pageType ?? image.description ?? `Screen ${image.id}`;
    items.push({
      id: `screen:${image.id}`,
      kind: "screen",
      app: image.app,
      title,
      description: analysis?.description ?? image.description ?? "Observed screen",
      evidenceIds: [image.id],
      pageType: analysis?.pageType,
      productArea: analysis?.productArea,
      theme: analysis?.theme,
      states: analysis?.visibleStates ?? [],
      layoutPatterns: analysis?.layoutPatterns ?? [],
      componentNames: analysis?.componentNames ?? [],
      appCategory: appCategories[image.app],
      searchText: [
        image.app, title, image.description, analysis?.description, analysis?.purpose,
        analysis?.productArea, analysis?.theme, ...(analysis?.visibleStates ?? []),
        ...(analysis?.componentNames ?? []),
        ...(analysis?.visibleText ?? []), ...(analysis?.layoutPatterns ?? []), ...(analysis?.icons ?? []),
        ...(analysis?.imagery ?? []), ...(analysis?.contentPatterns ?? []), ...(analysis?.interactionPatterns ?? []),
        appCategories[image.app],
      ].filter(Boolean).join(" "),
    });
  }

  for (const system of systems) {
    for (const component of system.components) {
      items.push({
        id: `component:${system.app}:${component.id}`,
        kind: "component",
        app: system.app,
        title: component.name,
        description: component.description,
        evidenceIds: evidenceForComponent(component),
        states: component.variants.map(({ name }) => name),
        layoutPatterns: [], componentNames: [component.name], appCategory: appCategories[system.app],
        searchText: [system.app, component.name, component.category, component.description,
          ...component.variants.flatMap(({ name, description }) => [name, description])].join(" "),
      });
    }
    for (const token of system.tokens) {
      items.push({
        id: `token:${system.app}:${token.id}`,
        kind: "token",
        app: system.app,
        title: token.name,
        description: `${token.value} · ${token.role}`,
        evidenceIds: token.evidence,
        states: [],
        layoutPatterns: [], componentNames: [], appCategory: appCategories[system.app],
        searchText: [system.app, token.kind, token.name, token.value, token.role].join(" "),
      });
    }
    for (const rule of system.rules ?? []) {
      items.push({ id: `pattern:${system.app}:${rule.id}`, kind: 'pattern', app: system.app, title: rule.name, description: rule.description, evidenceIds: rule.evidence, states: [], layoutPatterns: rule.kind === 'layout' ? [rule.name] : [], componentNames: [], appCategory: appCategories[system.app], searchText: [system.app, rule.kind, rule.name, rule.description].join(' ') });
    }
  }

  for (const entry of flows) {
    for (const flow of entry.flows) {
      items.push({
        id: `flow:${entry.app}:${flow.id}`,
        kind: "flow",
        app: entry.app,
        title: flow.title,
        description: flow.description,
        evidenceIds: evidenceForFlow(flow),
        states: [],
        layoutPatterns: [], componentNames: [], appCategory: appCategories[entry.app],
        searchText: [entry.app, flow.title, flow.description, ...flow.tags, ...flow.steps.map(({ label }) => label)].join(" "),
      });
    }
  }
  return items;
}

function matchScore(item: CatalogSearchItem, query: string): number {
  const terms = words(query);
  if (terms.length === 0) return 1;
  const haystack = words(item.searchText).join(' ');
  if (!terms.every((term) => haystack.includes(term))) return 0;
  const title = item.title.toLocaleLowerCase();
  return terms.reduce((score, term) => score + (title === term ? 8 : title.includes(term) ? 4 : 1), 0);
}

export function searchCatalog(source: CatalogResearchSource, options: CatalogSearchOptions): CatalogSearchResult {
  const index = indexCatalog(source);
  const facets = {
    kinds: { app: 0, screen: 0, component: 0, token: 0, flow: 0, pattern: 0 } as Record<CatalogEntityKind, number>,
    themes: unique(index.flatMap(({ theme }) => theme ? [theme] : [])).sort(),
    pageTypes: unique(index.flatMap(({ pageType }) => pageType ? [pageType] : [])).sort(),
    productAreas: unique(index.flatMap(({ productArea }) => productArea ? [productArea] : [])).sort(),
    states: unique(index.flatMap(({ states }) => states)).sort(),
    layouts: unique(index.flatMap(({ layoutPatterns }) => layoutPatterns)).sort(),
    components: unique(index.flatMap(({ componentNames }) => componentNames)).sort(),
    appCategories: unique(index.flatMap(({ appCategory }) => appCategory ? [appCategory] : [])).sort(),
  };
  for (const item of index) facets.kinds[item.kind] += 1;

  const kindOrder: CatalogEntityKind[] = ["screen", "flow", "component", "token", "pattern", "app"];
  const items = index
    .map((item) => ({ item, score: matchScore(item, options.query) }))
    .filter(({ item, score }) =>
      score > 0
      && (!options.kind || options.kind === "all" || item.kind === options.kind)
      && (!options.theme || item.theme === options.theme)
      && (!options.pageType || item.pageType === options.pageType)
      && (!options.productArea || item.productArea === options.productArea)
      && (!options.state || item.states.includes(options.state))
      && (!options.layout || item.layoutPatterns.includes(options.layout))
      && (!options.component || item.componentNames.includes(options.component))
      && (!options.appCategory || item.appCategory === options.appCategory))
    .sort((a, b) => b.score - a.score || kindOrder.indexOf(a.item.kind) - kindOrder.indexOf(b.item.kind) || a.item.title.localeCompare(b.item.title))
    .slice(0, Math.min(Math.max(options.limit ?? 50, 1), 100))
    .map(({ item: { searchText: _searchText, ...item } }) => item);
  return { items, facets };
}

export interface ComparisonRow {
  id: string;
  label: string;
  values: Array<string | null>;
  evidenceIds: number[][];
}

export interface CatalogComparison {
  apps: string[];
  foundations: ComparisonRow[];
  components: ComparisonRow[];
  flows: ComparisonRow[];
}

function alignedRows(
  systems: DesignSystemSnapshot[],
  entries: Array<{ app: string; id: string; label: string; value: string; evidence: number[] }>,
): ComparisonRow[] {
  const labels = unique(entries.map(({ label }) => label)).sort();
  return labels.map((label) => ({
    id: entries.find((entry) => entry.label === label)?.id ?? label,
    label,
    values: systems.map(({ app }) => entries.find((entry) => entry.app === app && entry.label === label)?.value ?? null),
    evidenceIds: systems.map(({ app }) => entries.find((entry) => entry.app === app && entry.label === label)?.evidence ?? []),
  }));
}

export function buildComparison(
  systems: DesignSystemSnapshot[],
  flowEntries: Array<{ app: string; flows: DesignFlow[] }>,
): CatalogComparison {
  if (systems.length < 2 || systems.length > 5) throw new Error("Comparison requires 2 to 5 apps");
  const foundations = systems.flatMap((system) => system.tokens.map((token) => ({
    app: system.app, id: token.id, label: token.name, value: token.value, evidence: token.evidence,
  })));
  const components = systems.flatMap((system) => system.components.map((component) => ({
    app: system.app,
    id: component.id,
    label: component.name,
    value: component.variants.map(({ name }) => name).join(", "),
    evidence: evidenceForComponent(component),
  })));
  const flows = flowEntries.flatMap((entry) => entry.flows.map((flow) => ({
    app: entry.app,
    id: flow.id,
    label: flow.title,
    value: `${flow.steps.length} ${flow.steps.length === 1 ? "step" : "steps"}`,
    evidence: evidenceForFlow(flow),
  })));
  return {
    apps: systems.map(({ app }) => app),
    foundations: alignedRows(systems, foundations),
    components: alignedRows(systems, components),
    flows: alignedRows(systems, flows),
  };
}
