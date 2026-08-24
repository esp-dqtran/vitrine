import { AnimatedText } from "../recovered/text/AnimatedText.jsx";
import { SpiralScene } from "../recovered/spiral/SpiralScene.jsx";
import { SplitButton } from "./SplitButton.jsx";

const EASE_IN_OUT_CUBIC = (progress) => (
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2
);

function scrollOneViewport() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = window.scrollY;
  const target = start + window.innerHeight;

  if (reduceMotion) {
    window.scrollTo({ top: target });
    return;
  }

  const startedAt = performance.now();
  const duration = 1200;

  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    window.scrollTo({
      top: start + ((target - start) * EASE_IN_OUT_CUBIC(progress)),
      behavior: "instant",
    });
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export function HeroSection({ content }) {
  return (
    <section className="hero-section" data-page-builder-section="mainHeroSection">
      <div className="hero-section__copy">
        <div className="hero-section__main">
          <p className="eyebrow" data-studio-field="eyebrow">
            <AnimatedText>{content.eyebrow}</AnimatedText>
          </p>
          <h1 data-studio-field="title">
            <AnimatedText>{content.title}</AnimatedText>
          </h1>
          <p className="hero-section__lede" data-studio-field="appRichText">
            <AnimatedText>{content.lede}</AnimatedText>
          </p>
          <div className="hero-section__action">
            <SplitButton href="#pricing">Get access</SplitButton>
          </div>
        </div>
        <div className="hero-section__stats" aria-label="Supported stack and agent status">
          <div><span>Next 16.x</span><span>Astro 7.x</span><span>Sanity v6</span><span>TS: strict</span></div>
          <div><span>Agents.md: loaded</span><span>MCP: 2 servers</span><span>Drift: 0</span></div>
        </div>
      </div>
      <div className="hero-section__visual">
        <SpiralScene />
      </div>
      <button className="hero-section__scroll-cue" type="button" aria-label="Scroll to the next section" onClick={scrollOneViewport}>
        <span aria-hidden="true"><i /></span>
      </button>
    </section>
  );
}
