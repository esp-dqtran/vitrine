import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Check,
  Code,
  Copy,
  Crosshair,
  DownloadSimple,
  GlobeSimple,
  MagicWand,
  CursorClick,
  SpinnerGap,
} from "@phosphor-icons/react";

const DEFAULT_URL = "https://www.contentarchitecture.dev/";

async function request(path, options) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function IconButton({ label, children, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ScopeOption({ checked, label, onChange }) {
  return (
    <label className="scope-option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="scope-option__check" aria-hidden="true">
        <Check size={12} weight="bold" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [page, setPage] = useState(null);
  const [selection, setSelection] = useState(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [browserConnected, setBrowserConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState(
    "Keep the visual structure, responsive behavior, and hover interactions faithful to the source.",
  );
  const [scope, setScope] = useState({
    structure: true,
    styles: true,
    behavior: true,
    assets: true,
  });
  const [job, setJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function openPage(nextUrl = url) {
    setLoading(true);
    setError("");
    setSelection(null);
    setJob(null);
    try {
      const nextPage = await request("/api/browser/open", {
        method: "POST",
        body: JSON.stringify({ url: nextUrl }),
      });
      setPage(nextPage);
      setUrl(nextPage.url);
      setBrowserConnected(true);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    openPage(DEFAULT_URL);
    // Initial browser boot only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const events = new EventSource("/api/browser/events");
    events.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "browser") {
          setBrowserConnected(Boolean(message.connected));
        }
        if (message.type === "page") {
          setPage(message.page);
          setUrl(message.page.url);
          setBrowserConnected(true);
        }
        if (message.type === "inspect") {
          setInspectMode(Boolean(message.active));
        }
        if (message.type === "selection") {
          setSelection(message.selection);
          setInspectMode(false);
          setJob(null);
        }
      } catch {
        // Ignore malformed keep-alive data and reconnect automatically.
      }
    };
    return () => events.close();
  }, []);

  async function browserCommand(path, body) {
    setLoading(true);
    setError("");
    try {
      const nextPage = await request(path, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      setPage(nextPage);
      setUrl(nextPage.url);
      setBrowserConnected(true);
      setSelection(null);
      setJob(null);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  async function focusBrowser() {
    setLoading(true);
    setError("");
    try {
      const nextPage = await request("/api/browser/focus", {
        method: "POST",
        body: "{}",
      });
      setPage(nextPage);
      setUrl(nextPage.url);
      setBrowserConnected(true);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleInspect() {
    setError("");
    setJob(null);
    if (!inspectMode) setSelection(null);
    try {
      const result = await request(
        inspectMode ? "/api/browser/inspect/stop" : "/api/browser/inspect/start",
        { method: "POST", body: "{}" },
      );
      setInspectMode(Boolean(result.active));
      setBrowserConnected(true);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function reverseEngineer() {
    if (!selection) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await request("/api/reverse-engineer", {
        method: "POST",
        body: JSON.stringify({ selection, scope, instructions }),
      });
      setJob(result);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copySelector() {
    if (selection?.selector) await navigator.clipboard.writeText(selection.selector);
  }

  function downloadRequest() {
    if (!job) return;
    const blob = new Blob([JSON.stringify({ ...job, selection }, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `${job.requestId}.json`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Vitrines</div>
        <nav className="topbar__nav" aria-label="Primary">
          <button type="button">Apps</button>
          <button type="button">Sites</button>
          <button type="button">Flows</button>
          <button type="button" className="is-active">Reverse engineer</button>
        </nav>
        <div className="topbar__status">
          <span className={`status-dot ${browserConnected ? "" : "is-connecting"}`} />
          {browserConnected ? "Direct browser connected" : "Opening direct browser…"}
        </div>
        <button type="button" className="account-button" aria-label="Account menu">
          K
        </button>
      </header>

      <main className="workspace">
        <section className="browser-panel" aria-label="Browser preview">
          <div className="browser-toolbar">
            <div className="browser-toolbar__history">
              <IconButton
                label="Go back"
                onClick={() => browserCommand("/api/browser/back")}
                disabled={!page || loading}
              >
                <ArrowLeft size={17} />
              </IconButton>
              <IconButton
                label="Go forward"
                onClick={() => browserCommand("/api/browser/forward")}
                disabled={!page || loading}
              >
                <ArrowRight size={17} />
              </IconButton>
              <IconButton
                label="Reload"
                onClick={() => browserCommand("/api/browser/reload")}
                disabled={!page || loading}
              >
                <ArrowClockwise size={17} />
              </IconButton>
            </div>

            <form
              className="address-bar"
              onSubmit={(event) => {
                event.preventDefault();
                openPage(url);
              }}
            >
              <GlobeSimple size={16} />
              <input
                aria-label="Page URL"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                spellCheck="false"
              />
              {loading ? <SpinnerGap className="spin" size={16} /> : null}
            </form>

            <button
              type="button"
              className={`inspect-button ${inspectMode ? "is-active" : ""}`}
              aria-pressed={inspectMode}
              onClick={toggleInspect}
              disabled={!page || loading}
            >
              <Crosshair size={17} weight={inspectMode ? "fill" : "regular"} />
              {inspectMode ? "Cancel" : "Select"}
            </button>
          </div>

          <div className="browser-meta">
            <div>
              <span className="browser-meta__eyebrow">Native browser session</span>
              <strong>{page?.title || "Opening page…"}</strong>
            </div>
            <div className="browser-meta__status">
              <span className={inspectMode ? "is-inspecting" : "is-live"}>
                {inspectMode ? "Selecting in browser" : "Live browser window"}
              </span>
              <span>{page ? `${page.viewport.width} × ${page.viewport.height}` : "—"}</span>
            </div>
          </div>

          <div className="direct-browser-stage">
            <div className="direct-browser-card">
              <div className="direct-browser-card__top">
                <span className="direct-browser-card__icon">
                  <GlobeSimple size={24} />
                </span>
                <span className="direct-browser-card__status">
                  <span className={browserConnected ? "" : "is-connecting"} />
                  {browserConnected ? "Browser window open" : "Opening browser…"}
                </span>
              </div>

              <h2>Browse at native speed</h2>
              <p>
                The source website is running in its own Chromium window with its real
                animations, scrolling, inputs, and links. This workspace only receives a
                component snapshot after you select one.
              </p>

              <div className="direct-browser-actions">
                <button type="button" onClick={focusBrowser} disabled={!page || loading}>
                  <ArrowSquareOut size={17} />
                  Open browser
                </button>
                <button
                  type="button"
                  className={inspectMode ? "is-active" : ""}
                  onClick={toggleInspect}
                  disabled={!page || loading}
                >
                  <Crosshair size={17} weight={inspectMode ? "fill" : "regular"} />
                  {inspectMode ? "Cancel selection" : "Select component"}
                </button>
              </div>

              <ol className="direct-browser-steps">
                <li className={page ? "is-complete" : "is-current"}>
                  <span>{page ? <Check size={12} weight="bold" /> : "1"}</span>
                  <strong>Browse</strong>
                  <small>Use the real page normally</small>
                </li>
                <li className={inspectMode ? "is-current" : selection ? "is-complete" : ""}>
                  <span>{selection ? <Check size={12} weight="bold" /> : "2"}</span>
                  <strong>Select</strong>
                  <small>Start the DOM selector</small>
                </li>
                <li className={selection ? "is-complete" : inspectMode ? "is-current" : ""}>
                  <span>{selection ? <Check size={12} weight="bold" /> : "3"}</span>
                  <strong>Click</strong>
                  <small>Choose an element in Chromium</small>
                </li>
              </ol>

              {inspectMode ? (
                <div className="direct-inspect-callout">
                  <Crosshair size={18} weight="fill" />
                  Selection is active in Chromium. Hover to inspect the real DOM, click to
                  capture, or press Escape to cancel.
                </div>
              ) : null}
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <aside className="selection-panel" aria-label="Reverse engineering request">
          <div className="selection-panel__heading">
            <div>
              <span className="eyebrow">Component inspector</span>
              <h1>Choose what to rebuild</h1>
            </div>
            <span className="step-count">{job ? "3 / 3" : selection ? "2 / 3" : "1 / 3"}</span>
          </div>

          <ol className="workflow-steps">
            <li className={page ? "is-complete" : "is-current"}>
              <span>{page ? <Check size={12} weight="bold" /> : "1"}</span>
              Load page
            </li>
            <li className={selection ? "is-complete" : page ? "is-current" : ""}>
              <span>{selection ? <Check size={12} weight="bold" /> : "2"}</span>
              Select component
            </li>
            <li className={job ? "is-complete" : selection ? "is-current" : ""}>
              <span>{job ? <Check size={12} weight="bold" /> : "3"}</span>
              Create request
            </li>
          </ol>

          {!selection ? (
            <div className="selection-empty">
              <span className="selection-empty__icon">
                <CursorClick size={30} />
              </span>
              <h2>Select in the real browser</h2>
              <p>
                Focus the Chromium window, browse normally, then start the selector and
                click the component you want to reverse engineer.
              </p>
            </div>
          ) : (
            <div className="selection-content">
              <article className="selected-card">
                {selection.preview ? (
                  <img src={selection.preview} alt="Selected component preview" />
                ) : null}
                <div className="selected-card__body">
                  <div className="selected-card__title">
                    <div>
                      <span>{selection.tag}</span>
                      <h2>{selection.componentName}</h2>
                    </div>
                    <a href={selection.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open source page">
                      <ArrowSquareOut size={17} />
                    </a>
                  </div>
                  <div className="selector-row">
                    <code>{selection.selector}</code>
                    <button type="button" onClick={copySelector} aria-label="Copy selector">
                      <Copy size={15} />
                    </button>
                  </div>
                  <dl className="selection-stats">
                    <div>
                      <dt>Size</dt>
                      <dd>{Math.round(selection.rect.width)} × {Math.round(selection.rect.height)}</dd>
                    </div>
                    <div>
                      <dt>Children</dt>
                      <dd>{selection.childCount}</dd>
                    </div>
                    <div>
                      <dt>Display</dt>
                      <dd>{selection.styles.display}</dd>
                    </div>
                  </dl>
                </div>
              </article>

              <fieldset className="scope-fieldset">
                <legend>Reverse-engineering scope</legend>
                <div className="scope-grid">
                  {[
                    ["structure", "Structure & layout"],
                    ["styles", "Styles & tokens"],
                    ["behavior", "Interaction behavior"],
                    ["assets", "Assets & fonts"],
                  ].map(([key, label]) => (
                    <ScopeOption
                      key={key}
                      label={label}
                      checked={scope[key]}
                      onChange={() => setScope((current) => ({ ...current, [key]: !current[key] }))}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="instructions-field">
                <span>Instructions</span>
                <textarea
                  rows="3"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>

              {!job ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={reverseEngineer}
                  disabled={submitting}
                >
                  {submitting ? <SpinnerGap className="spin" size={18} /> : <MagicWand size={18} weight="fill" />}
                  {submitting ? "Creating request…" : "Reverse engineer component"}
                </button>
              ) : (
                <div className="request-success">
                  <div className="request-success__icon">
                    <Code size={20} />
                  </div>
                  <div>
                    <span>Request ready</span>
                    <strong>{job.requestId}</strong>
                    <p>{job.deliverables.join(" · ")}</p>
                  </div>
                  <button type="button" onClick={downloadRequest} aria-label="Download request">
                    <DownloadSimple size={17} />
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
