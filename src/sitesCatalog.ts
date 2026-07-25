import { canonicalMobbinSitesUrl } from "./sites.ts";

export function canonicalSitesCatalogUrls(hrefs: readonly string[]): string[] {
  const urls = new Set<string>();
  for (const href of hrefs) {
    try {
      const absolute = new URL(href, "https://mobbin.com");
      urls.add(canonicalMobbinSitesUrl(absolute.href).canonicalUrl);
    } catch {
      continue;
    }
  }
  return [...urls];
}
