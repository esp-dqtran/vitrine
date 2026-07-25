import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresSearchStore, type SearchAccess } from "./searchStore.ts";
import { normalizeSearchRequest, type SearchScope } from "./searchTypes.ts";

function fakePool() {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  return {
    queries,
    pool: {
      async query(text: string, values?: unknown[]) {
        queries.push({ text, values });
        return { rows: [], rowCount: 0 };
      },
    },
  };
}

async function sqlFor(scope: SearchScope, access: SearchAccess = { publishedOnly: true }) {
  const fake = fakePool();
  const store = new PostgresSearchStore(fake.pool as never);
  await store.search(normalizeSearchRequest({ scope, q: "" }), undefined, access);
  return fake.queries.map(({ text }) => text).join("\n");
}

test("restricts Apps and Sites scopes without restricting All", async () => {
  assert.match(await sqlFor("apps"), /d\.catalog_scope = \$\d+/);
  assert.match(await sqlFor("sites"), /d\.catalog_scope = \$\d+/);

  const allSql = await sqlFor("all");
  assert.doesNotMatch(allSql, /d\.catalog_scope = \$\d+/);
});

test("authorizes published Apps and ready Sites before ranking and facets", async () => {
  const sql = await sqlFor("all", {
    publishedOnly: true,
    allowedAppIds: [3],
  });

  assert.match(sql, /d\.catalog_scope = 'apps'.*av\.status = 'published'/s);
  assert.match(sql, /d\.catalog_scope = 'sites'.*sv\.status = 'ready'/s);
  assert.match(sql, /\(d\.catalog_scope = 'sites' OR d\.app_id = ANY\(/);
});

test("uses normalized category and Site arrays for filters and facets", async () => {
  const fake = fakePool();
  const store = new PostgresSearchStore(fake.pool as never);
  await store.search(normalizeSearchRequest({
    scope: "sites",
    appCategory: "Business",
    siteSection: "Pricing",
    siteStyle: "Minimal",
  }), undefined, { publishedOnly: true });

  const sql = fake.queries.map(({ text }) => text).join("\n");
  assert.match(sql, /d\.catalog_categories/);
  assert.match(sql, /d\.site_sections/);
  assert.match(sql, /d\.site_styles/);
});
