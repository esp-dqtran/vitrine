import type { SiteVersionDetail, SiteSummary, SitesStore } from "./sitesStore.ts";
import type { SiteCatalogIndexDocument } from "./typesenseSiteCatalog.ts";

type SiteCatalogStore = Pick<SitesStore, "listReadySites" | "readyVersionDetail">;

const asTimestamp = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const textValues = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
  : [];

function searchValues(site: SiteSummary, detail: SiteVersionDetail | undefined): {
  sections: string[];
  technologies: string[];
  motion: string[];
  text: string[];
} {
  const sections = new Set<string>();
  const text = [site.name, site.sourceUrl, site.description, ...site.categories, ...site.styles]
    .filter((value): value is string => Boolean(value));
  for (const page of detail?.pages ?? []) {
    sections.add(page.title);
    text.push(page.title);
    for (const section of page.sections) {
      const metadata = section.sourceMetadata;
      const patterns = textValues(metadata.patterns);
      patterns.forEach((value) => sections.add(value));
      text.push(...patterns, ...section.ocrBoxes.map(({ text }) => text));
      for (const key of ["heading", "text"] as const) {
        if (typeof metadata[key] === "string") text.push(metadata[key]);
      }
    }
  }
  const technologies = (detail?.analysis?.technology ?? [])
    .filter(({ state }) => state === "confirmed" || state === "observed-in-use")
    .flatMap(({ name, version, category, categories }) => [name, version, category, ...(categories ?? [])])
    .filter((value): value is string => Boolean(value));
  const motion = (detail?.analysis?.motion ?? [])
    .filter(({ evidenceIds }) => evidenceIds.length > 0)
    .flatMap(({ type, trigger, easing, properties }) => [type, trigger, easing, ...properties])
    .filter((value): value is string => Boolean(value));
  text.push(...technologies, ...motion);
  return {
    sections: [...sections],
    technologies: [...new Set(technologies)],
    motion: [...new Set(motion)],
    text: [...new Set(text.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))],
  };
}

function toIndexDocument(
  site: SiteSummary,
  detail: SiteVersionDetail | undefined,
): SiteCatalogIndexDocument {
  const search = searchValues(site, detail);
  return {
    id: `site:${site.siteId}`,
    siteId: site.siteId,
    versionId: site.versionId,
    title: site.name,
    sourceUrl: site.sourceUrl,
    searchText: search.text.join(" "),
    categories: site.categories,
    sections: search.sections,
    styles: site.styles,
    technologies: search.technologies,
    motion: search.motion,
    latestAt: asTimestamp(site.updatedAt),
    popularity: site.popularity,
    card: JSON.stringify(site),
  };
}

export async function publishedSiteCatalogDocument(
  siteId: number,
  store: SiteCatalogStore,
): Promise<SiteCatalogIndexDocument | undefined> {
  const site = (await store.listReadySites()).find((candidate) => candidate.siteId === siteId);
  if (!site) return undefined;
  const detail = await store.readyVersionDetail(site.siteId, site.versionId);
  return toIndexDocument(site, detail);
}

export async function publishedSiteCatalogDocuments(
  store: SiteCatalogStore,
): Promise<SiteCatalogIndexDocument[]> {
  const sites = await store.listReadySites();
  const documents: SiteCatalogIndexDocument[] = [];
  let next = 0;
  const worker = async () => {
    while (next < sites.length) {
      const site = sites[next++];
      if (!site) return;
      documents.push(toIndexDocument(
        site,
        await store.readyVersionDetail(site.siteId, site.versionId),
      ));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, sites.length) }, worker));
  return documents;
}
