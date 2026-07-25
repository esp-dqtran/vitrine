import assert from "node:assert/strict";
import { test } from "node:test";
import { projectSiteSearchDocuments } from "./siteSearchProjection.ts";

test("projects a ready Site into a published search document", () => {
  const [document] = projectSiteSearchDocuments({
    site: {
      id: 7,
      versionId: 11,
      name: "V7",
      description: "Visual data platform",
      categories: ["Business"],
      styles: ["Minimal", "Dark"],
      updatedAt: "2026-07-25T00:00:00.000Z",
    },
    pages: [
      { title: "Pricing", sectionPatterns: ["Hero", "Social Proof"] },
      { title: "FAQ", sectionPatterns: ["FAQ"] },
    ],
  });

  assert.equal(document.entityType, "site");
  assert.equal(document.catalogScope, "sites");
  assert.equal(document.catalogName, "V7");
  assert.equal(document.siteId, 7);
  assert.equal(document.siteVersionId, 11);
  assert.deepEqual(document.siteSections, ["FAQ", "Hero", "Pricing", "Social Proof"]);
  assert.deepEqual(document.siteStyles, ["Dark", "Minimal"]);
  assert.match(document.searchText, /Visual data platform/);
});
