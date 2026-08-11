import assert from "node:assert/strict";
import test from "node:test";
import { publishedFlowCatalogDocuments } from "./typesenseFlowCatalogSource.ts";

const item = {
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

test("builds searchable Flow documents from every published platform page", async () => {
  const calls: string[] = [];
  const documents = await publishedFlowCatalogDocuments({
    cursorSecret: "test-secret",
    loadPage: async ({ platform, cursor }) => {
      calls.push(`${platform}:${cursor ?? "first"}`);
      return {
        items: platform === "web" && !cursor ? [item] : [],
        nextCursor: platform === "web" && !cursor ? "next" : null,
        totalCount: 1,
        facets: [],
      };
    },
  });

  assert.deepEqual(calls, ["web:first", "web:next", "ios:first", "android:first"]);
  assert.equal(documents.length, 1);
  assert.deepEqual(documents[0], {
    id: "web:linear:9:profile", platform: "web", appId: "linear", appName: "Linear",
    title: "Edit profile", category: "Account Management", description: "Change your profile picture",
    tags: ["profile"], stepLabels: ["Open profile"],
    searchText: "Linear linear Edit profile Account Management Change your profile picture profile Open profile",
    versionId: 9, card: JSON.stringify(item),
  });
});
