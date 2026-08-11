import assert from "node:assert/strict";
import test from "node:test";
import type { SiteSummary, SiteVersionDetail } from "./sitesStore.ts";
import { publishedSiteCatalogDocument, publishedSiteCatalogDocuments } from "./typesenseSiteCatalogSource.ts";

const site: SiteSummary = {
  siteId: 7, versionId: 9, name: "Linear", slug: "linear", sourceUrl: "https://linear.app",
  description: "Project management", logoUrl: "https://linear.app/logo.svg", categories: ["Business"],
  styles: ["Minimal"], popularity: 8, label: "Aug 2026", isLatest: true, pageCount: 1,
  sectionCount: 1, previewUrl: "/assets/sites/7/preview.webp", isUpdated: false,
  previewMediaKind: "image", previews: [], updatedAt: "2026-08-11T00:00:00.000Z",
};

const detail: SiteVersionDetail = {
  ...site,
  canonicalUrl: "https://mobbin.com/sites/linear",
  versions: [],
  pages: [{
    id: 1, sourceId: "home", title: "Home", url: "https://linear.app", position: 0,
    fullPageImageUrl: "/api/sites/7/versions/9/pages/1/media",
    sections: [{
      id: 2, sourceId: "hero", position: 0, mediaKind: "image",
      mediaUrl: "/api/sites/7/versions/9/sections/2/media", ocrBoxes: [{ x: 0, y: 0, width: 1, height: 1, text: "Plan better" }],
      sourceMetadata: { patterns: ["Hero"], heading: "Project planning" },
    }],
  }],
  analysis: {
    schemaVersion: 2, status: "ready", evidence: [], structure: [], visualTokens: [], responsive: [],
    synthesis: null, warnings: [],
    technology: [{ id: "tech", name: "Framer", category: "framework", state: "confirmed", evidenceIds: ["tech-1"], confidence: 1 }],
    motion: [{ id: "motion", targetEvidenceId: "structure-1", type: "scroll-linked", trigger: "scroll-progress", properties: ["transform"], states: [], viewports: ["desktop"], evidenceIds: ["motion-1"], confidence: 1 }],
  },
};

const store = {
  listReadySites: async () => [site],
  readyVersionDetail: async () => detail,
};

test("builds a Site Typesense document from ready catalog and captured evidence", async () => {
  const document = await publishedSiteCatalogDocument(7, store);
  assert.equal(document?.id, "site:7");
  assert.deepEqual(document?.sections, ["Home", "Hero"]);
  assert.deepEqual(document?.technologies, ["Framer", "framework"]);
  assert.deepEqual(document?.motion, ["scroll-linked", "scroll-progress", "transform"]);
  assert.match(document?.searchText ?? "", /Plan better/);
});

test("builds the full ready Site catalog for an alias swap", async () => {
  const documents = await publishedSiteCatalogDocuments(store);
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.siteId, 7);
});
