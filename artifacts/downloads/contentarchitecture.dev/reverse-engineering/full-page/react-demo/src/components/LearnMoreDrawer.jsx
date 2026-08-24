import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { OdometerWord } from "./SplitButton.jsx";

const SECTIONS = [
  { id: "why", label: "001 / WHY THIS EXISTS" },
  { id: "shipping", label: "002 / WHY I KEEP SHIPPING IT" },
  { id: "author", label: "003 / WHO AM I" },
];

function DrawerButton({ buttonRef, close = false, expanded = false, onClick }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`learn-more-button${close ? " learn-more-button--close" : ""}`}
      aria-haspopup={close ? undefined : "dialog"}
      aria-expanded={close ? undefined : expanded}
      aria-label={close ? "Close" : "Learn more"}
      onClick={onClick}
    >
      <span className="learn-more-button__label"><OdometerWord>{close ? "Close" : "Learn more"}</OdometerWord></span>
      <i aria-hidden="true" />
      <span className="learn-more-button__icon" aria-hidden="true">{close ? "X" : "+"}</span>
    </button>
  );
}

function DrawerSection({ children, id, label, sectionRef }) {
  return (
    <section id={id} ref={sectionRef} className="learn-more-dialog__section">
      <h3>{label}</h3>
      <div className="learn-more-dialog__copy">{children}</div>
    </section>
  );
}

function DrawerNavLabel({ children }) {
  const label = String(children);
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleLabel, setVisibleLabel] = useState(label);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return undefined;

    const fit = () => {
      const width = container.clientWidth;
      if (!width) {
        setVisibleLabel(label);
        return;
      }
      measure.textContent = label;
      const fullWidth = measure.scrollWidth;
      if (fullWidth <= width) {
        setVisibleLabel(label);
        return;
      }
      const characterCount = Math.max(1, Math.floor(width / (fullWidth / label.length)));
      setVisibleLabel(`${label.slice(0, Math.max(0, characterCount - 1))}…`);
    };

    fit();
    let frame = 0;
    let viewportWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === viewportWidth) return;
      viewportWidth = window.innerWidth;
      setVisibleLabel(label);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(fit);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [label]);

  return (
    <span className="learn-more-dialog__nav-label" ref={containerRef}>
      <span aria-hidden="true" ref={measureRef}>{label}</span>
      <OdometerWord>{visibleLabel}</OdometerWord>
    </span>
  );
}

export function LearnMoreDrawer() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const dialogRef = useRef(null);
  const scrollRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const sectionRefs = useRef(new Map());
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...dialogRef.current.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const goToSection = (id) => {
    const section = sectionRefs.current.get(id);
    const scroller = scrollRef.current;
    if (!section || !scroller) return;
    const sectionTop = section.getBoundingClientRect().top;
    const scrollerTop = scroller.getBoundingClientRect().top;
    scroller.scrollTo({
      top: scroller.scrollTop + sectionTop - scrollerTop - 32,
      behavior: prefersReducedMotion ? "instant" : "smooth",
    });
    setActiveSection(id);
  };

  return (
    <>
      <div className="learn-more-trigger">
        <DrawerButton buttonRef={triggerRef} expanded={open} onClick={() => setOpen(true)} />
      </div>

      {open ? (
        <div className="learn-more-overlay">
          <div className="learn-more-overlay__backdrop" role="presentation" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            className="learn-more-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="learn-more-dialog__nav-shell">
              <nav aria-label="Sections">
                <ul>
                  {SECTIONS.map((section) => (
                    <li key={section.id}>
                      <button type="button" aria-label={section.label} aria-current={activeSection === section.id ? "true" : undefined} onClick={() => goToSection(section.id)}>
                        <DrawerNavLabel>{section.label}</DrawerNavLabel>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <i className="learn-more-dialog__connector" aria-hidden="true" />
            </div>

            <div className="learn-more-dialog__scroll" ref={scrollRef}>
              <article>
                <header className="learn-more-dialog__header">
                  <div>
                    <h2 id={titleId}>README ╱ THE CONTENT ARCHITECTURE</h2>
                    <p>A PERSONAL NOTE FROM THE MAINTAINER</p>
                  </div>
                  <DrawerButton buttonRef={closeRef} close onClick={() => setOpen(false)} />
                </header>

                <div className="learn-more-dialog__sections">
                  <DrawerSection id="learn-more-why" label={SECTIONS[0].label} sectionRef={(node) => sectionRefs.current.set("why", node)}>
                    <p>Every Sanity project I shipped, the first week looked identical. Spin up Next, or Astro. Wire the Studio. Rewrite the page builder. Rebuild the SEO layer. Re-do the webhook revalidation. Re-style the same contact form for the fourth time.</p>
                    <p>By the time the actual creative work started, 3 days of the budget were gone and the client had not seen a single pixel that mattered.</p>
                    <p>Extracting it started small. One project. Then two. Then ten. Every time something broke in production, a Sanity migration that nuked a dataset, a CDN cache that served stale OG images for three weeks, a webhook that fired twice and corrupted a sitemap, the fix went back into the boilerplate.</p>
                    <p>For a long time I called this the cost of headless. I had rebuilt the same foundation so many times I could do it half-asleep, and I mistook that for being good at my job instead of what it was, doing the same work twice.</p>
                    <p>At some point that stopped being a reason to keep it to myself.</p>
                    <p className="learn-more-dialog__reasoning">If you want the reasoning before you buy, I wrote it all down: <a href="https://www.edoardolunardi.dev/blog/the-content-architecture-cms-structure" target="_blank" rel="noopener noreferrer">CMS structure</a>, <a href="https://www.edoardolunardi.dev/blog/the-content-architecture-content-models" target="_blank" rel="noopener noreferrer">content models</a>, <a href="https://www.edoardolunardi.dev/blog/the-content-architecture-page-composition" target="_blank" rel="noopener noreferrer">page composition</a>, and <a href="https://www.edoardolunardi.dev/blog/the-content-architecture-content-primitives" target="_blank" rel="noopener noreferrer">content primitives</a>. The thinking behind every decision in the codebase, free to read.</p>
                  </DrawerSection>

                  <DrawerSection id="learn-more-shipping" label={SECTIONS[1].label} sectionRef={(node) => sectionRefs.current.set("shipping", node)}>
                    <p>I use this on every project. I am the heaviest user. The bug I find on a Friday client engagement is the patch you get on Monday.</p>
                    <p>I am one person, not a team. That is a feature. The architecture is consistent because one mind held it from the first schema file to the last revalidation hook. Nobody overrode the opinion. Nobody added a field because a stakeholder asked nicely.</p>
                    <p>There is no distance between me and this. The decisions in the repo are the ones I make on paid work, in the same week, under the same deadline. When you open the fetch layer or the page builder, you are reading how I actually ship, not a demo cleaned up for sale. That is the whole relationship: you get the thing I rely on, maintained by the person who relies on it most.</p>
                    <p>I am not trying to turn this into a SaaS. There is no dashboard, no seat-based pricing, no telemetry. The roadmap is not fixed in stone either, it grows out of real client work: when a project turns up something worth having, it becomes part of the product. You buy the repo, you own the repo. I maintain it because I use it too.</p>
                    <p>Maintaining this in public is a forcing function for my own work. With paying users on both repos, I cannot let the schema rot, skip a Next.js or Astro major, or sit on a breaking change in a Sanity plugin. The same discipline is why an agent is useful on it: the calls are already made and written down, so it builds inside them instead of guessing. Your projects stay current because mine have to.</p>
                  </DrawerSection>

                  <DrawerSection id="learn-more-author" label={SECTIONS[2].label} sectionRef={(node) => sectionRefs.current.set("author", node)}>
                    <p>I am Edo <img className="learn-more-dialog__portrait" src="/assets/author-inline-portrait.jpg" alt="Man in black turtleneck smiling and looking to the side indoors" width="100" height="100" /> - Creative Web Engineer, nearly a decade in. Sanity Pioneer 2026, Awwwards jury member, recognized across Awwwards, CSSDA, and FWA. I have shipped for Buck, Disney, Porsche, Red Bull, Le Labo Fragrances, Getty. Design sensibility, technical depth, obsessive about detail. Based in Vienna, working worldwide.</p>
                    <figure className="learn-more-dialog__media">
                      <video autoPlay loop muted playsInline preload="metadata" poster="/assets/author-video-poster.webp" aria-hidden="true" tabIndex={-1}>
                        <source src="/assets/author-video-1080p.mp4" type="video/mp4" />
                      </video>
                    </figure>
                    <p>Find me on <a href="https://www.instagram.com/edo.tsx" target="_blank" rel="noopener noreferrer">Instagram</a>, <a href="https://www.linkedin.com/in/edoardolunardi" target="_blank" rel="noopener noreferrer">LinkedIn</a>, and <a href="https://x.com/edo_lunardi" target="_blank" rel="noopener noreferrer">X</a>. The work lives at <a href="https://www.edoardolunardi.dev/" target="_blank" rel="noopener noreferrer">edoardolunardi.dev</a>. Write to <a href="mailto:hello@edoardolunardi.dev">hello@edoardolunardi.dev</a>.</p>
                  </DrawerSection>
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
