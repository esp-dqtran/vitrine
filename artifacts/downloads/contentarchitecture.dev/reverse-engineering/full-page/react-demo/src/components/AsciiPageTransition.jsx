import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const GLYPHS = "01<>[]{}()/\\|=+*#%&$@!?;:.~01ABCDEF0123456789";
const DURATION = 720;
const REDUCED_DURATION = 180;

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function createNoiseOffsets(cols, rows) {
  const lattice = new Float32Array(35);
  for (let index = 0; index < lattice.length; index += 1) lattice[index] = Math.random();

  const smooth = (value) => value * value * (3 - 2 * value);
  const mix = (from, to, amount) => from + (to - from) * amount;
  const raw = new Float32Array(cols * rows);
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col / cols) * 6;
      const y = (row / rows) * 4;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const sx = smooth(x - x0);
      const sy = smooth(y - y0);
      const latticeIndex = 7 * y0 + x0;
      const top = mix(lattice[latticeIndex] ?? 0, lattice[latticeIndex + 1] ?? 0, sx);
      const bottom = mix(lattice[latticeIndex + 7] ?? 0, lattice[latticeIndex + 8] ?? 0, sx);
      const value = mix(top, bottom, sy) + (Math.random() - 0.5) * 0.08;
      const index = row * cols + col;
      raw[index] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }

  const range = maximum - minimum || 1;
  const normalized = new Float32Array(cols * rows);
  for (let index = 0; index < raw.length; index += 1) {
    normalized[index] = (((raw[index] ?? 0) - minimum) / range) * 0.88;
  }
  return normalized;
}

function createAtlas(color, cellWidth, cellHeight, fontSize, dpr) {
  const atlasCellWidth = Math.ceil(cellWidth * dpr);
  const atlasCellHeight = Math.ceil(cellHeight * dpr);
  const atlas = document.createElement("canvas");
  atlas.width = atlasCellWidth * GLYPHS.length;
  atlas.height = atlasCellHeight * 12;
  const context = atlas.getContext("2d");
  if (!context) return null;

  context.font = `${Math.round(fontSize * dpr)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  for (let opacityStep = 0; opacityStep < 12; opacityStep += 1) {
    context.globalAlpha = (opacityStep + 1) / 12;
    const y = opacityStep * atlasCellHeight + atlasCellHeight / 2;
    for (let glyphIndex = 0; glyphIndex < GLYPHS.length; glyphIndex += 1) {
      context.fillText(GLYPHS[glyphIndex] ?? "0", glyphIndex * atlasCellWidth + atlasCellWidth / 2, y);
    }
  }
  context.globalAlpha = 1;
  return { canvas: atlas, cellWidth: atlasCellWidth, cellHeight: atlasCellHeight };
}

function createScene(canvas, context) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cols = Math.max(1, Math.round(width / 12));
  const rows = Math.max(1, Math.round(height / 17));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const computed = getComputedStyle(canvas);
  const background = computed.getPropertyValue("--ascii-transition-bg").trim() || "#000000";
  const color = computed.getPropertyValue("--ascii-transition-color").trim() || "#ffffff";
  const count = cols * rows;
  const seeds = new Uint16Array(count);
  const flicker = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    seeds[index] = Math.floor(65536 * Math.random());
    flicker[index] = 70 + 120 * Math.random();
  }

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    width,
    height,
    background,
    coverOffsets: createNoiseOffsets(cols, rows),
    revealOffsets: createNoiseOffsets(cols, rows),
    seeds,
    flicker,
    atlas: createAtlas(color, cellWidth, cellHeight, Math.round(0.86 * cellHeight), dpr),
  };
}

export function AsciiPageTransition({ phase, onCoverComplete, onRevealComplete }) {
  const canvasRef = useRef(null);
  const phaseRef = useRef(phase);
  const callbacksRef = useRef({ onCoverComplete, onRevealComplete });
  const timingRef = useRef({ cover: 0, reveal: 0, coverFired: false, revealFired: false });
  const animationRef = useRef(0);
  const rendererRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    callbacksRef.current = { onCoverComplete, onRevealComplete };
  }, [onCoverComplete, onRevealComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let scene = createScene(canvas, context);
    let resizePending = false;
    const onResize = () => { resizePending = true; };

    const drawReduced = (activePhase, progress) => {
      context.clearRect(0, 0, scene.width, scene.height);
      context.globalAlpha = activePhase === "cover" ? progress : 1 - progress;
      context.fillStyle = scene.background;
      context.fillRect(0, 0, scene.width, scene.height);
      context.globalAlpha = 1;
    };

    const drawAscii = (activePhase, progress, now) => {
      const offsets = activePhase === "cover" ? scene.coverOffsets : scene.revealOffsets;
      context.clearRect(0, 0, scene.width, scene.height);
      context.globalAlpha = 1;
      context.fillStyle = scene.background;

      if (activePhase === "cover" && progress >= 1) {
        context.fillRect(0, 0, scene.width, scene.height);
      } else {
        context.beginPath();
        for (let row = 0; row < scene.rows; row += 1) {
          for (let col = 0; col < scene.cols; col += 1) {
            const index = row * scene.cols + col;
            const cellProgress = clamp01((progress - (offsets[index] ?? 0)) * (25 / 3));
            const opacity = activePhase === "cover" ? cellProgress : 1 - cellProgress;
            if (opacity >= 0.35) {
              context.rect(
                Math.floor(col * scene.cellWidth),
                Math.floor(row * scene.cellHeight),
                Math.ceil(scene.cellWidth) + 1,
                Math.ceil(scene.cellHeight) + 1,
              );
            }
          }
        }
        context.fill();
      }

      if (!scene.atlas) return;
      const glyphCount = GLYPHS.length;
      for (let row = 0; row < scene.rows; row += 1) {
        for (let col = 0; col < scene.cols; col += 1) {
          const index = row * scene.cols + col;
          const cellProgress = clamp01((progress - (offsets[index] ?? 0)) * (25 / 3));
          const opacity = activePhase === "cover" ? cellProgress : 1 - cellProgress;
          if (opacity <= 0.02) continue;

          const seed = scene.seeds[index] ?? 0;
          const step = Math.floor((now + seed) / (scene.flicker[index] || 100));
          const flash = (seed + step) % 19 === 0;
          const wave = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(0.004 * now + seed));
          let opacityStep = Math.floor(clamp01(cellProgress > 0 && cellProgress < 1 || flash ? 1 : wave) * clamp01(1.3 * opacity) * 12);
          if (opacityStep <= 0) continue;
          if (opacityStep >= 12) opacityStep = 11;
          const glyphIndex = (seed + step) % glyphCount;

          context.drawImage(
            scene.atlas.canvas,
            glyphIndex * scene.atlas.cellWidth,
            opacityStep * scene.atlas.cellHeight,
            scene.atlas.cellWidth,
            scene.atlas.cellHeight,
            col * scene.cellWidth,
            row * scene.cellHeight,
            scene.cellWidth,
            scene.cellHeight,
          );
        }
      }
    };

    const render = (now) => {
      if (resizePending) {
        scene = createScene(canvas, context);
        resizePending = false;
      }

      const activePhase = phaseRef.current;
      const timing = timingRef.current;
      const duration = reducedMotion ? REDUCED_DURATION : DURATION;
      if (activePhase === "cover") {
        const progress = clamp01((now - timing.cover) / duration);
        if (reducedMotion) drawReduced(activePhase, progress);
        else drawAscii(activePhase, progress, now);
        if (progress >= 1 && !timing.coverFired) {
          timing.coverFired = true;
          callbacksRef.current.onCoverComplete();
        }
      } else if (activePhase === "reveal") {
        const progress = clamp01((now - timing.reveal) / duration);
        if (reducedMotion) drawReduced(activePhase, progress);
        else drawAscii(activePhase, progress, now);
        if (progress >= 1 && !timing.revealFired) {
          timing.revealFired = true;
          callbacksRef.current.onRevealComplete();
        }
      }

      if (phaseRef.current === "idle") {
        context.clearRect(0, 0, scene.width, scene.height);
        animationRef.current = 0;
        return;
      }
      animationRef.current = requestAnimationFrame(render);
    };

    rendererRef.current = {
      start() {
        if (!animationRef.current) animationRef.current = requestAnimationFrame(render);
      },
      stop() {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      },
      clear() {
        context.clearRect(0, 0, scene.width, scene.height);
      },
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => {
    phaseRef.current = phase;
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (phase === "idle") {
      renderer.stop();
      renderer.clear();
      return;
    }
    const timing = timingRef.current;
    if (phase === "cover") {
      timing.cover = performance.now();
      timing.coverFired = false;
    } else {
      timing.reveal = performance.now();
      timing.revealFired = false;
    }
    renderer.start();
  }, [phase]);

  return <canvas ref={canvasRef} data-ascii-curtain={phase} aria-hidden="true" />;
}
