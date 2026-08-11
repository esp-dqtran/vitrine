import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { ingestAppMetadata, renderedDescriptionCandidates } from "./appMetadataIngest.ts";
import type { ObjectStore } from "./objectStore.ts";

const unusedObjectStore = {} as ObjectStore;

test("extracts rendered App metadata inside the browser context", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <title>Kilo Code - AI coding agent</title>
      <meta property="og:site_name" content="Kilo Code">
      <meta name="description" content="Open-source AI coding agent for planning, building, and fixing code.">
      <header><a href="/"><svg viewBox="0 0 100 100"><path d="M10 10h80v80H10z" fill="currentColor"></path></svg>Kilo Code</a></header>
      <main><h1>Kilo Code</h1><p>Build software with an AI coding agent.</p></main>
    `);
    const metadata = await renderedDescriptionCandidates(page);
    assert.equal(metadata.displayName, "Kilo Code");
    assert.equal(metadata.candidates[0]?.source, "metadata");
    assert.match(metadata.candidates[0]?.text ?? "", /open-source AI coding agent/i);
    assert.match(metadata.brandIconSvg ?? "", /<rect[^>]+fill="#111111"/);
    assert.match(metadata.brandIconSvg ?? "", /M10 10h80v80H10z/);
  } finally {
    await browser.close();
  }
});

test("creates the App record before ingesting its description and stored icon", async () => {
  const calls: string[] = [];
  const result = await ingestAppMetadata({
    app: "linear",
    sourceUrl: "https://linear.app/",
  }, {
    objectStore: unusedObjectStore,
    runQuery: async (sql) => {
      if (sql.startsWith("INSERT INTO apps")) {
        calls.push("record");
        return {
          rows: [{
            id: 17,
            name: "linear",
            display_name: null,
            description: null,
            website_url: "https://linear.app/",
            icon_url: null,
            created: true,
          }],
          rowCount: 1,
        } as never;
      }
      calls.push("metadata");
      return { rows: [], rowCount: 1 } as never;
    },
    inspect: async () => {
      calls.push("inspect");
      return {
        displayName: "Linear",
        canonicalUrl: "https://linear.app/",
        descriptionCandidates: [{
          text: "Linear is a purpose-built product development platform that helps teams plan and build products.",
          source: "metadata",
          position: 0,
        }],
        brandIconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0h100v100H0z"/></svg>',
      };
    },
    resolveIcon: async () => {
      calls.push("resolve-icon");
      return {
        url: "https://linear.app/icon.png",
        source: "website-icon",
        width: 512,
        height: 512,
        format: "png",
      };
    },
    storeIcon: async (_appId, source) => {
      calls.push("store-icon");
      assert.ok(Buffer.isBuffer(source), "official inline brand artwork is preferred");
      return "/assets/apps/17/icon.webp";
    },
    analyzeCategories: async () => {
      calls.push("analyze-categories");
      return {
        categories: [
          { id: 7, name: "Developer Tools", slug: "developer-tools" },
          { id: 1, name: "AI", slug: "ai" },
        ],
        rationale: "Linear supports software product development.",
        provider: "test",
      };
    },
  });

  assert.equal(calls[0], "record");
  assert.equal(result.complete, true);
  assert.equal(result.created, true);
  assert.equal(result.displayName, "Linear");
  assert.match(result.description ?? "", /product development platform/);
  assert.equal(result.iconUrl, "/assets/apps/17/icon.webp");
  assert.deepEqual(result.categories.map(({ slug }) => slug), ["developer-tools", "ai"]);
  assert.deepEqual(result.issues, []);
});

test("keeps the App record retryable when metadata cannot be resolved", async () => {
  const result = await ingestAppMetadata({
    app: "example",
    sourceUrl: "https://example.com/",
  }, {
    objectStore: unusedObjectStore,
    runQuery: async (sql) => sql.startsWith("INSERT INTO apps") ? ({
      rows: [{
        id: 18,
        name: "example",
        display_name: null,
        description: null,
        website_url: "https://example.com/",
        icon_url: null,
        created: true,
      }],
      rowCount: 1,
    }) as never : ({ rows: [], rowCount: 0 }) as never,
    inspect: async () => { throw new Error("blocked"); },
    resolveIcon: async () => null,
  });

  assert.equal(result.id, 18);
  assert.equal(result.complete, false);
  assert.deepEqual(result.issues, ["description_inspection_failed", "icon_unresolved", "category_unresolved"]);
});
