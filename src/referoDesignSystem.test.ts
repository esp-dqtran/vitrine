import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReferoSitemap, parseReferoStylePage } from "./referoDesignSystem.ts";
import { shouldReplaceReferoPrimary } from "./referoDesignSystemStore.ts";

const id = "90ce5883-bb24-4466-93f7-801cd617b0d1";
const url = `https://styles.refero.design/style/${id}`;

function page(result: unknown): string {
  const tree = ["$", "main", null, { children: [{ result }] }];
  const payload = `6:${JSON.stringify(tree)}`;
  return `<html><head><script type="application/ld+json">{"name":"Example"}</script></head><body><script>self.__next_f.push(${JSON.stringify([1, payload])})</script></body></html>`;
}

test("parses the public Refero style sitemap", () => {
  const entries = parseReferoSitemap(`<?xml version="1.0"?><urlset><url><loc>${url}</loc><lastmod>2026-08-01T00:00:00Z</lastmod><image:image><image:loc>https://images.example/style.jpg?x=1&amp;y=2</image:loc></image:image></url></urlset>`);
  assert.deepEqual(entries, [{ id, url, lastModified: "2026-08-01T00:00:00Z", imageUrl: "https://images.example/style.jpg?x=1&y=2" }]);
});

test("extracts and normalizes a Refero React Flight style payload", () => {
  const record = parseReferoStylePage(page({
    meta: { url: "https://linear.app", siteName: "Linear", extractedAt: "2026-07-03T00:00:00Z" },
    screenshot: { url: "https://images.example/full.jpg", thumbnail: "https://images.example/thumb.jpg" },
    raw: { colors: { tokens: [{ hex: "#08090a" }] } },
    designSystem: {
      theme: "dark",
      northStar: "midnight precision instrument",
      description: "A precise dark interface.",
      colors: [{ name: "Void", hex: "#08090a", role: "Canvas" }],
      typography: [{ family: "Inter", weight: "400", sizes: "16", role: "UI" }],
      typeScale: [{ role: "body", size: 16, lineHeight: 1.5 }],
      spacing: { elementGap: "8px", radius: { buttons: "6px" } },
      components: [{ name: "Primary button", role: "Action", description: "Acid lime CTA" }],
      layout: "Centered at 1200px.",
      dos: ["Use one accent."],
      donts: ["Do not add gradients."],
    },
  }), url, "2026-08-03T00:00:00Z", "2026-08-01T00:00:00Z");

  assert.equal(record.id, id);
  assert.equal(record.result.meta.siteName, "Linear");
  assert.equal(record.snapshot.app, "linear");
  assert.equal(record.snapshot.provenance?.provider, "refero");
  assert.equal(record.snapshot.provenance?.theme, "dark");
  assert.equal(record.snapshot.tokens.filter(({ kind }) => kind === "color").length, 1);
  assert.equal(record.snapshot.tokens.filter(({ kind }) => kind === "typography").length, 2);
  assert.equal(record.snapshot.components[0]?.name, "Primary button");
  assert.equal(record.snapshot.rules?.filter(({ name }) => name === "Do").length, 1);
  assert.match(record.contentHash, /^[0-9a-f]{64}$/);
});

test("never replaces Vitrines-observed or non-Refero primary design systems", () => {
  const record = parseReferoStylePage(page({
    meta: { url: "https://linear.app", siteName: "Linear" },
    designSystem: { colors: [] },
  }), url, "2026-08-03T00:00:00Z", "2026-08-01T00:00:00Z");

  assert.equal(shouldReplaceReferoPrimary(undefined, record), true);
  assert.equal(shouldReplaceReferoPrimary({ origin: "observed", snapshot: {} }, record), false);
  assert.equal(shouldReplaceReferoPrimary({ origin: "automatic", snapshot: {} }, record), false);
  assert.equal(shouldReplaceReferoPrimary({ origin: "imported", snapshot: { provenance: { provider: "getdesign" } } }, record), false);
  assert.equal(shouldReplaceReferoPrimary({ origin: "imported", snapshot: { provenance: { provider: "refero", upstreamModifiedAt: "2026-07-01T00:00:00Z" } } }, record), true);
});
