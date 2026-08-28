export const TILE_SLOT_COUNT = 114;
export const TILE_DIRECTIONS = ["left", "right", "up", "down"];

const stepForDirection = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function slotPriority(slot, direction) {
  const column = slot.runtimeColumn ?? 0;
  const row = slot.runtimeRow ?? 0;
  const centerDistance = Math.abs(column - 7) + Math.abs(row - 3.5);
  if (direction === "left") return column * 100 + Math.abs(row - 3.5);
  if (direction === "right") return -column * 100 + Math.abs(row - 3.5);
  if (direction === "up") return row * 100 + Math.abs(column - 7);
  if (direction === "down") return -row * 100 + Math.abs(column - 7);
  return centerDistance;
}

export function createSpatialTile(x = 0, y = 0) {
  return { id: `${x}:${y}`, x, y, assignments: [] };
}

export function tileExtent(tiles) {
  return tiles.reduce((extent, tile) => ({
    minX: Math.min(extent.minX, tile.x),
    maxX: Math.max(extent.maxX, tile.x),
    minY: Math.min(extent.minY, tile.y),
    maxY: Math.max(extent.maxY, tile.y),
  }), { minX: 0, maxX: 0, minY: 0, maxY: 0 });
}

export function nearbyTileIds(tiles, focusTileId, radius = 1) {
  const focus = tiles.find((tile) => tile.id === focusTileId) ?? tiles[0];
  if (!focus) return new Set();
  return new Set(tiles.filter((tile) => (
    Math.abs(tile.x - focus.x) <= radius
    && Math.abs(tile.y - focus.y) <= radius
  )).map((tile) => tile.id));
}

function assignIntoTile(tile, apps, slotTemplate, direction) {
  const occupied = new Set(tile.assignments.map(({ slotIndex }) => slotIndex));
  const empty = slotTemplate
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slotIndex }) => !occupied.has(slotIndex))
    .sort((left, right) => (
      slotPriority(left.slot, direction) - slotPriority(right.slot, direction)
    ));
  const assigned = apps.slice(0, empty.length).map((app, index) => {
    const { slot, slotIndex } = empty[index];
    const instanceKey = `${tile.id}:${slotIndex}:${app.id}`;
    return {
      slotIndex,
      item: {
        ...app,
        index: instanceKey,
        instanceKey,
        runtimeRow: slot.runtimeRow,
        runtimeColumn: slot.runtimeColumn,
        sourceSlotIndex: slot.index,
      },
    };
  });
  return {
    tile: { ...tile, assignments: [...tile.assignments, ...assigned] },
    assignedKeys: assigned.map(({ item }) => item.instanceKey),
    remainingApps: apps.slice(assigned.length),
  };
}

function nextTileTarget(tiles, start, direction, slotCount) {
  const step = stepForDirection[direction];
  let coordinate = { x: start.x + step.x, y: start.y + step.y };
  while (true) {
    const existingIndex = tiles.findIndex((tile) => (
      tile.x === coordinate.x && tile.y === coordinate.y
    ));
    if (existingIndex < 0) return { coordinate, existingIndex };
    if (tiles[existingIndex].assignments.length < slotCount) {
      return { coordinate, existingIndex };
    }
    coordinate = { x: coordinate.x + step.x, y: coordinate.y + step.y };
  }
}

export function allocateAppsToTiles(
  tiles,
  apps,
  slotTemplate,
  direction = "center",
  focusTileId = "0:0",
) {
  if (!apps.length) return { tiles, assignedKeys: [], targetTileId: null };
  const currentTiles = tiles.length ? tiles : [createSpatialTile()];
  const assignedAppIds = new Set(currentTiles.flatMap((tile) => (
    tile.assignments.map(({ item }) => item.id)
  )));
  const uniqueApps = apps.filter((app) => {
    if (assignedAppIds.has(app.id)) return false;
    assignedAppIds.add(app.id);
    return true;
  });
  if (!uniqueApps.length) return { tiles: currentTiles, assignedKeys: [], targetTileId: null };
  const focusIndex = Math.max(0, currentTiles.findIndex((tile) => tile.id === focusTileId));
  let nextTiles = [...currentTiles];
  let targetIndex = focusIndex;
  let remainingApps = uniqueApps;
  const assignedKeys = [];
  let targetTileId = nextTiles[targetIndex].id;

  while (remainingApps.length) {
    const result = assignIntoTile(nextTiles[targetIndex], remainingApps, slotTemplate, direction);
    nextTiles[targetIndex] = result.tile;
    assignedKeys.push(...result.assignedKeys);
    remainingApps = result.remainingApps;
    targetTileId = result.tile.id;
    if (!remainingApps.length) break;

    const target = nextTileTarget(
      nextTiles,
      nextTiles[targetIndex],
      direction,
      slotTemplate.length,
    );
    if (target.existingIndex >= 0) {
      targetIndex = target.existingIndex;
    } else {
      const tile = createSpatialTile(target.coordinate.x, target.coordinate.y);
      nextTiles.push(tile);
      targetIndex = nextTiles.length - 1;
    }
  }

  if (nextTiles[targetIndex].assignments.length >= slotTemplate.length && direction !== "center") {
    const target = nextTileTarget(
      nextTiles,
      nextTiles[targetIndex],
      direction,
      slotTemplate.length,
    );
    if (target.existingIndex < 0) {
      nextTiles.push(createSpatialTile(target.coordinate.x, target.coordinate.y));
    }
  }

  return { tiles: nextTiles, assignedKeys, targetTileId };
}
