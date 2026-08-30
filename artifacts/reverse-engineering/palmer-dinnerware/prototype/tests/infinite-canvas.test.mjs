import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasLoadDirection,
  dragLoadDirection,
  trackpadZoomIndex,
} from "../src/interaction/canvasEdges.js";
import {
  allocateAppsToTiles,
  createSpatialTile,
  nearbyTileIds,
  tileExtent,
} from "../src/interaction/spatialTileAllocator.js";
import { catalogAppsToItems } from "../src/data/apps.js";
import {
  equalIdSets,
  visibleTileIds,
  viewportTileIds,
} from "../src/interaction/viewportTiles.js";

const slots = [
  { index: 0, runtimeColumn: 0, runtimeRow: 0, size: 10 },
  { index: 1, runtimeColumn: 1, runtimeRow: 0, size: 14 },
  { index: 2, runtimeColumn: 0, runtimeRow: 1, size: 18 },
  { index: 3, runtimeColumn: 1, runtimeRow: 1, size: 22 },
];
const apps = (prefix, count) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  name: `${prefix} ${index}`,
  collectionSlug: `${prefix}-${index}`,
}));

test("detects all four canvas loading edges", () => {
  const bounds = { minX: -1200, maxX: -100, minY: -900, maxY: -80 };
  const viewport = { width: 1000, height: 700 };

  assert.equal(canvasLoadDirection({ x: -1180, y: -500 }, bounds, viewport), "right");
  assert.equal(canvasLoadDirection({ x: -120, y: -500 }, bounds, viewport), "left");
  assert.equal(canvasLoadDirection({ x: -650, y: -880 }, bounds, viewport), "down");
  assert.equal(canvasLoadDirection({ x: -650, y: -100 }, bounds, viewport), "up");
  assert.equal(canvasLoadDirection({ x: -650, y: -500 }, bounds, viewport), null);
});

test("maps a deliberate drag to the newly revealed canvas direction", () => {
  assert.equal(dragLoadDirection(140, 20), "left");
  assert.equal(dragLoadDirection(-140, 20), "right");
  assert.equal(dragLoadDirection(20, 140), "up");
  assert.equal(dragLoadDirection(20, -140), "down");
  assert.equal(dragLoadDirection(40, 30), null);
});

test("maps trackpad pinch direction to the discrete canvas zoom levels", () => {
  assert.equal(trackpadZoomIndex(1, -12, 3), 2);
  assert.equal(trackpadZoomIndex(1, 12, 3), 0);
  assert.equal(trackpadZoomIndex(2, -12, 3), 2);
  assert.equal(trackpadZoomIndex(0, 12, 3), 0);
  assert.equal(trackpadZoomIndex(1, 0, 3), 1);
});

test("preserves useful App metadata for the focus sidebar", () => {
  const [item] = catalogAppsToItems([{
    id: "comet",
    app: "Comet",
    accent: "#111111",
    categories: [{ name: "Utilities" }],
    totalScreens: 124,
    analyzedScreens: 98,
    description: "  An AI-powered browser.  ",
    platforms: ["ios", "ios"],
    lastCapturedAt: "2026-07-24T11:46:20.491Z",
    websiteUrl: "https://example.com",
  }]);

  assert.equal(item.description, "An AI-powered browser.");
  assert.deepEqual(item.platforms, ["ios"]);
  assert.equal(item.analyzedScreens, 98);
  assert.equal(item.lastCapturedAt, "2026-07-24T11:46:20.491Z");
  assert.equal(item.websiteUrl, "https://example.com");
});

test("fills empty slots before extending into a neighboring tile", () => {
  const seeded = allocateAppsToTiles([createSpatialTile()], apps("first", 3), slots, "center");
  const extended = allocateAppsToTiles(seeded.tiles, apps("next", 2), slots, "right");

  assert.equal(extended.tiles.find(({ id }) => id === "0:0").assignments.length, 4);
  assert.equal(extended.tiles.find(({ id }) => id === "1:0").assignments.length, 1);
  assert.equal(new Set(extended.assignedKeys).size, 2);
});

test("does not assign an App twice when a cursor page is replayed", () => {
  const seeded = allocateAppsToTiles([createSpatialTile()], apps("first", 3), slots, "center");
  const replayed = allocateAppsToTiles(
    seeded.tiles,
    [apps("first", 3)[1], ...apps("next", 1)],
    slots,
    "right",
  );

  const assignedIds = replayed.tiles.flatMap((tile) => (
    tile.assignments.map(({ item }) => item.id)
  ));
  assert.equal(assignedIds.filter((id) => id === "first-1").length, 1);
  assert.equal(assignedIds.filter((id) => id === "next-0").length, 1);
  assert.equal(replayed.assignedKeys.length, 1);
});

test("creates cached neighboring tiles in every direction", () => {
  for (const [direction, expectedId] of [
    ["left", "-1:0"],
    ["right", "1:0"],
    ["up", "0:-1"],
    ["down", "0:1"],
  ]) {
    const full = allocateAppsToTiles([createSpatialTile()], apps("full", 4), slots, direction);
    assert.ok(full.tiles.some(({ id }) => id === expectedId));
  }
});

test("keeps assignments cached while virtualizing distant tile contents", () => {
  const tiles = [
    createSpatialTile(-2, 0),
    createSpatialTile(-1, 0),
    createSpatialTile(0, 0),
    createSpatialTile(1, 0),
    createSpatialTile(2, 0),
  ];
  assert.deepEqual(tileExtent(tiles), { minX: -2, maxX: 2, minY: 0, maxY: 0 });
  assert.deepEqual([...nearbyTileIds(tiles, "0:0", 1)], ["-1:0", "0:0", "1:0"]);
});

test("mounts visible and cardinal overscan tiles without paying for diagonal tiles", () => {
  const rects = [
    { id: "center", left: 0, top: 0, right: 1000, bottom: 700 },
    { id: "left", left: -1160, top: 0, right: -120, bottom: 700 },
    { id: "right", left: 1120, top: 0, right: 2160, bottom: 700 },
    { id: "up", left: 0, top: -860, right: 1000, bottom: -120 },
    { id: "down", left: 0, top: 820, right: 1000, bottom: 1560 },
    { id: "diagonal", left: -1160, top: -860, right: -120, bottom: -120 },
    { id: "far", left: 1400, top: 0, right: 2400, bottom: 700 },
  ];

  const mounted = viewportTileIds(rects, { width: 1000, height: 700 });
  assert.deepEqual([...visibleTileIds(rects, { width: 1000, height: 700 })], ["center"]);
  assert.deepEqual([...mounted], ["center", "left", "right", "up", "down"]);
  assert.equal(equalIdSets(mounted, new Set(["down", "up", "right", "left", "center"])), true);
  assert.equal(equalIdSets(mounted, new Set(["center"])), false);
});
