import { useState } from "react";
import { AnimatedText } from "../recovered/text/AnimatedText.jsx";
import { Terminal } from "../recovered/terminal/Terminal.jsx";

const problems = [
  { label: "Agent redesigns the architecture on every prompt", tag: "∞ HRS" },
  { label: "Page builder schema + section registration + preview", tag: "~5 HRS" },
  { label: "Draft mode + live preview + webhook revalidation", tag: "~4 HRS" },
  { label: "CDN vs. data cache — stale content after publish", tag: "~3 HRS" },
  { label: "Studio structure editors can actually use", tag: "~3 HRS" },
  { label: "SEO metadata, OG images, sitemaps, robots.txt", tag: "~2 HRS" },
  { label: "Rewriting the same 12 components", tag: "~2 HRS" },
  { label: "Redirects, analytics, view transitions, Mux", tag: "~2 HRS" },
  { label: "Contact form + spam guard + Resend wiring", tag: "~1 HR" },
  { label: "ESLint, Prettier, Biome, git hooks", tag: "~1 HR" },
  { label: "Basic auth for staging environments", tag: "~1 HR" },
];

const firstParagraph = "It's never the easy stuff that hurts. It's the page builder, modeled from scratch again. Draft mode and live preview, wired up and subtly broken again. The cache bug where published content goes stale and the client swears you shipped something wrong. A Studio structure your editors actually understand, instead of one they email you about.";
const secondParagraph = "This is the part nobody quotes for and everybody rebuilds. Days gone before the real work starts.";

export function CommonProblemsPanel({ className = "problem-section__terminal" }) {
  return (
    <div className={className}>
      <Terminal
        title="Common problems"
        lines={problems}
        footer="ESTIMATED TIME LOST: ~24 HOURS PER PROJECT  (3 FULL DAYS)"
      />
    </div>
  );
}

export function ProblemSection() {
  const [firstParagraphLines, setFirstParagraphLines] = useState(0);

  return (
    <section className="problem-section" data-page-builder-section="textTerminalSection">
      <div className="problem-section__grid">
        <CommonProblemsPanel />
        <div className="problem-section__copy">
          <h2 data-studio-field="title">
            <AnimatedText>The page builder alone costs you days. Every single time.</AnimatedText>
          </h2>
          <div className="problem-section__rich-text" data-studio-field="appRichText">
            <AnimatedText
              animationDelay={0.1}
              className="problem-section__paragraph"
              onLineCountChange={setFirstParagraphLines}
            >
              {firstParagraph}
            </AnimatedText>
            <AnimatedText
              animationDelay={0.1 + (firstParagraphLines * 0.1)}
              className="problem-section__paragraph"
            >
              {secondParagraph}
            </AnimatedText>
          </div>
        </div>
      </div>
    </section>
  );
}
