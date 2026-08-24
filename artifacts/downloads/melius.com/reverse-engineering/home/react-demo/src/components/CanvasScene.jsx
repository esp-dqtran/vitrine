import { useEffect, useMemo, useRef, useState } from "react";

import { CanvasNode } from "./CanvasNode";

const SCENE_HEIGHT = 559;
const COMPACT_VIEWPORT_WIDTH = 560;
const DEFAULT_VIEWPORT_WIDTH = 780;
const NODE_PORT_OFFSET = 35;

function getAspectRatio(media) {
  const source = media.type === "video" ? media.video : media.image;
  return source.width / source.height;
}

function getNodeWidth(item, viewportHeight = SCENE_HEIGHT, compact = false) {
  const remainingHeight = Math.max(1, Math.min(447.2, item.maxHeight ?? 447.2, viewportHeight - item.y) - 62);
  const maxWidth = compact ? Math.min(232, item.maxWidth ?? 348) : item.maxWidth ?? 348;
  return Math.min(maxWidth, 448, remainingHeight * getAspectRatio(item.media));
}

function getTrackX(item, cardWidth, sceneWidth, viewportWidth) {
  const desiredX = item.x + cardWidth / 2 - viewportWidth / 2;
  return -Math.min(Math.max(0, desiredX), Math.max(0, sceneWidth - viewportWidth));
}

function connectorPath(source, target, sourceWidth) {
  const fromX = source ? source.x + sourceWidth : Math.max(0, target.x - 96);
  const fromY = source ? source.y + NODE_PORT_OFFSET : target.y + NODE_PORT_OFFSET;
  const toX = target.x;
  const toY = target.y + NODE_PORT_OFFSET;
  const curve = (toX - fromX) * .85;
  return `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`;
}

function CanvasConnector({ data, visible }) {
  return <g>
    <path d={data.path} fill="none" pathLength="1" stroke="var(--canvas-orange)" strokeWidth="1" style={{ strokeDasharray: 1, strokeDashoffset: visible ? 0 : 1 }} />
    <circle cx={data.fromX} cy={data.fromY} fill="var(--canvas-offblack)" r="3.75" stroke="var(--canvas-orange)" strokeWidth="1" style={{ opacity: visible ? 1 : 0 }} />
    <circle cx={data.fromX} cy={data.fromY} fill="var(--canvas-orange)" r="1.875" style={{ opacity: visible ? 1 : 0 }} />
    <circle cx={data.toX} cy={data.toY} fill="var(--canvas-offblack)" r="3.75" stroke="var(--canvas-orange)" strokeWidth="1" style={{ opacity: visible ? 1 : 0 }} />
    <circle cx={data.toX} cy={data.toY} fill="var(--canvas-orange)" r="1.875" style={{ opacity: visible ? 1 : 0 }} />
  </g>;
}

export function CanvasScene({ active = true, assetBase, scene, sequence = 0 }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [visibleConnectionCount, setVisibleConnectionCount] = useState(0);
  const [trackDuration, setTrackDuration] = useState(.8);
  const [trackX, setTrackX] = useState(0);
  const [trackY, setTrackY] = useState(0);
  const dragRef = useRef(null);
  const items = scene.media;
  const sceneWidth = scene.width;
  const viewportWidth = !prefersReducedMotion && containerWidth > 0 && containerWidth < COMPACT_VIEWPORT_WIDTH ? COMPACT_VIEWPORT_WIDTH : DEFAULT_VIEWPORT_WIDTH;
  const scale = containerWidth > 0 ? containerWidth / viewportWidth : 1;
  const compact = viewportWidth === COMPACT_VIEWPORT_WIDTH;
  const cards = useMemo(() => items.map((item) => ({ ...item, width: getNodeWidth(item, SCENE_HEIGHT, compact) })), [compact, items]);
  const connectors = useMemo(() => {
    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const targetIds = new Set(scene.connections.map((connection) => connection.to));
    const initial = cards.filter((card) => !targetIds.has(card.id)).map((target) => ({ source: null, target }));
    const linked = scene.connections.map((connection) => ({ source: cardsById.get(connection.from), target: cardsById.get(connection.to) })).filter(({ source, target }) => source && target);
    return [...initial, ...linked].map(({ source, target }) => {
      const sourceWidth = source?.width ?? 0;
      const fromX = source ? source.x + sourceWidth : Math.max(0, target.x - 96);
      const fromY = source ? source.y + NODE_PORT_OFFSET : target.y + NODE_PORT_OFFSET;
      return { fromX, fromY, path: connectorPath(source, target, sourceWidth), targetId: target.id, toX: target.x, toY: target.y + NODE_PORT_OFFSET };
    });
  }, [cards, scene.connections]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const sync = () => setContainerWidth(element.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!items.length) return undefined;
    setTrackX(0); setTrackY(0);
    setTrackDuration(0);
    setVisibleConnectionCount(prefersReducedMotion ? scene.connections.length : 0);
    setRevealedCount(prefersReducedMotion && sequence > 0 ? items.length : 0);
    if (sequence === 0) return undefined;
    setRevealedCount(prefersReducedMotion ? items.length : 1);
    if (prefersReducedMotion) return undefined;

    let elapsed = 0;
    const timers = [];
    const schedule = (callback, duration) => {
      elapsed += duration;
      timers.push(window.setTimeout(callback, elapsed));
    };

    for (let index = 1; index < cards.length; index += 1) {
      const previous = cards[index - 1];
      const current = cards[index];
      const sameGroup = previous.id.split("-").slice(0, 2).join("-") === current.id.split("-").slice(0, 2).join("-");
      const timing = sameGroup ? { linger: .18, lineDelay: .3, lineDuration: .3, panDuration: .45 } : { linger: index === 1 ? .85 : .5, lineDelay: .6, lineDuration: .45, panDuration: .8 };
      schedule(() => { setTrackDuration(timing.panDuration); setTrackX(getTrackX(current, current.width, sceneWidth, viewportWidth)); }, timing.linger * 1000);
      schedule(() => setVisibleConnectionCount((count) => Math.max(count, index)), timing.lineDelay * 1000);
      schedule(() => setRevealedCount(index + 1), timing.lineDuration * 1000);
    }

    return () => timers.forEach(window.clearTimeout);
  }, [cards, items.length, prefersReducedMotion, scene.connections.length, sceneWidth, sequence, viewportWidth]);

  const playbackComplete = revealedCount >= cards.length;
  const dragStart = (event) => {
    if (!playbackComplete || prefersReducedMotion) return;
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, trackX, trackY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const dragMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const maxX = Math.max(0, sceneWidth - viewportWidth);
    setTrackX(Math.max(-maxX, Math.min(0, drag.trackX + (event.clientX - drag.clientX) / scale)));
    if (event.pointerType !== "touch") setTrackY(Math.max(-120, Math.min(120, drag.trackY + (event.clientY - drag.clientY) / scale)));
  };
  const dragEnd = (event) => { if (!dragRef.current) return; dragRef.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); };

  return <div className="canvas-scene" data-canvas-scene data-draggable={playbackComplete && !prefersReducedMotion} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} ref={containerRef} style={{ height: `${SCENE_HEIGHT * scale}px` }}>
    <div className="canvas-scene__viewport" style={{ height: `${SCENE_HEIGHT}px`, transform: `scale(${scale})`, width: `${viewportWidth}px` }}>
      <div className="canvas-scene__grid" />
      <div className="canvas-scene__track" style={{ transform: `translate3d(${trackX}px, ${trackY}px, 0)`, transitionDuration: `${trackDuration}s`, width: `${sceneWidth}px` }}>
        {cards.map((item, index) => <div className="canvas-scene__node" key={item.id} style={{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px` }}><CanvasNode active={active} alt={item.media.type === "video" ? item.media.video.label : item.media.image.alt} aspectRatio={getAspectRatio(item.media)} mediaType={item.media.type} model={item.model} revealed={index < revealedCount} src={`${assetBase}${item.media.type === "video" ? item.media.video.src : item.media.image.src}`} title={item.title} type={item.tag} /></div>)}
        <svg aria-hidden="true" className="canvas-scene__connectors" fill="none" preserveAspectRatio="none" viewBox={`0 0 ${sceneWidth} ${SCENE_HEIGHT}`}>
          {connectors.map((connector, index) => <CanvasConnector data={connector} key={`${connector.targetId}-${index}`} visible={index === 0 ? revealedCount > 0 : visibleConnectionCount >= index} />)}
        </svg>
      </div>
    </div>
  </div>;
}
