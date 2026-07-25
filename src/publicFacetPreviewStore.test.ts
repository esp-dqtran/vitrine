import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePublicFacet,
  type PublicFacetInput,
} from "./publicFacetPreview.ts";
import { publishedFacetPreview } from "./publicFacetPreviewStore.ts";

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
});

test("maps a bounded latest-published Flow preview", async () => {
  let capturedSql = "";
  let capturedValues: readonly unknown[] | undefined;
  const preview = await publishedFacetPreview(flowFacet, async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;
    return {
      rows: [{
        app: "linear",
        icon_url: null,
        media_count: 7,
      }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  });

  assert.deepEqual(preview, {
    kind: "flow",
    app: "linear",
    label: "Setting Up",
    iconUrl: null,
    mediaCount: 3,
  });
  assert.deepEqual(capturedValues, ["web", "Setting Up"]);
  assert.match(capturedSql, /av\.status = 'published'/);
  assert.match(capturedSql, /public_facet_previews/);
  assert.match(capturedSql, /LIMIT 1/);
  assert.doesNotMatch(capturedSql, /JOIN images|app_flow_versions/);
  assert.doesNotMatch(capturedSql, /object_key\s+AS/);
});

test("maps an icon-only Category preview and returns null without media", async () => {
  const category = await publishedFacetPreview(
    { group: "categories", value: "Finance", platform: "ios" },
    async () => ({
      rows: [{ app: "Revolut", icon_url: "https://cdn.example/revolut.png", media_count: 0 }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    }),
  );
  assert.deepEqual(category, {
    kind: "icon",
    app: "Revolut",
    label: "Finance",
    iconUrl: "https://cdn.example/revolut.png",
    mediaCount: 0,
  });

  assert.equal(
    await publishedFacetPreview(
      { group: "elements", value: "Dialog", platform: "web" },
      async () => ({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    ),
    null,
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
