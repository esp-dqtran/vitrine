import assert from "node:assert/strict";
import test from "node:test";
import { createCloudflareFrontendWorker, applyHtmlSeo } from "./cloudflareFrontendWorker.ts";
import { metadataForPath } from "./seoMetadata.ts";
import { buildSitemapXml } from "./seoSitemap.ts";

test("SEO metadata canonicalizes catalog routes and noindexes filtered variants", () => {
  const catalog = metadataForPath("/browse/example-app");
  assert.equal(catalog.canonicalPath, "/browse/example-app");
  assert.equal(catalog.robots, "index, follow");
  assert.match(catalog.title, /example-app app reference/);

  const filtered = metadataForPath("/browse/example-app", "?platform=ios");
  assert.equal(filtered.canonicalPath, "/browse/example-app");
  assert.equal(filtered.robots, "noindex, nofollow");

  const malformed = metadataForPath("/browse/%E0%A4%A");
  assert.equal(malformed.robots, "index, follow");
});

test("SEO sitemap contains only canonical public URLs", () => {
  const sitemap = buildSitemapXml({
    appSlugs: ["Example App", "Example App"],
    siteSlugs: ["example-site"],
    lastModified: "2026-08-25",
  });
  assert.match(sitemap, /<loc>https:\/\/vitrines\.ai\/browse\/Example%20App<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vitrines\.ai\/browse\/sites\/example-site<\/loc>/);
  assert.equal((sitemap.match(/Example%20App/g) ?? []).length, 1);
  assert.doesNotMatch(sitemap, /\/apps\//);
  assert.match(sitemap, /<lastmod>2026-08-25<\/lastmod>/);
});

test("Cloudflare serves crawler-ready route metadata before React hydration", async () => {
  const shell = `<!doctype html><html><head><title>Vitrines</title>
    <meta name="description" content="default" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="Vitrines" />
    <link rel="canonical" href="https://vitrines.ai/" />
    </head><body><div id="root"></div></body></html>`;
  const worker = createCloudflareFrontendWorker(async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/apps/example/preview") {
      return Response.json({
        app: {
          id: "example",
          app: "Example App",
          description: "A useful example app.",
          iconUrl: "https://cdn.example.com/example.png",
          categories: [{ name: "Productivity" }],
          platforms: ["web"],
        },
      });
    }
    throw new Error(`unexpected API request: ${url.pathname}`);
  });
  const response = await worker.fetch(
    new Request("https://vitrines.ai/browse/example?platform=ios", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response(shell, { headers: { "content-type": "text/html" } }) },
      API_ORIGIN: "https://api.vitrines.ai",
    },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>Example App app reference — Vitrines<\/title>/);
  assert.match(html, /content="A useful example app\."/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /href="https:\/\/vitrines\.ai\/browse\/example"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /Example App/);
});

test("Cloudflare returns 404 for unknown HTML routes", async () => {
  const worker = createCloudflareFrontendWorker(async () => {
    throw new Error("unknown routes must not query the API");
  });
  const response = await worker.fetch(
    new Request("https://vitrines.ai/not-a-real-page", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("shell", { headers: { "content-type": "text/html" } }) },
    },
  );
  assert.equal(response.status, 404);
});

test("HTML SEO transformation escapes head content and removes stale JSON-LD", () => {
  const html = "<html><head><title>Old</title><script type=\"application/ld+json\">{\"old\":true}</script></head></html>";
  const transformed = applyHtmlSeo(html, {
    title: "A <safe> title",
    description: "A & useful description",
    canonicalPath: "/browse/example",
    robots: "noindex, nofollow",
  });
  assert.match(transformed, /A &lt;safe&gt; title/);
  assert.match(transformed, /A &amp; useful description/);
  assert.match(transformed, /noindex, nofollow/);
  assert.doesNotMatch(transformed, /application\/ld\+json/);
});
