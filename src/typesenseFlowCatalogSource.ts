import type { FlowCatalogItem, FlowCatalogPage } from "./flowCatalogStore.ts";
import type { Platform } from "./platformFromUrl.ts";
import type { FlowCatalogIndexDocument } from "./typesenseFlowCatalog.ts";

function taxonomySlug(value: string): string {
  return value.toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type PublishedFlowCatalogPageLoader = (input: {
  platform: Platform;
  cursor?: string;
  limit: number;
  sort: "grouped";
  includeFacets: false;
  cursorSecret: string;
}) => Promise<FlowCatalogPage>;

function indexDocument(item: FlowCatalogItem, platform: Platform): FlowCatalogIndexDocument {
  const { preview } = item;
  const flow = preview.flow;
  const stepLabels = flow.steps.map(({ label }) => label);
  const searchText = [
    preview.appName,
    preview.appId,
    item.title,
    item.category,
    item.type ?? '',
    flow.description,
    ...flow.tags,
    ...stepLabels,
  ].map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    id: `${platform}:${preview.appId}:${preview.versionId}:${preview.sourceFlowId}`,
    platform,
    appId: preview.appId,
    appName: preview.appName,
    title: item.title,
    category: item.category,
    categorySlug: taxonomySlug(item.category),
    type: item.type ?? 'Other content detail',
    typeKey: `${taxonomySlug(item.category)}/${taxonomySlug(item.type ?? 'Other content detail')}`,
    description: flow.description,
    tags: flow.tags,
    stepLabels,
    searchText: [...new Set(searchText)].join(" "),
    versionId: preview.versionId,
    card: JSON.stringify(item),
  };
}

export async function publishedFlowCatalogDocuments(input: {
  cursorSecret: string;
  loadPage: PublishedFlowCatalogPageLoader;
}): Promise<FlowCatalogIndexDocument[]> {
  const documents: FlowCatalogIndexDocument[] = [];
  for (const platform of ["web", "ios", "android"] as const) {
    let cursor: string | undefined;
    do {
      const page = await input.loadPage({
        platform,
        cursor,
        limit: 100,
        sort: "grouped",
        includeFacets: false,
        cursorSecret: input.cursorSecret,
      });
      documents.push(...page.items.map((item) => indexDocument(item, platform)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  return documents;
}
