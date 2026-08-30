import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { relatedCategoryItems } from "../src/data/apps.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("adapts Palmer motion to an API-backed virtual App canvas", async () => {
  const [apps, api, hook, page, canvas, allocator, focus, filter, brand, chrome, styles, vite, productTypography] = await Promise.all([
    read("src/data/apps.js"),
    read("src/data/appCatalogApi.js"),
    read("src/hooks/useAppCatalog.js"),
    read("src/pages/PalmerHomePage.jsx"),
    read("src/sections/ExperienceCanvasSection.jsx"),
    read("src/interaction/spatialTileAllocator.js"),
    read("src/composites/CollectionFocus.jsx"),
    read("src/composites/FilterControl.jsx"),
    read("src/primitives/BrandLogo.jsx"),
    read("src/sections/GlobalChrome.jsx"),
    read("src/styles.css"),
    read("vite.config.mjs"),
    read("../../../../src/vitrine/productTypography.css"),
  ]);

  assert.match(apps, /catalogAppsToItems/);
  assert.match(apps, /description: typeof app\.description/);
  assert.match(apps, /platforms: \[\.\.\.new Set/);
  assert.match(apps, /lastCapturedAt: app\.lastCapturedAt/);
  assert.doesNotMatch(apps, /const appRecords/);
  assert.match(api, /\/api\/apps/);
  assert.match(api, /cursor/);
  assert.match(api, /vitrine:auth-token/);
  assert.match(api, /initialPageRequests = new Map\(\)/);
  assert.match(api, /preloadInitialAppCatalogPage/);
  assert.match(api, /vitrines:explore-catalog-request-start/);
  assert.match(api, /performance\?\.measure/);
  assert.match(hook, /fetchAppCatalogPage/);
  assert.match(hook, /fetchAppCatalogPage\(\)/);
  assert.match(hook, /catalogSessionKey/);
  assert.match(hook, /\[catalogSessionKey\]/);
  assert.match(hook, /setCanAutoLoadMore\(Boolean\(page\.nextCursor\)\)/);
  assert.match(page, /useAppCatalog/);
  assert.match(page, /canAutoLoadMore=\{canAutoLoadMore\}/);
  assert.match(page, /allowBackgroundPagination=\{!entering\}/);
  assert.match(canvas, /canvasLoadDirection/);
  assert.match(canvas, /dragLoadDirection/);
  assert.match(canvas, /viewportTileIds/);
  assert.match(canvas, /syncMountedTiles/);
  assert.match(canvas, /scheduleMountedTileSync/);
  assert.match(canvas, /deferOverscan: true/);
  assert.match(canvas, /visibleOnly: true/);
  assert.match(canvas, /preserveView: \{ position: previousPosition, scale: previousScale \}/);
  assert.doesNotMatch(canvas, /retainMountedOverscan/);
  assert.doesNotMatch(canvas, /preserveCurrent/);
  assert.match(canvas, /scheduleTileOverscanWork/);
  assert.match(canvas, /ZOOM_IMAGE_PRELOAD_LIMIT = 32/);
  assert.match(canvas, /priorityItemKeys/);
  assert.match(canvas, /const previousPosition = \{ \.\.\.position\.current \}/);
  assert.doesNotMatch(canvas, /nearbyTileIds\(tiles, focusTileId, 1\)/);
  assert.match(canvas, /previousHeight/);
  assert.match(canvas, /data-load-more-state/);
  assert.match(canvas, /AUTO_LOAD_DIRECTIONS = \["right", "down", "left", "up"\]/);
  assert.match(canvas, /autoLoadIndex\.current % AUTO_LOAD_DIRECTIONS\.length/);
  assert.match(canvas, /!canAutoLoadMore/);
  assert.match(canvas, /requestIdleCallback\(callback, \{ timeout: 1_200 \}\)/);
  assert.match(canvas, /window\.setTimeout\(callback, 250\)/);
  assert.match(canvas, /if \(loadMore\(direction, \{ animate: false \}\)\) autoLoadIndex\.current \+= 1/);
  assert.match(canvas, /if \(pending\.animate === false\)/);
  assert.match(canvas, /if \(pending\.animate === false\)[\s\S]*const assigned = new Set/);
  assert.match(canvas, /data-assignment-count=\{tile\.assignments\.length\}/);
  assert.match(canvas, /suppressClick/);
  assert.match(canvas, /Draggable\.create\(canvas/);
  assert.match(canvas, /minimumMovement: 10/);
  assert.match(canvas, /if \(!event\.ctrlKey\) return/);
  assert.match(canvas, /addEventListener\("wheel", onTrackpadPinch, \{ passive: false \}\)/);
  assert.match(canvas, /trackpadZoomIndex/);
  assert.doesNotMatch(canvas, /setCursorPosition/);
  assert.match(canvas, /ref=\{cursorRef\}/);
  assert.match(canvas, /const nearby = new Map\(\)/);
  assert.match(canvas, /proximityProducts\.current = new Set\(nearby\.keys\(\)\)/);
  assert.match(canvas, /pendingWheelPosition\.current = next/);
  assert.match(canvas, /const renderedTiles = useMemo/);
  assert.match(canvas, /onHoverStart=\{handleHoverStart\}/);
  assert.match(canvas, /if \(!allowBackgroundPagination/);
  const experienceProduct = await read("src/composites/ExperienceProduct.jsx");
  const productImage = await read("src/primitives/ProductImage.jsx");
  assert.match(experienceProduct, /role="button"/);
  assert.match(experienceProduct, /event\.key !== "Enter"/);
  assert.match(experienceProduct, /memo\(ExperienceProductView\)/);
  assert.match(productImage, /decoding="async"/);
  assert.match(allocator, /allocateAppsToTiles/);
  assert.match(allocator, /assignIntoTile/);
  assert.match(vite, /VITRINE_API_TARGET/);
  assert.match(focus, /contextProduct\.name/);
  assert.match(focus, /contextProduct\.totalScreens/);
  assert.match(focus, /contextProduct\.description/);
  assert.match(focus, /contextProduct\.platforms/);
  assert.match(focus, /contextProduct\.lastCapturedAt/);
  assert.match(focus, /FOCUS_CAROUSEL_RADIUS = 2/);
  assert.match(focus, /FOCUS_THUMB_RADIUS = 12/);
  assert.match(focus, /Math\.abs\(index - slide\) <= FOCUS_CAROUSEL_RADIUS/);
  assert.match(focus, /Math\.abs\(index - slide\) <= FOCUS_THUMB_RADIUS/);
  assert.match(focus, /href=\{contextProduct\.appUrl\}/);
  assert.match(focus, /aria-label=\{`View \$\{product\.name\}`\}/);
  assert.match(focus, /onOpenApp\(product\.id\)/);
  assert.match(focus, /suppressProductClick/);
  assert.match(filter, /aria-label="Filter apps"/);
  assert.match(brand, /brand-logo__mark/);
  assert.match(brand, /brand-logo__word/);
  assert.match(brand, />Vitrines</);
  assert.match(chrome, /href="\/apps"/);
  assert.match(chrome, /aria-label="Back to Apps"/);
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
