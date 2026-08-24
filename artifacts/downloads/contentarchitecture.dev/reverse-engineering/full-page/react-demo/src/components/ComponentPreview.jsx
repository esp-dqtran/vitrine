import content from "../content.json";
import { AsciiShowcaseCard } from "./AsciiShowcaseCard.jsx";
import { AsciiTexture } from "./AsciiTexture.jsx";
import { BlogPage } from "./BlogPage.jsx";
import { ClosingSection } from "./ClosingSection.jsx";
import { FaqSection } from "./FaqSection.jsx";
import { FeaturesSection } from "./FeaturesSection.jsx";
import { HeroSection } from "./HeroSection.jsx";
import { PullWindow, PullWindowHandle } from "./PullWindow.jsx";
import { PricingSection } from "./PricingSection.jsx";
import { ProblemSection } from "./ProblemSection.jsx";
import { RepoExplorer } from "./RepoExplorer.jsx";
import { ReviewsSection } from "./ReviewsSection.jsx";
import { ShowcaseSection } from "./ShowcaseSection.jsx";
import { SplitButton } from "./SplitButton.jsx";
import { AnimatedText } from "../recovered/text/AnimatedText.jsx";
import { GlyphField } from "../recovered/glyph/GlyphField.jsx";
import { ContentArchitectureLogo } from "../recovered/menu/ContentArchitectureLogo.jsx";
import { DesktopMenuCard } from "../recovered/menu/DesktopMenuCard.jsx";
import { MobileMenuCard } from "../recovered/menu/MobileMenuCard.jsx";
import { SpiralScene } from "../recovered/spiral/SpiralScene.jsx";
import { Terminal } from "../recovered/terminal/Terminal.jsx";
import "./ComponentPreview.css";

const PAGE_LINKS = {
  "hero-section": "/",
  "problem-section": "/#features",
  "features-section": "/#features",
  "repo-explorer": "/#the-repo",
  "showcase-section": "/#showcase",
  "reviews-section": "/#reviews",
  "pricing-section": "/#pricing",
  "faq-section": "/#faq",
  "closing-section": "/#contact",
  "site-footer": "/#contact",
  "site-navigation": "/",
  "blog-page": "/blog",
  "learn-more-drawer": "/",
  "studio-chrome": "/",
  "studio-section-editor": "/",
  "ascii-texture": "/",
  app: "/",
};

const HERO_CONTENT = {
  eyebrow: "Built for agentic development.",
  title: "The Sanity setup agents don't reinvent.",
  lede: "Every run invents a new one, none decided. This Sanity kit for Next.js and Astro commits six years of decisions.",
};

const REVIEWS = [
  { quote: "We shipped the Good Fella site on an early version and it saved us tons of time.", name: "Julian Fella", role: "Co-Founder, Good Fella", image: "/assets/julian.avif" },
  { quote: "The plumbing was already handled, so the week we'd normally lose to setup went into the creative work.", name: "Elliott Mangham", role: "Founder & Frontend Engineer", image: "/assets/elliott.avif" },
  { quote: "The revalidation problem I'd burned two days on was already solved and committed.", name: "Malik Kotb", role: "Web Designer & Engineer", image: "/assets/malik.jpg" },
];

function OpenInSite({ componentId, onNavigate }) {
  const href = PAGE_LINKS[componentId] || "/";
  return (
    <div className="component-preview__page-module">
      <span>Page-sized module</span>
      <p>This component is rendered in its complete page context, where its layout and connected interactions are accurate.</p>
      <a href={href} onClick={(event) => onNavigate?.(event.currentTarget, event)}>Open live component in reconstructed site ↗</a>
    </div>
  );
}

export function ComponentPreview({ componentId, onNavigate }) {
  switch (componentId) {
    case "hero-section":
      return <HeroSection content={HERO_CONTENT} />;
    case "problem-section":
      return <ProblemSection />;
    case "features-section":
      return <FeaturesSection />;
    case "repo-explorer":
      return <section className="component-preview__section-shell"><RepoExplorer /></section>;
    case "showcase-section":
      return <ShowcaseSection items={content.showcase} />;
    case "reviews-section":
      return <ReviewsSection reviews={REVIEWS} />;
    case "pricing-section":
      return <PricingSection />;
    case "faq-section":
      return <FaqSection items={content.faq} />;
    case "closing-section":
      return <ClosingSection ascii={"THE NEXT\nTHREE DAYS\nARE YOURS."} />;
    case "blog-page":
      return <BlogPage onNavigate={onNavigate} />;
    case "ascii-texture":
      return <div className="component-preview__texture"><AsciiTexture /></div>;
    case "split-button":
    case "odometer-word":
      return <div className="component-preview__center"><SplitButton href="#split-button">Get access</SplitButton></div>;
    case "ascii-showcase-card":
    case "ascii-image":
      return <div className="component-preview__card"><AsciiShowcaseCard href="#ascii-showcase-card" imageAlt="Serve Robotics site" imageSrc="/assets/serve-robotics.avif" studioIndex={5} title="Serve Robotics" /></div>;
    case "animated-text":
      return <div className="component-preview__animated"><AnimatedText>Built from observed structure and behavior.</AnimatedText></div>;
    case "terminal":
      return <div className="component-preview__terminal"><Terminal title="Component preview" command="inspect split-button" lines={[{ label: "status", tag: "ready" }, { label: "interaction", tag: "hover" }, { label: "source", tag: "local" }]} footer="Done." /></div>;
    case "desktop-menu-card":
      return <div className="component-preview__menu"><DesktopMenuCard onNavigate={onNavigate} currentKey="showcase" /></div>;
    case "mobile-menu-card":
      return <div className="component-preview__mobile-menu"><MobileMenuCard onNavigate={onNavigate} defaultOpen currentKey="showcase" /></div>;
    case "content-architecture-logo":
      return <div className="component-preview__logo"><ContentArchitectureLogo /></div>;
    case "pull-window":
    case "pull-window-handle":
      return <div className="component-preview__pull"><PullWindow><div className="component-preview__pull-window"><PullWindowHandle>Drag me</PullWindowHandle><span>Composable drag surface</span></div></PullWindow></div>;
    case "spiral-scene":
      return <div className="component-preview__scene"><SpiralScene /></div>;
    case "glyph-field":
    case "glyph-field-backdrop":
      return <div className="component-preview__scene"><GlyphField /></div>;
    default:
      return <OpenInSite componentId={componentId} onNavigate={onNavigate} />;
  }
}
