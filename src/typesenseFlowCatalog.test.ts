import assert from "node:assert/strict";
import test from "node:test";
import {
  createTypesenseFlowCatalogClient,
  flowCatalogTypesenseFilter,
} from "./typesenseFlowCatalog.ts";

const card = {
  category: "Account Management",
  type: "Edit profile",
  title: "Edit profile",
  preview: {
    appId: "linear", appName: "Linear", appIconUrl: null, versionId: 9, version: 4,
    sourceFlowId: "profile", screenCount: 1,
    flow: {
      id: "linear:11", title: "Edit profile", category: "Account Management", description: "Change your profile picture",
      tags: ["profile"], steps: [{ label: "Open profile", evidence: [] }],
    },
  },
};

const document = {
  id: "web:linear:9:profile", platform: "web" as const, appId: "linear", appName: "Linear",
  title: "Edit profile", category: "Account Management", categorySlug: "account-settings",
  type: "Edit profile", typeKey: "account-settings/edit-profile", description: "Change your profile picture",
  tags: ["profile"], stepLabels: ["Open profile"], searchText: "Linear Edit profile Open profile",
  versionId: 9, card: JSON.stringify(card),
};

test("maps controlled Flow category and type filters to Typesense", () => {
  assert.equal(flowCatalogTypesenseFilter({
    platform: "web",
    flowCategories: ["account-settings"],
    flowTypes: ["account-settings/edit-profile"],
  }), "platform:=`web` && (categorySlug:=`account-settings`) && (typeKey:=`account-settings/edit-profile`)");
});

test("indexes and full-text searches Flow cards through a dedicated alias", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createTypesenseFlowCatalogClient(
    { host: "http://typesense.test", apiKey: "secret", collection: "vitrines_flows_v1" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/aliases/vitrines_flows_v1") && init?.method !== "PUT") return new Response("", { status: 404 });
      if (String(url).endsWith("/collections") && init?.method === "POST") return new Response("{}", { status: 201 });
      if (String(url).includes("/documents/import")) return new Response('{"success":true}', { status: 200 });
      if (String(url).endsWith("/aliases/vitrines_flows_v1") && init?.method === "PUT") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({
        found: 1,
        hits: [{ document }],
        facet_counts: [{ field_name: "categorySlug", counts: [{ value: "account-settings", count: 1 }] }],
      }));
    },
  );

  assert.equal(await client.index([document]), 1);
  const result = await client.search({ query: "open profile", platform: "web", flowCategories: ["account-settings"], flowTypes: [] });
  assert.equal(result.items[0]?.title, "Edit profile");
  assert.deepEqual(result.facets, [{ group: "flowCategories", value: "account-settings", count: 1 }]);
  assert.match(requests.at(-1)?.url ?? "", /query_by=title%2CappName%2Ccategory%2Ctype%2Ctags%2CstepLabels%2Cdescription%2CsearchText/);
  assert.match(requests.at(-1)?.url ?? "", /filter_by=platform%3A%3D%60web%60\+%26%26\+%28categorySlug%3A%3D%60account-settings%60%29/);
  assert.match(requests.at(-1)?.url ?? "", /sort_by=_text_match%3Adesc%2CversionId%3Adesc/);
});
