import { useEffect } from "react";
import { sourceFragments } from "./sourceFragments.js";
import "./source.css";

function SourceFragment({ html }) {
  return <div className="source-fragment" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function GlobalChrome() {
  return <SourceFragment html={sourceFragments.global} />;
}

export function HeroSection() {
  return <SourceFragment html={sourceFragments.hero} />;
}

export function IntroLeadSection() {
  return <SourceFragment html={sourceFragments.intro} />;
}

export function WorkCarouselSection() {
  return <SourceFragment html={sourceFragments.work} />;
}

export function OriginStorySection() {
  return <SourceFragment html={sourceFragments.origin} />;
}

export function AiLimitSection() {
  return <SourceFragment html={sourceFragments.shift} />;
}

export function ProcessFlowSection() {
  return <SourceFragment html={sourceFragments.process} />;
}

export function BrandProtocolStorySection() {
  return <SourceFragment html={sourceFragments.protocol} />;
}

export function BrandProtocolFlowSection() {
  return <SourceFragment html={sourceFragments.protocolParts} />;
}

export function AiAdoptionSection() {
  return <SourceFragment html={sourceFragments.ai} />;
}

export function ExperimentsCarouselSection() {
  return <SourceFragment html={sourceFragments.lab} />;
}

export function ContactSection() {
  return <SourceFragment html={sourceFragments.contact} />;
}

export function FooterTetrisSection() {
  return <SourceFragment html={sourceFragments.footer} />;
}

function useCapturedRuntime() {
  useEffect(() => {
    if (window.__craftRuntimeLoaded) return;
    window.__craftRuntimeLoaded = true;
    const script = document.createElement("script");
    script.src = "/craft-runtime.js";
    script.dataset.craftRuntime = "true";
    document.body.appendChild(script);
  }, []);
}

export function App() {
  useCapturedRuntime();

  return (
    <>
      <GlobalChrome />
      <main id="top">
        <HeroSection />
        <IntroLeadSection />
        <WorkCarouselSection />
        <OriginStorySection />
        <AiLimitSection />
        <ProcessFlowSection />
        <BrandProtocolStorySection />
        <BrandProtocolFlowSection />
        <AiAdoptionSection />
        <ExperimentsCarouselSection />
        <ContactSection />
      </main>
      <FooterTetrisSection />
    </>
  );
}
