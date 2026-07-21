import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { createPublicPageBrowser, publicPageScrollDurationMs } from "./publicPageBrowser.ts";

async function fixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html>
        <head>
          <title>Fixture App | Design platform</title>
          <meta name="description" content="A deterministic browser fixture">
          <meta name="theme-color" content="#123456">
          <link rel="canonical" href="/pricing">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font: 18px sans-serif; }
            header, section, footer, main > div { width: 100%; padding: 30px 60px; }
            header { height: 120px; background: #fff; }
            section, main > div { min-height: 620px; }
            .hero { background: #eef4ff; }
            .features { background: #fff; }
            .pricing { background: #f4f1ff; }
            footer { height: 360px; background: #111; color: white; }
            .cookie { position: fixed; inset: auto 20px 20px; height: 100px; z-index: 9999; background: white; }
            .sticky-copy { position: fixed; top: 0; height: 60px; z-index: 9998; background: white; }
          </style>
          <script type="application/ld+json">{"@type":"SoftwareApplication","name":"Fixture App","applicationCategory":"ProductivityApplication","description":"Structured fixture"}</script>
        </head>
        <body>
          <header><h2>Navigation</h2></header>
          <div class="sticky-copy">Duplicate navigation</div>
          <main>
            <section class="hero"><h1>Hero</h1><p>Build better products.</p></section>
            <div class="features"><h2>Features</h2><p>Rendered div-only section.</p></div>
            <section class="pricing"><h2>Pricing</h2><p>Choose a plan.</p></section>
          </main>
          <footer><h2>Footer</h2><p>Footer links.</p></footer>
          <div class="cookie" role="dialog">Cookie settings</div>
        </body>
      </html>`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
  return { server, url: `http://lvh.me:${address.port}/pricing` };
}

test("caps long previews at the smooth default duration", () => {
  assert.equal(publicPageScrollDurationMs(1_000, 200), 5_000);
  assert.equal(publicPageScrollDurationMs(9_925, 200), 20_000);
  assert.equal(publicPageScrollDurationMs(100_000, 200, 20_000), 20_000);
});

test("captures ordered HTML sections, crops, metadata, and a continuous WebM preview", { timeout: 30_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 8_000,
    holdMs: 20,
  });
  t.after(() => browser.close());

  const result = await browser.capture(fixture.url);

  assert.equal(result.capture.metadata.name, "Fixture App");
  assert.equal(result.capture.metadata.description, "Structured fixture");
  assert.equal(result.capture.metadata.category, "ProductivityApplication");
  assert.equal(result.capture.metadata.accent, "#123456");
  assert.equal(result.capture.canonicalUrl, fixture.url);
  assert.deepEqual(
    result.capture.sections.map((section) => section.heading),
    ["Navigation", "Hero", "Features", "Pricing", "Footer"],
  );
  assert.equal(result.capture.sections.some((section) => /cookie|duplicate navigation/i.test(section.text)), false);
  assert.deepEqual([...result.pageImage.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(result.sectionImages.length, result.capture.sections.length);
  assert.ok(result.sectionImages.every(({ body }) => body.subarray(0, 8).equals(result.pageImage.subarray(0, 8))));
  assert.deepEqual([...result.preview.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  assert.equal(result.scroll.stops, 0);
  assert.ok(result.scroll.durationMs <= 60_000);
});
