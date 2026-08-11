import assert from "node:assert/strict";
import test from "node:test";
import {
  createTypesenseFlowCatalogClient,
  flowCatalogTypesenseFilter,
} from "./typesenseFlowCatalog.ts";

const card = {
  category: "Account Management",
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
  title: "Edit profile", category: "Account Management", description: "Change your profile picture",
  tags: ["profile"], stepLabels: ["Open profile"], searchText: "Linear Edit profile Open profile",
  versionId: 9, card: JSON.stringify(card),
};

test("maps Flow platform and group filters to Typesense", () => {
  assert.equal(flowCatalogTypesenseFilter({
    platform: "web",
    flowGroups: ["Account Management", "Security"],
  }), "platform:=`web` && (category:=`Account Management` || category:=`Security`)");
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
        facet_counts: [{ field_name: "category", counts: [{ value: "Account Management", count: 1 }] }],
      }));
    },
  );

  assert.equal(await client.index([document]), 1);
  const result = await client.search({ query: "open profile", platform: "web", flowGroups: ["Account Management"] });
  assert.equal(result.items[0]?.title, "Edit profile");
  assert.deepEqual(result.facets, [{ group: "flowGroups", value: "Account Management", count: 1 }]);
  assert.match(requests.at(-1)?.url ?? "", /query_by=title%2CappName%2Ccategory%2Ctags%2CstepLabels%2Cdescription%2CsearchText/);
  assert.match(requests.at(-1)?.url ?? "", /filter_by=platform%3A%3D%60web%60\+%26%26\+%28category%3A%3D%60Account\+Management%60%29/);
  assert.match(requests.at(-1)?.url ?? "", /sort_by=_text_match%3Adesc%2CversionId%3Adesc/);
});
