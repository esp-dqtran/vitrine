import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import type { ObjectMetadata } from "./objectStore.ts";
import { buildSiteAnalysis } from "./sitePageInspection.ts";
import { classifySiteImportUrl } from "./sites.ts";
import {
  createGenericSitesStoreMethods,
  type GenericSiteCompleteInput,
} from "./sitesGenericStore.ts";

test("persists one generic page and its analysis only in Sites tables", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query = async (
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Record<string, unknown>>> => {
    calls.push({ sql, values });
    if (/INSERT INTO sites/.test(sql)) return result([{ id: 7 }]);
    if (/INSERT INTO site_versions/.test(sql)) {
      return result([{ id: 9, status: "importing" }]);
    }
    if (/SELECT s\.id AS site_id/.test(sql) && /FOR UPDATE/.test(sql)) {
      return result([{
        site_id: 7,
        version_id: 9,
        status: "importing",
        content_hash: "a".repeat(64),
      }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) {
      return result([{ object_key: values?.[0] }]);
    }
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: 11 }]);
    if (/UPDATE site_versions/.test(sql) && /status = 'ready'/.test(sql)) {
      return result([{ id: 9 }]);
    }
    return result();
  };
  const methods = createGenericSitesStoreMethods(
    query,
    async (work) => work(query),
  );
  const identity = classifySiteImportUrl("https://example.com/pricing");
  assert.equal(identity.kind, "public-page");
  if (identity.kind !== "public-page") throw new Error("fixture identity");
  const analysis = fixtureAnalysis();

  const begin = await methods.beginGenericImport({
    identity,
    name: "Example",
    description: "Pricing",
    iconUrl: "https://example.com/icon.png",
    categories: ["Business"],
    styles: ["Minimal"],
    contentHash: "a".repeat(64),
    analysis,
  });
  assert.deepEqual(begin, { reused: false, siteId: 7, versionId: 9 });
  const versionUpsert = calls.find(({ sql }) => /INSERT INTO site_versions/.test(sql));
  assert.match(versionUpsert!.sql, /catalog_snapshot/);
  assert.deepEqual(JSON.parse(String(versionUpsert!.values?.at(-1))), {
    name: "Example",
    slug: "example-com",
    sourceUrl: identity.canonicalUrl,
    description: "Pricing",
    logoUrl: "https://example.com/icon.png",
    categories: ["Business"],
    categoriesNormalized: ["business"],
    styles: ["Minimal"],
    stylesNormalized: ["minimal"],
    popularity: 0,
  });

  const completion: GenericSiteCompleteInput = {
    identity,
    siteId: 7,
    versionId: 9,
    contentHash: "a".repeat(64),
    page: {
      sourceId: "page",
      title: "Example",
      url: identity.canonicalUrl,
    },
    sections: [
      {
        sourceId: "section-0",
        position: 0,
        cropTop: 0,
        cropBottom: 500,
        sourceMetadata: { selector: "main" },
      },
    ],
    analysis,
    objectKeys: {
      source: "sites/url/source.json",
      analysis: "sites/url/analysis.json",
      preview: "sites/url/preview.webm",
      mobile: "sites/url/mobile/page.png",
      page: "sites/url/page.png",
      sections: { "section-0": "sites/url/sections/0.png" },
    },
  };
  const objects = Object.values(completion.objectKeys)
    .flatMap((value) =>
      typeof value === "string" ? [value] : Object.values(value)
    )
    .map(metadata);
  await methods.completeGenericImport(completion, objects);

  const sql = calls.map((call) => call.sql).join("\n");
  for (const table of [
    "sites",
    "site_versions",
    "site_pages",
    "site_sections",
    "stored_objects",
  ]) {
    assert.match(sql, new RegExp(table));
  }
  assert.doesNotMatch(sql, /\bapps\b|\bweb_pages\b|\bweb_page_versions\b|\bweb_page_sections\b/);
});

test("adds a public-page capture as a version of an existing Site with the same URL", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query = async (
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Record<string, unknown>>> => {
    calls.push({ sql, values });
    if (/SELECT id[\s\S]+regexp_replace\(lower\(source_url\)/.test(sql)) {
      return result([{ id: 329 }]);
    }
    if (/UPDATE sites[\s\S]+RETURNING id/.test(sql)) return result([{ id: 329 }]);
    if (/INSERT INTO site_versions/.test(sql)) {
      return result([{ id: 454, status: "importing" }]);
    }
    return result();
  };
  const identity = classifySiteImportUrl("https://vercel.com/");
  assert.equal(identity.kind, "public-page");
  if (identity.kind !== "public-page") throw new Error("fixture identity");

  const begin = await createGenericSitesStoreMethods(
    query,
    async (work) => work(query),
  ).beginGenericImport({
    identity,
    name: "Vercel",
    description: "Developer cloud",
    iconUrl: "https://vercel.com/icon.png",
    categories: ["Developer tools"],
    styles: ["Minimal"],
    contentHash: "b".repeat(64),
    analysis: fixtureAnalysis(),
  });

  assert.deepEqual(begin, { reused: false, siteId: 329, versionId: 454 });
  assert.equal(calls.some(({ sql }) => /INSERT INTO sites/.test(sql)), false);
  assert.equal(
    calls.find(({ sql }) => /INSERT INTO site_versions/.test(sql))?.values?.[0],
    329,
  );
});

function fixtureAnalysis() {
  return buildSiteAnalysis({
    viewport: "desktop",
    width: 1_440,
    height: 900,
    document: { width: 1_440, height: 1_000 },
    structure: [],
    visualTokens: [],
    animationSamples: [],
    technologySignals: {
      generator: [],
      htmlAttributes: {},
      scriptUrls: [],
      stylesheetUrls: [],
      resourceUrls: [],
      inlineScripts: [],
      sourceMapSources: [],
      runtimes: {},
      activeRuntimeSignals: [],
    },
    mutations: { attributes: 0, childNodes: 0 },
    warnings: [],
  });
}

function metadata(key: string): ObjectMetadata {
  return {
    key,
    sha256: "b".repeat(64),
    byteSize: 10,
    contentType: key.endsWith(".webm")
      ? "video/webm"
      : key.endsWith(".png")
      ? "image/png"
      : "application/json",
    accessClass: "protected",
  };
}

function result(
  rows: Record<string, unknown>[] = [],
): QueryResult<Record<string, unknown>> {
  return {
    rows,
    rowCount: rows.length,
    command: "",
    oid: 0,
    fields: [],
  };
}
