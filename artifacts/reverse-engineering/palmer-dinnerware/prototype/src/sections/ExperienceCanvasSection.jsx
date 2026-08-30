import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Move } from "../primitives/Icons";
import {
  PALMER_SOURCE_COLUMN_COUNT,
  PALMER_SOURCE_ROW_COUNT,
  PALMER_SOURCE_SLOTS,
} from "../data/palmerSourceSlots";
import { ExperienceProduct } from "../composites/ExperienceProduct";
import { canvasLoadDirection, dragLoadDirection, trackpadZoomIndex } from "../interaction/canvasEdges";
import {
  allocateAppsToTiles,
  createSpatialTile,
  tileExtent,
} from "../interaction/spatialTileAllocator";
import {
  equalIdSets,
  visibleTileIds,
  viewportTileIds,
} from "../interaction/viewportTiles";
import { SOURCE_ZOOM_LEVELS, ZoomControl } from "../composites/ZoomControl";
import {
  Draggable,
  duration,
  gsap,
  palmerMotion,
  prefersReducedMotion,
  usesPortraitTouchMotion,
} from "../motion/palmerMotion";
import { ControlDockSection } from "./ControlDockSection";

const AUTO_LOAD_DIRECTIONS = ["right", "down", "left", "up"];
const ZOOM_IMAGE_PRELOAD_LIMIT = 32;

function scheduleCatalogIdleWork(callback) {
  if (typeof window.requestIdleCallback === "function") {
    const request = window.requestIdleCallback(callback, { timeout: 1_200 });
    return () => window.cancelIdleCallback(request);
  }
  const timer = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timer);
}

function scheduleTileOverscanWork(callback) {
  if (typeof window.requestIdleCallback === "function") {
    const request = window.requestIdleCallback(callback, { timeout: 300 });
    return () => window.cancelIdleCallback(request);
  }
  const timer = window.setTimeout(callback, 100);
  return () => window.clearTimeout(timer);
}

function seededTiles(items) {
  return allocateAppsToTiles(
    [createSpatialTile()],
    items,
    PALMER_SOURCE_SLOTS,
    "center",
  ).tiles;
}

function tileColumns(items) {
  const columns = Array.from(
    { length: PALMER_SOURCE_COLUMN_COUNT },
    () => Array(PALMER_SOURCE_ROW_COUNT).fill(null),
  );
  items.forEach((item) => {
    const column = Math.max(0, Math.min(PALMER_SOURCE_COLUMN_COUNT - 1, item.runtimeColumn ?? 0));
    const row = Math.max(0, Math.min(PALMER_SOURCE_ROW_COUNT - 1, item.runtimeRow ?? 0));
    columns[column][row] = item;
  });
  return columns;
}

export function ExperienceCanvasSection({
  items,
  loading,
  error,
  hasMore,
  canAutoLoadMore,
  allowBackgroundPagination = true,
  loadNextPage,
  filterItems,
  menu,
  filters,
  onOpenCollection,
}) {
  const initialZoomIndex = 2;
  const itemSignature = items.map(({ id }) => id).join("|");
  const initialTiles = useMemo(() => seededTiles(items), [itemSignature]);
  const [stream, setStream] = useState(() => ({ signature: itemSignature, tiles: initialTiles }));
  const [zoomIndex, setZoomIndex] = useState(initialZoomIndex);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoveredItem, setHoveredItem] = useState(null);
  const [loadingDirection, setLoadingDirection] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [focusTileId, setFocusTileId] = useState("0:0");
  const [mountedTileIds, setMountedTileIds] = useState(() => new Set(["0:0"]));
  const [priorityItemKeys, setPriorityItemKeys] = useState(() => new Set());
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const zoomRef = useRef(initialZoomIndex);
  const dragRef = useRef(null);
  const dragState = useRef({ dragged: false, prefetched: false, startX: 0, startY: 0 });
  const suppressClick = useRef(false);
  const position = useRef({ x: 0, y: 0 });
  const pendingLoad = useRef(null);
  const loadLock = useRef(false);
  const autoLoadIndex = useRef(0);
  const lastProximityUpdate = useRef(0);
  const proximityProducts = useRef(new Set());
  const pinchGesture = useRef({ active: false, lastEventAt: 0 });
  const wheelFrame = useRef(0);
  const pendingWheelPosition = useRef(null);
  const mountFrame = useRef(0);
  const zoomStartFrame = useRef(0);
  const pendingMountView = useRef(null);
  const mountedTileIdsRef = useRef(mountedTileIds);
  const mountGeneration = useRef(0);
  const cancelOverscanWork = useRef(null);
  const tiles = stream.signature === itemSignature ? stream.tiles : initialTiles;
  const extent = useMemo(() => tileExtent(tiles), [tiles]);
  const renderedTiles = useMemo(() => tiles.map((tile) => {
    const filteredItems = filterItems(tile.assignments.map(({ item }) => item));
    const mounted = mountedTileIds.has(tile.id);
    return {
      tile,
      mounted,
      columns: mounted ? tileColumns(filteredItems) : null,
      visibleAssignmentCount: filteredItems.length,
    };
  }), [filterItems, mountedTileIds, tiles]);
  const visibleAssignmentCount = useMemo(() => renderedTiles.reduce((count, entry) => (
    count + entry.visibleAssignmentCount
  ), 0), [renderedTiles]);

  useLayoutEffect(() => {
    if (stream.signature === itemSignature) return;
    pendingLoad.current = null;
    loadLock.current = false;
    setLoadingDirection(null);
    setLoadError(null);
    setFocusTileId("0:0");
    const initialMountedTiles = new Set(["0:0"]);
    mountedTileIdsRef.current = initialMountedTiles;
    setMountedTileIds(initialMountedTiles);
    setPriorityItemKeys(new Set());
    autoLoadIndex.current = 0;
    setStream({ signature: itemSignature, tiles: initialTiles });
  }, [initialTiles, itemSignature, stream.signature]);

  const bounds = useCallback((scale = SOURCE_ZOOM_LEVELS[zoomRef.current]) => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const stageBox = stage.getBoundingClientRect();
    const width = canvas.scrollWidth * scale;
    const height = canvas.scrollHeight * scale;
    const gutter = window.innerWidth * 0.1;
    return {
      minX: Math.min(-gutter, stageBox.width - width - 50),
      maxX: window.innerWidth <= 700 ? 0 : -gutter,
      minY: Math.min(-gutter, stageBox.height - height - gutter),
      maxY: window.innerWidth <= 700 ? 0 : -gutter,
    };
  }, []);

  const clampPosition = useCallback((x, y, scale) => {
    const nextBounds = bounds(scale);
    return {
      x: Math.max(nextBounds.minX, Math.min(nextBounds.maxX, x)),
      y: Math.max(nextBounds.minY, Math.min(nextBounds.maxY, y)),
    };
  }, [bounds]);

  const moveCanvas = useCallback((next) => {
    if (!canvasRef.current) return;
    position.current = next;
    gsap.set(canvasRef.current, { x: next.x, y: next.y });
  }, []);

  const syncMountedTiles = useCallback((
    nextPosition = position.current,
    scale = SOURCE_ZOOM_LEVELS[zoomRef.current],
    {
      deferOverscan = false,
      preserveView = null,
      visibleOnly = false,
    } = {},
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const pages = [...canvas.querySelectorAll(".experience-page")];
    const projectRects = (viewPosition, viewScale) => pages.map((page) => {
      const left = viewPosition.x + page.offsetLeft * viewScale;
      const top = viewPosition.y + page.offsetTop * viewScale;
      return {
        id: page.dataset.streamTile,
        left,
        top,
        right: left + page.offsetWidth * viewScale,
        bottom: top + page.offsetHeight * viewScale,
      };
    });
    const rects = projectRects(nextPosition, scale);
    const visibleIds = visibleTileIds(rects, viewport);
    const nextIds = visibleOnly
      ? new Set(visibleIds)
      : viewportTileIds(rects, viewport);
    if (!visibleIds.size && rects.length) {
      const center = { x: viewport.width / 2, y: viewport.height / 2 };
      const nearest = rects.reduce((best, rect) => {
        const distance = Math.hypot(
          (rect.left + rect.right) / 2 - center.x,
          (rect.top + rect.bottom) / 2 - center.y,
        );
        return distance < best.distance ? { id: rect.id, distance } : best;
      }, { id: rects[0].id, distance: Infinity });
      visibleIds.add(nearest.id);
      nextIds.add(nearest.id);
    }
    const generation = ++mountGeneration.current;
    cancelOverscanWork.current?.();
    cancelOverscanWork.current = null;
    const immediateIds = deferOverscan ? new Set(visibleIds) : nextIds;
    let deferredIds = nextIds;
    if (deferOverscan) {
      const nearestOverscan = rects.filter(({ id }) => (
        nextIds.has(id) && !immediateIds.has(id)
      )).map((rect) => {
        const distanceX = rect.left > viewport.width
          ? rect.left - viewport.width
          : rect.right < 0 ? -rect.right : 0;
        const distanceY = rect.top > viewport.height
          ? rect.top - viewport.height
          : rect.bottom < 0 ? -rect.bottom : 0;
        return { id: rect.id, distance: Math.hypot(distanceX, distanceY) };
      }).sort((left, right) => left.distance - right.distance)[0];
      deferredIds = new Set(immediateIds);
      if (nearestOverscan) deferredIds.add(nearestOverscan.id);
    }
    if (preserveView) {
      visibleTileIds(projectRects(preserveView.position, preserveView.scale), viewport)
        .forEach((id) => immediateIds.add(id));
    }
    const changed = !equalIdSets(mountedTileIdsRef.current, immediateIds);
    if (changed) {
      mountedTileIdsRef.current = immediateIds;
      setMountedTileIds(immediateIds);
    }
    if (deferOverscan && !equalIdSets(immediateIds, deferredIds)) {
      cancelOverscanWork.current = scheduleTileOverscanWork(() => {
        if (generation !== mountGeneration.current) return;
        cancelOverscanWork.current = null;
        if (equalIdSets(mountedTileIdsRef.current, deferredIds)) return;
        mountedTileIdsRef.current = deferredIds;
        setMountedTileIds(deferredIds);
      });
    }
    return changed;
  }, [viewport]);

  const scheduleMountedTileSync = useCallback((
    nextPosition = position.current,
    scale = SOURCE_ZOOM_LEVELS[zoomRef.current],
  ) => {
    pendingMountView.current = { position: { ...nextPosition }, scale };
    if (mountFrame.current) return;
    mountFrame.current = window.requestAnimationFrame(() => {
      mountFrame.current = 0;
      const pending = pendingMountView.current;
      if (pending) {
        syncMountedTiles(pending.position, pending.scale, {
          deferOverscan: true,
        });
      }
    });
  }, [syncMountedTiles]);

  const prioritizeZoomTargetImages = useCallback((
    previousPosition,
    nextPosition,
    previousScale,
    nextScale,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || previousScale <= 0) return;
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const candidates = [...canvas.querySelectorAll(".experience-product")].map((product) => {
      const rect = product.getBoundingClientRect();
      const layoutLeft = (rect.left - previousPosition.x) / previousScale;
      const layoutTop = (rect.top - previousPosition.y) / previousScale;
      const width = rect.width / previousScale * nextScale;
      const height = rect.height / previousScale * nextScale;
      const left = nextPosition.x + layoutLeft * nextScale;
      const top = nextPosition.y + layoutTop * nextScale;
      return {
        key: product.dataset.instanceKey,
        visible: left + width > 0 && left < viewport.width && top + height > 0 && top < viewport.height,
        distance: Math.hypot(left + width / 2 - center.x, top + height / 2 - center.y),
      };
    }).filter(({ key, visible }) => key && visible)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, ZOOM_IMAGE_PRELOAD_LIMIT);
    const nextKeys = new Set(candidates.map(({ key }) => key));
    setPriorityItemKeys((current) => equalIdSets(current, nextKeys) ? current : nextKeys);
  }, [viewport]);

  const updateFocusTile = useCallback(() => {
    const pages = [...(canvasRef.current?.querySelectorAll(".experience-page") ?? [])];
    if (!pages.length) return;
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const nearest = pages.reduce((best, page) => {
      const rect = page.getBoundingClientRect();
      const distance = Math.hypot(rect.x + rect.width / 2 - center.x, rect.y + rect.height / 2 - center.y);
      return distance < best.distance
        ? { id: page.dataset.streamTile, distance }
        : best;
    }, { id: pages[0].dataset.streamTile, distance: Infinity });
    setFocusTileId(nearest.id);
  }, [viewport.height, viewport.width]);

  const finishLoad = useCallback(() => {
    pendingLoad.current = null;
    loadLock.current = false;
    setLoadingDirection(null);
    requestAnimationFrame(updateFocusTile);
  }, [updateFocusTile]);

  const loadMore = useCallback((direction, { animate = true } = {}) => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length || !hasMore || pendingLoad.current || loadLock.current) return false;

    loadLock.current = true;
    pendingLoad.current = {
      direction,
      previousWidth: canvas.scrollWidth,
      previousHeight: canvas.scrollHeight,
      assignedKeys: [],
      targetTileId: null,
      animate,
    };
    setLoadError(null);
    setLoadingDirection(direction);
    void loadNextPage()
      .then((nextItems) => {
        if (!nextItems.length) {
          finishLoad();
          return;
        }
        setStream((current) => {
          const currentTiles = current.signature === itemSignature ? current.tiles : initialTiles;
          const allocation = allocateAppsToTiles(
            currentTiles,
            nextItems,
            PALMER_SOURCE_SLOTS,
            direction,
            focusTileId,
          );
          if (pendingLoad.current) {
            pendingLoad.current.assignedKeys = allocation.assignedKeys;
            pendingLoad.current.targetTileId = allocation.targetTileId;
          }
          return { signature: itemSignature, tiles: allocation.tiles };
        });
      })
      .catch((reason) => {
        setLoadError(reason.message);
        finishLoad();
      });
    return true;
  }, [finishLoad, focusTileId, hasMore, initialTiles, itemSignature, items.length, loadNextPage]);

  const loadMoreAtEdge = useCallback((next) => {
    const direction = canvasLoadDirection(next, bounds(), viewport);
    if (direction) loadMore(direction);
  }, [bounds, loadMore, viewport]);

  useEffect(() => {
    if (!allowBackgroundPagination || !items.length || loading || !canAutoLoadMore
      || loadingDirection || loadError || loadLock.current) {
      return undefined;
    }
    return scheduleCatalogIdleWork(() => {
      const direction = AUTO_LOAD_DIRECTIONS[
        autoLoadIndex.current % AUTO_LOAD_DIRECTIONS.length
      ];
      if (loadMore(direction, { animate: false })) autoLoadIndex.current += 1;
    });
  }, [allowBackgroundPagination, canAutoLoadMore, items.length, loadError, loadMore, loading, loadingDirection]);

  const dragCallbacks = useRef({});
  dragCallbacks.current = {
    bounds,
    loadMore,
    loadMoreAtEdge,
    scheduleMountedTileSync,
    updateFocusTile,
    viewport,
  };

  useLayoutEffect(() => {
    let resizeFrame = 0;
    const onResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => () => {
    window.cancelAnimationFrame(wheelFrame.current);
    window.cancelAnimationFrame(mountFrame.current);
    window.cancelAnimationFrame(zoomStartFrame.current);
    cancelOverscanWork.current?.();
    gsap.killTweensOf([...proximityProducts.current]);
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !items.length) return;
    const scale = SOURCE_ZOOM_LEVELS[zoomRef.current];
    const centered = {
      x: (stage.clientWidth - canvas.scrollWidth * scale) / 2 + 1,
      y: (stage.clientHeight - canvas.scrollHeight * scale) / 2 - 49,
    };
    position.current = centered;
    gsap.set(canvas, { x: centered.x, y: centered.y, scale });
    syncMountedTiles(centered, scale);
  }, [itemSignature, items.length, syncMountedTiles, viewport]);

  useLayoutEffect(() => {
    if (!items.length) return;
    syncMountedTiles(position.current, SOURCE_ZOOM_LEVELS[zoomRef.current], {
      deferOverscan: true,
    });
  }, [items.length, syncMountedTiles, tiles]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return undefined;

    const syncPosition = (instance, allowLoad) => {
      const next = { x: instance.x, y: instance.y };
      position.current = next;
      dragCallbacks.current.scheduleMountedTileSync(next);
      if (!allowLoad) return;

      const active = dragState.current;
      const deltaX = instance.x - active.startX;
      const deltaY = instance.y - active.startY;
      if (Math.hypot(deltaX, deltaY) <= 10) return;
      active.dragged = true;

      const callbacks = dragCallbacks.current;
      const dragDirection = dragLoadDirection(
        deltaX,
        deltaY,
        Math.min(160, Math.max(96, Math.min(callbacks.viewport.width, callbacks.viewport.height) * 0.12)),
      );
      const direction = dragDirection
        ?? canvasLoadDirection(next, callbacks.bounds(), callbacks.viewport);
      if (direction && callbacks.loadMore(direction)) active.prefetched = true;
    };

    const finishMotion = (instance) => {
      const next = { x: instance.x, y: instance.y };
      position.current = next;
      dragCallbacks.current.scheduleMountedTileSync(next);
      dragCallbacks.current.updateFocusTile();
      if (!dragState.current.prefetched) dragCallbacks.current.loadMoreAtEdge(next);
    };

    const throwResistance = usesPortraitTouchMotion()
      ? palmerMotion.drag.portraitTouchThrowResistance
      : palmerMotion.drag.desktopThrowResistance;
    const draggable = Draggable.create(canvas, {
      type: "x,y",
      allowEventDefault: true,
      minimumMovement: 10,
      inertia: !prefersReducedMotion(),
      throwResistance,
      bounds: bounds(),
      edgeResistance: palmerMotion.drag.edgeResistance,
      onPress() {
        suppressClick.current = false;
        dragState.current = {
          dragged: false,
          prefetched: false,
          startX: this.x,
          startY: this.y,
        };
      },
      onDrag() {
        syncPosition(this, true);
      },
      onThrowUpdate() {
        syncPosition(this, false);
      },
      onDragEnd() {
        suppressClick.current = dragState.current.dragged;
        if (dragState.current.dragged) {
          requestAnimationFrame(() => {
            suppressClick.current = false;
          });
        }
        if (!this.isThrowing) finishMotion(this);
      },
      onThrowComplete() {
        finishMotion(this);
      },
    })[0];

    dragRef.current = draggable;
    const easingTimer = window.setTimeout(() => canvas.classList.add("drag-easing"), 100);
    return () => {
      window.clearTimeout(easingTimer);
      canvas.classList.remove("drag-easing");
      draggable.kill();
      if (dragRef.current === draggable) dragRef.current = null;
    };
  }, [Boolean(items.length), viewport.height, viewport.width]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const pending = pendingLoad.current;
    if (!canvas || !pending?.assignedKeys.length) return undefined;

    const scale = SOURCE_ZOOM_LEVELS[zoomRef.current];
    const addedWidth = Math.max(0, canvas.scrollWidth - pending.previousWidth);
    const addedHeight = Math.max(0, canvas.scrollHeight - pending.previousHeight);
    const anchored = clampPosition(
      pending.direction === "left" ? position.current.x - addedWidth * scale : position.current.x,
      pending.direction === "up" ? position.current.y - addedHeight * scale : position.current.y,
      scale,
    );
    position.current = anchored;
    gsap.set(canvas, { x: anchored.x, y: anchored.y });
    dragRef.current?.applyBounds(bounds(scale));
    dragRef.current?.update();

    if (pending.animate === false) {
      finishLoad();
      return undefined;
    }
    const assigned = new Set(pending.assignedKeys);
    const products = [...canvas.querySelectorAll(".experience-product")].filter((product) => (
      assigned.has(product.dataset.instanceKey)
    ));
    if (!products.length) {
      if (syncMountedTiles(position.current, scale)) return undefined;
      finishLoad();
      return undefined;
    }
    const tween = gsap.fromTo(products, { scale: 0.35, autoAlpha: 0 }, {
      scale: 1,
      autoAlpha: 1,
      duration: duration(0.75),
      ease: "back.out(1.35)",
      stagger: { amount: 0.38, from: pending.direction === "left" || pending.direction === "up" ? "end" : "start" },
      clearProps: "transform,opacity,visibility",
      onComplete: finishLoad,
    });
    return () => tween.kill();
  }, [clampPosition, finishLoad, mountedTileIds, syncMountedTiles, tiles]);

  const changeZoom = useCallback((nextIndex) => {
    if (nextIndex === zoomRef.current || !canvasRef.current) return;
    const previousScale = SOURCE_ZOOM_LEVELS[zoomRef.current];
    const nextScale = SOURCE_ZOOM_LEVELS[nextIndex];
    const previousPosition = { ...position.current };
    const viewportCenter = { x: viewport.width / 2, y: viewport.height / 2 };
    const scaleRatio = nextScale / previousScale;
    const focalPosition = {
      x: viewportCenter.x - (viewportCenter.x - position.current.x) * scaleRatio,
      y: viewportCenter.y - (viewportCenter.y - position.current.y) * scaleRatio,
    };
    const nextPosition = clampPosition(focalPosition.x, focalPosition.y, nextScale);
    position.current = nextPosition;
    zoomRef.current = nextIndex;
    setZoomIndex(nextIndex);
    prioritizeZoomTargetImages(previousPosition, nextPosition, previousScale, nextScale);
    const mountedChanged = syncMountedTiles(nextPosition, nextScale, {
      preserveView: { position: previousPosition, scale: previousScale },
      visibleOnly: true,
    });
    const startZoom = () => {
      zoomStartFrame.current = 0;
      gsap.to(canvasRef.current, {
        x: nextPosition.x,
        y: nextPosition.y,
        scale: nextScale,
        duration: duration(palmerMotion.zoom.duration),
        ease: palmerMotion.zoom.ease,
        overwrite: true,
        onComplete: () => {
          syncMountedTiles(nextPosition, nextScale, {
            deferOverscan: true,
          });
          dragRef.current?.applyBounds(bounds(nextScale));
          dragRef.current?.update();
          updateFocusTile();
        },
      });
    };
    window.cancelAnimationFrame(zoomStartFrame.current);
    if (mountedChanged && nextScale < previousScale) {
      zoomStartFrame.current = window.requestAnimationFrame(startZoom);
    } else {
      startZoom();
    }
  }, [bounds, clampPosition, prioritizeZoomTargetImages, syncMountedTiles, updateFocusTile, viewport.height, viewport.width]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onTrackpadPinch = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;

      const now = performance.now();
      const gesture = pinchGesture.current;
      if (now - gesture.lastEventAt > 180) gesture.active = false;
      gesture.lastEventAt = now;
      if (gesture.active) return;
      gesture.active = true;
      changeZoom(trackpadZoomIndex(
        zoomRef.current,
        event.deltaY,
        SOURCE_ZOOM_LEVELS.length,
      ));
    };
    stage.addEventListener("wheel", onTrackpadPinch, { passive: false });
    return () => stage.removeEventListener("wheel", onTrackpadPinch);
  }, [changeZoom]);

  const columnCount = extent.maxX - extent.minX + 1;
  const rowCount = extent.maxY - extent.minY + 1;
  const handleHoverStart = useCallback((nextItem, event) => {
    setHoveredItem(nextItem);
    if (cursorRef.current) {
      gsap.set(cursorRef.current, { x: event.clientX, y: event.clientY + 25 });
    }
  }, []);
  const handleHoverEnd = useCallback(() => setHoveredItem(null), []);

  return (
    <section
      ref={stageRef}
      className="experience-stage"
      aria-label="App experience canvas"
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerMove={(event) => {
        if (hoveredItem && cursorRef.current) {
          gsap.set(cursorRef.current, { x: event.clientX, y: event.clientY + 25 });
        }
        if (usesPortraitTouchMotion() || performance.now() - lastProximityUpdate.current < 100) return;
        lastProximityUpdate.current = performance.now();
        const products = [...(canvasRef.current?.querySelectorAll(".experience-product") ?? [])];
        const nearby = new Map();
        products.forEach((product) => {
          const rect = product.getBoundingClientRect();
          const distance = Math.hypot(
            event.clientX - (rect.left + rect.width / 2),
            event.clientY - (rect.top + rect.height / 2),
          );
          if (distance >= palmerMotion.drag.proximityThreshold) return;
          nearby.set(
            product,
            1 + (1 - distance / palmerMotion.drag.proximityThreshold) * palmerMotion.drag.proximityScale,
          );
        });
        nearby.forEach((scale, product) => {
          gsap.to(product, {
            scale,
            duration: duration(palmerMotion.drag.proximityDuration),
            ease: "power3",
            overwrite: "auto",
          });
        });
        proximityProducts.current.forEach((product) => {
          if (nearby.has(product)) return;
          gsap.to(product, {
            scale: 1,
            duration: duration(1),
            ease: "power3",
            overwrite: "auto",
          });
        });
        proximityProducts.current = new Set(nearby.keys());
      }}
      onPointerLeave={() => {
        if (usesPortraitTouchMotion()) return;
        const products = [...proximityProducts.current];
        proximityProducts.current.clear();
        gsap.to(products, {
          scale: 1,
          duration: duration(1),
          ease: "power3",
          overwrite: "auto",
        });
      }}
      onWheel={(event) => {
        if (event.ctrlKey) return;
        if (event.target.closest("button,a,input")) return;
        const bounded = clampPosition(
          position.current.x - event.deltaX,
          position.current.y - event.deltaY,
        );
        const easeQuadOut = (value) => 1 - (1 - value) * (1 - value);
        const wheelEase = easeQuadOut(0.8);
        const next = {
          x: position.current.x + (bounded.x - position.current.x) * wheelEase,
          y: position.current.y + (bounded.y - position.current.y) * wheelEase,
        };
        moveCanvas(next);
        pendingWheelPosition.current = next;
        if (!wheelFrame.current) {
          wheelFrame.current = window.requestAnimationFrame(() => {
            wheelFrame.current = 0;
            const latest = pendingWheelPosition.current;
            if (!latest) return;
            dragRef.current?.update();
            scheduleMountedTileSync(latest);
            updateFocusTile();
            loadMoreAtEdge(latest);
          });
        }
      }}
    >
      {items.length ? (
        <div className="experience-origin">
          <div
            ref={canvasRef}
            className="experience-canvas"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, max-content)`,
              gridTemplateRows: `repeat(${rowCount}, max-content)`,
            }}
          >
            {renderedTiles.map(({ tile, mounted, columns }) => {
              return (
                <div
                  className={`experience-page ${mounted ? "" : "is-virtual"}`.trim()}
                  data-assignment-count={tile.assignments.length}
                  data-stream-tile={tile.id}
                  key={tile.id}
                  style={{
                    gridColumn: tile.x - extent.minX + 1,
                    gridRow: tile.y - extent.minY + 1,
                  }}
                >
                  {mounted && columns.map((columnItems, columnIndex) => (
                    <div className="experience-column" key={`${tile.id}-${columnIndex}`}>
                      {columnItems.map((item, rowIndex) => (
                        <div className="experience-slot" key={`${tile.id}-${columnIndex}-${rowIndex}`}>
                          {item && (
                            <ExperienceProduct
                              item={item}
                              eager={priorityItemKeys.has(item.instanceKey)
                                || (tile.id === "0:0" && columnIndex < 5 && rowIndex < 3)}
                              onOpen={onOpenCollection}
                              onHoverStart={handleHoverStart}
                              onHoverEnd={handleHoverEnd}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-results">
          {loading ? "Loading Apps…" : error ?? "No apps match these filters."}
        </div>
      )}
      {items.length > 0 && visibleAssignmentCount === 0 && (
        <div className="no-results">No apps match these filters.</div>
      )}
      <div
        ref={cursorRef}
        className={`experience-cursor ${hoveredItem ? "is-visible" : ""}`}
        aria-hidden="true"
      >
        {hoveredItem?.name}
      </div>
      <div
        className="drag-hint"
        data-load-more-state={loadError ? "error" : loadingDirection ?? (hasMore ? "idle" : "complete")}
        title={loadError ?? undefined}
      >
        <Move size={13} />Drag to explore
      </div>
      <ZoomControl index={zoomIndex} onChange={changeZoom} />
      <ControlDockSection menu={menu} filters={filters} />
    </section>
  );
}
