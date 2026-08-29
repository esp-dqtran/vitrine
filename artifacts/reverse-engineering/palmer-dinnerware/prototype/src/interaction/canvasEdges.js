export function canvasLoadDirection(position, bounds, viewport) {
  const horizontalThreshold = Math.min(240, Math.max(96, viewport.width * 0.18));
  const verticalThreshold = Math.min(220, Math.max(88, viewport.height * 0.18));
  const candidates = [];

  if (position.x <= bounds.minX + horizontalThreshold) {
    candidates.push({ direction: "right", distance: Math.abs(position.x - bounds.minX) / horizontalThreshold });
  }
  if (position.x >= bounds.maxX - horizontalThreshold) {
    candidates.push({ direction: "left", distance: Math.abs(position.x - bounds.maxX) / horizontalThreshold });
  }
  if (position.y <= bounds.minY + verticalThreshold) {
    candidates.push({ direction: "down", distance: Math.abs(position.y - bounds.minY) / verticalThreshold });
  }
  if (position.y >= bounds.maxY - verticalThreshold) {
    candidates.push({ direction: "up", distance: Math.abs(position.y - bounds.maxY) / verticalThreshold });
  }

  candidates.sort((left, right) => left.distance - right.distance);
  return candidates[0]?.direction ?? null;
}

export function dragLoadDirection(deltaX, deltaY, threshold = 96) {
  if (Math.hypot(deltaX, deltaY) < threshold) return null;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX > 0 ? "left" : "right";
  }
  return deltaY > 0 ? "up" : "down";
}

export function trackpadZoomIndex(currentIndex, deltaY, levelCount) {
  if (!Number.isFinite(deltaY) || deltaY === 0 || levelCount < 1) return currentIndex;
  const direction = deltaY < 0 ? 1 : -1;
  return Math.max(0, Math.min(levelCount - 1, currentIndex + direction));
}
