import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  flowCatalogSearchTerms,
  FlowCatalogFacetCache,
  FlowCatalogPageCache,
  minimumFlowCatalogTermMatches,
  publishedFlowCatalogPage,
  type FlowCatalogQuery,
} from "./flowCatalogStore.ts";

const secret = "flow-store-secret-0123456789abcdef";
const timestamp = "2026-07-29T06:00:00.000Z";

function result(rows: Record<string, unknown>[] = []): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  flow_id: "41",
  category_id: "7",
  category: "Account Management",
  category_key: "account management",
  flow_type: "Edit profile",
  flow_type_key: "account-settings/edit-profile",
  category_sort: "account management",
  title: "Editing Profile",
  title_key: "editing profile",
  title_sort: "editing profile",
  exact_match: 0,
  title_term_matches: 0,
  term_matches: 0,
  count: 1081,
  category_count: 1825,
  category_rank: 1,
  other_rank: 0,
  version_id: 7,
  version_number: 3,
  app: "linear",
  app_name: "Linear",
  app_icon_url: "https://cdn.example.com/linear.png",
  version_flow_id: 71,
  source_flow_id: "editing-profile",
  description: "",
  tags: [],
  steps: [{ label: "Open profile", evidence: [10] }],
  ...overrides,
});

test("freezes published App versions and canonical taxonomy at one snapshot", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result(calls.length === 1 ? [row()] : [{
      total_count: 1,
      facets: [{ group: "flowCategories", value: "account-settings", count: 1 }],
    }]);
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]!.sql, /av\.published_at <= \$2::timestamptz/);
  assert.doesNotMatch(calls[0]!.sql, /av\.status = 'published'/);
  assert.match(calls[0]!.sql, /canonical\.created_at <= \$2::timestamptz/);
  assert.match(calls[0]!.sql, /parent\.created_at <= \$2::timestamptz/);
  assert.match(calls[0]!.sql, /ORDER BY av\.app_id, av\.published_at DESC, av\.version_number DESC, av\.id DESC/);
  assert.equal(calls[0]!.values?.[1], timestamp);
});

test("returns every observed screen for a catalog Flow", async () => {
  let calls = 0;
  const page = await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async () => {
    calls += 1;
    return result(calls === 1 ? [row({
      steps: [
        { label: "Open profile", evidence: [10, 11] },
        { label: "Save profile", evidence: [12] },
      ],
    })] : [{ total_count: 1, facets: [] }]);
  });

  const preview = page.items[0]!.preview;
  assert.equal(preview.screenCount, 3);
  assert.equal(preview.flow.steps.length, 3);
  assert.deepEqual(
    preview.flow.steps.map(({ evidence }) => evidence[0]!.imageUrl),
    [
      "/api/flows/media/linear/web/7/71/1?variant=full",
      "/api/flows/media/linear/web/7/71/2?variant=full",
      "/api/flows/media/linear/web/7/71/3?variant=full",
    ],
  );
});

test("does not expose source-specific Flow IDs in the published catalog", async () => {
  let calls = 0;
  const page = await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async () => {
    calls += 1;
    return result(calls === 1
      ? [row({ source_flow_id: "mobbin-flow-68c35291" })]
      : [{ total_count: 1, facets: [] }]);
  });

  assert.equal(page.items[0]?.preview.sourceFlowId, "flow-68c35291");
  assert.doesNotMatch(JSON.stringify(page), /mobbin/i);
});

test("deduplicates mapped Flows before attaching taxonomy labels", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result(calls.length === 1 ? [row()] : [{ total_count: 1, facets: [] }]);
  });

  const pageSql = calls.find(({ sql }) => !/total_count/.test(sql))!.sql;
  assert.match(pageSql, /unique_flow_ids AS MATERIALIZED/);
  assert.match(pageSql, /relevant_taxonomy AS MATERIALIZED/);
  assert.match(
    pageSql,
    /SELECT DISTINCT flow_id\s+FROM instances/,
  );
  assert.match(
    pageSql,
    /FROM unique_flow_ids observed\s+JOIN flows canonical ON canonical\.id = observed\.flow_id/,
  );
  assert.doesNotMatch(pageSql, /COUNT\(DISTINCT app_id\)/);
});

test("keeps heavyweight Flow preview JSON out of the catalog-wide materialized CTEs", async () => {
  const statements: string[] = [];
  await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql) => {
    statements.push(sql);
    return result(/total_count/.test(sql)
      ? [{ total_count: 1, facets: [] }]
      : [row()]);
  });

  const pageStatement = statements.find((sql) => !/total_count/.test(sql));
  assert.ok(pageStatement);
  const beforePaged = pageStatement.slice(0, pageStatement.indexOf("paged AS"));
  assert.doesNotMatch(beforePaged, /\b(?:description|tags|steps)\b/);
  assert.doesNotMatch(beforePaged, /\bapp_icon_url\b/);
  assert.doesNotMatch(beforePaged, /regexp_replace/);
  assert.doesNotMatch(beforePaged, /matches AS MATERIALIZED/);
  assert.doesNotMatch(
    beforePaged,
    /(?:instances|grouped_all|filtered_items|ranked) AS MATERIALIZED/,
  );
  assert.match(pageStatement, /representatives AS \([\s\S]*JOIN app_flow_versions/);
  assert.match(pageStatement, /representatives AS \([\s\S]*\bsteps\b/);
});

test("starts the independent first-page and facet metadata queries concurrently", async () => {
  let pageStarted = false;
  let metadataStarted = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const operation = publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql) => {
    if (/total_count/.test(sql)) metadataStarted = true;
    else pageStarted = true;
    await gate;
    return result(/total_count/.test(sql)
      ? [{ total_count: 1, facets: [] }]
      : [row()]);
  });

  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(pageStarted, true);
    assert.equal(metadataStarted, true);
  } finally {
    release();
  }
  await operation;
});

test("uses title/category keyset pagination without OFFSET", async () => {
  {
    const sort = "grouped" as const;
    const cache = new FlowCatalogFacetCache({ maxEntries: 4, ttlMs: 60_000 });
    const firstRows = [
      row(),
      row({
        flow_id: "42",
        title: "Logging In",
        title_key: "logging in",
        count: 744,
        category_rank: 2,
        version_flow_id: 72,
        source_flow_id: "logging-in",
      }),
      row({
        flow_id: "73",
        category: "Commerce & Finance",
        category_key: "commerce & finance",
        title: "Checkout",
        title_key: "checkout",
        count: 620,
        category_count: 620,
        category_rank: 1,
      }),
    ];
    let calls = 0;
    const sql: string[] = [];
    const query: FlowCatalogQuery = async (statement) => {
      sql.push(statement);
      calls += 1;
      if (calls === 1) return result(firstRows);
      if (calls === 2) return result([{ total_count: 3, facets: [] }]);
      return result([firstRows[2]!]);
    };
    const first = await publishedFlowCatalogPage({
      platform: "web",
      sort,
      limit: 2,
      cursorSecret: secret,
      facetCache: cache,
      now: () => new Date(timestamp),
    }, query);
    assert.deepEqual(first.items.map(({ title }) => title), ["Editing Profile", "Logging In"]);
    assert.ok(first.nextCursor);

    const second = await publishedFlowCatalogPage({
      platform: "web",
      sort,
      limit: 2,
      cursor: first.nextCursor!,
      cursorSecret: secret,
      facetCache: cache,
    }, query);
    assert.deepEqual(second.items.map(({ title }) => title), ["Checkout"]);
    assert.equal(calls, 3, "cursor page reuses cached facets");
    assert.ok(sql.every((statement) => !/\bOFFSET\b/i.test(statement)));
    assert.match(sql[2]!, /ROW\([\s\S]*\) > ROW\(/);
  }
});

test("continues after 800-character stored category and title names with bounded SQL keys", async () => {
  const longCategory = `account ${"management ".repeat(80)}`.trim();
  const longTitle = `editing ${"profile ".repeat(100)}`.trim();
  assert.ok(longCategory.length > 800);
  assert.ok(longTitle.length > 800);
  const cache = new FlowCatalogFacetCache({ maxEntries: 2, ttlMs: 60_000 });
  let call = 0;
  const statements: string[] = [];
  const query: FlowCatalogQuery = async (sql) => {
    statements.push(sql);
    call += 1;
    if (call === 1) {
      return result([
        row({
          category: longCategory,
          category_key: longCategory,
          category_sort: longCategory.slice(0, 120),
          title: longTitle,
          title_key: longTitle,
          title_sort: longTitle.slice(0, 120),
          flow_id: "91",
        }),
        row({ title: "Next", title_key: "next", flow_id: "92" }),
      ]);
    }
    if (/total_count/.test(sql)) {
      return result([{ total_count: 2, facets: [] }]);
    }
    return result([row({ title: "Next", title_key: "next", flow_id: "92" })]);
  };
  const first = await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    limit: 1,
    cursorSecret: secret,
    facetCache: cache,
    now: () => new Date(timestamp),
  }, query);
  assert.equal(first.items[0]?.title, longTitle);
  assert.equal(first.items[0]?.category, longCategory);
  assert.ok(first.nextCursor);
  assert.ok(first.nextCursor!.length <= 2_048);
  const second = await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    limit: 1,
    cursor: first.nextCursor!,
    cursorSecret: secret,
    facetCache: cache,
  }, query);
  assert.equal(second.items[0]?.title, "Next");
  assert.match(statements[0]!, /left\([\s\S]*category_key[\s\S]*120\)[\s\S]*AS category_sort/i);
  assert.match(statements[0]!, /left\([\s\S]*title_key[\s\S]*120\)[\s\S]*AS title_sort/i);
  assert.match(statements[0]!, /ORDER BY[\s\S]*title_sort[\s\S]*category_sort[\s\S]*category_id[\s\S]*flow_id/i);
  assert.match(statements[2]!, /ROW\([\s\S]*title_sort[\s\S]*category_sort[\s\S]*category_id[\s\S]*flow_id[\s\S]*\) > ROW\(/i);
});

test("normalizes child and parent search variants and applies controlled category filters", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const page = await publishedFlowCatalogPage({
    platform: "ios",
    sort: "grouped",
    query: "  Billing & Payments! ",
    flowCategories: ["account-settings", "commerce-checkout"],
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result(calls.length === 1 ? [row()] : [{
      total_count: 1,
      facets: [
        { group: "flowCategories", value: "account-settings", count: 2 },
        { group: "flowCategories", value: "commerce-checkout", count: 1 },
      ],
    }]);
  });

  assert.equal(calls[0]!.values?.[2], "billing and payments");
  assert.deepEqual(calls[0]!.values?.[3], ["account-settings", "commerce-checkout"]);
  assert.deepEqual(calls[0]!.values?.[8], ["bill", "payment"]);
  assert.equal(calls[0]!.values?.[9], 2);
  assert.match(calls[0]!.sql, /canonical\.normalized_name/);
  assert.match(calls[0]!.sql, /parent\.normalized_name/);
  assert.match(calls[0]!.sql, /LEFT JOIN flow_classifications classification/);
  assert.match(calls[0]!.sql, /classification\.status = 'approved'/);
  assert.match(calls[0]!.sql, /LEFT JOIN flow_types classified_type/);
  assert.match(calls[0]!.sql, /COALESCE\(classified_category\.name/);
  assert.match(calls[0]!.sql, /replace\(canonical\.normalized_name, ' and ', ' '\)/);
  assert.match(calls[0]!.sql, /ANY\(\$4::text\[\]\)/);
  assert.equal(page.totalCount, 1);
  assert.deepEqual(page.facets.map(({ value, count }) => ({ value, count })), [
    { value: "account-settings", count: 2 },
    { value: "commerce-checkout", count: 1 },
  ]);
});

test("uses the observed-flow query for filtered browsing and preserves fallback taxonomy", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  await publishedFlowCatalogPage({
    platform: "web",
    flowCategories: ["authentication"],
    flowTypes: ["content-detail/other-content-detail"],
    includeFacets: false,
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result([row({ page_total: 1 })]);
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /FROM unique_flow_ids observed/);
  assert.match(calls[0]!.sql, /COUNT\(\*\) OVER \(\)::int AS page_total/);
  assert.match(calls[0]!.sql, /approved_taxonomy AS/);
  assert.match(calls[0]!.sql, /fallback_taxonomy AS/);
  assert.match(calls[0]!.sql, /approved\.flow_id IS NULL/);
  assert.match(calls[0]!.sql, /content-detail\/other-content-detail/);
  assert.doesNotMatch(calls[0]!.sql, /unnest\(\$9::text\[\]\)/);
});

test("keeps the relevance query when filters are combined with search", async () => {
  const statements: string[] = [];
  await publishedFlowCatalogPage({
    platform: "web",
    query: "login",
    flowCategories: ["authentication"],
    includeFacets: false,
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql) => {
    statements.push(sql);
    return result([row({ page_total: 1 })]);
  });

  assert.match(statements[0]!, /unnest\(\$9::text\[\]\)/);
  assert.doesNotMatch(statements[0]!, /approved_taxonomy AS/);
});

test("reduces natural Flow queries to meaningful stems with a mostly-matching threshold", () => {
  assert.deepEqual(
    flowCatalogSearchTerms("checkout with payment method selection"),
    ["checkout", "payment", "method", "select"],
  );
  assert.deepEqual(flowCatalogSearchTerms("Log in"), ["log", " in"]);
  assert.deepEqual(flowCatalogSearchTerms("Creating accounts"), ["creat", "account"]);
  assert.equal(minimumFlowCatalogTermMatches(1), 1);
  assert.equal(minimumFlowCatalogTermMatches(4), 3);
  assert.equal(minimumFlowCatalogTermMatches(6), 4);
});

test("filters and orders natural Flow queries by lightweight taxonomy relevance", async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  await publishedFlowCatalogPage({
    platform: "web",
    query: "checkout with payment method selection",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql, values) => {
    calls.push({ sql, values });
    return result(calls.length === 1 ? [row({
      exact_match: 0,
      title_term_matches: 3,
      term_matches: 3,
    })] : [{ total_count: 1, facets: [] }]);
  });

  assert.deepEqual(calls[0]!.values?.[8], [
    "checkout",
    "payment",
    "method",
    "select",
  ]);
  assert.equal(calls[0]!.values?.[9], 3);
  assert.match(calls[0]!.sql, /unnest\(\$9::text\[\]\)/);
  assert.match(calls[0]!.sql, /relevance\.term_matches >= \$10::int/);
  assert.match(calls[0]!.sql, /canonical\.normalized_name = \$3\s+THEN 2/);
  assert.match(calls[0]!.sql, /relevance\.exact_match > 0/);
  assert.match(calls[0]!.sql, /ORDER BY ranked\.exact_match DESC,[\s\S]*ranked\.title_term_matches DESC,[\s\S]*ranked\.term_matches DESC/);
});

test("facets omit their own category filter while totalCount keeps it", async () => {
  let metadataSql = "";
  const page = await publishedFlowCatalogPage({
    platform: "android",
    sort: "grouped",
    flowCategories: ["onboarding"],
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql) => {
    if (/total_count/.test(sql)) {
      metadataSql = sql;
      return result([{
        total_count: 4,
        facets: [
          { group: "flowCategories", value: "onboarding", count: 4 },
          { group: "flowCategories", value: "commerce-checkout", count: 3 },
        ],
      }]);
    }
    return result([row()]);
  });
  assert.match(metadataSql, /filtered_items/);
  assert.match(metadataSql, /facet_items/);
  assert.equal(page.totalCount, 4);
  assert.equal(page.facets.length, 2);
});

test("facet cache is TTL bounded, LRU, and isolated by complete query identity", () => {
  let now = 1_000;
  const cache = new FlowCatalogFacetCache({
    maxEntries: 2,
    ttlMs: 100,
    now: () => now,
  });
  const value = { totalCount: 1, facets: [] };
  cache.set("web:a", value);
  cache.set("ios:a", { totalCount: 2, facets: [] });
  assert.equal(cache.get("web:a")?.totalCount, 1);
  cache.set("web:b", { totalCount: 3, facets: [] });
  assert.equal(cache.get("ios:a"), undefined, "least recently used entry was evicted");
  assert.equal(cache.get("web:a")?.totalCount, 1);
  assert.equal(cache.get("web:b")?.totalCount, 3);
  now += 101;
  assert.equal(cache.get("web:a"), undefined);
  assert.equal(cache.size, 0);
});

test("reuses one complete, snapshot-consistent first page for a warm query", async () => {
  const pageCache = new FlowCatalogPageCache({ maxEntries: 4, ttlMs: 60_000 });
  let calls = 0;
  const runQuery: FlowCatalogQuery = async (sql) => {
    calls += 1;
    return result(/total_count/.test(sql)
      ? [{
          total_count: 1,
          facets: [{ group: "flowCategories", value: "account-settings", count: 1 }],
        }]
      : [row()]);
  };
  const input = {
    platform: "web" as const,
    sort: "grouped" as const,
    limit: 12,
    cursorSecret: secret,
    pageCache,
  };

  const first = await publishedFlowCatalogPage(input, runQuery);
  const second = await publishedFlowCatalogPage(input, runQuery);

  assert.deepEqual(second, first);
  assert.equal(calls, 2, "the warm page performs no database query");
  assert.equal(pageCache.size, 1);

  await publishedFlowCatalogPage({
    ...input,
    flowCategories: ["account-settings"],
  }, runQuery);
  assert.equal(calls, 4, "filter identity has an independent cache entry");
  assert.equal(pageCache.size, 2);
});

test("serves a stale first page immediately while one background refresh runs", async () => {
  let now = 1_000;
  const pageCache = new FlowCatalogPageCache({
    maxEntries: 4,
    ttlMs: 100,
    staleTtlMs: 1_000,
    now: () => now,
  });
  let calls = 0;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const runQuery: FlowCatalogQuery = async () => {
    calls += 1;
    if (calls === 1) {
      return result([row({ title: "Cached", page_total: 1 })]);
    }
    await refreshGate;
    return result([row({ title: "Refreshed", page_total: 1 })]);
  };
  const input = {
    platform: "web" as const,
    sort: "grouped" as const,
    limit: 12,
    cursorSecret: secret,
    includeFacets: false,
    pageCache,
  };

  const initial = await publishedFlowCatalogPage(input, runQuery);
  assert.equal(initial.items[0]?.title, "Cached");
  now += 101;

  const firstStale = await publishedFlowCatalogPage(input, runQuery);
  const secondStale = await publishedFlowCatalogPage(input, runQuery);
  assert.equal(firstStale.items[0]?.title, "Cached");
  assert.equal(secondStale.items[0]?.title, "Cached");
  assert.equal(calls, 2, "stale requests share one background refresh");

  releaseRefresh();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const refreshed = await publishedFlowCatalogPage(input, runQuery);
  assert.equal(refreshed.items[0]?.title, "Refreshed");
  assert.equal(calls, 2);
});

test("drops a Flow page only after its stale retention window", () => {
  let now = 1_000;
  const cache = new FlowCatalogPageCache({
    ttlMs: 100,
    staleTtlMs: 500,
    now: () => now,
  });
  const page = { items: [], nextCursor: null, totalCount: 0, facets: [] };
  cache.set("web", page);
  now += 101;
  assert.equal(cache.get("web"), undefined);
  assert.equal(cache.getStale("web"), page);
  assert.equal(cache.size, 1);
  now += 400;
  assert.equal(cache.getStale("web"), undefined);
  assert.equal(cache.size, 0);
});

test("preserves the bounded Flow card and media structure", async () => {
  const page = await publishedFlowCatalogPage({
    platform: "web",
    sort: "grouped",
    cursorSecret: secret,
    now: () => new Date(timestamp),
  }, async (sql) => result(/total_count/.test(sql)
    ? [{ total_count: 1, facets: [] }]
    : [row()]));
  assert.deepEqual(page.items[0]?.preview.flow.steps[0]?.evidence[0], {
    imageId: 10,
    imageUrl: "/api/flows/media/linear/web/7/71/1?variant=full",
    thumbnailUrl: "/api/flows/media/linear/web/7/71/1?variant=thumb",
    description: "Open profile",
  });
});
