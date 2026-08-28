import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Move } from "../primitives/Icons";
import {
  PALMER_SOURCE_COLUMN_COUNT,
  PALMER_SOURCE_ROW_COUNT,
  PALMER_SOURCE_SLOTS,
} from "../data/palmerSourceSlots";
import { ExperienceProduct } from "../composites/ExperienceProduct";
import { canvasLoadDirection, dragLoadDirection } from "../interaction/canvasEdges";
import {
  allocateAppsToTiles,
  createSpatialTile,
  nearbyTileIds,
  tileExtent,
} from "../interaction/spatialTileAllocator";
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

function seededTiles(items) {
  return allocateAppsToTiles(
    [createSpatialTile()],
    items,
    PALMER_SOURCE_SLOTS,
    "center",
  ).tiles;
}

function tileColumns(tile, filterItems) {
  const columns = Array.from(
    { length: PALMER_SOURCE_COLUMN_COUNT },
    () => Array(PALMER_SOURCE_ROW_COUNT).fill(null),
  );
  filterItems(tile.assignments.map(({ item }) => item)).forEach((item) => {
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
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [loadingDirection, setLoadingDirection] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [focusTileId, setFocusTileId] = useState("0:0");
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const zoomRef = useRef(initialZoomIndex);
  const dragRef = useRef(null);
  const dragState = useRef({ dragged: false, prefetched: false, startX: 0, startY: 0 });
  const suppressClick = useRef(false);
  const position = useRef({ x: 0, y: 0 });
  const pendingLoad = useRef(null);
  const loadLock = useRef(false);
  const autoLoadIndex = useRef(0);
  const lastProximityUpdate = useRef(0);
  const tiles = stream.signature === itemSignature ? stream.tiles : initialTiles;
  const extent = useMemo(() => tileExtent(tiles), [tiles]);
  const mountedTileIds = useMemo(
    () => nearbyTileIds(tiles, focusTileId, 1),
    [focusTileId, tiles],
  );
  const visibleAssignmentCount = useMemo(() => tiles.reduce((count, tile) => (
    count + filterItems(tile.assignments.map(({ item }) => item)).length
  ), 0), [filterItems, tiles]);

  useLayoutEffect(() => {
    if (stream.signature === itemSignature) return;
    pendingLoad.current = null;
    loadLock.current = false;
    setLoadingDirection(null);
    setLoadError(null);
    setFocusTileId("0:0");
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
    if (!items.length || loading || !canAutoLoadMore || loadingDirection || loadError || loadLock.current) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const direction = AUTO_LOAD_DIRECTIONS[
        autoLoadIndex.current % AUTO_LOAD_DIRECTIONS.length
      ];
      if (loadMore(direction, { animate: false })) autoLoadIndex.current += 1;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canAutoLoadMore, items.length, loadError, loadMore, loading, loadingDirection]);

  const dragCallbacks = useRef({});
  dragCallbacks.current = {
    bounds,
    loadMore,
    loadMoreAtEdge,
    updateFocusTile,
    viewport,
  };

  useLayoutEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
  }, [itemSignature, items.length, viewport]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return undefined;

    const syncPosition = (instance, allowLoad) => {
      const next = { x: instance.x, y: instance.y };
      position.current = next;
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

    const assigned = new Set(pending.assignedKeys);
    const products = [...canvas.querySelectorAll(".experience-product")].filter((product) => (
      assigned.has(product.dataset.instanceKey)
    ));
    if (!products.length) {
      finishLoad();
      return undefined;
    }
    if (pending.animate === false) {
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
  }, [clampPosition, finishLoad, tiles]);

  const changeZoom = (nextIndex) => {
    if (nextIndex === zoomIndex || !canvasRef.current) return;
    const previousScale = SOURCE_ZOOM_LEVELS[zoomRef.current];
    const nextScale = SOURCE_ZOOM_LEVELS[nextIndex];
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
    gsap.to(canvasRef.current, {
      x: nextPosition.x,
      y: nextPosition.y,
      scale: nextScale,
      duration: duration(palmerMotion.zoom.duration),
      ease: palmerMotion.zoom.ease,
      overwrite: true,
      onComplete: () => {
        dragRef.current?.applyBounds(bounds(nextScale));
        dragRef.current?.update();
        updateFocusTile();
      },
    });
  };

  const columnCount = extent.maxX - extent.minX + 1;
  const rowCount = extent.maxY - extent.minY + 1;

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
        if (hoveredItem) setCursorPosition({ x: event.clientX, y: event.clientY });
        if (usesPortraitTouchMotion() || performance.now() - lastProximityUpdate.current < 100) return;
        lastProximityUpdate.current = performance.now();
        const products = canvasRef.current?.querySelectorAll(".experience-product") ?? [];
        products.forEach((product) => {
          const rect = product.getBoundingClientRect();
          const distance = Math.hypot(
            event.clientX - (rect.left + rect.width / 2),
            event.clientY - (rect.top + rect.height / 2),
          );
          const scale = distance < palmerMotion.drag.proximityThreshold
            ? 1 + (1 - distance / palmerMotion.drag.proximityThreshold) * palmerMotion.drag.proximityScale
            : 1;
          gsap.to(product, {
            scale,
            duration: duration(distance < palmerMotion.drag.proximityThreshold
              ? palmerMotion.drag.proximityDuration
              : 1),
            ease: "power3",
            overwrite: "auto",
          });
        });
      }}
      onPointerLeave={() => {
        if (usesPortraitTouchMotion()) return;
        gsap.to(canvasRef.current?.querySelectorAll(".experience-product") ?? [], {
          scale: 1,
          duration: duration(1),
          ease: "power3",
          overwrite: "auto",
        });
      }}
      onWheel={(event) => {
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
        dragRef.current?.update();
        updateFocusTile();
        loadMoreAtEdge(next);
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
            {tiles.map((tile) => {
              const mounted = mountedTileIds.has(tile.id);
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
                  {mounted && tileColumns(tile, filterItems).map((columnItems, columnIndex) => (
                    <div className="experience-column" key={`${tile.id}-${columnIndex}`}>
                      {columnItems.map((item, rowIndex) => (
                        <div className="experience-slot" key={`${tile.id}-${columnIndex}-${rowIndex}`}>
                          {item && (
                            <ExperienceProduct
                              item={item}
                              eager={tile.id === "0:0" && columnIndex < 5 && rowIndex < 3}
                              onOpen={onOpenCollection}
                              onHoverStart={(nextItem, event) => {
                                setHoveredItem(nextItem);
                                setCursorPosition({ x: event.clientX, y: event.clientY });
                              }}
                              onHoverEnd={() => setHoveredItem(null)}
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
        className={`experience-cursor ${hoveredItem ? "is-visible" : ""}`}
        style={{ transform: `translate3d(${cursorPosition.x}px, ${cursorPosition.y + 25}px, 0)` }}
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
