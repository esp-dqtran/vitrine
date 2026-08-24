import { useEffect, useRef, useState } from "react";

export const processFlowSteps = [
  { number: "01", title: "Explore", description: "We can go further than we used to, and faster: interactions and shader code, not just static layouts." },
  { number: "02", title: "Generate", description: "It rarely lands first try, so we curate and keep tuning the prompt and the inputs until it does." },
  { number: "03", title: "Refine", description: "We keep what's working, fix what isn't, and take it the rest of the way." },
  { number: "04", title: "Scale", description: "Once something works, it becomes a system we can reuse." },
];

const CELL = 9;
const COOL = "#3b5bd9";
const YELLOW = "#f5c518";

function random(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function smoothStep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function mix(a, b, amount) {
  if (amount <= 0) return a;
  if (amount >= 1) return b;
  const rgb = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `rgb(${(ar + (br - ar) * amount) | 0},${(ag + (bg - ag) * amount) | 0},${(ab + (bb - ab) * amount) | 0})`;
}

function profile(position) {
  return 0.06 + 0.94 * Math.abs(2 * position - 1) ** 1.2;
}

function depth(z, radius) {
  return Math.max(0, Math.min(1, 0.5 + 0.5 * (z / Math.max(1, radius))));
}

function useGrid(canvasRef, hostRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !host || !context) return;

    const draw = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, rect.width, rect.height);
      context.strokeStyle = "#fafafa";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= rect.width; x += CELL) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, rect.height);
      }
      for (let y = 0; y <= rect.height; y += CELL) {
        context.moveTo(0, y + 0.5);
        context.lineTo(rect.width, y + 0.5);
      }
      context.stroke();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [canvasRef, hostRef]);
}

function useHelix(canvasRef, activeStepRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let frameId = 0;
    let clock = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;
    let pointerStrength = 0;
    let pointerTarget = 0;
    const emphasis = [1, 1, 1, 1];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2) return;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
    };

    const pointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      pointerTarget = 1;
    };

    const pointerLeave = () => {
      pointerTarget = 0;
    };

    const alphaAt = (position) => {
      const active = activeStepRef.current;
      if (active === null && emphasis.every((value) => value > 0.995)) return 1;
      const group = position * 4 - 0.5;
      const quarter = Math.floor(group);
      const blend = smoothStep((group - quarter - 0.35) / 0.3);
      const start = emphasis[Math.max(0, Math.min(3, quarter))];
      const end = emphasis[Math.max(0, Math.min(3, quarter + 1))];
      return start + (end - start) * blend;
    };

    const draw = () => {
      if (!columns) return;
      context.clearRect(0, 0, width, height);
      pointerStrength += (pointerTarget - pointerStrength) * 0.09;
      const active = activeStepRef.current;
      for (let index = 0; index < 4; index += 1) {
        const target = active === null || active === index ? 1 : 0.16;
        emphasis[index] += (target - emphasis[index]) * 0.07;
      }

      const centerY = height / 2;
      const radius = height * 0.42;
      const repelRadius = height * 0.55;
      const repelAmount = height * 0.42;
      const items = [];

      const addPoint = (point) => {
        let x = point.x;
        let y = point.y;
        if (pointerStrength > 0.01) {
          const dx = x - pointerX;
          const dy = y - pointerY;
          const distance = Math.sqrt(dx * dx + dy * dy) + 0.001;
          if (distance < repelRadius) {
            let force = 1 - distance / repelRadius;
            force = force * force * pointerStrength;
            x += (dx / distance) * force * repelAmount;
            y += (dy / distance) * force * repelAmount;
          }
        }
        items.push({ ...point, column: (x / CELL) | 0, row: (y / CELL) | 0 });
      };

      for (let strand = 0; strand < 2; strand += 1) {
        const phase = strand * Math.PI;
        for (let index = 0; index < 400; index += 1) {
          const position = (index / 400 + clock * 0.0013) % 1;
          const strandRadius = radius * profile(position);
          const chaos = (1 - position) ** 1.05;
          const angle = position * 3.2 * Math.PI * 2 + phase + (random(index * 3.1 + strand * 40) - 0.5) * 2.9 * chaos;
          const jitteredRadius = strandRadius * (1 + (random(index * 7.7 + strand * 9) - 0.5) * 1.9 * chaos);
          const z = Math.cos(angle) * jitteredRadius;
          const y = Math.sin(angle) * jitteredRadius;
          const pointDepth = depth(z, strandRadius);
          const sourceColor = random(index * 2.3 + strand * 70) < smoothStep(position) ? YELLOW : COOL;
          addPoint({
            x: position * width + z * 0.34,
            y: centerY + y * 0.92,
            depth: pointDepth,
            color: mix("#ffffff", sourceColor, 0.3 + 0.65 * pointDepth),
            alpha: alphaAt(position),
          });
        }
      }

      for (let base = 0; base < 1; base += 0.04) {
        const position = (base + clock * 0.0013) % 1;
        if (position < 0.5) continue;
        const rungRadius = radius * profile(position);
        const angle = position * 3.2 * Math.PI * 2;
        for (let rung = 0; rung <= 1.001; rung += 0.12) {
          const offset = 1 - 2 * rung;
          const z = Math.cos(angle) * rungRadius * offset;
          const y = Math.sin(angle) * rungRadius * offset;
          const pointDepth = depth(z, rungRadius);
          addPoint({
            x: position * width + z * 0.34,
            y: centerY + y * 0.92,
            depth: pointDepth - 0.01,
            color: mix("#ffffff", YELLOW, 0.3 + 0.5 * pointDepth),
            alpha: alphaAt(position),
          });
        }
      }

      items.sort((a, b) => a.depth - b.depth);
      for (const item of items) {
        if (item.row < 0 || item.row >= rows || item.column < 0 || item.column >= columns) continue;
        context.globalAlpha = item.alpha;
        context.fillStyle = item.color;
        context.fillRect(item.column * CELL, item.row * CELL, CELL - 1, CELL - 1);
      }
      context.globalAlpha = 1;
    };

    const loop = () => {
      if (visible) {
        clock += 1;
        draw();
      }
      frameId = requestAnimationFrame(loop);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerleave", pointerLeave);
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
    };
  }, [canvasRef, activeStepRef]);
}

export function ProcessFlowSection({
  description = "The machine makes the options, we make the calls. In practice that works out to roughly 60 percent exploring, 20 building, 20 refining.",
  steps = processFlowSteps,
}) {
  const hostRef = useRef(null);
  const gridRef = useRef(null);
  const helixRef = useRef(null);
  const activeStepRef = useRef(null);
  const [activeStep, setActiveStep] = useState(null);
  activeStepRef.current = activeStep;
  useGrid(gridRef, hostRef);
  useHelix(helixRef, activeStepRef);

  const trackPixelLine = (event) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 62, event.clientX - rect.left - 31));
    event.currentTarget.style.setProperty("--line-x", `${Math.round(x / CELL) * CELL}px`);
  };

  return (
    <section className="process-flow" ref={hostRef} aria-labelledby="process-flow-title">
      <canvas className="process-flow__grid" ref={gridRef} aria-hidden="true" />
      <div className="process-flow__wrap">
        <header className="process-flow__header">
          <h2 className="process-flow__title" id="process-flow-title">Explore. Generate.<br />Refine. Scale.</h2>
          <p className="process-flow__description">{description}</p>
        </header>
        <div className="process-flow__visual">
          <canvas ref={helixRef} aria-hidden="true" />
        </div>
        <div className="process-flow__steps">
          {steps.map((step, index) => (
            <article
              className="process-step"
              key={step.number}
              onPointerEnter={(event) => event.pointerType !== "touch" && setActiveStep(index)}
              onPointerLeave={() => setActiveStep(null)}
              onPointerMove={trackPixelLine}
            >
              <div className="process-step__label">
                <span className="process-step__number">{step.number}</span>
                <span className="process-step__title">{step.title}</span>
              </div>
              <p className="process-step__description">{step.description}</p>
              <span className="process-step__pixel-line" aria-hidden="true"><i /></span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
