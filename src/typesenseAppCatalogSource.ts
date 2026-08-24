import { buildPublishedCatalogPage } from "./gallery.ts";
import {
  publishedCatalogPage,
  type PublishedCatalogPageRecord,
} from "./publicCatalogStore.ts";
import type { Platform } from "./platformFromUrl.ts";
import type { App } from "./vitrine/types.ts";
import type { AppCatalogIndexDocument } from "./typesenseAppCatalog.ts";

const platforms: Platform[] = ["web", "ios", "android"];

export type PublishedAppCatalogPage = (input: {
  cursor?: string;
  limit?: number;
  includeFacets?: boolean;
  platform: Platform;
  query?: string;
  sort?: "latest" | "trending";
}) => Promise<PublishedCatalogPageRecord>;

const asTimestamp = (value: string | null | undefined): number => {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

function toIndexDocument(card: App, platform: Platform): AppCatalogIndexDocument {
  return {
    id: `${platform}:${card.id}`,
    appId: card.id,
    platform,
    title: card.app,
    searchText: [card.app, card.description, ...card.categories.map(({ name }) => name)].filter(Boolean).join(" "),
    categories: card.categories.map(({ name }) => name),
    latestAt: asTimestamp(card.createdAt ?? card.lastCapturedAt),
    // Popularity is not a durable App-level signal in the current catalog source.
    // Keep this field for the future ranker while PostgreSQL remains the fallback
    // for the existing Trending view.
    trendingScore: 0,
    card: JSON.stringify(card),
  };
}

/**
 * Builds the exact App-card payload already consumed by the Apps UI. One document per
 * app/platform preserves the platform switcher without inventing screen-level facets
 * that the product does not yet ingest consistently.
 */
export async function publishedAppCatalogDocuments(
  loadPage: PublishedAppCatalogPage = publishedCatalogPage,
): Promise<AppCatalogIndexDocument[]> {
  const documents: AppCatalogIndexDocument[] = [];
  for (const platform of platforms) {
    let cursor: string | undefined;
    do {
      const page = await loadPage({ cursor, limit: 24, includeFacets: false, platform, sort: "latest" });
      const cards = buildPublishedCatalogPage(page).apps;
      for (const card of cards) {
        documents.push(toIndexDocument(card, platform));
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  return documents;
}

/** Loads the one published App/platform card that changed after a version is published. */
export async function publishedAppCatalogDocument(
  app: string,
  platform: Platform,
  loadPage: PublishedAppCatalogPage = publishedCatalogPage,
): Promise<AppCatalogIndexDocument | undefined> {
  const page = await loadPage({ query: app, limit: 24, includeFacets: false, platform, sort: "latest" });
  const card = buildPublishedCatalogPage(page).apps.find((candidate) => candidate.id === app);
  return card ? toIndexDocument(card, platform) : undefined;
}
