import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  adminCatalogPage,
  catalogFacetCacheForQuery,
  createCatalogFacetCache,
  publishedCatalogAppSlugs,
  publishedCatalogPage,
  type DatabaseQuery,
} from "./publicCatalogStore.ts";

import {
  CatalogCursorError,
  decodeCatalogCursor,
  encodeCatalogCursor,
  encodeUpdatedCatalogCursor,
} from "./catalogCursor.ts";

test("loads published sitemap App slugs in one bounded query", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const appSlugs = await publishedCatalogAppSlugs(
    { platform: "web", now: new Date("2026-08-26T04:59:59.000Z") },
    async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ app: "figma" }, { app: "linear" }, { app: null }], rowCount: 3 } as QueryResult;
    },
  );

  assert.deepEqual(appSlugs, ["figma", "linear"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /SELECT DISTINCT a\.name AS app/);
  assert.match(calls[0]!.sql, /latest\.screen_count > 0/);
  assert.deepEqual(calls[0]!.values, ["2026-08-26T04:59:00.000Z", "web"]);
});

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
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

function preview(app: string, id: number) {
  return {
    id,
    app,
    platform: "web",
    image_url: `capture:${String(id).padStart(16, "0")}`,
    kind: "screen",
    description: null,
    analysis: null,
    capture_url: null,
    viewport_width: 1440,
    viewport_height: 900,
    state_context: null,
    captured_at: "2026-07-25T00:00:00.000Z",
    preview_rank: 1,
  };
}

test("latest discovery emits no untyped PostgreSQL parameter holes", async () => {
  const query: DatabaseQuery = async (sql, values = []) => {
    assertPostgresParameterContract(sql, values);
    return result(sql.includes("totals AS")
      ? [{
          app_id: null,
          app: null,
          updated_at: null,
          total_screens: null,
          total_count: 0,
        }]
      : []);
  };

  await publishedCatalogPage({
    platform: "web",
    sort: "latest",
    now: new Date("2026-07-29T04:00:00.000Z"),
  }, query);
});

test("reuses complete facets inside one stable public catalog snapshot window", async () => {
  let facetCalls = 0;
  const identitySnapshots: unknown[] = [];
  const query: DatabaseQuery = async (sql, values = []) => {
    if (sql.includes("totals AS")) {
      identitySnapshots.push(values[0]);
      return result([{
        app_id: null,
        app: null,
        updated_at: null,
        total_screens: null,
        total_count: 0,
      }]);
    }
    if (sql.includes("AS facet_group")) {
      facetCalls += 1;
      return result([{
        facet_group: "categories",
        facet_value: "Business",
        count: 3,
      }]);
    }
    return result();
  };
  const cache = createCatalogFacetCache();

  await publishedCatalogPage({
    platform: "web",
    now: new Date("2026-07-29T04:00:10.000Z"),
  }, query, cache);
  await publishedCatalogPage({
    platform: "web",
    now: new Date("2026-07-29T04:00:50.000Z"),
  }, query, cache);

  assert.deepEqual(identitySnapshots, [
    "2026-07-29T04:00:00.000Z",
    "2026-07-29T04:00:00.000Z",
  ]);
  assert.equal(facetCalls, 1);
});

test("selects admin discovery Apps from unpublished versions with filters, progress, facets, and trending order", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("total_count")) {
      return result([{
        app_id: 42,
        app: "draft-linear",
        updated_at: "2026-07-26T03:03:57.624Z",
        total_screens: 9,
        total_count: 1,
      }]);
    }
    if (sql.includes("AS facet_group")) {
      return result([
        { facet_group: "categories", facet_value: "Business", count: 1 },
        { facet_group: "screens", facet_value: "Dashboard", count: 1 },
      ]);
    }
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: 42,
        app: "draft-linear",
        display_name: "Draft Linear",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 9,
        analyzed_screens: 3,
        available_platforms: ["web"],
      }]);
    }
    return result([preview("draft-linear", 1)]);
  };

  const page = await adminCatalogPage({
    now: new Date("2026-07-26T04:00:00.000Z"),
    platform: "web",
    query: "linear",
    sort: "trending",
    filters: [
      { group: "categories", value: "Business" },
      { group: "screens", value: "Dashboard" },
    ],
  }, query);

  assert.equal(page.apps[0]?.app, "draft-linear");
  assert.equal(page.apps[0]?.analyzed_screens, 3);
  assert.equal(page.totalCount, 1);
  assert.deepEqual(page.facets, [
    { group: "categories", value: "Business", count: 1 },
    { group: "screens", value: "Dashboard", count: 1 },
  ]);
  assert.doesNotMatch(calls[0]?.sql ?? "", /av\.published_at IS NOT NULL/);
  assert.match(calls[0]?.sql ?? "", /lower\(c\.name\) = ANY/);
  assert.match(calls[0]?.sql ?? "", /pfp\.facet_group = 'screens'/);
  assert.match(calls[0]?.sql ?? "", /ORDER BY popularity_score DESC/);
});

test("scopes admin analyzed progress to the requested platform", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("totals AS")) {
      return result([{
        app_id: 42,
        app: "multi-platform",
        updated_at: "2026-07-26T03:03:57.624Z",
        total_screens: 4,
        total_count: 1,
      }]);
    }
    if (sql.includes("AS facet_group")) return result();
    if (sql.includes("AS categories")) {
      const scoped = /progress_platform\.name = \$3/.test(sql);
      return result([{
        app_id: 42,
        app: "multi-platform",
        display_name: "Multi Platform",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 4,
        analyzed_screens: scoped ? 1 : 9,
        available_platforms: ["web"],
      }]);
    }
    return result([preview("multi-platform", 1)]);
  };

  const page = await adminCatalogPage({
    platform: "web",
    now: new Date("2026-07-26T04:00:00.000Z"),
  }, query);

  assert.equal(page.apps[0]?.total_screens, 4);
  assert.equal(page.apps[0]?.analyzed_screens, 1);
  assert.deepEqual(page.apps[0]?.available_platforms, ["web"]);
  const metadata = calls.find(({ sql }) => sql.includes("AS categories"));
  assert.ok(metadata);
  assert.match(metadata.sql, /progress_platform\.name = \$3/);
  assert.deepEqual(metadata.values, [[42], "2026-07-26T04:00:00.000Z", "web"]);
});

test("emits stable latest and trending cursors for admin discovery", async () => {
  for (const sort of ["latest", "trending"] as const) {
    let call = 0;
    const query: DatabaseQuery = async (sql) => {
      call += 1;
      if (call === 1) {
        return result([
          {
            app_id: 2,
            app: "newer",
            updated_at: "2026-07-26T03:00:00.000Z",
            total_screens: 9,
            popularity_score: 9,
            total_count: 2,
          },
          {
            app_id: 1,
            app: "older",
            updated_at: "2026-07-26T02:00:00.000Z",
            total_screens: 4,
            popularity_score: 4,
            total_count: 2,
          },
        ]);
      }
      if (sql.includes("jsonb_agg")) {
        return result([{
          app_id: 2,
          app: "newer",
          display_name: "Newer",
          categories: [],
          website_url: null,
          icon_url: null,
          accent_color: null,
          total_screens: 9,
          analyzed_screens: 2,
          available_platforms: ["web"],
        }]);
      }
      if (sql.includes("AS facet_group")) return result();
      return result([preview("newer", 1)]);
    };
    const page = await adminCatalogPage({
      limit: 1,
      sort,
      now: new Date("2026-07-26T04:00:00.000Z"),
    }, query);
    const decoded = decodeCatalogCursor(page.nextCursor!, sort);

    assert.equal(decoded.sort, sort);
    assert.equal(decoded.appId, 2);
    if (decoded.sort === "trending") assert.equal(decoded.popularityScore, 9);
  }
});

test("selects published Apps globally by Updated At and emits a snapshot cursor", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const selected = [
    { app_id: 91, app: "alltrails", updated_at: "2026-07-26T03:14:54.618Z" },
    { app_id: 42, app: "ipsy", updated_at: "2026-07-26T03:03:57.624Z" },
    { app_id: 17, app: "tubi", updated_at: "2026-07-26T02:57:07.457Z" },
  ];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(selected);
    if (calls.length === 2) {
      return result(selected.slice(0, 2).reverse().map(({ app_id, app }) => ({
        app_id,
        app,
        display_name: app.toUpperCase(),
        categories: [{
          id: 7,
          name: "Productivity",
          slug: "productivity",
        }],
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(selected.slice(0, 2).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage(
    { limit: 2, now: new Date("2026-07-26T04:00:00.000Z") },
    query,
  );

  assert.deepEqual(page.apps.map(({ app }) => app), ["alltrails", "ipsy"]);
  assert.equal(page.apps[0]?.last_captured_at, selected[0]?.updated_at);
  assert.equal(page.apps[0]?.created_at, selected[0]?.updated_at);
  assert.deepEqual(decodeCatalogCursor(page.nextCursor!, "latest"), {
    v: 2,
    sort: "latest",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });
  assert.deepEqual(calls[0]?.values, [
    "2026-07-26T04:00:00.000Z",
    null,
    null,
    null,
    null,
    3,
  ]);
  assert.match(calls[0]?.sql ?? "", /ORDER BY updated_at DESC,\s*app_id DESC/);
  assert.match(
    calls[0]?.sql ?? "",
    /date_trunc\('milliseconds', MAX\(latest\.captured_at\)\) AS updated_at/,
  );
  assert.match(calls[0]?.sql ?? "", /latest\.screen_count > 0/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /JOIN LATERAL/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /JOIN images/);
  assert.match(calls[0]?.sql ?? "", /av\.published_at <= \$1::timestamptz/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /av\.status = 'published'/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /GROUP BY[\s\S]*MAX\(i\.created_at\)/);
  assert.match(calls[1]?.sql ?? "", /\b(?:FROM|JOIN) app_categories/);
  assert.match(calls[1]?.sql ?? "", /JOIN categories/);
  assert.match(calls[1]?.sql ?? "", /jsonb_agg/);
  assert.match(calls[1]?.sql ?? "", /a\.description/);
  assert.doesNotMatch(calls[1]?.sql ?? "", /\ba\.category\b/);
});

test("selects one extra Updated At identity before reading bounded catalog metadata", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const identities = Array.from({ length: 25 }, (_, index) => ({
    app_id: index + 1,
    app: `app-${String(index + 1).padStart(2, "0")}`,
    updated_at: new Date(Date.UTC(2026, 6, 26, 4, 0, 0) - index * 1_000).toISOString(),
  }));
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return result(identities);
    if (calls.length === 2) {
      return result(identities.slice(0, 24).map(({ app_id, app }) => ({
        app_id,
        app,
        display_name: app.toUpperCase(),
        categories: [{
          id: 7,
          name: "Productivity",
          slug: "productivity",
        }],
        website_url: null,
        icon_url: null,
        accent_color: "#123456",
        total_screens: 12,
        available_platforms: ["web"],
      })));
    }
    return result(identities.slice(0, 24).map(({ app }, index) => preview(app, index + 1)));
  };

  const page = await publishedCatalogPage(
    { limit: 24, now: new Date("2026-07-26T04:00:00.000Z") },
    query,
  );

  assert.equal(page.apps.length, 24);
  assert.equal(page.previews.length, 24);
  assert.equal(decodeCatalogCursor(page.nextCursor!, "latest").appId, 24);
  assert.match(calls[0]?.sql ?? "", /LIMIT \$6/);
  assert.match(calls[1]?.sql ?? "", /ANY\(\$1::integer\[\]\)/);
  assert.match(calls[2]?.sql ?? "", /preview_rank <= 3/);
  assert.match(calls[2]?.sql ?? "", /JOIN LATERAL/);
  assert.match(calls[2]?.sql ?? "", /preview_category AS MATERIALIZED/);
  assert.match(calls[2]?.sql ?? "", /preview_category[\s\S]*app_preview_images manual/);
  assert.match(calls[2]?.sql ?? "", /lower\(pfp\.facet_value\) = 'preview'/);
  assert.match(calls[2]?.sql ?? "", /-2 AS source_priority/);
  assert.match(calls[2]?.sql ?? "", /curated AS MATERIALIZED/);
  assert.match(calls[2]?.sql ?? "", /fast_fallback AS MATERIALIZED/);
  assert.match(calls[2]?.sql ?? "", /UNION ALL/);
  assert.match(calls[2]?.sql ?? "", /candidate\.platform_id = p\.id[\s\S]*candidate\.kind = 'screen'/);
  // Fallback previews rank by stored byte size before recency, so blank
  // splash/loading captures never become an app's public face.
  assert.match(
    calls[2]?.sql ?? "",
    /ORDER BY heft\.byte_size DESC NULLS LAST,\s+candidate\.created_at DESC, candidate\.id DESC\s+LIMIT 3/,
  );
  assert.match(calls[2]?.sql ?? "", /\(SELECT COUNT\(\*\) FROM preview_category\)[\s\S]*\(SELECT COUNT\(\*\) FROM curated\)[\s\S]*\(SELECT COUNT\(\*\) FROM fast_fallback\)[\s\S]*< 3/);
  assert.doesNotMatch(calls[2]?.sql ?? "", /DISTINCT ON \(a\.id, latest\.platform, i\.id\)/);
  assert.match(calls[2]?.sql ?? "", /PARTITION BY app, platform/);
  assert.match(calls[2]?.sql ?? "", /ORDER BY platform_rank, platform/);
});

test("reuses the Updated At snapshot cursor and clamps the page size", async () => {
  const calls: Array<{ values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (_sql, values) => {
    calls.push({ values });
    return result();
  };
  const cursor = encodeUpdatedCatalogCursor({
    v: 1,
    sort: "updated",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });

  await publishedCatalogPage({ cursor, limit: 500 }, query);

  assert.deepEqual(calls[0]?.values, [
    "2026-07-26T04:00:00.000Z",
    "2026-07-26T03:03:57.624Z",
    42,
    null,
    null,
    25,
  ]);
});

test("filters catalog identities by category and platform before pagination", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result();
  };

  await publishedCatalogPage({
    filters: [{ group: "categories", value: "CRM" }],
    platform: "web",
  }, query);

  assert.deepEqual(calls[0]?.values?.slice(3), ["web", null, ["crm"], 25]);
  assert.match(calls[0]?.sql ?? "", /JOIN categories c/);
  assert.match(calls[0]?.sql ?? "", /lower\(c\.name\) = ANY\(\$6::text\[\]\)/);
  assert.match(calls[0]?.sql ?? "", /platform_latest\.platform = \$4/);
});

test("filters catalog identities through normalized Flow mappings", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    return result();
  };

  await publishedCatalogPage({
    filters: [{
      group: "flows",
      value: "Logging in (saved login info)",
    }],
    platform: "android",
  }, query);

  assert.deepEqual(
    calls[0]?.values?.slice(3),
    ["android", null, ["logging in (saved login info)"], 25],
  );
  assert.match(calls[0]?.sql ?? "", /JOIN app_flow_versions afv/);
  assert.match(calls[0]?.sql ?? "", /JOIN app_flow_version_mappings mapping/);
  assert.match(calls[0]?.sql ?? "", /JOIN flows canonical/);
  assert.match(calls[0]?.sql ?? "", /lower\(canonical\.name\) = ANY\(\$6::text\[\]\)/);
});

test("rejects malformed Updated At cursors", async () => {
  await assert.rejects(
    () => publishedCatalogPage(
      { cursor: "***", limit: 3 },
      async () => { throw new Error("query should not run"); },
    ),
    CatalogCursorError,
  );
});

test("rejects a cursor whose sort does not match the request", async () => {
  let calls = 0;
  const cursor = encodeCatalogCursor({
    v: 2,
    sort: "latest",
    snapshotAt: "2026-07-26T04:00:00.000Z",
    updatedAt: "2026-07-26T03:03:57.624Z",
    appId: 42,
  });
  await assert.rejects(
    () => publishedCatalogPage(
      { cursor, sort: "trending" },
      async () => {
        calls += 1;
        return result();
      },
    ),
    CatalogCursorError,
  );
  assert.equal(calls, 0);
});

test("ORs values within a filter group and ANDs different groups with parameters", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) {
      const categories = values?.find(
        (value) => Array.isArray(value) && value.includes("crm"),
      ) as string[] | undefined;
      const flows = values?.find(
        (value) => Array.isArray(value) && value.includes("setting up"),
      ) as string[] | undefined;
      return categories?.length === 2 && flows?.length === 1
        ? result([{
            app_id: 1,
            app: "linear",
            updated_at: "2026-07-26T03:14:54.618Z",
            total_count: 1,
          }])
        : result();
    }
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: 1,
        app: "linear",
        display_name: "Linear",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 1,
        available_platforms: ["web"],
      }]);
    }
    if (sql.includes("facet_group")) return result();
    return result([preview("linear", 1)]);
  };

  const page = await publishedCatalogPage({
    platform: "web",
    filters: [
      { group: "categories", value: "CRM" },
      { group: "categories", value: "Sales" },
      { group: "flows", value: "Setting Up" },
    ],
  }, query);

  assert.deepEqual(page.apps.map(({ app }) => app), ["linear"]);
  assert.match(calls[0]?.sql ?? "", /lower\(c\.name\) = ANY\(/);
  assert.match(calls[0]?.sql ?? "", /lower\(canonical\.name\) = ANY\(/);
  assert.match(
    calls[0]?.sql ?? "",
    /EXISTS[\s\S]*app_categories[\s\S]*AND EXISTS[\s\S]*app_flow_version_mappings/,
  );
  assert.ok(calls[0]?.values?.some(
    (value) => Array.isArray(value) && JSON.stringify(value) === '["crm","sales"]',
  ));
  assert.ok(calls[0]?.values?.some(
    (value) => Array.isArray(value) && JSON.stringify(value) === '["setting up"]',
  ));
});

test("returns a full filtered total and complete facets with own-group filters omitted", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("total_count")) {
      return result([{
        app_id: 42,
        app: "ipsy",
        updated_at: "2026-07-26T03:03:57.624Z",
        total_count: 9,
      }]);
    }
    if (sql.includes("AS facet_group")) {
      return result([
        { facet_group: "categories", facet_value: "Shopping", count: 7 },
        { facet_group: "categories", facet_value: "CRM", count: 2 },
        { facet_group: "flows", facet_value: "Setting Up", count: 4 },
        {
          facet_group: "screens",
          facet_value: "Signup",
          count: 3,
          section: "New User Experience",
          description: "Screens centered on signup.",
          aliases: ["sign up", "register"],
          section_position: 1,
          pattern_position: 3,
        },
        { facet_group: "elements", facet_value: "Dialog", count: 5 },
      ]);
    }
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: 42,
        app: "ipsy",
        display_name: "Ipsy",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 1,
        available_platforms: ["web"],
      }]);
    }
    return result([preview("ipsy", 1)]);
  };

  const page = await publishedCatalogPage({
    cursor: encodeUpdatedCatalogCursor({
      v: 1,
      sort: "updated",
      snapshotAt: "2026-07-26T04:00:00.000Z",
      updatedAt: "2026-07-26T03:10:00.000Z",
      appId: 99,
    }),
    platform: "web",
    query: "shop",
    filters: [
      { group: "categories", value: "Shopping" },
      { group: "flows", value: "Setting Up" },
    ],
    limit: 1,
  }, query);

  assert.equal(page.apps.length, 1);
  assert.equal(page.totalCount, 9);
  assert.deepEqual(page.facets, [
    { group: "categories", value: "CRM", count: 2 },
    { group: "categories", value: "Shopping", count: 7 },
    { group: "elements", value: "Dialog", count: 5 },
    { group: "flows", value: "Setting Up", count: 4 },
    {
      group: "screens",
      value: "Signup",
      count: 3,
      section: "New User Experience",
      description: "Screens centered on signup.",
      aliases: ["sign up", "register"],
      sectionPosition: 1,
      position: 3,
    },
  ]);
  const facetCall = calls.find(({ sql }) => sql.includes("AS facet_group"));
  assert.ok(facetCall);
  assert.match(facetCall.sql, /'categories' AS facet_group[\s\S]*app_categories/);
  assert.match(facetCall.sql, /'flows' AS facet_group[\s\S]*app_flow_version_mappings/);
  assert.match(facetCall.sql, /'screens' AS facet_group[\s\S]*public_facet_previews/);
  assert.match(facetCall.sql, /FROM screen_patterns pattern/);
  assert.match(facetCall.sql, /JOIN screen_pattern_sections section/);
  assert.match(facetCall.sql, /'elements' AS facet_group[\s\S]*public_facet_previews/);
  assert.match(facetCall.sql, /omit:categories/);
  assert.match(facetCall.sql, /omit:flows/);
  assert.match(facetCall.sql, /flow_eligible_apps AS MATERIALIZED/);
  assert.match(
    facetCall.sql,
    /JOIN flow_eligible_apps flow_eligible\s+ON flow_eligible\.app_id = facet_latest\.app_id/,
  );
});

test("scopes trending totals, App metadata, and previews to the requested platform", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("totals AS")) {
      const platformScoped = /av\.platform = \$5/.test(sql);
      return result(platformScoped
        ? [{
            app_id: 1,
            app: "web-leader",
            updated_at: "2026-07-26T03:00:00.000Z",
            total_screens: 4,
            popularity_score: 4,
            total_count: 2,
          }, {
            app_id: 2,
            app: "mobile-heavy",
            updated_at: "2026-07-26T02:00:00.000Z",
            total_screens: 3,
            popularity_score: 3,
            total_count: 2,
          }]
        : [{
            app_id: 2,
            app: "mobile-heavy",
            updated_at: "2026-07-26T02:00:00.000Z",
            total_screens: 103,
            popularity_score: 103,
            total_count: 2,
          }, {
            app_id: 1,
            app: "web-leader",
            updated_at: "2026-07-26T03:00:00.000Z",
            total_screens: 4,
            popularity_score: 4,
            total_count: 2,
          }]);
    }
    if (sql.includes("AS facet_group")) return result();
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: 1,
        app: "web-leader",
        display_name: "Multi Platform",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 4,
        available_platforms: ["web"],
      }]);
    }
    return result([preview("web-leader", 1)]);
  };

  const page = await publishedCatalogPage({
    platform: "web",
    sort: "trending",
    limit: 1,
    now: new Date("2026-07-26T04:00:00.000Z"),
  }, query);

  assert.equal(page.apps[0]?.app, "web-leader");
  assert.equal(page.apps[0]?.total_screens, 4);
  assert.deepEqual(page.apps[0]?.available_platforms, ["web"]);
  assert.deepEqual(page.previews.map(({ platform }) => platform), ["web"]);
  const identity = calls.find(({ sql }) => sql.includes("totals AS"));
  const metadata = calls.find(({ sql }) => sql.includes("jsonb_agg"));
  const previews = calls.find(({ sql }) => sql.includes("platform_ranked AS"));
  assert.ok(identity && metadata && previews);
  assert.match(
    identity.sql,
    /FROM app_versions av[\s\S]*av\.platform = \$5[\s\S]*ORDER BY av\.app_id/,
  );
  assert.match(
    metadata.sql,
    /FROM app_versions av[\s\S]*av\.platform = \$3[\s\S]*ORDER BY av\.app_id/,
  );
  assert.match(
    previews.sql,
    /FROM app_versions av[\s\S]*av\.platform = \$3[\s\S]*ORDER BY av\.app_id/,
  );
  assert.deepEqual(metadata.values, [[1], "2026-07-26T04:00:00.000Z", "web"]);
  assert.deepEqual(previews.values?.slice(0, 3), [
    [1],
    "2026-07-26T04:00:00.000Z",
    "web",
  ]);
  const cursor = decodeCatalogCursor(page.nextCursor!, "trending");
  assert.equal(cursor.sort === "trending" ? cursor.popularityScore : null, 4);
});

test("prioritizes exact screen and element facet preview images with match metadata", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const query: DatabaseQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("totals AS")) {
      return result([{
        app_id: 1,
        app: "linear",
        updated_at: "2026-07-26T03:00:00.000Z",
        total_screens: 8,
        total_count: 1,
      }]);
    }
    if (sql.includes("AS facet_group")) return result();
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: 1,
        app: "linear",
        display_name: "Linear",
        categories: [],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 8,
        available_platforms: ["web"],
      }]);
    }
    return result([{
      ...preview("linear", 99),
      matched_facets: [
        { group: "screens", value: "Dashboard" },
        { group: "elements", value: "Dialog" },
      ],
    }]);
  };

  const page = await publishedCatalogPage({
    platform: "web",
    filters: [
      { group: "screens", value: "Dashboard" },
      { group: "elements", value: "Dialog" },
    ],
  }, query);

  const previews = calls.find(({ sql }) => sql.includes("platform_ranked AS"));
  assert.ok(previews);
  assert.match(previews.sql, /public_facet_previews/);
  assert.match(previews.sql, /pfp\.image_id/);
  assert.match(previews.sql, /'screen', 'ui_element'/);
  assert.match(previews.sql, /matched_facets/);
  assert.match(previews.sql, /-1 AS source_priority/);
  assert.deepEqual(previews.values?.slice(3), [
    ["screens", "elements"],
    ["dashboard", "dialog"],
  ]);
  assert.deepEqual((page.previews[0] as { matched_facets?: unknown }).matched_facets, [
    { group: "screens", value: "Dashboard" },
    { group: "elements", value: "Dialog" },
  ]);
});

test("paginates latest and trending with matching deterministic keyset boundaries", async () => {
  for (const sort of ["latest", "trending"] as const) {
    let identityCalls = 0;
    const identitySql: string[] = [];
    const identityValues: Array<readonly unknown[]> = [];
    const query: DatabaseQuery = async (sql, values = []) => {
      if (sql.includes("totals AS")) {
        identitySql.push(sql);
        identityValues.push(values);
        identityCalls += 1;
        const rows = sort === "latest"
          ? [
              { app_id: 2, app: "newer", updated_at: "2026-07-26T03:00:00.000Z", total_screens: 10, popularity_score: 10, total_count: 2 },
              { app_id: 1, app: "older", updated_at: "2026-07-26T02:00:00.000Z", total_screens: 99, popularity_score: 99, total_count: 2 },
            ]
          : [
              { app_id: 1, app: "popular", updated_at: "2026-07-26T02:00:00.000Z", total_screens: 99, popularity_score: 99, total_count: 2 },
              { app_id: 2, app: "recent", updated_at: "2026-07-26T03:00:00.000Z", total_screens: 10, popularity_score: 10, total_count: 2 },
            ];
        return result(identityCalls === 1 ? rows : [rows[1]!]);
      }
      if (sql.includes("AS facet_group")) {
        return result([{ facet_group: "categories", facet_value: "Work", count: 2 }]);
      }
      if (sql.includes("jsonb_agg")) {
        const app = identityCalls === 1
          ? (sort === "latest" ? "newer" : "popular")
          : (sort === "latest" ? "older" : "recent");
        const appId = app === "older" || app === "popular" ? 1 : 2;
        return result([{
          app_id: appId, app, display_name: app, categories: [],
          website_url: null, icon_url: null, accent_color: null,
          total_screens: appId === 1 ? 99 : 10, available_platforms: ["web"],
        }]);
      }
      return result();
    };

    const first = await publishedCatalogPage({
      sort,
      limit: 1,
      now: new Date("2026-07-26T04:00:00.000Z"),
      platform: "web",
    }, query);
    const second = await publishedCatalogPage({
      sort,
      limit: 1,
      cursor: first.nextCursor!,
      platform: "web",
    }, query);

    assert.equal(first.apps.length, 1);
    assert.equal(second.apps.length, 1);
    assert.equal(second.totalCount, 2);
    assert.deepEqual(second.facets, first.facets);
    const decoded = decodeCatalogCursor(first.nextCursor!, sort);
    assert.equal(decoded.sort, sort);
    if (decoded.sort === "trending") {
      assert.equal(decoded.popularityScore, 99);
      assert.match(identitySql[0]!, /ORDER BY popularity_score DESC, updated_at DESC, app_id DESC/);
      assert.match(identitySql[1]!, /\(popularity_score, updated_at, app_id\) </);
      assert.deepEqual(identityValues[1], [
        "2026-07-26T04:00:00.000Z",
        "2026-07-26T02:00:00.000Z",
        1,
        99,
        "web",
        null,
        2,
      ]);
    } else {
      assert.match(identitySql[0]!, /ORDER BY updated_at DESC, app_id DESC/);
      assert.match(identitySql[1]!, /\(updated_at, app_id\) </);
      assert.deepEqual(identityValues[1], [
        "2026-07-26T04:00:00.000Z",
        "2026-07-26T03:00:00.000Z",
        2,
        "web",
        null,
        2,
      ]);
    }
  }
});

test("reuses complete cached facets on a cursor page without another facet query", async () => {
  let identityCalls = 0;
  let facetCalls = 0;
  const query: DatabaseQuery = async (sql) => {
    if (sql.includes("totals AS")) {
      identityCalls += 1;
      return result([{
        app_id: identityCalls,
        app: `app-${identityCalls}`,
        updated_at: `2026-07-26T0${4 - identityCalls}:00:00.000Z`,
        total_screens: 3,
        total_count: 2,
      }, ...(identityCalls === 1 ? [{
        app_id: 2,
        app: "app-2",
        updated_at: "2026-07-26T02:00:00.000Z",
        total_screens: 2,
        total_count: 2,
      }] : [])]);
    }
    if (sql.includes("AS facet_group")) {
      facetCalls += 1;
      return result([{ facet_group: "flows", facet_value: "Checkout", count: 2 }]);
    }
    if (sql.includes("jsonb_agg")) {
      return result([{
        app_id: identityCalls, app: `app-${identityCalls}`, display_name: null,
        categories: [], website_url: null, icon_url: null, accent_color: null,
        total_screens: 2, available_platforms: ["web"],
      }]);
    }
    return result();
  };

  const first = await publishedCatalogPage({
    limit: 1,
    now: new Date("2026-07-26T04:00:00.000Z"),
    platform: "web",
    filters: [{ group: "categories", value: "Commerce" }],
  }, query);
  const second = await publishedCatalogPage({
    limit: 1,
    cursor: first.nextCursor!,
    platform: "web",
    filters: [{ group: "categories", value: "Commerce" }],
  }, query);

  assert.equal(facetCalls, 1);
  assert.deepEqual(second.facets, first.facets);
});

test("facet cache expires by TTL and evicts the least-recently-used entry", () => {
  let now = 0;
  const cache = createCatalogFacetCache({
    ttlMs: 10,
    maxEntries: 2,
    now: () => now,
  });
  const a = [{ group: "flows", value: "A", count: 1 }];
  const b = [{ group: "flows", value: "B", count: 1 }];
  const c = [{ group: "flows", value: "C", count: 1 }];
  cache.set("a", a);
  cache.set("b", b);
  assert.deepEqual(cache.get("a"), a);
  cache.set("c", c);
  assert.equal(cache.get("b"), undefined);
  assert.deepEqual(cache.get("a"), a);
  now = 11;
  assert.equal(cache.get("a"), undefined);
});

test("default facet caches are isolated by runQuery identity", async () => {
  const first: DatabaseQuery = async () => result();
  const second: DatabaseQuery = async () => result();
  assert.notEqual(
    catalogFacetCacheForQuery(first),
    catalogFacetCacheForQuery(second),
  );
  assert.equal(catalogFacetCacheForQuery(first), catalogFacetCacheForQuery(first));
});

test("compact discovery skips the facet query without changing page selection", async () => {
  const statements: string[] = [];
  const page = await publishedCatalogPage({
    platform: "web",
    includeFacets: false,
    now: new Date("2026-07-29T04:00:00.000Z"),
  }, async (sql) => {
    statements.push(sql);
    return result([{
      app_id: null,
      app: null,
      updated_at: null,
      total_screens: null,
      total_count: 0,
    }]);
  });

  assert.equal(statements.length, 1);
  assert.match(statements[0]!, /totals AS/);
  assert.deepEqual(page.facets, []);
});

test("a Category dropdown computes only Category facets", async () => {
  const statements: string[] = [];
  await publishedCatalogPage({
    platform: "web",
    facetGroups: ["categories"],
    now: new Date("2026-07-29T04:00:00.000Z"),
  }, async (sql) => {
    statements.push(sql);
    return result(sql.includes("totals AS")
      ? [{
          app_id: null,
          app: null,
          updated_at: null,
          total_screens: null,
          total_count: 0,
        }]
      : []);
  });

  assert.equal(statements.length, 2);
  assert.match(statements[1]!, /'categories' AS facet_group/);
  assert.doesNotMatch(statements[1]!, /flow_eligible_apps/);
  assert.doesNotMatch(statements[1]!, /screen_patterns/);
  assert.doesNotMatch(statements[1]!, /'elements' AS facet_group/);
});
