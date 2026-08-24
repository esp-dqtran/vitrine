import { useCallback, useEffect, useRef, useState } from "react";
import content from "./content.json";
import { AsciiPageTransition } from "./components/AsciiPageTransition.jsx";
import { BlogPage } from "./components/BlogPage.jsx";
import { ClosingSection } from "./components/ClosingSection.jsx";
import { ComponentLibraryPage } from "./components/ComponentLibraryPage.jsx";
import { FaqSection } from "./components/FaqSection.jsx";
import { FeaturesSection } from "./components/FeaturesSection.jsx";
import { FullComponentGalleryPage } from "./components/FullComponentGalleryPage.jsx";
import { HeroSection } from "./components/HeroSection.jsx";
import { LearnMoreDrawer } from "./components/LearnMoreDrawer.jsx";
import { ProblemSection } from "./components/ProblemSection.jsx";
import { PricingSection } from "./components/PricingSection.jsx";
import { RepoExplorer } from "./components/RepoExplorer.jsx";
import { ReviewsSection } from "./components/ReviewsSection.jsx";
import { ShowcaseSection } from "./components/ShowcaseSection.jsx";
import { SiteFooter } from "./components/SiteFooter.jsx";
import { SiteNavigation } from "./components/SiteNavigation.jsx";
import { StudioChrome } from "./components/StudioChrome.jsx";
import "./page.css";

const REVIEWS = [
  {
    quote: "We shipped the Good Fella site on an early version and it saved us tons of time. Six months in, we're still building pages and sections in an afternoon without fighting the setup.",
    name: "Julian Fella",
    role: "Co-Founder, Good Fella",
    image: "/assets/julian.avif",
  },
  {
    quote: "Edo and I ran a client project on this together. The plumbing was already handled, so the week we'd normally lose to setup went into the creative work the client actually remembers.",
    name: "Elliott Mangham",
    role: "Founder & Frontend Engineer",
    image: "/assets/elliott.avif",
  },
  {
    quote: "I opened the fetch layer and found the revalidation problem I'd burned two days on last project, already solved and committed. That one folder paid for the whole thing, and the rest is six years of decisions I'd have made the slow way.",
    name: "Malik Kotb",
    role: "Web Designer & Engineer",
    image: "/assets/malik.jpg",
  },
];

const CLOSING_ASCII = String.raw` /$$$$$$$$ /$$                                                       /$$            /$$$$$$              /$$                              
|__  $$__/| $$                                                      | $$           /$$__  $$            | $$                              
   | $$   | $$$$$$$   /$$$$$$        /$$$$$$$   /$$$$$$  /$$   /$$ /$$$$$$        |__/  \ $$        /$$$$$$$  /$$$$$$  /$$   /$$  /$$$$$$$
   | $$   | $$__  $$ /$$__  $$      | $$__  $$ /$$__  $$|  $$ /$$/|_  $$_/           /$$$$$/       /$$__  $$ |____  $$| $$  | $$ /$$_____/
   | $$   | $$  \ $$| $$$$$$$$      | $$  \ $$| $$$$$$$$ \  $$$$/   | $$            |___  $$      | $$  | $$  /$$$$$$$| $$  | $$|  $$$$$$ 
   | $$   | $$  | $$| $$_____/      | $$  | $$| $$_____/  >$$  $$   | $$ /$$       /$$  \ $$      | $$  | $$ /$$__  $$| $$  | $$ \____  $$
   | $$   | $$  | $$|  $$$$$$$      | $$  | $$|  $$$$$$$ /$$/\  $$  |  $$$$/      |  $$$$$$/      |  $$$$$$$|  $$$$$$$|  $$$$$$$ /$$$$$$$/
   |__/   |__/  |__/ \_______/      |__/  |__/ \_______/|__/  \__/   \___/         \______/        \_______/ \_______/ \____  $$|_______/ 
                                                                                                                       /$$  | $$          
                                                                                                                      |  $$$$$$/          
                                                                                                                       \______/           
                                                                                                                                          
                                                                                                                                          
  /$$$$$$   /$$$$$$   /$$$$$$        /$$   /$$  /$$$$$$  /$$   /$$  /$$$$$$   /$$$$$$$                                                    
 |____  $$ /$$__  $$ /$$__  $$      | $$  | $$ /$$__  $$| $$  | $$ /$$__  $$ /$$_____/                                                    
  /$$$$$$$| $$  \__/| $$$$$$$$      | $$  | $$| $$  \ $$| $$  | $$| $$  \__/|  $$$$$$                                                     
 /$$__  $$| $$      | $$_____/      | $$  | $$| $$  | $$| $$  | $$| $$       \____  $$                                                    
|  $$$$$$$| $$      |  $$$$$$$      |  $$$$$$$|  $$$$$$/|  $$$$$$/| $$       /$$$$$$$//$$                                                 
 \_______/|__/       \_______/       \____  $$ \______/  \______/ |__/      |_______/|__/                                                 
                                     /$$  | $$                                                                                            
                                    |  $$$$$$/                                                                                            
                                     \______/                                                                                             `;

function HomePage({ onNavigate }) {
  const [chrome, setChrome] = useState({ drawer: true, header: true, footer: true, minimap: true });
  const [heroContent, setHeroContent] = useState({
    eyebrow: "Built for agentic development.",
    title: "The Sanity setup agents don't reinvent.",
    lede: "Every run invents a new one, none decided. This Sanity kit for Next.js and Astro commits six years of decisions. Your agent builds inside them, and checks its work through MCP and a real Chrome.",
  });

  return (
    <>
      {chrome.header ? <SiteNavigation onNavigate={onNavigate} /> : null}
      <StudioChrome
        chrome={chrome}
        heroContent={heroContent}
        onChangeChrome={(key, value) => setChrome((current) => ({ ...current, [key]: value }))}
        onChangeHero={(key, value) => setHeroContent((current) => ({ ...current, [key]: value }))}
      />
      <main className="page-main">
        <HeroSection content={heroContent} />
        <ProblemSection />
        <FeaturesSection />
        <section id="the-repo" className="repo-section" data-page-builder-section="ideSection"><RepoExplorer /></section>
        <ShowcaseSection items={content.showcase} />
        <ReviewsSection reviews={REVIEWS} />
        <PricingSection />
        <FaqSection items={content.faq} />
        <ClosingSection ascii={CLOSING_ASCII} />
      </main>
      {chrome.footer ? <SiteFooter onNavigate={onNavigate} /> : null}
      {chrome.drawer ? <LearnMoreDrawer /> : null}
    </>
  );
}

function normalizeRoute(pathname) {
  if (pathname === "/blog") return "/blog";
  if (pathname === "/components/all") return "/components/all";
  if (pathname === "/components") return "/components";
  return "/";
}

export function App() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname));
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const pendingNavigationRef = useRef(null);
  const transitionPhaseRef = useRef("idle");

  useEffect(() => {
    document.title = route === "/blog"
      ? "Content Architecture Blog | Next.js + Sanity Engineering"
      : route === "/components" || route === "/components/all"
        ? "Component Inventory | Content Architecture"
        : "Agent-Ready Sanity Kit for Next.js & Astro | The Content Architecture";
  }, [route]);

  const setPhase = useCallback((phase) => {
    transitionPhaseRef.current = phase;
    setTransitionPhase(phase);
  }, []);

  const requestRoute = useCallback((target, options = {}) => {
    if (transitionPhaseRef.current !== "idle") return;
    pendingNavigationRef.current = { ...target, ...options };
    setPhase("cover");
  }, [setPhase]);

  const handleNavigate = useCallback((link, event) => {
    const target = new URL(link.href, window.location.origin);
    if (target.origin !== window.location.origin) return;
    event.preventDefault();

    const targetRoute = normalizeRoute(target.pathname);
    if (targetRoute === route) {
      if (target.hash) document.querySelector(target.hash)?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    requestRoute({ route: targetRoute, hash: target.hash });
  }, [requestRoute, route]);

  useEffect(() => {
    const onPopState = () => {
      const nextRoute = normalizeRoute(window.location.pathname);
      if (nextRoute === route) return;
      requestRoute({ route: nextRoute, hash: window.location.hash }, { historyChanged: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [requestRoute, route]);

  const handleCoverComplete = useCallback(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) {
      setPhase("reveal");
      return;
    }
    const nextUrl = `${pending.route}${pending.hash || ""}`;
    if (!pending.historyChanged) window.history.pushState({}, "", nextUrl);
    setRoute(pending.route);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      if (pending.hash) requestAnimationFrame(() => document.querySelector(pending.hash)?.scrollIntoView());
      setPhase("reveal");
    });
  }, [setPhase]);

  const handleRevealComplete = useCallback(() => {
    pendingNavigationRef.current = null;
    setPhase("idle");
  }, [setPhase]);

  return (
    <>
      {route === "/blog" ? <BlogPage onNavigate={handleNavigate} /> : route === "/components/all" ? <FullComponentGalleryPage onNavigate={handleNavigate} /> : route === "/components" ? <ComponentLibraryPage onNavigate={handleNavigate} /> : <HomePage onNavigate={handleNavigate} />}
      <AsciiPageTransition
        phase={transitionPhase}
        onCoverComplete={handleCoverComplete}
        onRevealComplete={handleRevealComplete}
      />
    </>
  );
}
