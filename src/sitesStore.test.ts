import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import type { ObjectMetadata } from "./objectStore.ts";
import {
  createSitesFacetCache,
  createSitesStore,
  sitesFacetCacheForQuery,
  type DatabaseQuery,
} from "./sitesStore.ts";
import { decodeSitesCursor } from "./sitesCursor.ts";

const cursorSecret = "sites-store-test-secret-0123456789abcdef";

const identity = {
  canonicalUrl:
    "https://mobbin.com/sites/v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09/f4e176f7-aeb6-4f9a-9689-e4379fc357b1/preview",
  sourceSiteId: "v-7-1fbe80df-2586-4a09-aa5c-29aeeb716a09",
  sourceVersionId: "f4e176f7-aeb6-4f9a-9689-e4379fc357b1",
};

const graph = {
  site: {
    sourceId: "1fbe80df-2586-4a09-aa5c-29aeeb716a09",
    name: "V7",
    slug: identity.sourceSiteId,
    sourceUrl: "https://v7labs.com/",
    description: "AI for private equity and finance",
    logoUrl: "https://cdn.fixture/logo.webp",
    categories: [],
    styles: ["Minimal"],
    popularity: 154,
  },
  version: {
    sourceId: identity.sourceVersionId,
    label: "Jul 2026",
    isLatest: true,
    previewVideoUrl: "https://cdn.fixture/preview.mp4",
  },
  pages: [{
    sourceId: "page-1",
    title: "Home",
    url: "https://v7labs.com/",
    position: 0,
    fullPageImageUrl: "https://cdn.fixture/page.png",
    sections: [{
      sourceId: "section-1",
      position: 0,
      mediaKind: "image" as const,
      mediaUrl: "https://cdn.fixture/page.png",
      cropTop: 0,
      cropBottom: 800,
      ocrBoxes: [],
    }],
  }],
};

function result(
  rows: Array<Record<string, unknown>> = [],
  rowCount = rows.length,
): QueryResult<Record<string, unknown>> {
  return { rows, rowCount, command: "", oid: 0, fields: [] };
}

function assertPostgresParameterContract(
  sql: string,
  values: readonly unknown[],
): void {
  const referenced = new Set(
    [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])),
  );
  for (let index = 1; index <= values.length; index += 1) {
    assert.equal(
      referenced.has(index),
      true,
      `PostgreSQL cannot infer the type of unused parameter $${index}`,
    );
  }
}

function summaryRow(overrides: Record<string, unknown> = {}) {
  return {
    site_id: 1,
    version_id: 2,
    name: "V7",
    slug: graph.site.slug,
    source_url: graph.site.sourceUrl,
    description: graph.site.description,
    logo_url: graph.site.logoUrl,
    categories: graph.site.categories,
    styles: graph.site.styles,
    popularity: graph.site.popularity,
    label: graph.version.label,
    is_latest: true,
    updated_at: new Date("2026-07-29T03:00:00.000Z"),
    page_count: 16,
    section_count: 46,
    preview_content_type: "image/png",
    page_previews: [],
    ...overrides,
  };
}

test("latest Site discovery emits no untyped PostgreSQL parameter holes", async () => {
  const query: DatabaseQuery = async (sql, values = []) => {
    assertPostgresParameterContract(sql, values);
    return result(sql.includes("totals AS")
      ? [{
          site_id: null,
          version_id: null,
          updated_at: null,
          popularity: null,
          total_count: 0,
        }]
      : []);
  };

  await createSitesStore(query).listReadySitesPage({
    platform: "web",
    sort: "latest",
    now: new Date("2026-07-29T04:00:00.000Z"),
    cursorSecret,
  });
});

test("reuses complete facets inside one stable Site snapshot window", async () => {
  let facetCalls = 0;
  const identitySnapshots: unknown[] = [];
  const query: DatabaseQuery = async (sql, values = []) => {
    if (sql.includes("totals AS")) {
      identitySnapshots.push(values[0]);
      return result([{
        site_id: null,
        version_id: null,
        updated_at: null,
        popularity: null,
        total_count: 0,
      }]);
    }
    if (sql.includes("AS facet_group")) {
      facetCalls += 1;
      return result([{
        facet_group: "styles",
        facet_value: "Minimal",
        count: 3,
      }]);
    }
    return result();
  };
  const store = createSitesStore(query);

  await store.listReadySitesPage({
    platform: "web",
    now: new Date("2026-07-29T04:00:10.000Z"),
    cursorSecret,
  });
  await store.listReadySitesPage({
    platform: "web",
    now: new Date("2026-07-29T04:00:50.000Z"),
    cursorSecret,
  });

  assert.deepEqual(identitySnapshots, [
    "2026-07-29T04:00:00.000Z",
    "2026-07-29T04:00:00.000Z",
  ]);
  assert.equal(facetCalls, 1);
});

test("keyset-paginates latest and popular ready Sites without OFFSET", async () => {
  for (const sort of ["latest", "popular"] as const) {
    let identityCalls = 0;
    let facetCalls = 0;
    const identitySql: string[] = [];
    const identityValues: Array<readonly unknown[]> = [];
    const query: DatabaseQuery = async (sql, values = []) => {
      if (sql.includes("totals AS")) {
        identityCalls += 1;
        identitySql.push(sql);
        identityValues.push(values);
        const rows = sort === "latest"
          ? [
              { site_id: 2, version_id: 20, updated_at: "2026-07-29T03:00:00.000Z", popularity: 5, total_count: 2 },
              { site_id: 1, version_id: 10, updated_at: "2026-07-29T02:00:00.000Z", popularity: 99, total_count: 2 },
            ]
          : [
              { site_id: 1, version_id: 10, updated_at: "2026-07-29T02:00:00.000Z", popularity: 99, total_count: 2 },
              { site_id: 2, version_id: 20, updated_at: "2026-07-29T03:00:00.000Z", popularity: 5, total_count: 2 },
            ];
        return result(identityCalls === 1 ? rows : [rows[1]!]);
      }
      if (sql.includes("AS facet_group")) {
        facetCalls += 1;
        return result();
      }
      if (sql.includes("page_previews")) {
        const selectedId = Number((values[0] as number[])[0]);
        return result([summaryRow({
          site_id: selectedId,
          version_id: selectedId === 1 ? 10 : 20,
          popularity: selectedId === 1 ? 99 : 5,
          updated_at: selectedId === 1
            ? new Date("2026-07-29T02:00:00.000Z")
            : new Date("2026-07-29T03:00:00.000Z"),
        })]);
      }
      return result();
    };
    const store = createSitesStore(query);
    const first = await store.listReadySitesPage({
      sort,
      platform: "web",
      limit: 1,
      now: new Date("2026-07-29T04:00:00.000Z"),
      cursorSecret,
    });
    const second = await store.listReadySitesPage({
      sort,
      platform: "web",
      limit: 1,
      cursor: first.nextCursor!,
      cursorSecret,
    });

    assert.equal(first.items.length, 1);
    assert.equal(second.items.length, 1);
    assert.equal(second.totalCount, 2);
    assert.equal(facetCalls, 1);
    assert.equal(identitySql.some((sql) => /\bOFFSET\b/i.test(sql)), false);
    const decoded = decodeSitesCursor(first.nextCursor!, sort, cursorSecret);
    assert.equal(decoded.sort, sort);
    if (decoded.sort === "popular") {
      assert.equal(decoded.popularity, 99);
      assert.match(identitySql[0]!, /ORDER BY popularity DESC, updated_at DESC, site_id DESC/);
      assert.match(identitySql[1]!, /\(popularity, updated_at, site_id\) </);
      assert.ok(identityValues[1]!.includes(99));
    } else {
      assert.match(identitySql[0]!, /ORDER BY updated_at DESC, site_id DESC/);
      assert.match(identitySql[1]!, /\(updated_at, site_id\) </);
    }
  }
});

test("keeps popular pagination and catalog metadata stable after the mutable Site row changes", async () => {
  let identityReads = 0;
  let currentSite = { name: "Original", popularity: 90 };
  const identitySql: string[] = [];
  const summarySql: string[] = [];
  const query: DatabaseQuery = async (sql, values = []) => {
    if (sql.includes("totals AS")) {
      identityReads += 1;
      identitySql.push(sql);
      if (identityReads === 1) {
        return result([
          { site_id: 2, version_id: 20, updated_at: "2026-07-29T03:00:00.000Z", popularity: 100, total_count: 2 },
          { site_id: 1, version_id: 10, updated_at: "2026-07-29T02:00:00.000Z", popularity: 90, total_count: 2 },
        ]);
      }
      const readsVersionSnapshot = /rv\.catalog_snapshot/.test(sql);
      return result([readsVersionSnapshot
        ? { site_id: 1, version_id: 10, updated_at: "2026-07-29T02:00:00.000Z", popularity: 90, total_count: 2 }
        : { site_id: 2, version_id: 20, updated_at: "2026-07-29T03:00:00.000Z", popularity: currentSite.popularity, total_count: 2 }]);
    }
    if (sql.includes("AS facet_group")) return result();
    if (sql.includes("page_previews")) {
      summarySql.push(sql);
      const selectedId = Number((values[0] as number[])[0]);
      const readsVersionSnapshot = /catalog_snapshot/.test(sql);
      return result([summaryRow({
        site_id: selectedId,
        version_id: selectedId === 2 ? 20 : 10,
        name: readsVersionSnapshot ? (selectedId === 2 ? "Top" : "Original") : currentSite.name,
        popularity: readsVersionSnapshot ? (selectedId === 2 ? 100 : 90) : currentSite.popularity,
        updated_at: selectedId === 2
          ? new Date("2026-07-29T03:00:00.000Z")
          : new Date("2026-07-29T02:00:00.000Z"),
      })]);
    }
    return result();
  };
  const store = createSitesStore(query);
  const first = await store.listReadySitesPage({
    platform: "web",
    sort: "popular",
    limit: 1,
    now: new Date("2026-07-29T04:00:00.000Z"),
    cursorSecret,
  });
  currentSite = { name: "Mutated", popularity: 1_000 };
  const second = await store.listReadySitesPage({
    platform: "web",
    sort: "popular",
    limit: 1,
    cursor: first.nextCursor!,
    cursorSecret,
  });

  assert.deepEqual(
    [...first.items, ...second.items].map(({ siteId }) => siteId),
    [2, 1],
  );
  assert.equal(second.items[0]?.name, "Original");
  assert.equal(second.items[0]?.popularity, 90);
  assert.ok(identitySql.every((sql) => /rv\.catalog_snapshot/.test(sql)));
  assert.ok(summarySql.every((sql) => /catalog_snapshot/.test(sql)));
});

test("builds indexed case-insensitive filters without selecting an older matching version", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values = []) => {
    calls.push({ sql, values });
    return result(sql.includes("totals AS")
      ? [{ site_id: null, version_id: null, updated_at: null, popularity: null, total_count: 0 }]
      : []);
  };
  await createSitesStore(query).listReadySitesPage({
    platform: "web",
    query: "  Linear  ",
    filters: [
      { group: "categories", value: "FINANCE" },
      { group: "categories", value: "business" },
      { group: "sections", value: "PRICING" },
      { group: "styles", value: "MINIMAL" },
    ],
    cursorSecret,
  });

  assert.match(calls[0]!.sql, /sv\.catalog_snapshot->'categoriesNormalized' \?\| \$\d+::text\[\]/);
  assert.match(calls[0]!.sql, /sv\.catalog_snapshot->'stylesNormalized' \?\| \$\d+::text\[\]/);
  assert.match(calls[0]!.sql, /lower\(filter_page\.title\) = ANY\(\$\d+::text\[\]\)/);
  assert.match(calls[0]!.sql, /lower\(section_value\.value\) = ANY\(\$\d+::text\[\]\)/);
  assert.match(calls[0]!.sql, /NOT EXISTS \([\s\S]+FROM site_versions newer[\s\S]+newer\.site_id = sv\.site_id/);
  assert.match(calls[0]!.sql, /\(newer\.is_latest, newer\.updated_at, newer\.id\)\s+>\s+\(sv\.is_latest, sv\.updated_at, sv\.id\)/);
  assert.doesNotMatch(calls[0]!.sql, /AS MATERIALIZED/);
  assert.doesNotMatch(calls[0]!.sql, /rv\.catalog_snapshot->'(?:categories|styles)Normalized' \?\|/);
  assert.match(calls[0]!.sql, /rv\.catalog_snapshot->>'name' ILIKE/);
  assert.ok(calls[0]!.values.some((value) =>
    Array.isArray(value) && value.join(",") === "finance,business"
  ));
  assert.ok(calls[0]!.values.some((value) =>
    Array.isArray(value) && value.join(",") === "pricing"
  ));
  assert.ok(calls[0]!.values.some((value) =>
    Array.isArray(value) && value.join(",") === "minimal"
  ));
  assert.ok(calls[0]!.values.includes("Linear"));
  assert.doesNotMatch(calls[0]!.sql, /jsonb_build_object/);
});

test("returns complete own-group-omission Site facets and full filtered total", async () => {
  const calls: string[] = [];
  const query: DatabaseQuery = async (sql) => {
    calls.push(sql);
    if (sql.includes("totals AS")) {
      return result([{
        site_id: null,
        version_id: null,
        updated_at: null,
        popularity: null,
        total_count: 7,
      }]);
    }
    if (sql.includes("AS facet_group")) {
      return result([
        { facet_group: "categories", facet_value: "Business", count: 5 },
        { facet_group: "sections", facet_value: "Pricing", count: 3 },
        { facet_group: "styles", facet_value: "Minimal", count: 4 },
      ]);
    }
    return result();
  };
  const page = await createSitesStore(query).listReadySitesPage({
    platform: "web",
    filters: [
      { group: "categories", value: "Finance" },
      { group: "sections", value: "Pricing" },
      { group: "styles", value: "Minimal" },
    ],
    cursorSecret,
  });

  assert.equal(page.totalCount, 7);
  assert.deepEqual(page.facets, [
    { group: "categories", value: "Business", count: 5 },
    { group: "sections", value: "Pricing", count: 3 },
    { group: "styles", value: "Minimal", count: 4 },
  ]);
  const facetSql = calls.find((sql) => sql.includes("AS facet_group"))!;
  assert.match(facetSql, /omit:categories/);
  assert.match(facetSql, /omit:sections/);
  assert.match(facetSql, /omit:styles/);
  assert.match(facetSql, /COUNT\(DISTINCT rv\.site_id\)::integer/);
  assert.match(facetSql, /categories_ready_versions AS \(/);
  assert.match(facetSql, /sections_ready_versions AS \(/);
  assert.match(facetSql, /styles_ready_versions AS \(/);
  assert.match(facetSql, /sv\.catalog_snapshot->'categoriesNormalized' \?\|/);
  const categoryReadySql = facetSql.match(
    /categories_ready_versions AS \([\s\S]*?sections_ready_versions AS/,
  )?.[0] ?? "";
  assert.doesNotMatch(categoryReadySql, /categoriesNormalized' \?\|/);
  assert.match(categoryReadySql, /stylesNormalized' \?\|/);
  const sectionsReadySql = facetSql.match(
    /sections_ready_versions AS \([\s\S]*?styles_ready_versions AS/,
  )?.[0] ?? "";
  assert.match(sectionsReadySql, /categoriesNormalized' \?\|/);
  assert.match(sectionsReadySql, /stylesNormalized' \?\|/);
  const stylesReadySql = facetSql.match(
    /styles_ready_versions AS \([\s\S]*?SELECT 'categories'/,
  )?.[0] ?? "";
  assert.match(stylesReadySql, /categoriesNormalized' \?\|/);
  assert.doesNotMatch(stylesReadySql, /stylesNormalized' \?\|/);
});

test("Site facet cache has TTL/LRU behavior and is isolated by query identity", () => {
  let now = 0;
  const cache = createSitesFacetCache({ ttlMs: 10, maxEntries: 2, now: () => now });
  const a = [{ group: "styles", value: "A", count: 1 }];
  const b = [{ group: "styles", value: "B", count: 1 }];
  const c = [{ group: "styles", value: "C", count: 1 }];
  cache.set("a", a);
  cache.set("b", b);
  assert.deepEqual(cache.get("a"), a);
  cache.set("c", c);
  assert.equal(cache.get("b"), undefined);
  now = 11;
  assert.equal(cache.get("a"), undefined);

  const first: DatabaseQuery = async () => result();
  const second: DatabaseQuery = async () => result();
  assert.equal(sitesFacetCacheForQuery(first), sitesFacetCacheForQuery(first));
  assert.notEqual(sitesFacetCacheForQuery(first), sitesFacetCacheForQuery(second));
});

test("loads only ready versions", async () => {
  const capturedSql: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql) => {
    capturedSql.push(sql);
    return result();
  };
  const store = createSitesStore(fakeQuery);

  await store.listReadySites();
  await store.readyVersionByCanonicalUrl(identity.canonicalUrl);
  await store.readyVersionDetail(1, 2);

  assert.match(capturedSql[0], /sv\.status = 'ready'/);
  assert.match(capturedSql[1], /sv\.status = 'ready'/);
  assert.match(capturedSql[2], /sv\.status = 'ready'/);
});

test("maps PostgreSQL timestamptz Date values in ready Site summaries", async () => {
  const updatedAt = new Date("2026-07-20T09:32:37.938Z");
  const store = createSitesStore(async () => result([{
    site_id: 1,
    version_id: 2,
    name: "V7",
    slug: graph.site.slug,
    source_url: graph.site.sourceUrl,
    description: graph.site.description,
    logo_url: graph.site.logoUrl,
    categories: graph.site.categories,
    styles: graph.site.styles,
    popularity: graph.site.popularity,
    label: graph.version.label,
    is_latest: true,
    updated_at: updatedAt,
    page_count: 16,
    section_count: 46,
    preview_content_type: "image/png",
  }]));

  const sites = await store.listReadySites();

  assert.equal(sites[0].updatedAt, updatedAt.toISOString());
  assert.equal(sites[0].description, graph.site.description);
  assert.equal(sites[0].logoUrl, graph.site.logoUrl);
  assert.deepEqual(sites[0].categories, []);
  assert.deepEqual(sites[0].styles, ["Minimal"]);
  assert.equal(sites[0].popularity, 154);
  assert.equal(sites[0].previewMediaKind, "image");
});

test("returns the first five ordered page previews in ready Site summaries", async () => {
  const previews = Array.from({ length: 6 }, (_, index) => ({
    id: index + 10,
    title: `Page ${index + 1}`,
    position: index,
  }));
  const store = createSitesStore(async () => result([{
    site_id: 1,
    version_id: 2,
    name: "V7",
    slug: graph.site.slug,
    source_url: graph.site.sourceUrl,
    label: graph.version.label,
    is_latest: true,
    updated_at: new Date("2026-07-20T00:00:00.000Z"),
    page_count: 6,
    section_count: 12,
    page_previews: previews.slice(0, 5),
  }]));

  const [site] = await store.listReadySites();

  assert.deepEqual(site.previews, previews.slice(0, 5).map((page) => ({
    ...page,
    url: `/api/sites/1/versions/2/pages/${page.id}/media`,
  })));
});

test("returns only authenticated API media paths in ready Site views", async () => {
  const fakeQuery: DatabaseQuery = async (sql) => {
    if (/SELECT s\.id AS site_id, sv\.id AS version_id, s\.name/.test(sql)) {
      return result([{
        site_id: 1,
        version_id: 2,
        name: "V7",
        slug: graph.site.slug,
        source_url: graph.site.sourceUrl,
        canonical_url: identity.canonicalUrl,
        label: graph.version.label,
        is_latest: true,
      }]);
    }
    if (/SELECT sp\.id, sp\.source_page_id/.test(sql)) {
      return result([{ id: 3, source_page_id: "page-1", title: "Home", page_url: graph.pages[0].url, position: 0 }]);
    }
    if (/SELECT ss\.id, ss\.page_id/.test(sql)) {
      return result([{
        id: 4,
        page_id: 3,
        source_section_id: "section-1",
        position: 0,
        media_kind: "video",
        poster_object_key: "sites/poster.webp",
        crop_top: null,
        crop_bottom: null,
        video_start_seconds: 1,
        video_end_seconds: 2,
        ocr_boxes: [],
        source_metadata: { patterns: ["Hero Section"] },
      }]);
    }
    return result();
  };

  const view = await createSitesStore(fakeQuery).readyVersionDetail(1, 2);
  assert.equal(view?.previewUrl, "/api/sites/1/versions/2/media/preview");
  assert.equal(view?.pages[0].fullPageImageUrl, "/api/sites/1/versions/2/pages/3/media");
  assert.equal(view?.pages[0].sections[0].mediaUrl, "/api/sites/1/versions/2/sections/4/media");
  assert.equal(view?.pages[0].sections[0].posterUrl, "/api/sites/1/versions/2/sections/4/poster");
  assert.deepEqual(view?.pages[0].sections[0].sourceMetadata, { patterns: ["Hero Section"] });
});

test("maps image Site sections without optional crop bounds", async () => {
  const fakeQuery: DatabaseQuery = async (sql) => {
    if (/SELECT s\.id AS site_id, sv\.id AS version_id, s\.name/.test(sql)) {
      return result([{
        site_id: 1,
        version_id: 2,
        name: "V7",
        slug: graph.site.slug,
        source_url: graph.site.sourceUrl,
        canonical_url: identity.canonicalUrl,
        label: graph.version.label,
        is_latest: true,
      }]);
    }
    if (/SELECT sp\.id, sp\.source_page_id/.test(sql)) {
      return result([{ id: 3, source_page_id: "page-1", title: "Home", page_url: graph.pages[0].url, position: 0 }]);
    }
    if (/SELECT ss\.id, ss\.page_id/.test(sql)) {
      return result([{
        id: 4,
        page_id: 3,
        source_section_id: "section-1",
        position: 0,
        media_kind: "image",
        poster_object_key: null,
        crop_top: null,
        crop_bottom: null,
        video_start_seconds: null,
        video_end_seconds: null,
        ocr_boxes: [],
        source_metadata: {},
      }]);
    }
    return result();
  };

  const view = await createSitesStore(fakeQuery).readyVersionDetail(1, 2);

  assert.equal(view?.pages[0].sections[0].cropTop, undefined);
  assert.equal(view?.pages[0].sections[0].cropBottom, undefined);
});

test("returns ready Site versions newest-first in version detail", async () => {
  const store = createSitesStore(async (sql) => {
    if (/SELECT s\.id AS site_id, sv\.id AS version_id/.test(sql)) {
      return result([{
        site_id: 1,
        version_id: 2,
        name: "V7",
        slug: graph.site.slug,
        source_url: graph.site.sourceUrl,
        canonical_url: identity.canonicalUrl,
        label: "Jul 2026",
        is_latest: true,
      }]);
    }
    if (/SELECT sv\.id, sv\.label, sv\.is_latest, sv\.updated_at/.test(sql)) {
      return result([
        { id: 2, label: "Jul 2026", is_latest: true, updated_at: new Date("2026-07-20T00:00:00Z") },
        { id: 1, label: "Nov 2025", is_latest: false, updated_at: new Date("2025-11-20T00:00:00Z") },
      ]);
    }
    return result();
  });

  const detail = await store.readyVersionDetail(1, 2);

  assert.deepEqual(detail?.versions, [
    { id: 2, label: "Jul 2026", isLatest: true, updatedAt: "2026-07-20T00:00:00.000Z" },
    { id: 1, label: "Nov 2025", isLatest: false, updatedAt: "2025-11-20T00:00:00.000Z" },
  ]);
});

test("media resolution is scoped to one ready Site version", async () => {
  const capturedSql: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql) => {
    capturedSql.push(sql);
    return result();
  };
  const store = createSitesStore(fakeQuery);

  await store.siteMediaObject({
    siteId: 1,
    versionId: 2,
    kind: "section",
    recordId: 3,
  });

  assert.match(
    capturedSql.at(-1)!,
    /s\.id = \$1[\s\S]+sv\.id = \$2[\s\S]+sv\.status = 'ready'/,
  );
  assert.match(capturedSql.at(-1)!, /ss\.id = \$3/);
});

test("beginImport resets only a non-ready version to importing", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/INSERT INTO sites/.test(sql)) return result([{ id: 1 }]);
    if (/INSERT INTO site_versions/.test(sql)) return result([{ id: 2 }]);
    return result();
  };

  const created = await createSitesStore(fakeQuery).beginImport(identity, graph);

  assert.deepEqual(created, { siteId: 1, versionId: 2 });
  const versionUpsert = calls.find((call) => /INSERT INTO site_versions/.test(call.sql));
  assert.match(versionUpsert!.sql, /status = CASE[\s\S]+status = 'ready'/);
  assert.match(versionUpsert!.sql, /ELSE 'importing'/);
  assert.match(versionUpsert!.sql, /catalog_snapshot/);
  assert.deepEqual(
    JSON.parse(String(versionUpsert!.values?.at(-1))),
    {
      name: graph.site.name,
      slug: graph.site.slug,
      sourceUrl: graph.site.sourceUrl,
      description: graph.site.description,
      logoUrl: graph.site.logoUrl,
      categories: graph.site.categories,
      categoriesNormalized: [],
      styles: graph.site.styles,
      stylesNormalized: ["minimal"],
      popularity: graph.site.popularity,
    },
  );
  const siteUpsert = calls.find((call) => /INSERT INTO sites/.test(call.sql));
  assert.match(siteUpsert!.sql, /description/);
  assert.deepEqual(siteUpsert!.values?.slice(4), [
    graph.site.description,
    graph.site.logoUrl,
    JSON.stringify(graph.site.categories),
    JSON.stringify(graph.site.styles),
    graph.site.popularity,
  ]);
});

test("adds a Mobbin capture as a version of an existing Site with the same URL", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT id[\s\S]+regexp_replace\(lower\(source_url\)/.test(sql)) {
      return result([{ id: 7 }]);
    }
    if (/UPDATE sites[\s\S]+RETURNING id/.test(sql)) return result([{ id: 7 }]);
    if (/INSERT INTO site_versions/.test(sql)) return result([{ id: 8 }]);
    return result();
  };

  const created = await createSitesStore(fakeQuery).beginImport(identity, graph);

  assert.deepEqual(created, { siteId: 7, versionId: 8 });
  assert.equal(calls.some(({ sql }) => /INSERT INTO sites/.test(sql)), false);
  assert.equal(
    calls.find(({ sql }) => /INSERT INTO site_versions/.test(sql))?.values?.[0],
    7,
  );
});

test("completeImport writes object metadata and graph before the final ready transition", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  let pageId = 10;
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/FOR UPDATE/.test(sql)) {
      return result([{ site_id: 1, version_id: 2, status: "importing" }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: values?.[0] }]);
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: pageId++ }]);
    if (/INSERT INTO site_sections/.test(sql)) return result([{ id: 20 }]);
    if (/page_count/.test(sql) && /section_count/.test(sql)) {
      return result([{ page_count: 1, section_count: 1 }]);
    }
    if (/UPDATE site_versions/.test(sql) && /status = 'ready'/.test(sql)) {
      return result([{ id: 2 }]);
    }
    return result();
  };
  const objects: ObjectMetadata[] = [
    metadata("sites/source.json", "application/json"),
    metadata("sites/preview.png", "image/png"),
    metadata("sites/page.png", "image/png"),
    metadata("sites/section.png", "image/png"),
  ];

  const completed = await createSitesStore(fakeQuery).completeImport({
    identity,
    graph,
    objectKeys: {
      source: "sites/source.json",
      preview: "sites/preview.png",
      pages: { "page-1": "sites/page.png" },
      sections: { "section-1": { media: "sites/section.png" } },
    },
  }, objects);

  assert.deepEqual(completed, { siteId: 1, versionId: 2 });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1)!.sql, "COMMIT");
  const readyIndex = calls.findIndex((call) => /status = 'ready'/.test(call.sql));
  const sectionIndex = calls.findIndex((call) => /INSERT INTO site_sections/.test(call.sql));
  assert.ok(readyIndex > sectionIndex);
  assert.match(calls.map(({ sql }) => sql).join("\n"), /SET is_latest = false[\s\S]+id <> \$2/);
  assert.match(calls[readyIndex].sql, /is_latest = true/);
});

test("completeImport persists image Site sections without optional crop bounds", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (/FOR UPDATE/.test(sql)) {
      return result([{ site_id: 1, version_id: 2, status: "importing" }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: values?.[0] }]);
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: 10 }]);
    if (/INSERT INTO site_sections/.test(sql)) return result([{ id: 20 }]);
    if (/page_count/.test(sql) && /section_count/.test(sql)) {
      return result([{ page_count: 1, section_count: 1 }]);
    }
    if (/UPDATE site_versions/.test(sql) && /status = 'ready'/.test(sql)) {
      return result([{ id: 2 }]);
    }
    return result();
  };
  const section = graph.pages[0].sections[0];
  const graphWithoutCrop = {
    ...graph,
    pages: [{
      ...graph.pages[0],
      sections: [{
        sourceId: section.sourceId,
        position: section.position,
        mediaKind: section.mediaKind,
        mediaUrl: section.mediaUrl,
        ocrBoxes: section.ocrBoxes,
      }],
    }],
  };
  const objects: ObjectMetadata[] = [
    metadata("sites/source.json", "application/json"),
    metadata("sites/preview.png", "image/png"),
    metadata("sites/page.png", "image/png"),
    metadata("sites/section.png", "image/png"),
  ];

  await createSitesStore(fakeQuery).completeImport({
    identity,
    graph: graphWithoutCrop,
    objectKeys: {
      source: "sites/source.json",
      preview: "sites/preview.png",
      pages: { "page-1": "sites/page.png" },
      sections: { "section-1": { media: "sites/section.png" } },
    },
  }, objects);

  const sectionInsert = calls.find((call) => /INSERT INTO site_sections/.test(call.sql));
  assert.equal(sectionInsert?.values?.[6], null);
  assert.equal(sectionInsert?.values?.[7], null);
});

test("completeImport rolls back when persisted counts do not match", async () => {
  const calls: string[] = [];
  const fakeQuery: DatabaseQuery = async (sql, values) => {
    calls.push(sql);
    if (/FOR UPDATE/.test(sql)) {
      return result([{ site_id: 1, version_id: 2, status: "importing" }]);
    }
    if (/INSERT INTO stored_objects/.test(sql)) return result([{ object_key: values?.[0] }]);
    if (/INSERT INTO site_pages/.test(sql)) return result([{ id: 10 }]);
    if (/INSERT INTO site_sections/.test(sql)) return result([{ id: 20 }]);
    if (/page_count/.test(sql) && /section_count/.test(sql)) {
      return result([{ page_count: 1, section_count: 0 }]);
    }
    return result();
  };

  await assert.rejects(
    createSitesStore(fakeQuery).completeImport({
      identity,
      graph,
      objectKeys: {
        source: "sites/source.json",
        preview: "sites/preview.png",
        pages: { "page-1": "sites/page.png" },
        sections: { "section-1": { media: "sites/section.png" } },
      },
    }, [
      metadata("sites/source.json", "application/json"),
      metadata("sites/preview.png", "image/png"),
      metadata("sites/page.png", "image/png"),
      metadata("sites/section.png", "image/png"),
    ]),
    /persisted Site graph count mismatch/i,
  );
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.doesNotMatch(calls.join("\n"), /status = 'ready'/);
});

function metadata(
  key: string,
  contentType: ObjectMetadata["contentType"],
): ObjectMetadata {
  return {
    key,
    sha256: "a".repeat(64),
    byteSize: 10,
    contentType,
    accessClass: "protected",
  };
}
