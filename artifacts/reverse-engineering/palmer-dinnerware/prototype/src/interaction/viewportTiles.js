export const TILE_VIEWPORT_OVERSCAN = 160;

export function visibleTileIds(rects, viewport) {
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  return new Set(rects.filter((rect) => (
    rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < height
  )).map(({ id }) => id));
}

export function viewportTileIds(rects, viewport, overscan = TILE_VIEWPORT_OVERSCAN) {
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  return new Set(rects.filter((rect) => {
    const visibleX = rect.right > 0 && rect.left < width;
    const visibleY = rect.bottom > 0 && rect.top < height;
    const nearX = rect.right > -overscan && rect.left < width + overscan;
    const nearY = rect.bottom > -overscan && rect.top < height + overscan;
    return (visibleX && nearY) || (nearX && visibleY);
  }).map(({ id }) => id));
}

export function equalIdSets(left, right) {
  return left.size === right.size && [...left].every((id) => right.has(id));
}
