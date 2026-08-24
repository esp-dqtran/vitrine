import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAdminAppsPage,
  parseCatalogDiscoveryPage,
} from "./catalogPageParser.ts";

const item = {
  id: "linear",
  app: "Linear",
  categories: [{ id: 1, name: "Productivity", slug: "productivity" }],
  accent: "#5E6AD2",
  totalScreens: 1,
  platforms: ["web"],
  previewScreens: [{
    id: 7,
    type: "Dashboard",
    productArea: "Home",
    theme: "light",
    visibleStates: ["default"],
    platform: "web",
    description: null,
    purpose: "Review workspace activity",
    sourcePresentation: "marketing-composite",
    embeddedPageType: "Dashboard",
    icons: ["Search"],
    imagery: ["Avatar"],
    contentPatterns: ["Metadata row"],
    interactionPatterns: ["Tabs"],
    responsiveViewport: "desktop",
    url: "/api/preview-media/linear/7",
    matchedFacets: [{ group: "screens", value: "Dashboard" }],
    uiElements: [{
      type: "Top Navigation Bar",
      group: "View",
      layer: "embedded-ui",
      confidence: 0.87,
      reviewStatus: "accepted",
    }],
  }],
  websiteUrl: null,
  iconUrl: null,
};

const page = {
  items: [item],
  nextCursor: null,
  totalCount: 1,
  facets: [{ group: "categories", value: "Productivity", count: 1 }],
};

test("parses catalog and admin app envelopes", () => {
  assert.deepEqual(parseCatalogDiscoveryPage(page), page);
  assert.deepEqual(parseAdminAppsPage({
    apps: [{ ...item, screens: [] }],
    nextCursor: "next",
    total: 3,
  }).total, 3);
});

test("parses admin discovery facets while preserving progress fields", () => {
  const parsed = parseAdminAppsPage({
    apps: [{ ...item, screens: [], analyzedScreens: 3 }],
    nextCursor: "next",
    total: 9,
    facets: [{ group: "screens", value: "Dashboard", count: 4, section: "Workspace" }],
  });

  assert.equal(parsed.apps[0]?.analyzedScreens, 3);
  assert.deepEqual(parsed.facets, [
    { group: "screens", value: "Dashboard", count: 4, section: "Workspace" },
  ]);
});

test("preserves normalized Screen-pattern taxonomy metadata", () => {
  const facet = {
    group: "screens",
    value: "My Account & Profile",
    count: 4,
    section: "Account Management",
    description: "Screens that present an overview of the user account or profile.",
    aliases: ["account overview", "profile"],
    sectionPosition: 2,
    position: 4,
  };
  const parsed = parseCatalogDiscoveryPage({ ...page, facets: [facet] });

  assert.deepEqual(parsed.facets, [facet]);
});

test("rejects malformed catalog envelope fields with clear response errors", () => {
  const validScreen = item.previewScreens[0]!;
  for (const malformed of [
    { ...page, items: null },
    { ...page, nextCursor: 7 },
    { ...page, totalCount: -1 },
    { ...page, facets: [{ group: "flows", value: "Checkout", count: -1 }] },
    { ...page, facets: [{ group: "screens", value: "Home", count: 1, aliases: [7] }] },
    { ...page, facets: [{ group: "screens", value: "Home", count: 1, position: 0 }] },
    { ...page, items: [{ ...item, previewScreens: null }] },
    { ...page, items: [{ ...item, previewScreens: [{}] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, id: "7" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, platform: "desktop" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, theme: "sepia" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, visibleStates: "default" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, description: undefined }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, productArea: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, thumbnailUrl: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, sourceUrl: false }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, layoutPatterns: ["grid", 7] }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, componentNames: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, visibleText: "Save" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, purpose: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, sourcePresentation: "poster" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, embeddedPageType: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, uiElements: [{ ...validScreen.uiElements[0], layer: "canvas" }] }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, uiElements: [{ ...validScreen.uiElements[0], confidence: 2 }] }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, icons: ["Search", 7] }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, imagery: "Avatar" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, contentPatterns: [false] }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, interactionPatterns: {} }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, responsiveViewport: "watch" }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, capturedAt: 7 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, stateContext: {} }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, confidence: 1.5 }] }] },
    { ...page, items: [{ ...item, previewScreens: [{ ...validScreen, matchedFacets: [{}] }] }] },
    { ...page, items: [{ ...item, analyzedScreens: "1" }] },
    { ...page, items: [{ ...item, lastCapturedAt: 7 }] },
    { ...page, items: [{ ...item, description: false }] },
    { ...page, items: [{ ...item, previewVideoUrl: 9 }] },
  ]) {
    assert.throws(
      () => parseCatalogDiscoveryPage(malformed),
      /invalid catalog response:/,
    );
  }
});

test("rejects malformed admin envelopes", () => {
  assert.throws(
    () => parseAdminAppsPage({ apps: [], nextCursor: null, total: "3" }),
    /invalid admin Apps response:/,
  );
});
