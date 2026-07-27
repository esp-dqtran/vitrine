import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePublicFacet,
  type PublicFacetInput,
} from "./publicFacetPreview.ts";
import { publishedFacetPreviews } from "./publicFacetPreviewStore.ts";

const flowFacet: PublicFacetInput = {
  group: "flows",
  value: "Setting Up",
  platform: "web",
};

test("accepts only the public Apps taxonomy and supported platforms", () => {
  assert.deepEqual(
    parsePublicFacet({ group: "elements", value: "Dialog", platform: "web" }),
    { group: "elements", value: "Dialog", platform: "web" },
  );
  assert.equal(parsePublicFacet({ group: "elements", value: "Unknown", platform: "web" }), null);
  assert.equal(parsePublicFacet({ group: "flows", value: "Setting Up", platform: "android" }), null);
  assert.equal(parsePublicFacet({ group: ["flows"], value: "Setting Up", platform: "web" }), null);
  assert.deepEqual(
    parsePublicFacet({ group: "categories", value: "New Category", platform: "web" }),
    { group: "categories", value: "New Category", platform: "web" },
  );
  assert.equal(
    parsePublicFacet({ group: "categories", value: "   ", platform: "web" }),
    null,
  );
});

test("maps at most six distinct latest-published Flow preview candidates", async () => {
  let capturedSql = "";
  let capturedValues: readonly unknown[] | undefined;
  const previews = await publishedFacetPreviews(flowFacet, async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;
    return {
      rows: Array.from({ length: 7 }, (_, index) => ({
        app: `app-${index}`,
        icon_url: null,
        media_count: index === 0 ? 7 : 2,
      })),
      rowCount: 7,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  });

  assert.deepEqual(previews[0], {
    kind: "flow",
    app: "app-0",
    label: "Setting Up",
    iconUrl: null,
    mediaCount: 3,
  });
  assert.equal(previews.length, 6);
  assert.equal(new Set(previews.map(({ app }) => app)).size, 6);
  assert.deepEqual(capturedValues, ["web", "Setting Up"]);
  assert.match(capturedSql, /av\.status = 'published'/);
  assert.match(capturedSql, /public_facet_previews/);
  assert.match(capturedSql, /LIMIT 6/);
  assert.doesNotMatch(capturedSql, /JOIN images|app_flow_versions/);
  assert.doesNotMatch(capturedSql, /object_key\s+AS/);
});

test("maps icon-only Category candidates and returns an empty pool without media", async () => {
  let capturedSql = "";
  const categories = await publishedFacetPreviews(
    { group: "categories", value: "Finance", platform: "ios" },
    async (sql) => {
      capturedSql = sql;
      return {
        rows: [{ app: "Revolut", icon_url: "https://cdn.example/revolut.png", media_count: 0 }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    },
  );
  assert.deepEqual(categories, [{
    kind: "icon",
    app: "Revolut",
    label: "Finance",
    iconUrl: "https://cdn.example/revolut.png",
    mediaCount: 0,
  }]);
  assert.match(capturedSql, /JOIN app_categories ac ON ac\.app_id = a\.id/);
  assert.match(capturedSql, /JOIN categories c ON c\.id = ac\.category_id/);
  assert.match(capturedSql, /lower\(c\.name\) = lower\(\$2\)/);
  assert.doesNotMatch(capturedSql, /a\.category/);

  assert.deepEqual(
    await publishedFacetPreviews(
      { group: "elements", value: "Dialog", platform: "web" },
      async () => ({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    ),
    [],
  );
});

test("migration caches published Screen, UI Element, and Flow facet media", async () => {
  const migration = await readFile(
    new URL("../migrations/0026_public_facet_previews.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE public_facet_previews/);
  assert.match(migration, /facet_group IN \('screens', 'elements', 'flows'\)/);
  assert.match(migration, /CREATE INDEX public_facet_previews_lookup_idx/);
  assert.match(migration, /CREATE TRIGGER refresh_public_facet_previews_on_publish/);
  assert.match(migration, /images i[\s\S]*i\.kind = 'ui_element'/);
  assert.match(migration, /app_flow_versions/);
  assert.doesNotMatch(migration, /FOR published_version IN/);
  assert.match(migration, /PARTITION BY vi\.version_id, facets\.facet_value/);
});

test("fallback migration fills sparse taxonomy from the correct media kinds", async () => {
  const migration = await readFile(
    new URL("../migrations/0027_public_facet_preview_fallbacks.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /i\.kind = 'screen'/);
  assert.match(migration, /i\.kind = 'ui_element'/);
  assert.match(migration, /i\.kind = 'flow_step'/);
  assert.match(migration, /vi\.source_url IS NOT NULL/);
  assert.match(migration, /ON CONFLICT \(version_id, facet_group, facet_value, rank\) DO NOTHING/);
  assert.doesNotMatch(migration, /SELECT fill_public_facet_preview_fallbacks\(id\)/);
  assert.match(migration, /PARTITION BY vi\.version_id[\s\S]*WHERE media\.ordinal <= 5/);
});
