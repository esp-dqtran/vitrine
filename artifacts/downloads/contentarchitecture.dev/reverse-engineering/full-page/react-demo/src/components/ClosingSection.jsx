import { PullWindow, PullWindowHandle } from "./PullWindow.jsx";

export function ClosingAsciiPanel({ ascii, title = "The content architecture" }) {
  return (
    <PullWindow className="closing-window">
      <div className="closing-card">
        <div className="closing-card__inner">
          <PullWindowHandle className="closing-card__header">
            <span>{title}</span>
          </PullWindowHandle>
          <div className="closing-card__body">
            <pre role="img" aria-label={"The next 3 days\nare yours."}>{ascii}</pre>
          </div>
        </div>
      </div>
    </PullWindow>
  );
}

export function ClosingSection({ ascii, title = "The content architecture" }) {
  return (
    <section className="closing-section" data-page-builder-section="calloutSection">
      <ClosingAsciiPanel ascii={ascii} title={title} />
    </section>
  );
}
