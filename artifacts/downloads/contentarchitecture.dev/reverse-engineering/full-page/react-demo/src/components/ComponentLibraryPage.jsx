import { useEffect, useMemo, useState } from "react";
import { COMPONENT_CATALOG, COMPONENT_GROUPS } from "../componentCatalog.js";
import { ComponentPreview } from "./ComponentPreview.jsx";
import "./ComponentLibraryPage.css";

function selectedFromHash() {
  return window.location.hash.slice(1) || COMPONENT_CATALOG[0].id;
}

function ComponentCard({ component, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={`component-library-card ${isSelected ? "is-selected" : ""}`}
      onClick={() => onSelect(component.id)}
      aria-pressed={isSelected}
    >
      <span className="component-library-card__top"><small>{component.kind}</small><i>{component.reuse}</i></span>
      <strong>{component.name}</strong>
      <span>{component.description}</span>
      <code>{component.source}</code>
    </button>
  );
}

export function ComponentLibraryPage({ onNavigate }) {
  const [group, setGroup] = useState("all");
  const [selectedId, setSelectedId] = useState(selectedFromHash);
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(
    () => COMPONENT_CATALOG.filter((component) => group === "all" || component.group === group),
    [group],
  );
  const selected = COMPONENT_CATALOG.find((component) => component.id === selectedId) || COMPONENT_CATALOG[0];

  useEffect(() => {
    const onHashChange = () => setSelectedId(selectedFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function selectComponent(id) {
    setSelectedId(id);
    window.history.replaceState({}, "", `#${id}`);
    setCopied(false);
  }

  async function copyShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#${selected.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function returnToSite(event) {
    onNavigate(event.currentTarget, event);
  }

  return (
    <div className="component-library-page">
      <header className="component-library-header">
        <a href="/" onClick={returnToSite}>← Reconstructed site</a>
        <a className="component-library-header__all" href="/components/all" onClick={returnToSite}>Show all 32</a>
        <b>{COMPONENT_CATALOG.length} React components</b>
      </header>

      <main className="component-library-main">
        <section className="component-library-hero">
          <p>Content Architecture / Reverse engineering output</p>
          <h1>One place for every reconstructed component.</h1>
          <div>
            <span>32 exports</span><span>4 simple groups</span><span>Evidence-linked</span>
          </div>
        </section>

        <section className="component-library-workspace" aria-label="Component catalog">
          <aside className="component-library-sidebar">
            <p>Categories</p>
            <div role="tablist" aria-label="Component categories">
              {COMPONENT_GROUPS.map((item) => {
                const count = item.id === "all" ? COMPONENT_CATALOG.length : COMPONENT_CATALOG.filter((component) => component.group === item.id).length;
                return (
                  <button key={item.id} type="button" role="tab" aria-selected={group === item.id} onClick={() => setGroup(item.id)}>
                    <span>{item.label}</span><b>{count}</b>
                  </button>
                );
              })}
            </div>
            <p className="component-library-sidebar__note">Start with Page sections to understand the site. UI building blocks and Visual effects are the candidates to reuse elsewhere. Internal system components stay here for completeness.</p>
          </aside>

          <div className="component-library-grid" aria-live="polite">
            {filtered.map((component) => <ComponentCard key={component.id} component={component} isSelected={selected.id === component.id} onSelect={selectComponent} />)}
          </div>

          <aside className="component-library-detail" aria-label="Selected component">
            <p>Selected component</p>
            <h2>{selected.name}</h2>
            <div className="component-library-detail__preview">
              <span>Live React preview</span>
              <ComponentPreview componentId={selected.id} onNavigate={onNavigate} />
            </div>
            <dl>
              <div><dt>Category</dt><dd>{selected.kind}</dd></div>
              <div><dt>Reuse decision</dt><dd>{selected.reuse}</dd></div>
              <div><dt>Source</dt><dd><code>{selected.source}</code></dd></div>
              <div><dt>Observed evidence</dt><dd>{selected.evidence}</dd></div>
            </dl>
            <p className="component-library-detail__description">{selected.description}</p>
            <button type="button" onClick={copyShareLink}>{copied ? "Link copied" : "Copy share link"}</button>
            <small>{window.location.pathname}#{selected.id}</small>
          </aside>
        </section>
      </main>
    </div>
  );
}
