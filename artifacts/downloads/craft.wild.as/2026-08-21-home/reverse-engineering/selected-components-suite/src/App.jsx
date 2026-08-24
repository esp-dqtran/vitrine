import { useRef } from "react";
import { ExperimentsCarouselSection } from "./components/ExperimentsCarouselSection.jsx";
import { HeroSection } from "./components/HeroSection.jsx";
import { ContactSection } from "./components/ContactSection.jsx";
import { ProcessFlowSection } from "./components/ProcessFlowSection.jsx";
import { ProtocolPartsSection } from "./components/ProtocolPartsSection.jsx";
import { TetrisFooter } from "./components/TetrisFooter.jsx";
import { WorkCarouselSection } from "./components/WorkCarouselSection.jsx";
import { useAmbientField } from "./hooks/useAmbientField.js";

export function App() {
  const ambientCanvasRef = useRef(null);
  const ambientTextMaskRef = useRef(null);
  const contactRef = useRef(null);
  const footerRef = useRef(null);

  useAmbientField(ambientCanvasRef, ambientTextMaskRef, contactRef, footerRef);

  return (
    <>
      <canvas id="hero-kv" aria-hidden="true" ref={ambientCanvasRef} />
      <canvas className="ambient-text-mask" aria-hidden="true" ref={ambientTextMaskRef} />
      <a className="toplink show" href="https://wild.as" target="_blank" rel="noopener noreferrer">
        View full site
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </a>
      <main className="component-suite">
        <HeroSection />
        <WorkCarouselSection />
        <ProcessFlowSection />
        <ProtocolPartsSection />
        <ExperimentsCarouselSection />
        <ContactSection sectionRef={contactRef} />
      </main>
      <TetrisFooter footerRef={footerRef} />
    </>
  );
}
