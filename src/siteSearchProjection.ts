import {
  searchDocumentRevision,
  searchDocumentText,
  uniqueSearchValues,
} from "./searchProjection.ts";
import type { SearchDocument } from "./searchTypes.ts";

export interface PublishedSiteSearchSource {
  site: {
    id: number;
    versionId: number;
    name: string;
    description: string;
    categories: string[];
    styles: string[];
    updatedAt: string;
  };
  pages: Array<{
    title: string;
    sectionPatterns: string[];
  }>;
}

export function projectSiteSearchDocuments(
  source: PublishedSiteSearchSource,
): SearchDocument[] {
  const sections = uniqueSearchValues(
    source.pages.flatMap(({ title, sectionPatterns }) => [title, ...sectionPatterns]),
  );
  const catalogCategories = uniqueSearchValues(source.site.categories);
  const siteStyles = uniqueSearchValues(source.site.styles);
  const document = {
    documentId: `site:${source.site.id}`,
    indexVersion: 1 as const,
    catalogScope: "sites" as const,
    catalogName: source.site.name,
    siteId: source.site.id,
    siteVersionId: source.site.versionId,
    catalogCategories,
    siteSections: sections,
    siteStyles,
    platform: "web",
    entityType: "site" as const,
    sourceId: `site:${source.site.id}`,
    title: source.site.name,
    description: source.site.description,
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    ...(catalogCategories[0] ? { appCategory: catalogCategories[0] } : {}),
    publishedAt: source.site.updatedAt,
    sourcePayload: {
      siteId: source.site.id,
      siteVersionId: source.site.versionId,
    },
    searchText: searchDocumentText(
      source.site.name,
      source.site.description,
      catalogCategories,
      siteStyles,
      sections,
    ),
  };
  return [{
    ...document,
    sourceRevision: searchDocumentRevision(document),
  }];
}
