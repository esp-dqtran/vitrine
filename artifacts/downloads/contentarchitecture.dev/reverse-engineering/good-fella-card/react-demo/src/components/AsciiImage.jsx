import { useEffect, useRef, useState } from "react";

const RAMP = ".:-=+*#%@";

function monoFont(size, weight = 400) {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() ||
    "ui-monospace, monospace";
  return `${weight} ${Math.floor(size)}px ${family}`;
}

function backgroundBrightness(element) {
  let current = element;

  while (current) {
    const match = /rgba?\(([^)]+)\)/.exec(getComputedStyle(current).backgroundColor);
    if (match?.[1]) {
      const [red, green, blue, alpha = 1] = match[1].split(",").map(Number.parseFloat);
      if ([red, green, blue].every(Number.isFinite) && alpha > 0) {
        return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      }
    }

    current = current.parentElement;
  }

  return 1;
}

export function AsciiImage({
  active = false,
  aspect = 16 / 9,
  cells,
  cols = 120,
  invert,
  label,
  levels = 64,
  rows = 37,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const previousKeyRef = useRef("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !cells) return undefined;

    let timer = 0;

    function draw() {
      const width = container.getBoundingClientRect().width;
      if (width <= 0) return;

      const key = `${width}:${levels}:${cols}:${rows}:${aspect}:${invert}:${cells}`;
      if (previousKeyRef.current === key) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round((width / aspect) * dpr));
      const cellWidth = pixelWidth / cols;
      const cellHeight = pixelHeight / rows;
      const dark = invert ?? backgroundBrightness(canvas) < 0.5;

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.fillStyle = getComputedStyle(canvas).color || (dark ? "#fff" : "#000");
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = monoFont(cellHeight);

      const measuredM = context.measureText("M").width || 0.6 * cellHeight;
      context.font = monoFont((cellWidth / measuredM) * cellHeight);

      const highestLevel = levels - 1;
      const characters = Array(levels);
      const opacities = new Float32Array(levels);

      for (let level = 0; level <= highestLevel; level += 1) {
        const normalized = level / highestLevel;
        const value = dark ? normalized : 1 - normalized;
        characters[level] =
          RAMP[Math.min(RAMP.length - 1, Math.round(value * (RAMP.length - 1)))] ??
          RAMP[0];
        opacities[level] = 0.12 + 0.88 * value ** 0.85;
      }

      for (let row = 0; row < rows; row += 1) {
        const y = (row + 0.5) * cellHeight;
        for (let column = 0; column < cols; column += 1) {
          const level = Math.min(
            highestLevel,
            Math.max(0, cells.charCodeAt(row * cols + column) - 33),
          );
          const character = characters[level];
          if (!character) continue;

          context.globalAlpha = opacities[level] ?? 1;
          context.fillText(character, (column + 0.5) * cellWidth, y);
        }
      }

      context.globalAlpha = 1;
      previousKeyRef.current = key;
      setReady(true);
    }

    function scheduleDraw() {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 100);
    }

    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(container);
    document.fonts.ready.then(scheduleDraw);
    scheduleDraw();

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [aspect, cells, cols, invert, levels, rows]);

  return (
    <div
      ref={containerRef}
      className={`ascii-image ${ready ? "is-ready" : ""}`}
      style={{ aspectRatio: aspect }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={`ascii-image__canvas ${active ? "is-hidden" : ""}`}
      />
    </div>
  );
}
