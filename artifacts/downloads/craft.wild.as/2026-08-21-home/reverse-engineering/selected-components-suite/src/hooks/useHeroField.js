import { useEffect } from "react";

const CELL = 9;
const COLORS = ["#1c2541", "#3b5bd9", "#f5c518", "#e0492a", "#d8ff00"];

function hash(column, row, seed) {
  const value = Math.sin(column * 127.1 + row * 311.7 + seed * 0.13) * 43758.5453;
  return value - Math.floor(value);
}

function ambientValue(x, y, time, seed) {
  const warpedX = x + Math.sin(y * 6 + time * 0.2 + seed) * 0.04;
  const warpedY = y + Math.cos(x * 5 - time * 0.16 + seed) * 0.04;
  const waves = Math.sin(warpedX * 7 + seed + time * 0.22)
    + Math.cos(warpedY * 8 - seed * 0.4 - time * 0.17)
    + Math.sin((warpedX + warpedY) * 11 - seed * 0.7) * 0.48;
  return 0.5 + waves / 5;
}

function colorFor(x, value, accent) {
  if (accent >= 0.86 && accent < 1.02) return COLORS[4];
  if (accent >= 0.78) return COLORS[3];
  if (accent >= 0.62) return COLORS[2];
  if (accent >= 0.46) return COLORS[1];
  if (accent >= 0.3) return COLORS[0];
  if (x < 0.28) return value > 0.55 ? COLORS[1] : COLORS[0];
  if (x < 0.58) return value > 0.58 ? COLORS[2] : COLORS[1];
  if (x < 0.82) return value > 0.57 ? COLORS[3] : COLORS[2];
  return value > 0.56 ? COLORS[0] : COLORS[1];
}

export function useHeroField(canvasRef, headerRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const header = headerRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !header || !context) return undefined;

    const seed = 17.42;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let headerBottom = 0;
    let dpr = 1;
    let heat = new Float32Array();
    let frame = 0;
    let startedAt = performance.now();
    let pointerX = -1;
    let pointerY = -1;
    let previousX = -1;
    let previousY = -1;
    let shake = 0;
    let charging = false;
    let chargeStartedAt = 0;
    let chargeX = 0;
    let chargeY = 0;
    const waves = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      headerBottom = Math.max(0, headerRect.bottom - rect.top);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      heat = new Float32Array(columns * rows);
    };

    const deposit = (x, y, amount = 0.94, radius = 8) => {
      const centerColumn = x / CELL;
      const centerRow = y / CELL;
      const limit = Math.ceil(radius * 1.5);
      for (let rowOffset = -limit; rowOffset <= limit; rowOffset += 1) {
        for (let columnOffset = -limit; columnOffset <= limit; columnOffset += 1) {
          const column = Math.floor(centerColumn + columnOffset);
          const row = Math.floor(centerRow + rowOffset);
          if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
          const dx = column + 0.5 - centerColumn;
          const dy = row + 0.5 - centerRow;
          const weight = Math.exp(-(dx * dx + dy * dy) / Math.max(1, radius * radius * 0.34));
          if (weight < 0.03) continue;
          const index = row * columns + column;
          heat[index] = Math.max(heat[index], amount * weight);
        }
      }
    };

    const onPointerMove = (event) => {
      if (!finePointer) return;
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      if (previousX < 0) {
        previousX = pointerX;
        previousY = pointerY;
      }
      const distance = Math.hypot(pointerX - previousX, pointerY - previousY);
      const steps = Math.max(1, Math.ceil(distance / CELL));
      for (let index = 1; index <= steps; index += 1) {
        const progress = index / steps;
        deposit(
          previousX + (pointerX - previousX) * progress,
          previousY + (pointerY - previousY) * progress,
        );
      }
      previousX = pointerX;
      previousY = pointerY;
    };

    const onPointerLeave = () => {
      pointerX = -1;
      pointerY = -1;
      previousX = -1;
      previousY = -1;
    };

    const isInteractiveTarget = (target) => target instanceof Element
      && Boolean(target.closest("a, button, input, textarea, select, .pxctl"));

    const localPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return { x, y, inside: x >= 0 && x <= rect.width && y >= 0 && y <= rect.height };
    };

    const onPointerDown = (event) => {
      if (!finePointer || event.button !== 0 || isInteractiveTarget(event.target)) return;
      const point = localPoint(event);
      if (!point.inside) return;
      charging = true;
      chargeStartedAt = performance.now() / 1000;
      chargeX = point.x;
      chargeY = point.y;
    };

    const releaseCharge = () => {
      if (!charging) return;
      charging = false;
      const now = performance.now() / 1000;
      const charge = Math.min((now - chargeStartedAt) / 2.2, 1);
      const power = 0.35 + charge * 2.1;
      deposit(chargeX, chargeY, 1, 10 * (2.5 + charge * 18));
      if (!reducedMotion) {
        waves.push({ x: chargeX, y: chargeY, startedAt: now, power });
        shake = 0.45 + charge * 1.9;
      }
    };

    const onDoubleClick = (event) => {
      if (!finePointer || isInteractiveTarget(event.target)) return;
      const point = localPoint(event);
      if (!point.inside) return;
      const now = performance.now() / 1000;
      deposit(point.x, point.y, 1, 10 * 22);
      if (!reducedMotion) {
        waves.push({ x: point.x, y: point.y, startedAt: now, power: 2.8 });
        shake = 2.4;
      }
    };

    const draw = (timestamp) => {
      const elapsed = (timestamp - startedAt) / 1000;
      const reveal = reducedMotion ? 1 : Math.min(1, elapsed / 1.35);
      const time = reducedMotion ? 0 : elapsed;
      heat.forEach((value, index) => {
        heat[index] = value < 0.003 ? 0 : value * 0.92;
      });

      if (charging) {
        const now = performance.now() / 1000;
        const charge = Math.min((now - chargeStartedAt) / 2.2, 1);
        deposit(chargeX, chargeY, 0.45 + charge * 0.5, 10 * (2 + charge * 8));
        if (!reducedMotion) shake = Math.max(shake, 0.12 + charge * 0.35);
      }

      const now = performance.now() / 1000;
      for (let index = waves.length - 1; index >= 0; index -= 1) {
        const wave = waves[index];
        const age = now - wave.startedAt;
        if (age > 1.5) {
          waves.splice(index, 1);
          continue;
        }
        const radius = age * Math.hypot(width, height) * 1.7;
        const sigma = CELL * 5.5 * wave.power;
        const amplitude = Math.max(0, 1 - age / 1.5) * 1.2 * wave.power;
        const inverse = 1 / (2 * sigma * sigma);
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const deltaX = (column + 0.5) * CELL - wave.x;
            const deltaY = (row + 0.5) * CELL - wave.y;
            const distance = Math.hypot(deltaX, deltaY);
            const value = amplitude * Math.exp(-((distance - radius) ** 2) * inverse);
            if (value <= 0.02) continue;
            const heatIndex = row * columns + column;
            heat[heatIndex] = Math.max(heat[heatIndex], value);
          }
        }
      }

      context.save();
      if (shake > 0.01) {
        shake *= 0.9;
        context.translate((Math.random() - 0.5) * shake * 20, (Math.random() - 0.5) * shake * 20);
      } else {
        shake = 0;
      }
      context.clearRect(-40, -40, width + 80, height + 80);
      context.fillStyle = "#fff";
      context.fillRect(-40, -40, width + 80, height + 80);
      context.strokeStyle = "#fafafa";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= width; x += CELL) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += CELL) {
        context.moveTo(0, y + 0.5);
        context.lineTo(width, y + 0.5);
      }
      context.stroke();

      for (let row = 0; row < rows; row += 1) {
        const y = row * CELL;
        if (y < headerBottom - CELL) continue;
        const localY = (y - headerBottom) / Math.max(1, height - headerBottom);
        for (let column = 0; column < columns; column += 1) {
          const x = column * CELL;
          const nx = x / Math.max(1, width);
          const cutoff = 0.42
            + 0.16 * Math.sin(nx * Math.PI * 2.2 + seed)
            + 0.12 * Math.sin(nx * Math.PI * 5.1 - seed * 0.6);
          const ragged = (hash(column, row, seed) - 0.5) * 0.16;
          const base = ambientValue(nx, localY, time, seed);
          const density = base + (hash(column * 1.7, row * 1.3, seed) - 0.5) * 0.2;
          const fieldVisible = localY < cutoff + ragged && hash(column, row, seed + 9) < reveal;
          const index = row * columns + column;
          const accent = heat[index];
          if (!fieldVisible && accent < 0.3) continue;
          if (fieldVisible && density < 0.43 && accent < 0.3) continue;
          context.fillStyle = colorFor(nx, density, accent);
          context.fillRect(x, y, CELL - 1, CELL - 1);
        }
      }

      if (pointerX > 0 && pointerY > headerBottom) deposit(pointerX, pointerY, 0.82, 7);
      context.restore();
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(header);
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", releaseCharge);
    window.addEventListener("pointercancel", releaseCharge);
    window.addEventListener("dblclick", onDoubleClick);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", releaseCharge);
      window.removeEventListener("pointercancel", releaseCharge);
      window.removeEventListener("dblclick", onDoubleClick);
    };
  }, [canvasRef, headerRef]);
}
