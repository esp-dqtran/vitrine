import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import * as publicPageBrowserModule from "./publicPageBrowser.ts";

const {
  createFrameWriteQueue,
  createPublicPageBrowser,
  publicPageScrollDurationMs,
} = publicPageBrowserModule;

async function fixtureServer(): Promise<{ server: Server; url: string }> {
  const oversizedInlineScript = "x".repeat(2 * 1_024 * 1_024);
  const server = createServer((request, response) => {
    if (request.url === "/drift") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>Wrong page</title><main><h1>Navigation drift</h1></main>");
      return;
    }
    if (request.url === "/static") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        "<html><head><title>First website</title></head><body>" +
          "<h1>Home of the first website</h1><p>From here you can browse.</p>" +
          "<ul><li><a href='/history'>Web history</a></li></ul></body></html>",
      );
      return;
    }
    if (request.url === "/consent") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Consent fixture</title>
            <style>
              html, body { margin: 0; min-height: 100%; background: #123456; }
              main { min-height: 900px; color: white; }
              [role="dialog"] {
                position: fixed;
                inset: auto 0 0;
                height: 180px;
                z-index: 9999;
                background: #ff0000;
              }
            </style>
          </head>
          <body>
            <main><h1>Visible page</h1><p>Content behind consent.</p></main>
            <div role="dialog">
              <p>We use cookies to personalize content and analyze traffic.</p>
              <button onclick="this.closest('[role=dialog]').remove()">Okay</button>
            </div>
          </body>
        </html>`);
      return;
    }
    if (request.url === "/div-bands") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Div bands</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 500px 0; font: 18px sans-serif; }
              .fixed-header {
                position: fixed;
                inset: 0 0 auto;
                height: 64px;
                background: #000;
                color: white;
                z-index: 10;
              }
              .page { width: 100%; }
              .band { width: 100%; min-height: 900px; padding: 80px; }
              .band:not([data-visible="true"]) { background: #fff !important; }
            </style>
          </head>
          <body>
            <header class="fixed-header">Navigation</header>
            <main>
              <div class="page">
                <div class="band" data-color="#00ff00"><h1>Agentic infrastructure</h1></div>
                <div class="band" data-color="#ff0000"><h2>Build agents</h2></div>
                <div class="band" data-color="#0000ff"><h2>Recently shipped</h2></div>
              </div>
            </main>
            <script>
              const observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                  entry.target.dataset.visible = String(entry.isIntersecting);
                  entry.target.style.background = entry.isIntersecting
                    ? entry.target.dataset.color
                    : "#fff";
                }
              }, { threshold: 0.1 });
              document.querySelectorAll(".band").forEach((band) => observer.observe(band));
            </script>
          </body>
        </html>`);
      return;
    }
    if (request.url === "/fixed-canvas") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Fixed canvas</title>
            <style>
              html, body, #root { margin: 0; width: 100%; height: 0; overflow: hidden; }
              main { position: fixed; inset: 0; display: grid; place-items: center; background: #f4ead8; }
            </style>
          </head>
          <body><div id="root"><main><img alt="Interactive map" width="800" height="600"></main></div></body>
        </html>`);
      return;
    }
    if (request.url === "/nested-coverage") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Nested coverage</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; font: 18px sans-serif; }
              section, article { width: 100%; }
              section { min-height: 1100px; padding-top: 40px; }
              section > h1 { margin: 0 60px 40px; }
              article { min-height: 300px; padding: 60px; }
            </style>
          </head>
          <body>
            <main>
              <section id="platform" class="product-platform">
                <h1>Product platform</h1>
                <article><h2>Build collaboratively</h2><button>Start building</button></article>
                <article><h2>Ship with confidence</h2><img alt="Deployment graph"></article>
                <article><h2>Scale automatically</h2><a href="/docs">Read documentation</a></article>
              </section>
            </main>
          </body>
        </html>`);
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html>
        <head>
          <title>Fixture App | Design platform</title>
          <meta name="description" content="A deterministic browser fixture">
          <meta name="theme-color" content="#123456">
          <link rel="canonical" href="/publisher-canonical-lie">
          <script type="application/json">${oversizedInlineScript}</script>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font: 18px sans-serif; }
            header, section, footer, .features, .cta { width: 100%; padding: 30px 60px; }
            header { height: 72px; background: #fff; }
            main { padding-top: 80px; }
            section, .features { min-height: 620px; }
            .main-shell { width: 100%; }
            .cta { min-height: 420px; background: #111; color: white; }
            .hero { background: #eef4ff; }
            .features { background: #fff; }
            .pricing { background: #f4f1ff; }
            .long { min-height: 32000px; background: linear-gradient(#fff, #eef4ff); }
            footer { width: 80%; height: 100px; margin: 80px auto 0; background: #111; color: white; }
            .cookie { position: fixed; inset: auto 20px 20px; height: 100px; z-index: 9999; background: white; }
            .sticky-copy { position: fixed; top: 0; height: 60px; z-index: 9998; background: white; }
            #sticky { position: sticky; top: 0; height: 40px; }
            #loop { width: 100px; height: 40px; animation: slide 1s linear infinite; }
            @keyframes slide { to { transform: translateX(20px); } }
            @media (max-width: 600px) { video { display: none; } }
          </style>
          <script type="application/ld+json">{"@type":"SoftwareApplication","name":"Fixture App","applicationCategory":"ProductivityApplication","description":"Structured fixture"}</script>
          <script>setTimeout(() => { location.href = "/drift"; }, 50)</script>
        </head>
        <body>
          <div id="root">
            <header><h2>Navigation</h2></header>
            <div class="sticky-copy">Duplicate navigation</div>
            <main>
              <div class="main-shell">
                <section class="hero">
                  <h1 style="position:relative">
                    <span>Hero section title</span>
                    <span style="position:absolute;inset:0">Hero section title</span>
                    <span hidden>Hero responsive duplicate</span>
                  </h1>
                  <p>Build better products.</p>
                  <div id="sticky"></div><div id="loop"></div><video></video>
                </section>
                <div class="features"><h2>Features</h2><p>Rendered div-only section.</p></div>
                <section class="pricing"><h2>Pricing</h2><p>Choose a plan.</p></section>
                <section class="long"><h2>Long content</h2><p>Exercises encoder back-pressure.</p></section>
                <div class="cta"><h2>Start today</h2><p>Build a standout site.</p></div>
              </div>
            </main>
            <footer><h2>Footer</h2><p>Footer links.</p></footer>
          </div>
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

test("captures an unstructured static body as one full-page section", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(new URL("/static", fixture.url).toString());

  assert.equal(result.capture.metadata.name, "First website");
  assert.equal(result.capture.sections.length, 1);
  assert.equal(result.capture.sections[0]?.heading, "Home of the first website");
  assert.deepEqual(result.capture.sections[0]?.bounds, {
    x: 0,
    y: 0,
    width: result.capture.document.width,
    height: result.capture.document.height,
  });
});

test("dismisses an explicit cookie consent dialog before desktop and mobile capture", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(new URL("/consent", fixture.url).toString());
  const desktopPixel = await sharp(result.pageImage)
    .extract({ left: 10, top: 850, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const mobilePixel = await sharp(result.mobilePageImage)
    .extract({ left: 10, top: 800, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();

  assert.deepEqual([...desktopPixel], [0x12, 0x34, 0x56]);
  assert.deepEqual([...mobilePixel], [0x12, 0x34, 0x56]);
});

test("segments nested div-only marketing bands at their headings", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(
    new URL("/div-bands", fixture.url).toString(),
  );

  assert.deepEqual(
    result.capture.sections.map((section) => section.heading),
    ["Agentic infrastructure", "Build agents", "Recently shipped"],
  );
});

test("falls back to one viewport section for fixed-position canvas pages", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(
    new URL("/fixed-canvas", fixture.url).toString(),
  );

  assert.equal(result.capture.sections.length, 1);
  assert.equal(result.capture.sections[0]?.bounds.y, 0);
  assert.equal(result.capture.sections[0]?.bounds.height, result.capture.viewport.height);
  assert.equal(result.sectionImages.length, 1);
});

test("keeps nested content bands and reconstruction metadata", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(
    new URL("/nested-coverage", fixture.url).toString(),
  );

  assert.deepEqual(
    result.capture.sections.map((section) => section.heading),
    [
      "Product platform",
      "Build collaboratively",
      "Ship with confidence",
      "Scale automatically",
    ],
  );
  assert.equal(result.capture.sections[0]?.anchor, "platform");
  assert.deepEqual(result.capture.sections[0]?.classNames, ["product-platform"]);
  assert.equal(result.capture.sections[1]?.headingLevel, "h2");
  assert.equal(result.capture.sections[1]?.content?.buttons, 1);
  assert.equal(result.capture.sections[2]?.content?.images, 1);
  assert.equal(result.capture.sections[3]?.content?.links, 1);
  assert.equal(result.capture.sections.length, result.sectionImages.length);
});

test("captures viewport-driven content at its document position", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(
    new URL("/div-bands", fixture.url).toString(),
  );
  const secondBandPixel = await sharp(result.pageImage)
    .extract({ left: 10, top: 1_800, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();

  assert.deepEqual([...secondBandPixel], [0xff, 0x00, 0x00]);
});

test("does not repeat a fixed top header in stitched page captures", { timeout: 20_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 10_000,
    maxScrollDurationMs: 1_000,
    holdMs: 10,
  });
  t.after(() => browser.close());

  const result = await browser.capture(
    new URL("/div-bands", fixture.url).toString(),
  );
  const firstStitchPixel = await sharp(result.pageImage)
    .extract({ left: 10, top: 900, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();

  assert.deepEqual([...firstStitchPixel], [0x00, 0xff, 0x00]);
});

test("serializes preview-frame writes when the encoder applies back-pressure", async () => {
  let activeWrites = 0;
  let maximumConcurrentWrites = 0;
  const queue = createFrameWriteQueue(async () => {
    activeWrites += 1;
    maximumConcurrentWrites = Math.max(maximumConcurrentWrites, activeWrites);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeWrites -= 1;
  });

  for (let index = 0; index < 12; index += 1) queue.push(Buffer.from([index]));
  await queue.flush();

  assert.equal(maximumConcurrentWrites, 1);
});

test("revalidates DNS for every request instead of caching a public answer", async () => {
  const createValidator = (
    publicPageBrowserModule as typeof publicPageBrowserModule & {
      createPublicNetworkValidator?: (
        resolve: (hostname: string) => Promise<Array<{ address: string; family: number }>>,
      ) => (url: string) => Promise<void>;
    }
  ).createPublicNetworkValidator;
  assert.equal(typeof createValidator, "function");
  let calls = 0;
  const validate = createValidator!(async () => {
    calls += 1;
    return calls === 1
      ? [{ address: "203.0.114.10", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  });

  await validate("https://example.com/");
  await assert.rejects(
    () => validate("https://example.com/app.js"),
    /public/i,
  );
  assert.equal(calls, 2);
});

test("caps screenshot dimensions before rendering page bytes", () => {
  const captureClip = (
    publicPageBrowserModule as typeof publicPageBrowserModule & {
      publicPageCaptureClip?: (
        document: { width: number; height: number },
        viewport: { width: number; height: number },
      ) => { x: 0; y: 0; width: number; height: number };
    }
  ).publicPageCaptureClip;
  assert.equal(typeof captureClip, "function");
  assert.deepEqual(
    captureClip!({ width: 100_000, height: 100_000 }, { width: 1_440, height: 900 }),
    { x: 0, y: 0, width: 1_440, height: 100_000 },
  );
});

test("captures ordered HTML sections, crops, metadata, and a continuous WebM preview", { timeout: 60_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const browser = await createPublicPageBrowser({
    headless: true,
    validateNavigation: async () => undefined,
    scrollPixelsPerSecond: 600,
    maxScrollDurationMs: 20_000,
    holdMs: 20,
  });
  t.after(() => browser.close());
  const warnings: Error[] = [];
  const collectWarning = (warning: Error) => warnings.push(warning);
  process.on("warning", collectWarning);
  t.after(() => process.off("warning", collectWarning));

  const result = await browser.capture(fixture.url);

  assert.equal(result.capture.metadata.name, "Fixture App");
  assert.equal(result.capture.metadata.description, "Structured fixture");
  assert.equal(result.capture.metadata.category, "ProductivityApplication");
  assert.equal(result.capture.metadata.accent, "#123456");
  assert.equal(result.capture.canonicalUrl, fixture.url);
  assert.ok(result.capture.document.height > 30_000);
  assert.ok(Buffer.byteLength(result.capture.html, "utf8") <= 2 * 1_024 * 1_024);
  assert.deepEqual(
    result.capture.sections.map((section) => section.heading),
    ["Navigation", "Hero section title", "Features", "Pricing", "Long content", "Start today", "Footer"],
  );
  assert.ok(result.capture.sections.every(({ bounds }) =>
    bounds.x === 0 && bounds.width === result.capture.document.width
  ));
  assert.equal(result.capture.sections[0]?.bounds.y, 0);
  assert.equal(result.capture.sections[0]?.bounds.height, 72);
  assert.equal(result.capture.sections[1]?.bounds.y, 72);
  for (let index = 1; index < result.capture.sections.length; index += 1) {
    const previous = result.capture.sections[index - 1]!;
    assert.equal(
      result.capture.sections[index]?.bounds.y,
      previous.bounds.y + previous.bounds.height,
    );
  }
  const lastSection = result.capture.sections.at(-1)!;
  assert.equal(
    lastSection.bounds.y + lastSection.bounds.height,
    result.capture.document.height,
  );
  assert.equal(result.capture.sections.some((section) => /cookie|duplicate navigation/i.test(section.text)), false);
  assert.equal(result.analysis.schemaVersion, 1);
  assert.equal(result.analysis.status, "evidence-only");
  assert.ok(result.analysis.structure.length > 0);
  assert.ok(
    result.analysis.structure.some((item) =>
      item.heading === "Hero section title"
    ),
  );
  assert.equal(
    result.analysis.structure.some((item) =>
      String(item.heading ?? "").includes("responsive duplicate")
    ),
    false,
  );
  assert.ok(result.analysis.motion.some((item) => item.type === "continuous"));
  assert.ok(result.analysis.technology.some((item) => item.name === "CSS Keyframes"));
  assert.deepEqual([...result.pageImage.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pageMetadata = await sharp(result.pageImage).metadata();
  assert.deepEqual(
    { width: pageMetadata.width, height: pageMetadata.height },
    result.capture.document,
  );
  assert.equal(result.mobilePageImage.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(result.sectionImages.length, result.capture.sections.length);
  assert.ok(result.sectionImages.every(({ body }) => body.subarray(0, 8).equals(result.pageImage.subarray(0, 8))));
  const sectionMetadata = await Promise.all(
    result.sectionImages.map(({ body }) => sharp(body).metadata()),
  );
  assert.deepEqual(
    sectionMetadata.map(({ width, height }) => ({ width, height })),
    result.capture.sections.map(({ bounds }) => ({
      width: Math.ceil(bounds.width),
      height: Math.ceil(bounds.height),
    })),
  );
  assert.deepEqual([...result.preview.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  assert.ok(ffmpegPath, "ffmpeg-static must provide a portable encoder");
  const inspection = spawnSync(ffmpegPath, ["-hide_banner", "-i", "pipe:0", "-f", "null", "-"], {
    input: result.preview,
    encoding: "utf8",
  });
  assert.equal(inspection.status, 0, inspection.stderr);
  assert.match(inspection.stderr, /60 fps/);
  assert.equal(warnings.some((warning) => /MaxListenersExceededWarning/.test(warning.message)), false);
  assert.equal(result.scroll.stops, 0);
  assert.ok(result.scroll.durationMs <= 60_000);
});

test("captures a page through the production tsx worker runtime", { timeout: 45_000 }, async (t) => {
  const fixture = await fixtureServer();
  t.after(() => new Promise<void>((resolve) => fixture.server.close(() => resolve())));
  const childSource = `
    import { createPublicPageBrowser } from "./src/publicPageBrowser.ts";
    const browser = await createPublicPageBrowser({
      headless: true,
      validateNavigation: async () => undefined,
      scrollPixelsPerSecond: 10_000,
      maxScrollDurationMs: 1_000,
      holdMs: 10,
    });
    try {
      const result = await browser.capture(process.env.ASTRYX_TEST_CAPTURE_URL);
      console.log(JSON.stringify({
        name: result.capture.metadata.name,
        sections: result.capture.sections.map((section) => section.heading),
      }));
    } finally {
      await browser.close();
    }
  `;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", childSource],
    {
      cwd: process.cwd(),
      env: { ...process.env, ASTRYX_TEST_CAPTURE_URL: fixture.url },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const [code] = await once(child, "close") as [number | null];

  assert.equal(code, 0, stderr);
  assert.deepEqual(JSON.parse(stdout), {
    name: "Fixture App",
    sections: ["Navigation", "Hero section title", "Features", "Pricing", "Long content", "Start today", "Footer"],
  });
});
