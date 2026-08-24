import { useRef } from "react";
import { useAmbientField } from "../hooks/useAmbientField.js";
import { ContactSection } from "./ContactSection.jsx";

export function ContactAmbientPreview() {
  const stageRef = useRef(null);
  const ambientCanvasRef = useRef(null);
  const ambientTextMaskRef = useRef(null);
  const contactRef = useRef(null);
  const footerRef = useRef(null);

  useAmbientField(
    ambientCanvasRef,
    ambientTextMaskRef,
    contactRef,
    footerRef,
    stageRef,
    { textCenterY: 250 },
  );

  return (
    <div className="contact-ambient-preview" ref={stageRef}>
      <canvas id="hero-kv" aria-hidden="true" ref={ambientCanvasRef} />
      <canvas className="ambient-text-mask" aria-hidden="true" ref={ambientTextMaskRef} />
      <ContactSection sectionRef={contactRef} />
    </div>
  );
}
