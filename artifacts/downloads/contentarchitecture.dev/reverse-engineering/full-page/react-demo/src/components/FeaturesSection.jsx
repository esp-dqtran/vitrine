import { GlyphField } from "../recovered/glyph/GlyphField.jsx";
import { AnimatedText } from "../recovered/text/AnimatedText.jsx";

const FEATURES = [
  {
    key: "1e69e65a8685",
    number: "001",
    title: "Agent-native",
    text: "AGENTS.md and a dozen scoped skills load the conventions before the first prompt, so Claude Code or Cursor builds inside the decisions instead of proposing a new architecture per run. Two MCP servers ship in the repo: one reads the running app, one drives a real Chrome. The agent checks its own work.",
  },
  {
    key: "9e2f7c1a4b8d",
    number: "002",
    title: "Agent-ready in production",
    text: "The shipped site stays legible to agents: an editable llms.txt drafted from your content, and a token-light Markdown twin of every page on the same URL. A feature you can put in your own proposals.",
  },
  {
    key: "f60b9b19b2ce",
    number: "003",
    title: "Schema as a system",
    text: "Document roles, factory functions, singletons. Every schema looks the same, so every editor knows where to go. You never model the structure from scratch again.",
  },
  {
    key: "43df4d0bc5d0",
    number: "004",
    title: "The hard fields, already built",
    text: "The three fields nobody gets right the first time. A link field that handles every kind of link. A media field that returns image, Mux, Rive, and Lottie in one shape, dimensions included, so layout never shifts. A page builder with guardrails. Typed, composed everywhere.",
  },
  {
    key: "74c11d7a580a",
    number: "005",
    title: "Fetch layer, solved",
    text: "CDN bypassed in production, Data Cache doing the work, webhooks invalidating on publish, draft mode wired in. Stale content after publish stops being a midnight problem.",
  },
  {
    key: "8d7f964604ba",
    number: "006",
    title: "A Studio editors actually use",
    text: "Every document type where editors expect it. Pages own their routes, singletons stay locked, no hunting. Clients stop emailing to ask where their homepage lives.",
  },
  {
    key: "73536edffd01",
    number: "007",
    title: "SEO, done not deferred",
    text: "Per-page metadata from schema, sitemap driven by Sanity, OpenGraph with auto-cropped images, robots.txt included. Nothing bolted on the week before launch.",
  },
  {
    key: "827aea375c85",
    number: "008",
    title: "Production-ready from day one",
    text: "Basic auth, spam-protected forms, redirects managed in Sanity, analytics, view transitions. The plumbing you reconfigure every project, already wired.",
  },
  {
    key: "f073fa2b36c7",
    number: "009",
    title: "Wired up, not just cloned",
    text: "An interactive setup script provisions the Sanity project, mints tokens, wires CORS and the revalidation webhook, and writes your .env. Migration scripts back up production and move content between environments. The first run is handled, not documented.",
  },
];

const INTRO = "The production foundation under my client work: hundreds of decisions, schema, fetching, structure, SEO, made once over six years and committed. Clone it, rename it, ship. Committed decisions are also why agents work here: inside them an agent ships, without them it redesigns.";

export function FeaturesSection() {
  return (
    <section
      id="features"
      data-page-builder-section="benefitsSection"
      className="features-section"
    >
      <div className="features-section__field">
        <div className="features-section__field-inner">
          <GlyphField />
        </div>
        <div className="features-section__wash" aria-hidden="true" />
      </div>

      <div className="features-section__grid">
        <div className="features-section__column">
          <header className="features-section__intro">
            <h2 data-studio-field="title">
              <AnimatedText>Every decision already made. So you can skip to the actual work.</AnimatedText>
            </h2>
            <div className="features-section__rich-text" data-studio-field="appRichText">
              <AnimatedText animationDelay={0.1}>{INTRO}</AnimatedText>
            </div>
          </header>

          <ul className="features-list">
            {FEATURES.map((feature, index) => (
              <li data-studio-item={`items.${index}`} key={feature.key}>
                <p className="features-list__title" data-studio-field={`items.${index}.title`}>
                  <AnimatedText>{`${feature.number} / ${feature.title}`}</AnimatedText>
                </p>
                <p className="features-list__text" data-studio-field={`items.${index}.text`}>
                  <AnimatedText animationDelay={0.1}>{feature.text}</AnimatedText>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="features-section__mobile-spacer" aria-hidden="true" />
    </section>
  );
}
