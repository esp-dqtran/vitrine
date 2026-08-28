import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { relatedCategoryItems } from "../src/data/apps.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("adapts Palmer motion to an API-backed virtual App canvas", async () => {
  const [apps, api, hook, page, canvas, allocator, focus, filter, brand, styles, vite, productTypography] = await Promise.all([
    read("src/data/apps.js"),
    read("src/data/appCatalogApi.js"),
    read("src/hooks/useAppCatalog.js"),
    read("src/pages/PalmerHomePage.jsx"),
    read("src/sections/ExperienceCanvasSection.jsx"),
    read("src/interaction/spatialTileAllocator.js"),
    read("src/composites/CollectionFocus.jsx"),
    read("src/composites/FilterControl.jsx"),
    read("src/primitives/BrandLogo.jsx"),
    read("src/styles.css"),
    read("vite.config.mjs"),
    read("../../../../src/vitrine/productTypography.css"),
  ]);

  assert.match(apps, /catalogAppsToItems/);
  assert.doesNotMatch(apps, /const appRecords/);
  assert.match(api, /\/api\/apps/);
  assert.match(api, /cursor/);
  assert.match(api, /vitrine:auth-token/);
  assert.match(hook, /fetchAppCatalogPage/);
  assert.match(hook, /catalogSessionKey/);
  assert.match(hook, /\[catalogSessionKey\]/);
  assert.match(page, /useAppCatalog/);
  assert.match(canvas, /canvasLoadDirection/);
  assert.match(canvas, /dragLoadDirection/);
  assert.match(canvas, /nearbyTileIds/);
  assert.match(canvas, /previousHeight/);
  assert.match(canvas, /data-load-more-state/);
  assert.match(canvas, /AUTO_LOAD_DIRECTIONS = \["right", "down", "left", "up"\]/);
  assert.match(canvas, /autoLoadIndex\.current % AUTO_LOAD_DIRECTIONS\.length/);
  assert.match(canvas, /if \(loadMore\(direction, \{ animate: false \}\)\) autoLoadIndex\.current \+= 1/);
  assert.match(canvas, /if \(pending\.animate === false\)/);
  assert.match(canvas, /data-assignment-count=\{tile\.assignments\.length\}/);
  assert.match(canvas, /suppressClick/);
  assert.match(canvas, /Draggable\.create\(canvas/);
  assert.match(canvas, /minimumMovement: 10/);
  assert.match(await read("src/composites/ExperienceProduct.jsx"), /role="button"/);
  assert.match(await read("src/composites/ExperienceProduct.jsx"), /event\.key !== "Enter"/);
  assert.match(allocator, /allocateAppsToTiles/);
  assert.match(allocator, /assignIntoTile/);
  assert.match(vite, /VITRINE_API_TARGET/);
  assert.match(focus, /contextProduct\.name/);
  assert.match(focus, /contextProduct\.totalScreens/);
  assert.match(focus, /href=\{contextProduct\.appUrl\}/);
  assert.match(focus, /aria-label=\{`View \$\{product\.name\}`\}/);
  assert.match(focus, /onOpenApp\(product\.id\)/);
  assert.match(focus, /suppressProductClick/);
  assert.match(filter, /aria-label="Filter apps"/);
  assert.match(brand, /brand-logo__mark/);
  assert.match(brand, /brand-logo__word/);
  assert.match(brand, />Vitrines</);
  assert.doesNotMatch(page, /prefers-color-scheme|themeMode|data-theme/);
  assert.doesNotMatch(styles, /\.palmer-app\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: light/);
  assert.match(styles, /mask-image: url\("\/favicon\.svg"\)/);
  assert.ok((productTypography.match(/\.palmer-app \*/g) ?? []).length >= 10);
  assert.match(styles, /font-family: inherit/);
});

test("keeps the selected App first and limits focus peers to its category", () => {
  const items = [
    { id: "writer", name: "WRITER", categories: ["AI", "Productivity"], type: "AI" },
    { id: "wwdc", name: "WWDC", categories: ["Developer Tools"], type: "Developer Tools" },
    { id: "mercor", name: "Mercor", categories: ["AI"], type: "AI" },
    { id: "lex", name: "Lex", categories: ["Productivity"], type: "Productivity" },
  ];
  assert.deepEqual(
    relatedCategoryItems(items, items[0]).map(({ id }) => id),
    ["writer", "mercor", "lex"],
  );
});
