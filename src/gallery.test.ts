import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGalleryApps } from "./gallery.ts";

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
