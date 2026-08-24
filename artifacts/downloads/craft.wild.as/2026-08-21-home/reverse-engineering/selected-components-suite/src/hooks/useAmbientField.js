import { useEffect } from "react";

const bands = [
  [0.3, "#1c2541"],
  [0.46, "#3b5bd9"],
  [0.62, "#f5c518"],
  [0.78, "#e0492a"],
];

function inside(rect, x, y) {
  return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function useAmbientField(canvasRef, textCanvasRef, contactRef, footerRef, scopeRef, options = {}) {
  const scopedTextCenterY = options.textCenterY;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const touch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cell = 9;
    const brush = 10;
    const textCanvas = textCanvasRef.current;
    const textContext = textCanvas?.getContext("2d");
    if (!textCanvas || !textContext) return undefined;
    const text = "the answer is yes we do it     ";
    const textHeight = 20;
    const seed = Math.random() * 1000;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let heat = new Float32Array();
    let pointerX = -1;
    let pointerY = -1;
    let previousX = -1;
    let previousY = -1;
    let lastMove = performance.now() / 1000;
    let cursorZone = "";
    let time = 0;
    let textWidth = 0;
    let textData = null;
    let textScroll = 0;
    let pacmanActive = false;
    let pacmanX = 0;
    let pacmanY = 0;
    let pacmanDirection = 1;
    let pacmanStart = 0;
    let pacmanAge = 0;
    let animationFrame = 0;
    let previousFrame = 0;
    let shake = 0;
    let charging = false;
    let chargeStartedAt = 0;
    let chargeX = 0;
    let chargeY = 0;
    const waves = [];

    const getBounds = () => {
      const scoped = scopeRef?.current?.getBoundingClientRect();
      if (scoped?.width && scoped?.height) return scoped;
      return {
        bottom: window.innerHeight,
        height: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        top: 0,
        width: window.innerWidth,
      };
    };

    const toLocalPoint = (clientX, clientY) => {
      const bounds = getBounds();
      return { x: clientX - bounds.left, y: clientY - bounds.top };
    };

    const randomAt = (column, row) => {
      const value = Math.sin(column * 127.1 + row * 311.7 + seed * 0.13) * 43758.5453;
      return value - Math.floor(value);
    };

    const size = () => {
      const bounds = getBounds();
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / cell) + 1;
      rows = Math.ceil(height / cell) + 1;
      heat = new Float32Array(columns * rows);
    };

    const deposit = (x, y, amount, sigma) => {
      const centerColumn = x / cell;
      const centerRow = y / cell;
      const radius = Math.ceil(sigma * 1.6);
      const inverse = 1 / (2 * sigma * sigma * 0.18);

      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          const column = Math.trunc(centerColumn + columnOffset);
          const row = Math.trunc(centerRow + rowOffset);
          if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
          const deltaX = column + 0.5 - centerColumn;
          const deltaY = row + 0.5 - centerRow;
          const weight = Math.exp(-(deltaX ** 2 + deltaY ** 2) * inverse);
          if (weight < 0.02) continue;
          const index = row * columns + column;
          heat[index] = Math.min(1, heat[index] + amount * weight);
        }
      }
    };

    const follow = (x, y, sigma) => {
      if (previousX < 0) {
        previousX = x;
        previousY = y;
      }
      const deltaX = x - previousX;
      const deltaY = y - previousY;
      const length = Math.hypot(deltaX, deltaY);
      const steps = Math.max(1, Math.min(48, Math.round(length / (cell * 0.8))));
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        deposit(previousX + deltaX * progress, previousY + deltaY * progress, 0.16, sigma);
      }
      previousX = x;
      previousY = y;
    };

    const stampPacman = (centerX, centerY, radius, angle, mouth, value) => {
      const startColumn = Math.floor((centerX - radius) / cell);
      const endColumn = Math.ceil((centerX + radius) / cell);
      const startRow = Math.floor((centerY - radius) / cell);
      const endRow = Math.ceil((centerY + radius) / cell);

      for (let row = startRow; row <= endRow; row += 1) {
        for (let column = startColumn; column <= endColumn; column += 1) {
          if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
          const deltaX = (column + 0.5) * cell - centerX;
          const deltaY = (row + 0.5) * cell - centerY;
          if (deltaX ** 2 + deltaY ** 2 > radius ** 2) continue;
          const angleDelta = Math.abs(((Math.atan2(deltaY, deltaX) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (angleDelta < mouth) continue;
          const index = row * columns + column;
          heat[index] = Math.max(heat[index], value + 0.03 * Math.sin(column * 0.7 + row * 0.7 - time * 0.01));
        }
      }
    };

    const wander = (restX, restY) => {
      if (!pacmanActive) {
        pacmanActive = true;
        pacmanDirection = restX < width * 0.5 ? 1 : -1;
        pacmanX = restX;
        pacmanY = restY;
        pacmanStart = restX;
        pacmanAge = 0;
      }

      const radius = brush * 3.4;
      pacmanAge += 1;
      pacmanX += pacmanDirection * 2.6;
      if (pacmanX > width + radius + 12 || pacmanX < -radius - 12) {
        pacmanDirection = Math.random() < 0.5 ? 1 : -1;
        pacmanY = 70 + Math.random() * Math.max(1, height - 140);
        pacmanX = pacmanDirection > 0 ? -radius : width + radius;
        pacmanStart = pacmanX;
        pacmanAge = 0;
      }

      const pelletRow = Math.round(pacmanY / cell);
      for (let index = 1; index <= 80; index += 1) {
        const x = pacmanStart + pacmanDirection * brush * 3.4 * index;
        if (x < -20 || x > width + 20 || pacmanDirection * (x - pacmanX) <= radius * 0.7) continue;
        const column = Math.round(x / cell);
        if (column < 0 || pelletRow < 0 || column >= columns || pelletRow >= rows) continue;
        const heatIndex = pelletRow * columns + column;
        heat[heatIndex] = Math.max(heat[heatIndex], 0.72);
      }

      const mouth = 0.05 + 0.6 * Math.abs(Math.sin(pacmanAge * 0.16));
      stampPacman(pacmanX, pacmanY, radius, pacmanDirection > 0 ? 0 : Math.PI, mouth, 0.72);
    };

    const buildText = () => {
      textContext.font = '18px "Sneak", monospace';
      textWidth = Math.max(8, Math.ceil(textContext.measureText(text).width));
      textCanvas.width = textWidth;
      textCanvas.height = textHeight;
      textContext.font = '18px "Sneak", monospace';
      textContext.textBaseline = "middle";
      textContext.fillStyle = "#000";
      textContext.fillText(text, 0, textHeight / 2);
      textData = textContext.getImageData(0, 0, textWidth, textHeight).data;
    };

    const stampText = (centerY) => {
      if (!textData) buildText();
      const baseRow = Math.round(centerY / cell) - Math.floor(textHeight / 2);
      const scrollOffset = Math.floor(textScroll);
      const amplitude = touch ? 0.05 : 0.14;
      for (let localColumn = 0; localColumn < columns; localColumn += 1) {
        const maskColumn = ((scrollOffset + localColumn) % textWidth + textWidth) % textWidth;
        for (let localRow = 0; localRow < textHeight; localRow += 1) {
          if (textData[(localRow * textWidth + maskColumn) * 4 + 3] <= 80) continue;
          const row = baseRow + localRow;
          if (row < 0 || row >= rows) continue;
          const index = row * columns + localColumn;
          heat[index] = Math.max(heat[index], 0.84 + amplitude * Math.sin(localColumn * 0.6 + localRow * 0.6 - time * 0.006));
        }
      }
    };

    const updateZone = (x, y) => {
      const contactRect = contactRef.current?.getBoundingClientRect();
      const footerRect = footerRef.current?.getBoundingClientRect();
      cursorZone = inside(contactRect, x, y) || inside(footerRect, x, y) ? "text" : "";
    };

    const handlePointerMove = (event) => {
      if (touch) return;
      const bounds = getBounds();
      if (!inside(bounds, event.clientX, event.clientY)) return;
      const point = toLocalPoint(event.clientX, event.clientY);
      pointerX = point.x;
      pointerY = point.y;
      lastMove = performance.now() / 1000;
      pacmanActive = false;
      updateZone(event.clientX, event.clientY);
    };

    const handleScroll = () => {
      if (touch || pointerX < 0) return;
      lastMove = performance.now() / 1000;
      pacmanActive = false;
      const bounds = getBounds();
      updateZone(pointerX + bounds.left, pointerY + bounds.top);
    };

    const isInteractiveTarget = (target) => target instanceof Element
      && Boolean(target.closest("a, button, input, textarea, select, .pxctl"));

    const handlePointerDown = (event) => {
      if (touch || event.button !== 0 || isInteractiveTarget(event.target)) return;
      const bounds = getBounds();
      if (!inside(bounds, event.clientX, event.clientY)) return;
      const point = toLocalPoint(event.clientX, event.clientY);
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
      deposit(chargeX, chargeY, 1, brush * (2.5 + charge * 18));
      if (!reducedMotion) {
        waves.push({ x: chargeX, y: chargeY, startedAt: now, power });
        shake = 0.45 + charge * 1.9;
      }
    };

    const handleDoubleClick = (event) => {
      if (touch || isInteractiveTarget(event.target)) return;
      const bounds = getBounds();
      if (!inside(bounds, event.clientX, event.clientY)) return;
      const point = toLocalPoint(event.clientX, event.clientY);
      const now = performance.now() / 1000;
      deposit(point.x, point.y, 1, brush * 22);
      if (!reducedMotion) {
        waves.push({ x: point.x, y: point.y, startedAt: now, power: 2.8 });
        shake = 2.4;
      }
    };

    const draw = (timestamp) => {
      const now = performance.now() / 1000;
      heat.forEach((value, index) => {
        heat[index] = value < 0.003 ? 0 : value * (touch ? 0.85 : 0.878);
      });

      if (charging) {
        const charge = Math.min((now - chargeStartedAt) / 2.2, 1);
        deposit(chargeX, chargeY, 0.45 + charge * 0.5, brush * (2 + charge * 8));
        if (!reducedMotion) shake = Math.max(shake, 0.12 + charge * 0.35);
      }

      for (let index = waves.length - 1; index >= 0; index -= 1) {
        const wave = waves[index];
        const age = now - wave.startedAt;
        if (age > 1.5) {
          waves.splice(index, 1);
          continue;
        }
        const radius = age * Math.hypot(width, height) * 1.7;
        const sigma = cell * 5.5 * wave.power;
        const amplitude = Math.max(0, 1 - age / 1.5) * 1.2 * wave.power;
        const inverse = 1 / (2 * sigma * sigma);
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const deltaX = (column + 0.5) * cell - wave.x;
            const deltaY = (row + 0.5) * cell - wave.y;
            const distance = Math.hypot(deltaX, deltaY);
            const value = amplitude * Math.exp(-((distance - radius) ** 2) * inverse);
            if (value <= 0.02) continue;
            const heatIndex = row * columns + column;
            heat[heatIndex] = Math.max(heat[heatIndex], value);
          }
        }
      }

      if (touch) {
        const scrollPosition = window.scrollY;
        const contactRect = contactRef.current?.getBoundingClientRect();
        const footerRect = footerRef.current?.getBoundingClientRect();
        const bounds = getBounds();
        const centerY = bounds.top + height * 0.5;
        const inTextZone = (contactRect && contactRect.top < centerY && contactRect.bottom > centerY)
          || (footerRect && footerRect.top < centerY && footerRect.bottom > centerY);
        cursorZone = inTextZone ? "text" : "";
        const targetX = width * 0.5 + Math.sin(scrollPosition * 0.0026 + 0.6) * width * 0.33;
        const targetY = height * 0.5 + Math.sin(scrollPosition * 0.0052) * height * 0.2;
        if (pointerX < 0) pointerX = targetX;
        if (pointerY < 0) pointerY = targetY;
        pointerX += (targetX - pointerX) * 0.11;
        pointerY += (targetY - pointerY) * 0.11;
        lastMove = now;
      }

      if (pointerX > 0 && cursorZone === "text") {
        const idleFor = now - lastMove;
        if (!touch && idleFor > 1.5) wander(pointerX, pointerY);
        else follow(pointerX, pointerY, brush * 0.5);
      } else {
        pacmanActive = false;
        previousX = -1;
        previousY = -1;
      }

      const firstMeta = contactRef.current?.querySelector(".meta");
      const metaRect = firstMeta?.getBoundingClientRect();
      const bounds = getBounds();
      const localMetaTop = metaRect ? metaRect.top - bounds.top : 0;
      if (metaRect && metaRect.bottom > bounds.top && metaRect.top < bounds.bottom + 260) {
        textScroll += 0.14;
        stampText(scopedTextCenterY ?? (localMetaTop - (touch ? 195 : 235)));
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
      const scrollOffset = touch ? 0 : window.scrollY % cell;
      context.strokeStyle = "#fafafa";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= width; x += cell) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, height);
      }
      for (let y = -scrollOffset; y <= height; y += cell) {
        context.moveTo(0, y + 0.5);
        context.lineTo(width, y + 0.5);
      }
      context.stroke();

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const value = heat[row * columns + column];
          if (value < 0.3 && !(value >= 0.86 && value < 1.02)) continue;
          let color = bands[0][1];
          if (value >= bands[1][0]) color = bands[1][1];
          if (value >= bands[2][0]) color = bands[2][1];
          if (value >= bands[3][0]) color = bands[3][1];
          if (value >= 0.86 && value < 1.02) color = "#d8ff00";
          context.fillStyle = color;
          context.fillRect(column * cell, row * cell - scrollOffset, cell - 1, cell - 1);
        }
      }
      context.restore();

      const delta = timestamp - previousFrame;
      previousFrame = timestamp;
      time += delta;
      animationFrame = window.requestAnimationFrame(draw);
    };

    size();
    window.addEventListener("resize", size);
    const pointerTarget = scopeRef?.current ?? window;
    const resizeObserver = scopeRef?.current && "ResizeObserver" in window
      ? new ResizeObserver(size)
      : null;
    resizeObserver?.observe(scopeRef.current);
    pointerTarget.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("scroll", handleScroll, { passive: true });
    pointerTarget.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", releaseCharge);
    window.addEventListener("pointercancel", releaseCharge);
    pointerTarget.addEventListener("dblclick", handleDoubleClick);
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => {
      if (!textData) buildText();
      size();
    });
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", size);
      pointerTarget.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      pointerTarget.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", releaseCharge);
      window.removeEventListener("pointercancel", releaseCharge);
      pointerTarget.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [canvasRef, contactRef, footerRef, scopeRef, scopedTextCenterY, textCanvasRef]);
}
