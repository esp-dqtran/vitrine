import { useCallback, useEffect, useRef, useState } from "react";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function useCarousel(viewportRef, trackRef) {
  const [offset, setOffsetState] = useState(0);
  const [bounds, setBounds] = useState({ maximum: 0, step: 1 });
  const offsetRef = useRef(0);
  const animationRef = useRef(0);
  const dragRef = useRef({ active: false, pointerId: null, x: 0, time: 0, velocity: 0, moved: false });

  const setOffset = useCallback((value) => {
    offsetRef.current = value;
    setOffsetState(value);
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const slides = track.children;
    const step = slides.length > 1
      ? Math.abs(slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left)
      : viewport.clientWidth;
    const maximum = Math.min(0, viewport.clientWidth - track.scrollWidth);
    setBounds({ maximum, step: Math.max(1, step) });
    setOffset(clamp(offsetRef.current, maximum, 0));
  }, [setOffset, trackRef, viewportRef]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (trackRef.current) observer.observe(trackRef.current);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationRef.current);
    };
  }, [measure, trackRef, viewportRef]);

  const animateTo = useCallback((target) => {
    window.cancelAnimationFrame(animationRef.current);
    const destination = clamp(target, bounds.maximum, 0);
    const tick = () => {
      const next = offsetRef.current + (destination - offsetRef.current) * 0.2;
      if (Math.abs(destination - next) < 0.4) {
        setOffset(destination);
        animationRef.current = 0;
        return;
      }
      setOffset(next);
      animationRef.current = window.requestAnimationFrame(tick);
    };
    animationRef.current = window.requestAnimationFrame(tick);
  }, [bounds.maximum, setOffset]);

  const snap = useCallback((value) => {
    const target = Math.round(value / bounds.step) * bounds.step;
    animateTo(target);
  }, [animateTo, bounds.step]);

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    window.cancelAnimationFrame(animationRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      time: performance.now(),
      velocity: 0,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const delta = event.clientX - drag.x;
    const elapsed = Math.max(1, now - drag.time);
    drag.velocity = delta / elapsed;
    drag.x = event.clientX;
    drag.time = now;
    if (Math.abs(delta) > 1) drag.moved = true;
    let next = offsetRef.current + delta;
    if (next > 0) next *= 0.28;
    if (next < bounds.maximum) next = bounds.maximum + (next - bounds.maximum) * 0.28;
    setOffset(next);
  }, [bounds.maximum, setOffset]);

  const endPointer = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const momentum = clamp(drag.velocity * 120, -bounds.step * 0.35, bounds.step * 0.35);
    snap(offsetRef.current + momentum);
  }, [bounds.step, snap]);

  const onClickCapture = useCallback((event) => {
    if (!dragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current.moved = false;
  }, []);

  const previous = useCallback(() => {
    animateTo(Math.round(offsetRef.current / bounds.step) * bounds.step + bounds.step);
  }, [animateTo, bounds.step]);

  const next = useCallback(() => {
    animateTo(Math.round(offsetRef.current / bounds.step) * bounds.step - bounds.step);
  }, [animateTo, bounds.step]);

  return {
    offset,
    dragging: dragRef.current.active,
    canPrevious: offset < -0.5,
    canNext: offset > bounds.maximum + 0.5,
    previous,
    next,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
    },
  };
}
