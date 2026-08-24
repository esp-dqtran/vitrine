import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { STUDIO_MANIFEST, StudioSectionEditor } from "./StudioSectionEditor.jsx";

const FIELD_SELECTOR = "[data-studio-field]";
const SECTION_SELECTOR = "[data-page-builder-section]";
const MEDIA_TAGS = new Set(["FIGURE", "IMG", "PICTURE", "VIDEO", "SVG", "CANVAS"]);
const ACCENT_TAGS = new Set(["BUTTON", "INPUT", "TEXTAREA"]);

const FIELD_LABELS = {
  appMedia: "Media",
  appRichText: "Text",
  author: "Author",
  avatar: "Avatar",
  eyebrow: "Eyebrow",
  name: "Plan name",
  question: "Question",
  quote: "Quote",
  sharedItemsTitle: "Shared terms title",
  text: "Text",
  title: "Title",
};

const STUDIO_TABS = [
  ["page", "📄 Page"],
  ["content", "🍱 Content"],
  ["seo", "🔍 SEO"],
  ["agents", "🤖 Agents"],
];

const STUDIO_NOTE = "Demo only. Edits are local and reset on reload. Everything here is editable in Sanity Studio.";

function fieldLeaf(field) {
  return field.slice(field.lastIndexOf(".") + 1);
}

function resolveFieldLabel(field) {
  const leaf = fieldLeaf(field);
  return FIELD_LABELS[leaf] || leaf;
}

function useStudioAvailability() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const update = () => {
      const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
      setAvailable(innerWidth >= 1024 && !touch);
    };
    update();
    addEventListener("resize", update, { passive: true });
    return () => removeEventListener("resize", update);
  }, []);

  return available;
}

function collectStudioFields() {
  const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR));
  const fields = [];

  document.querySelectorAll(FIELD_SELECTOR).forEach((element, order) => {
    const field = element.dataset.studioField || "";
    const section = element.closest(SECTION_SELECTOR);
    if (!field || !section || element.closest("[inert]")) return;

    const index = sections.indexOf(section);
    const rect = element.getBoundingClientRect();
    if (index < 0 || rect.width < 1 || rect.height < 1) return;

    fields.push({
      key: `${index}:${field}:${order}`,
      type: section.dataset.pageBuilderSection || "",
      index,
      field,
      label: resolveFieldLabel(field),
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  });

  return fields;
}

function StudioFieldOverlay({ activeField, onOpen }) {
  const prefersReducedMotion = useReducedMotion();
  const [fields, setFields] = useState([]);

  useLayoutEffect(() => {
    let frame = 0;
    const observed = new Set();
    const observer = new ResizeObserver(schedule);

    function measure() {
      frame = 0;
      const current = new Set(document.querySelectorAll(FIELD_SELECTOR));
      observed.forEach((element) => {
        if (current.has(element)) return;
        observer.unobserve(element);
        observed.delete(element);
      });
      current.forEach((element) => {
        if (observed.has(element)) return;
        observer.observe(element);
        observed.add(element);
      });
      setFields(collectStudioFields());
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    schedule();
    observer.observe(document.body);
    addEventListener("resize", schedule, { passive: true });
    addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer.disconnect();
      removeEventListener("resize", schedule);
      removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return createPortal(
    <motion.div
      className="studio-field-overlay"
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
      onWheel={(event) => window.scrollBy(event.deltaX, event.deltaY)}
    >
      {fields.map((field) => {
        const active = activeField
          && activeField.type === field.type
          && activeField.index === field.index
          && activeField.field === field.field;
        const labelBelow = field.top < 26;

        return (
          <button
            type="button"
            aria-label={`Edit ${field.label}`}
            className={`studio-field${active ? " is-active" : ""}`}
            key={field.key}
            onClick={() => onOpen(field)}
            style={{
              top: field.top - 3,
              left: field.left - 3,
              width: field.width + 6,
              height: field.height + 6,
            }}
          >
            <span className={labelBelow ? "is-below" : ""}><i aria-hidden="true">✎</i>{field.label}</span>
          </button>
        );
      })}
    </motion.div>,
    document.body,
  );
}

function classifyMinimapElement(element) {
  if (MEDIA_TAGS.has(element.tagName)) return "media";
  if (ACCENT_TAGS.has(element.tagName) || element.getAttribute("role") === "button") return "accent";
  return "text";
}

function collectMinimapRects(rootElement) {
  const origin = rootElement.getBoundingClientRect();
  const rectangles = [];
  const selector = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figure,img,picture,video,svg,canvas,button,input,textarea,[role='button']";

  for (const section of rootElement.querySelectorAll(SECTION_SELECTOR)) {
    const candidates = Array.from(section.querySelectorAll(selector));
    const candidateSet = new Set(candidates);
    const sectionRect = section.getBoundingClientRect();

    for (const element of candidates) {
      let parent = element.parentElement;
      let nested = false;
      while (parent && parent !== section) {
        if (candidateSet.has(parent)) {
          nested = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (nested) continue;

      const kind = classifyMinimapElement(element);
      let rects;
      if (kind === "text") {
        const range = document.createRange();
        range.selectNodeContents(element);
        const clientRects = Array.from(range.getClientRects());
        rects = clientRects.length ? clientRects.slice(0, 200) : [element.getBoundingClientRect()];
      } else {
        rects = [element.getBoundingClientRect()];
      }

      for (const rect of rects) {
        if (rect.width < 2 || rect.height < 2 || rect.bottom <= sectionRect.top || rect.top >= sectionRect.bottom) continue;
        rectangles.push({
          top: rect.top - origin.top,
          left: rect.left - origin.left,
          width: rect.width,
          height: rect.height,
          kind,
        });
        if (rectangles.length >= 1500) return rectangles;
      }
    }
  }

  return rectangles;
}

export function StudioMinimap({ armed, onToggle, scanRoot }) {
  const rootRef = useRef(null);
  const whiteCanvasRef = useRef(null);
  const accentCanvasRef = useRef(null);
  const metricsRef = useRef({ sy: 0 });
  const drawFrameRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    let resizeTimer = 0;
    const delayed = [];

    const draw = () => {
      drawFrameRef.current = 0;
      const root = rootRef.current;
      if (!root || stopped) return;

      const page = scanRoot?.current || document.documentElement;
      const width = root.clientWidth;
      const viewportHeight = innerHeight;
      if (width <= 0 || viewportHeight <= 0) return;

      const sx = width / page.clientWidth;
      const sy = root.clientHeight / viewportHeight;
      const worldHeight = page.scrollHeight;
      const height = Math.max(1, Math.ceil(worldHeight * sy));
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rectangles = collectMinimapRects(page);
      const accent = getComputedStyle(root).getPropertyValue("--orange").trim() || "#ff9100";
      const layers = [
        [whiteCanvasRef.current, "#ffffff", { text: 0.35, media: 0.15, accent: 0.6 }],
        [accentCanvasRef.current, accent, { text: 0.7, media: 0.4, accent: 1 }],
      ];

      metricsRef.current = { sy };
      for (const [canvas, color, alpha] of layers) {
        const context = canvas?.getContext("2d");
        if (!canvas || !context) continue;
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = color;
        for (const rect of rectangles) {
          context.globalAlpha = alpha[rect.kind];
          context.fillRect(rect.left * sx, rect.top * sy, rect.width * sx, rect.height * sy);
        }
        context.globalAlpha = 1;
      }

      const scrollOffset = page === document.documentElement ? scrollY : page.scrollTop;
      const transform = `translateY(${-scrollOffset * sy}px)`;
      if (whiteCanvasRef.current) whiteCanvasRef.current.style.transform = transform;
      if (accentCanvasRef.current) accentCanvasRef.current.style.transform = transform;
      setReady(rectangles.length > 0);
    };

    const schedule = () => {
      if (!drawFrameRef.current) drawFrameRef.current = requestAnimationFrame(draw);
    };
    const afterResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(schedule, 200);
    };
    const onScroll = () => {
      const page = scanRoot?.current || document.documentElement;
      const scrollOffset = page === document.documentElement ? scrollY : page.scrollTop;
      const transform = `translateY(${-scrollOffset * metricsRef.current.sy}px)`;
      if (whiteCanvasRef.current) whiteCanvasRef.current.style.transform = transform;
      if (accentCanvasRef.current) accentCanvasRef.current.style.transform = transform;
    };

    draw();
    const observer = new ResizeObserver(afterResize);
    observer.observe(scanRoot?.current || document.body);
    delayed.push(setTimeout(afterResize, 500), setTimeout(afterResize, 1500), setTimeout(afterResize, 3000));
    document.fonts?.ready.then(afterResize);
    addEventListener("load", afterResize);
    addEventListener("resize", afterResize, { passive: true });
    addEventListener("scroll", onScroll, { passive: true });

    return () => {
      stopped = true;
      observer.disconnect();
      delayed.forEach(clearTimeout);
      clearTimeout(resizeTimer);
      if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current);
      removeEventListener("load", afterResize);
      removeEventListener("resize", afterResize);
      removeEventListener("scroll", onScroll);
    };
  }, [scanRoot]);

  return (
    <motion.div
      className={`studio-minimap${ready ? " is-ready" : ""}`}
      data-studio-chrome="showMinimap"
      style={{ visibility: ready ? "visible" : "hidden" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
    >
      <div ref={rootRef} className="studio-minimap__viewport" aria-hidden="true">
        <canvas ref={whiteCanvasRef} className="studio-minimap__canvas" />
        <div className={`studio-minimap__scan${armed ? " is-hidden" : ""}`}>
          <div className="studio-minimap__scan-mask">
            <div className="studio-minimap__scan-counter">
              <canvas ref={accentCanvasRef} className="studio-minimap__canvas" />
            </div>
          </div>
          <div className="studio-minimap__scan-gradient" />
          <div className="studio-minimap__scan-line" />
        </div>
      </div>
      <button type="button" aria-label="Inspect this page in Studio mode" onClick={onToggle} />
      <span className="studio-minimap__label" aria-hidden="true">Inspect ↗</span>
    </motion.div>
  );
}

function StudioSwitch({ checked, children, onChange }) {
  return (
    <button className="studio-switch" type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>{children}</span>
      <i aria-hidden="true"><b /></i>
    </button>
  );
}

function StudioPanel({ activeField, chrome, heroContent, onChangeChrome, onChangeHero, onExit, onFocusField, section }) {
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const constraintsRef = useRef(null);
  const controls = useDragControls();
  const [activeTab, setActiveTab] = useState(section ? "content" : "page");
  const [noIndex, setNoIndex] = useState(false);
  const [serveMarkdown, setServeMarkdown] = useState(true);
  const [seoTitle, setSeoTitle] = useState("Agent-Ready Sanity Kit for Next.js & Astro | The Content Architecture");
  const [seoDescription, setSeoDescription] = useState("The agent-ready Sanity kit for Next.js and Astro. Six years of decisions committed: page builder, fetch layer, AGENTS.md, skills, MCP servers, llms.txt. Buy once, own it forever.");
  const meta = section ? STUDIO_MANIFEST[section.type] : null;

  useEffect(() => {
    setActiveTab(section ? "content" : "page");
  }, [section]);

  return createPortal(
    <div ref={constraintsRef} className="studio-overlay">
      <motion.section
        className="studio-panel"
        role="dialog"
        aria-labelledby={titleId}
        drag
        dragListener={false}
        dragControls={controls}
        dragConstraints={constraintsRef}
        dragElastic={0}
        dragMomentum={false}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.95, transition: { duration: 0.18, ease: [0.7, 0, 0.25, 1] } }}
        transition={prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 360, damping: 28, mass: 0.9 }}
      >
        <div className="studio-panel__shell">
          <div className="studio-panel__header">
            <div className="studio-panel__header-handle" onPointerDown={(event) => controls.start(event)}>
              <span className="studio-panel__grip" aria-hidden="true">⋮⋮</span>
              <i aria-hidden="true" />
              <span id={!meta ? titleId : undefined}>Studio Mode</span>
            </div>
            <button type="button" onClick={onExit}>Exit ✕</button>
          </div>

          <div className="studio-panel__intro-block">
            {section && meta ? (
              <div className="studio-panel__selection">
                <div>Page Builder / Sections / #{section.index + 1}</div>
                <div id={titleId}><span aria-hidden="true">{meta.icon}</span><strong>{meta.title}</strong></div>
                <small>{section.type}</small>
              </div>
            ) : (
              <p className="studio-panel__intro">Click any highlighted field on the page to edit it live. A demo of Sanity Presentation: changes are local and reset on reload.</p>
            )}

            <nav className="studio-panel__tabs" aria-label="Studio fields">
              {STUDIO_TABS.map(([key, label]) => (
                <button className={activeTab === key ? "is-active" : ""} type="button" key={key} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </nav>
          </div>

          <div className="studio-panel__content">
            {activeTab === "page" ? (
              <div className="studio-panel__stack">
                <div className="studio-setting-static"><span>Password protect</span><i aria-hidden="true"><b /></i></div>
                <StudioSwitch checked={chrome.drawer} onChange={(value) => onChangeChrome("drawer", value)}>Show drawer button</StudioSwitch>
                <StudioSwitch checked={chrome.header} onChange={(value) => onChangeChrome("header", value)}>Show site header</StudioSwitch>
                <StudioSwitch checked={chrome.footer} onChange={(value) => onChangeChrome("footer", value)}>Show site footer</StudioSwitch>
                <StudioSwitch checked={chrome.minimap} onChange={(value) => onChangeChrome("minimap", value)}>Show minimap</StudioSwitch>
                <p className="studio-panel__note">{STUDIO_NOTE}</p>
              </div>
            ) : null}

            {activeTab === "content" ? (
              section ? (
                <StudioSectionEditor
                  focusField={activeField?.field || section.field}
                  key={`${section.type}:${section.index}`}
                  onChangeHero={onChangeHero}
                  onFocusField={(field) => onFocusField({ ...section, field })}
                  section={section}
                />
              ) : <p className="studio-panel__empty">Click a highlighted field on the page to edit its section.</p>
            ) : null}

            {activeTab === "seo" ? (
              <div className="studio-panel__stack studio-panel__form">
                <StudioSwitch checked={noIndex} onChange={setNoIndex}>No index</StudioSwitch>
                <label>SEO title<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></label>
                <label>Description<textarea rows="3" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></label>
                <label>Image<span className="studio-panel__image"><img alt="" src="/assets/content-architecture-og.png" /></span></label>
                <p className="studio-panel__note">{STUDIO_NOTE}</p>
              </div>
            ) : null}

            {activeTab === "agents" ? (
              <div className="studio-panel__stack studio-panel__form">
                <StudioSwitch checked={serveMarkdown} onChange={setServeMarkdown}>Serve Markdown to agents</StudioSwitch>
                <label>Content<span className="studio-panel__code"># Home{"\n\n"}_Built for agentic development._{"\n\n"}## The Sanity setup agents don't reinvent.</span></label>
                <p className="studio-panel__note">{STUDIO_NOTE}</p>
              </div>
            ) : null}
          </div>
        </div>
      </motion.section>
    </div>,
    document.body,
  );
}

export function StudioChrome({ chrome, heroContent, onChangeChrome, onChangeHero }) {
  const available = useStudioAvailability();
  const [armed, setArmed] = useState(false);
  const [section, setSection] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const returnFocusRef = useRef(null);

  const disarm = () => {
    setSection(null);
    setActiveField(null);
    setArmed(false);
  };

  useEffect(() => {
    if (available) return;
    disarm();
  }, [available]);

  useEffect(() => {
    if (armed) returnFocusRef.current = document.activeElement;
    if (!armed && returnFocusRef.current instanceof HTMLElement) {
      const target = returnFocusRef.current;
      const timer = setTimeout(() => target.focus({ preventScroll: true }), 10);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [armed]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!available || event.key !== "Escape") return;
      if (section) {
        setSection(null);
        setActiveField(null);
      } else if (armed) {
        disarm();
      }
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [armed, available, section]);

  const toggle = () => {
    if (!available) return;
    setSection(null);
    setActiveField(null);
    setArmed((current) => !current);
  };

  const openField = (field) => {
    setSection({ type: field.type, index: field.index, field: field.field });
    setActiveField(field);
  };

  return (
    <>
      {chrome.minimap ? <StudioMinimap armed={armed} onToggle={toggle} /> : null}
      {available && armed ? <StudioFieldOverlay activeField={activeField} onOpen={openField} /> : null}
      <AnimatePresence>
        {available && armed ? (
          <StudioPanel
            activeField={activeField}
            chrome={chrome}
            heroContent={heroContent}
            key="studio-panel"
            onChangeChrome={onChangeChrome}
            onChangeHero={onChangeHero}
            onExit={disarm}
            onFocusField={setActiveField}
            section={section}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
