import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const accents = ["#d8ff00", "#f5c518", "#e0492a", "#0a0a0a"];
const cellSize = 9;

export function PixelButton({ as: Element = "button", children, className = "", ...props }) {
  const elementRef = useRef(null);
  const timerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ columns: 0, rows: 0 });
  const [colors, setColors] = useState([]);

  const clear = useCallback(() => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    setColors((current) => current.map(() => "transparent"));
  }, []);

  const tick = useCallback(() => {
    const length = dimensions.columns * dimensions.rows;
    setColors(Array.from({ length }, () => (
      Math.random() < 0.14 ? accents[Math.floor(Math.random() * accents.length)] : "transparent"
    )));
  }, [dimensions]);

  const handlePointerEnter = useCallback((event) => {
    props.onPointerEnter?.(event);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || timerRef.current) return;
    tick();
    timerRef.current = window.setInterval(tick, 130);
  }, [props, tick]);

  const handlePointerLeave = useCallback((event) => {
    props.onPointerLeave?.(event);
    clear();
  }, [clear, props]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const measure = () => {
      setDimensions({
        columns: Math.ceil(element.offsetWidth / cellSize),
        rows: Math.ceil(element.offsetHeight / cellSize),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setColors(Array.from({ length: dimensions.columns * dimensions.rows }, () => "transparent"));
  }, [dimensions]);

  useEffect(() => clear, [clear]);

  const { onPointerEnter, onPointerLeave, ...elementProps } = props;

  return (
    <Element
      {...elementProps}
      className={className}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      ref={elementRef}
    >
      <span
        aria-hidden="true"
        className="pxfx"
        style={{
          gridTemplateColumns: `repeat(${dimensions.columns}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
        }}
      >
        {colors.map((color, index) => <i key={index} style={{ background: color }} />)}
      </span>
      <span className="lbl">{children}</span>
    </Element>
  );
}
