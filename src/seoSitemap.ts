import { SITE_ORIGIN } from "./seoMetadata.ts";

const escapeXml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

export function buildSitemapXml(input: {
  appSlugs?: readonly string[];
  siteSlugs?: readonly string[];
  lastModified?: string;
} = {}): string {
  const staticPaths = [
    "/",
    "/browse",
    "/browse/flows",
    "/browse/sites",
    "/components",
    "/pricing",
    "/build-in-public",
    "/terms",
    "/privacy",
    "/refunds",
  ];
  const paths = [
    ...staticPaths,
    ...(input.appSlugs ?? []).map((slug) => `/browse/${encodeURIComponent(slug)}`),
    ...(input.siteSlugs ?? []).map((slug) => `/browse/sites/${encodeURIComponent(slug)}`),
  ];
  const uniquePaths = [...new Set(paths)];
  const lastModified = input.lastModified
    ? `<lastmod>${escapeXml(input.lastModified)}</lastmod>`
    : "";
  const urls = uniquePaths.map((path) =>
    `  <url><loc>${escapeXml(`${SITE_ORIGIN}${path}`)}</loc>${lastModified}</url>`,
  ).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}
