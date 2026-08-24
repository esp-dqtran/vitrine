import { useEffect, useRef, useState } from "react";
import { COMPONENT_CATALOG, COMPONENT_GROUPS } from "../componentCatalog.js";
import { ComponentPreview } from "./ComponentPreview.jsx";
import "./FullComponentGalleryPage.css";

function LazyComponent({ component, onNavigate }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || ready) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "900px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <article id={component.id} ref={ref} className="full-component-item">
      <header>
        <span>{component.kind}</span>
        <h2>{component.name}</h2>
        <code>{component.source}</code>
      </header>
      <div className="full-component-item__stage">
        {ready ? <ComponentPreview componentId={component.id} onNavigate={onNavigate} /> : <div className="full-component-item__placeholder">Loading {component.name}…</div>}
      </div>
    </article>
  );
}

export function FullComponentGalleryPage({ onNavigate }) {
  function goToCatalog(event) {
    onNavigate(event.currentTarget, event);
  }

  return (
    <div className="full-component-gallery-page">
      <header className="full-component-gallery-header">
        <a href="/components" onClick={goToCatalog}>← Component inventory</a>
        <span>Full gallery</span>
        <b>{COMPONENT_CATALOG.length} mounted on demand</b>
      </header>
      <main>
        <section className="full-component-gallery-hero">
          <p>Content Architecture / React reconstruction</p>
          <h1>All {COMPONENT_CATALOG.length} components.</h1>
          <p>Scroll to see each component at its full implementation size. Components mount only near the viewport, so the heavy canvas and WebGL work stays responsive.</p>
          <nav aria-label="Jump to component categories">
            {COMPONENT_GROUPS.filter((group) => group.id !== "all").map((group) => <a href={`#group-${group.id}`} key={group.id}>{group.label}</a>)}
          </nav>
        </section>

        {COMPONENT_GROUPS.filter((group) => group.id !== "all").map((group) => {
          const components = COMPONENT_CATALOG.filter((component) => component.group === group.id);
          return (
            <section className="full-component-group" id={`group-${group.id}`} key={group.id}>
              <header><div><span>{group.label}</span><p>{group.description}</p></div><b>{components.length}</b></header>
              {components.map((component) => <LazyComponent key={component.id} component={component} onNavigate={onNavigate} />)}
            </section>
          );
        })}
      </main>
    </div>
  );
}
