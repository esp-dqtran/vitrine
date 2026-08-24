import { useEffect } from "react";

const colors = ["#1c2541", "#3b5bd9", "#f5c518", "#e0492a"];
const neon = "#d8ff00";
const pixelSize = 8;

function smoothStep(value) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized * normalized * (3 - 2 * normalized);
}

function hash(value) {
  const result = Math.sin(value * 12.9898) * 43758.5453;
  return result - Math.floor(result);
}

const colorCache = new Map();

function hexToRgb(color) {
  if (colorCache.has(color)) return colorCache.get(color);
  const value = color.startsWith("#")
    ? [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ]
    : color.match(/\d+/g).map(Number);
  colorCache.set(color, value);
  return value;
}

function mixColor(from, to, amount) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  return `rgb(${Math.floor(start[0] + (end[0] - start[0]) * amount)},${Math.floor(start[1] + (end[1] - start[1]) * amount)},${Math.floor(start[2] + (end[2] - start[2]) * amount)})`;
}

function progressX(progress, isSkill) {
  const start = isSkill ? 0.28 : 0;
  return start + progress * (1 - start);
}

function flowPosition(progress, seed, width, height, time) {
  const centerY = height / 2;
  const isSkill = hash(seed * 5.5) < 0.5;
  const normalizedX = progressX(progress, isSkill);
  let x = normalizedX * width;
  const merge = 1 - smoothStep(Math.min(1, (normalizedX - 0.02) / 0.55));
  const radius = height * 0.3 * (0.28 + 0.72 * merge) + height * 0.05;
  const chaos = Math.max(0, 1 - normalizedX / 0.5) ** 1.2;
  const angle = normalizedX * 0.85 * Math.PI * 2
    + (isSkill ? Math.PI : 0)
    + (hash(seed * 3.1) - 0.5) * 3 * chaos
    + Math.sin(time * 0.0016 + seed * 30) * chaos * 1.1;
  const jitterRadius = radius * (1 + (hash(seed * 7.7) - 0.5) * 1.8 * chaos);
  const envelope = 1 - 0.22 * smoothStep((normalizedX - 0.5) / 0.16);
  const outputZone = smoothStep((normalizedX - 0.5) / 0.14)
    * (1 - smoothStep((normalizedX - 0.8) / 0.08));
  const depth = Math.cos(angle) * jitterRadius;
  let y = centerY
    + (Math.sin(angle) * jitterRadius + (isSkill ? 1 : -1) * height * 0.16 * merge) * envelope
    - height * 0.09 * smoothStep((normalizedX - 0.4) / 0.3);

  x += depth * 0.3 * envelope;
  const jitterTime = time * 0.0022;
  x += Math.sin(jitterTime + seed * 40 + normalizedX * 7) * width * 0.007
    + Math.sin(jitterTime * 0.5 + seed * 13) * width * 0.005;
  y += (Math.cos(jitterTime * 1.1 + seed * 27 + normalizedX * 5) * height * 0.055
    + Math.sin(jitterTime * 0.7 + seed * 51) * height * 0.04) * envelope;
  y += (Math.sin(time * 0.0025 + seed * 44) + (hash(seed * 61) - 0.5) * 1.8)
    * height * 0.11 * outputZone;

  if (normalizedX > 0.74) {
    const tail = (normalizedX - 0.74) / 0.26;
    const passes = hash(seed * 9.1) < 0.96;
    y += (passes ? -1 : 1) * smoothStep(tail) * height * 0.42;
  }

  return [x, y, 0.5 + 0.5 * (depth / (jitterRadius + 0.001))];
}

function pointColor(progress, seed) {
  const isSkill = hash(seed * 5.5) < 0.5;
  const x = progressX(progress, isSkill);
  if (x < 0.58) return isSkill ? colors[1] : colors[0];
  if (x < 0.74) return colors[2];
  const tail = (x - 0.74) / 0.26;
  return mixColor(colors[2], hash(seed * 9.1) < 0.96 ? neon : colors[3], smoothStep(Math.min(1, tail * 1.4)));
}

function stageOf(progress, seed) {
  const isSkill = hash(seed * 5.5) < 0.5;
  const x = progressX(progress, isSkill);
  if (x > 0.74) return 3;
  if (x >= 0.58) return 2;
  return isSkill ? 1 : 0;
}

export function useProtocolFlow(canvasRef, activeStageRef, pointerRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles = Array.from({ length: 4400 }, (_, index) => ({
      offset: hash(index * 3.3 + 7),
      seed: hash(index * 1.7 + 3),
      speed: 0.55 + hash(index * 5.1 + 2) * 0.9,
    }));
    const emphasis = [1, 1, 1, 1];
    let width = 0;
    let height = 0;
    let time = Math.random() * 4000;
    let visible = true;
    let pointerStrength = 0;
    let animationFrame = 0;
    let lastFrame = 0;

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2) return;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const repel = (point) => {
      if (pointerStrength < 0.01) return point;
      const radius = Math.min(width, height) * 0.35;
      const deltaX = point[0] - pointerRef.current.x;
      const deltaY = point[1] - pointerRef.current.y;
      const distance = Math.hypot(deltaX, deltaY) + 0.001;
      if (distance >= radius) return point;
      const force = (1 - distance / radius) ** 2 * pointerStrength;
      const magnitude = Math.min(width, height) * 0.3;
      return [
        point[0] + (deltaX / distance) * force * magnitude,
        point[1] + (deltaY / distance) * force * magnitude,
        point[2],
      ];
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      pointerStrength += ((pointerRef.current.inside ? 1 : 0) - pointerStrength) * 0.09;
      const activeStage = activeStageRef.current;
      emphasis.forEach((value, index) => {
        const target = activeStage < 0 || activeStage === index ? 1 : 0.16;
        emphasis[index] = value + (target - value) * 0.07;
      });

      const points = particles.map((particle) => {
        const progress = (particle.offset + time * 0.00006 * particle.speed) % 1;
        const point = repel(flowPosition(progress, particle.seed, width, height, time));
        return [
          point[0],
          point[1],
          point[2],
          pointColor(progress, particle.seed),
          emphasis[stageOf(progress, particle.seed)],
        ];
      }).sort((a, b) => a[2] - b[2]);

      context.globalAlpha = 0.13;
      context.strokeStyle = "#cfcfcf";
      context.lineWidth = 1;
      const linkDistance = (pixelSize * 6) ** 2;
      for (let index = 0; index < points.length; index += 2) {
        for (let peer = index + 1; peer < Math.min(points.length, index + 6); peer += 1) {
          const deltaX = points[index][0] - points[peer][0];
          const deltaY = points[index][1] - points[peer][1];
          if (deltaX ** 2 + deltaY ** 2 >= linkDistance) continue;
          context.beginPath();
          context.moveTo(points[index][0], points[index][1]);
          context.lineTo(points[peer][0], points[peer][1]);
          context.stroke();
        }
      }

      points.forEach(([x, y, depth, color, alpha]) => {
        void depth;
        context.globalAlpha = alpha;
        context.fillStyle = color;
        context.fillRect(
          Math.round(x / pixelSize) * pixelSize,
          Math.round(y / pixelSize) * pixelSize,
          pixelSize - 1,
          pixelSize - 1,
        );
      });
      context.globalAlpha = 1;
    };

    const loop = (timestamp) => {
      const delta = Math.min(40, timestamp - lastFrame);
      lastFrame = timestamp;
      if (!width) size();
      if (visible && width) {
        time += delta;
        draw();
      }
      animationFrame = window.requestAnimationFrame(loop);
    };

    const resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);
    size();
    draw();
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [activeStageRef, canvasRef, pointerRef]);
}
