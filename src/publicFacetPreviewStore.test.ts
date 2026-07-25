import assert from "node:assert/strict";
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
  assert.match(capturedSql, /app_flow_versions/);
  assert.match(capturedSql, /LIMIT 3/);
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
