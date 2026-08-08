import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminGalleryApps,
  buildAppMetadata,
  buildCatalogPage,
  buildEvidencePage,
  buildGalleryApps,
  buildPublishedCatalogPage,
} from "./gallery.ts";

const productivity = {
  id: 7,
  name: "Productivity",
  slug: "productivity",
};

test("builds app metadata without section payloads", () => {
  const app = buildAppMetadata({
    app: "claude",
    icon_url: "https://cdn.example.com/claude.png",
    categories: [
      { id: 1, name: "AI", slug: "ai" },
      productivity,
    ],
    total_screens: 120,
    total_ui_elements: 31,
    total_flows: 7,
    analyzed_screens: 115,
    last_captured_at: "2026-07-19T00:00:00.000Z",
    available_platforms: ["ios", "android"],
  });

  assert.equal(app.app, "Claude");
  assert.equal(app.totalScreens, 120);
  assert.equal(app.totalUiElements, 31);
  assert.equal(app.totalFlows, 7);
  assert.deepEqual(app.platforms, ["ios", "android"]);
  assert.deepEqual(app.categories.map(({ name }) => name), ["AI", "Productivity"]);
  assert.equal("cat" in app, false);
  assert.equal("screens" in app, false);
});

test("builds an evidence page without re-paginating it", () => {
  const page = buildEvidencePage({
    rows: [{
      id: 2,
      app: "claude",
      platform: "ios",
      image_url: "mobbin-bulk:0000000000000002",
      description: "Composer",
      source_screen_id: 41,
      source_screen_image_url: "mobbin-bulk:0000000000000041",
      matched_facets: [{ group: "screens", value: "Preview" }],
    }],
    nextCursor: "Mg",
  });

  assert.deepEqual(page.screens.map(({ id }) => id), [2]);
  assert.deepEqual(page.screens[0].sourceScreen, {
    id: 41,
    url: "/api/media/claude/0000000000000041",
    thumbnailUrl: "/api/media/claude/0000000000000041?variant=thumb",
  });
  assert.deepEqual(page.screens[0].matchedFacets, [{ group: "screens", value: "Preview" }]);
  assert.equal(page.nextCursor, "Mg");
});

test("groups images, preserves metadata, maps local media, and caps screens", () => {
  const images = Array.from({ length: 121 }, (_, index) => ({
    id: index + 1,
    app: "linear",
    platform: "web",
    image_url:
      index === 0 ? "mobbin-bulk:0123456789abcdef" : `https://cdn.example.com/${index}.png`,
    description: index === 0 ? "Login screen" : null,
    analysis: index === 0 ? {
      description: "Login screen",
      purpose: "Authenticate an existing user",
      pageType: "Login",
      productArea: "Authentication",
      theme: "light" as const,
      visibleStates: ["focused input"],
      componentNames: ["Text input", "Primary button"],
    } : null,
  }));

  const [app] = buildGalleryApps(images);

  assert.equal(app.app, "Linear");
  assert.deepEqual(app.categories, []);
  assert.equal("cat" in app, false);
  assert.equal(app.totalScreens, 121);
  assert.equal(app.screens.length, 120);
  assert.equal(app.screens[0].url, "/api/media/linear/0123456789abcdef");
  assert.equal(app.screens[0].thumbnailUrl, "/api/media/linear/0123456789abcdef?variant=thumb");
  assert.equal(app.screens[0].description, "Login screen");
  assert.equal(app.screens[0].id, 1);
  assert.equal(app.screens[0].type, "Login");
  assert.equal(app.screens[0].productArea, "Authentication");
  assert.equal(app.screens[0].theme, "light");
  assert.deepEqual(app.screens[0].visibleStates, ["focused input"]);
});

test("builds lightweight admin cards from database summaries", () => {
  const images = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    app: "linear",
    platform: "web",
    image_url: `mobbin-bulk:${String(index + 1).padStart(16, "0")}`,
    description: null,
    analysis: index === 0 ? {
      description: "Workspace",
      purpose: "Manage work",
      pageType: "Dashboard",
      productArea: "Workspace",
      theme: "light" as const,
      visibleStates: [],
      componentNames: [],
      confidence: 0.9,
    } : null,
    categories: [productivity],
    icon_url: "https://cdn.example.com/linear.png",
    total_screens: 236,
    analyzed_screens: 17,
    last_captured_at: "2026-07-19T01:00:00.000Z",
    available_platforms: ["web", "ios", "android"],
  }));

  const [app] = buildAdminGalleryApps(images);

  assert.equal(app.totalScreens, 236);
  assert.equal(app.analyzedScreens, 17);
  assert.equal(app.lastCapturedAt, "2026-07-19T01:00:00.000Z");
  assert.equal(app.screens.length, 5);
  assert.equal(app.iconUrl, "https://cdn.example.com/linear.png");
  assert.deepEqual(app.platforms, ["web", "ios", "android"]);
  assert.deepEqual(app.categories, [productivity]);
});

test("uses captured website identity in the Apps gallery", () => {
  const [app] = buildAdminGalleryApps([{
    id: 71,
    app: "example-com",
    platform: "web",
    image_url: "capture:0123456789abcdef",
    description: null,
    categories: [{
      id: 8,
      name: "Developer Tools",
      slug: "developer-tools",
    }],
    icon_url: "https://example.com/favicon.ico",
    display_name: "Example",
    website_url: "https://example.com",
    accent_color: "#123456",
    total_screens: 1,
    analyzed_screens: 0,
    last_captured_at: "2026-07-21T01:00:00.000Z",
    available_platforms: ["web"],
  }]);

  assert.equal(app.app, "Example");
  assert.equal(app.accent, "#123456");
  assert.equal(app.websiteUrl, "https://example.com");
  assert.equal(app.iconUrl, "https://example.com/favicon.ico");
});

test("builds paginated public previews without source image fields", () => {
  const images = Array.from({ length: 30 }, (_, appIndex) =>
    Array.from({ length: 4 }, (_, imageIndex) => ({
      id: appIndex * 10 + imageIndex + 1,
      app: `catalog-${String(appIndex + 1).padStart(2, "0")}`,
      platform: "web",
      image_url: `mobbin-bulk:${String(appIndex * 10 + imageIndex + 1).padStart(16, "0")}`,
      description: null,
      analysis: null,
    })),
  ).flat();

  const previews = images.slice(0, 3).map((image, index) => ({ ...image, preview_rank: index + 1 }));
  const first = buildCatalogPage(images, undefined, 24, previews);
  assert.equal(first.apps.length, 24);
  assert.equal(first.apps[0].previewScreens.length, 3);
  assert.deepEqual(first.apps[0].previewScreens.map(({ url }) => url), [
    "/api/preview-media/catalog-01/1?variant=full",
    "/api/preview-media/catalog-01/2?variant=full",
    "/api/preview-media/catalog-01/3?variant=full",
  ]);
  assert.deepEqual(first.apps[0].previewScreens.map(({ thumbnailUrl }) => thumbnailUrl), [
    "/api/preview-media/catalog-01/1",
    "/api/preview-media/catalog-01/2",
    "/api/preview-media/catalog-01/3",
  ]);
  assert.ok(first.nextCursor);
  assert.doesNotMatch(JSON.stringify(first), /image_url|mobbin-bulk/);

  const second = buildCatalogPage(images, first.nextCursor ?? undefined, 24, previews);
  assert.equal(second.apps.length, 6);
  assert.equal(second.nextCursor, null);
  assert.notEqual(second.apps[0].id, first.apps[0].id);
});

test("builds the existing public catalog contract from bounded app records", () => {
  const image = {
    id: 1,
    app: "linear",
    platform: "web",
    image_url: "capture:0123456789abcdef",
    kind: "screen" as const,
    description: null,
    analysis: null,
    captured_at: "2026-07-25T00:00:00.000Z",
  };
  const page = buildPublishedCatalogPage({
    apps: [{
      app_id: 1,
      app: "linear",
      display_name: "Linear",
      categories: [productivity],
      website_url: "https://linear.app",
      icon_url: "https://linear.app/icon.png",
      accent_color: "#5E6AD2",
      total_screens: 236,
      available_platforms: ["web", "ios"],
      last_captured_at: "2026-07-26T03:14:54.618Z",
    }],
    previews: [
      {
        ...image,
        matched_facets: [{ group: "screens", value: "Dashboard" }],
        preview_rank: 1,
      },
      { ...image, id: 2, preview_rank: 2 },
    ],
    nextCursor: "next",
  });

  assert.equal(page.apps[0]?.totalScreens, 236);
  assert.deepEqual(page.apps[0]?.platforms, ["web", "ios"]);
  assert.deepEqual(
    page.apps[0]?.previewScreens.map(({ url }) => url),
    [
      "/api/catalog/facet-media/linear/screens/Dashboard/web/1?variant=full",
      "/api/preview-media/linear/2?variant=full",
    ],
  );
  assert.deepEqual(page.apps[0]?.previewScreens[0]?.matchedFacets, [
    { group: "screens", value: "Dashboard" },
  ]);
  assert.equal(page.apps[0]?.iconUrl, "https://linear.app/icon.png");
  assert.equal(page.apps[0]?.lastCapturedAt, "2026-07-26T03:14:54.618Z");
  assert.deepEqual(page.apps[0]?.categories, [productivity]);
  assert.equal("cat" in page.apps[0]!, false);
  assert.equal(page.nextCursor, "next");
  assert.doesNotMatch(JSON.stringify(page), /image_url|object_key|capture:/);
});

test("keeps a UUID-disambiguated route while showing the human app name", () => {
  const slug = "aboard-ea683077-aadb-47c5-a771-d21fd9676510";
  const page = buildPublishedCatalogPage({
    apps: [{
      app_id: 2,
      app: slug,
      display_name: "Aboard",
      categories: [productivity],
      website_url: null,
      icon_url: null,
      accent_color: null,
      total_screens: 624,
      available_platforms: ["web"],
      last_captured_at: "2026-07-26T00:00:00.000Z",
    }],
    previews: [{
      id: 71,
      app: slug,
      platform: "web",
      image_url: "mobbin-bulk:0123456789abcdef",
      kind: "screen",
      description: null,
      analysis: null,
      captured_at: "2026-07-26T00:00:00.000Z",
      preview_rank: 1,
    }],
    nextCursor: null,
  });

  assert.equal(page.apps[0]?.id, slug);
  assert.equal(page.apps[0]?.app, "Aboard");
  assert.equal(page.apps[0]?.previewScreens[0]?.url, `/api/preview-media/${slug}/1?variant=full`);
});

test("preserves the server's Updated At order for published Apps", () => {
  const page = buildPublishedCatalogPage({
    apps: [
      {
        app_id: 91,
        app: "alltrails",
        display_name: "AllTrails",
        categories: [{
          id: 9,
          name: "Travel & Transportation",
          slug: "travel-transportation",
        }],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 20,
        available_platforms: ["web"],
        last_captured_at: "2026-07-26T03:14:54.618Z",
      },
      {
        app_id: 42,
        app: "ipsy",
        display_name: "Ipsy",
        categories: [{
          id: 10,
          name: "Shopping",
          slug: "shopping",
        }],
        website_url: null,
        icon_url: null,
        accent_color: null,
        total_screens: 12,
        available_platforms: ["web"],
        last_captured_at: "2026-07-26T03:03:57.624Z",
      },
    ],
    previews: [],
    nextCursor: null,
  });

  assert.deepEqual(page.apps.map(({ id }) => id), ["alltrails", "ipsy"]);
  assert.equal(page.apps[0]?.lastCapturedAt, "2026-07-26T03:14:54.618Z");
});
