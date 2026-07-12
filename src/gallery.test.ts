import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAppDetailPage, buildCatalogPage, buildGalleryApps } from "./gallery.ts";

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
  assert.equal(app.cat, "Productivity");
  assert.equal(app.totalScreens, 121);
  assert.equal(app.screens.length, 120);
  assert.equal(app.screens[0].url, "/api/media/linear/0123456789abcdef");
  assert.equal(app.screens[0].description, "Login screen");
  assert.equal(app.screens[0].id, 1);
  assert.equal(app.screens[0].type, "Login");
  assert.equal(app.screens[0].productArea, "Authentication");
  assert.equal(app.screens[0].theme, "light");
  assert.deepEqual(app.screens[0].visibleStates, ["focused input"]);
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

test("builds cursor-paginated app detail", () => {
  const images = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    app: "linear",
    platform: "web",
    image_url: `mobbin-bulk:${String(index + 1).padStart(16, "0")}`,
    description: null,
    analysis: null,
  }));
  const first = buildAppDetailPage(images, "linear", undefined, 2);
  assert.equal(first?.screens.length, 2);
  assert.ok(first?.nextCursor);
  const second = buildAppDetailPage(images, "linear", first?.nextCursor ?? undefined, 2);
  assert.deepEqual(second?.screens.map(({ id }) => id), [3, 4]);
  assert.equal(second?.nextCursor, null);
  assert.equal(buildAppDetailPage(images, "missing"), undefined);
});
