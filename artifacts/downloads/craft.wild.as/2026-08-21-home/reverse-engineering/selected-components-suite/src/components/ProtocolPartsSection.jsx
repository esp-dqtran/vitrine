import { useRef, useState } from "react";
import { useProtocolFlow } from "../hooks/useProtocolFlow.js";
import { useReveal } from "../hooks/useReveal.js";

const steps = [
  {
    number: "01",
    title: "Brand Truth",
    description: "The one place that holds the voice, the design and the rules we build everything from.",
  },
  {
    number: "02",
    title: "Skills",
    description: "A job the system has been taught to do your way, ready whenever you ask for it.",
  },
  {
    number: "03",
    title: "Output",
    description: "The finished work, drawn from Brand Truth and on-brand the moment it arrives.",
  },
  {
    number: "04",
    title: "Brand Check",
    description: "A score on every output, and what it learns goes back into the source.",
  },
];

export function ProtocolPartsSection() {
  const canvasRef = useRef(null);
  const revealRef = useRef(null);
  const activeStageRef = useRef(-1);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const [lineOffsets, setLineOffsets] = useState([0, 0, 0, 0]);
  const visible = useReveal(revealRef);

  useProtocolFlow(canvasRef, activeStageRef, pointerRef);

  const activateStage = (index, event) => {
    if (event.pointerType === "touch") return;
    activeStageRef.current = index;
  };

  const deactivateStage = (index) => {
    if (activeStageRef.current === index) activeStageRef.current = -1;
  };

  const moveLine = (index, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const lineWidth = 62;
    const x = Math.max(0, Math.min(rect.width - lineWidth, event.clientX - rect.left - lineWidth / 2));
    setLineOffsets((current) => current.map((value, currentIndex) => (
      currentIndex === index ? Math.round(x / 9) * 9 : value
    )));
  };

  return (
    <section className="proc bcp-parts" id="protocol-parts">
      <div className="wrap">
        <div className={`reveal${visible ? " in" : ""}`} ref={revealRef}>
          <div className="procflow">
            <canvas
              id="bcp-flowviz"
              aria-hidden="true"
              onPointerLeave={() => { pointerRef.current.inside = false; }}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                pointerRef.current = {
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                  inside: true,
                };
              }}
              ref={canvasRef}
            />
          </div>
          <div className="donuts">
            {steps.map((step, index) => (
              <div
                className="step"
                key={step.number}
                onPointerEnter={(event) => activateStage(index, event)}
                onPointerLeave={() => deactivateStage(index)}
                onPointerMove={(event) => moveLine(index, event)}
              >
                <div className="dl">
                  <span className="dn">{step.number}</span>
                  <span className="dt">{step.title}</span>
                </div>
                <p className="dd">{step.description}</p>
                <span className="pxline" aria-hidden="true" style={{ "--lx": `${lineOffsets[index]}px` }}><i /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
