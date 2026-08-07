import { Button, Card, TextInput } from "@astryxdesign/core";
import type { ResearchProjectItem, ResearchProjectWorkspace } from "../../researchProject.ts";

export type ProjectReferenceState = "idle" | "loading" | "ready" | "error";

export function ProjectReferencePanel({
  workspace,
  state,
  query,
  message,
  insertingId,
  onQueryChange,
  onInsert,
  onRetry,
  onClose,
}: {
  workspace?: ResearchProjectWorkspace;
  state: ProjectReferenceState;
  query: string;
  message: string;
  insertingId?: number;
  onQueryChange(value: string): void;
  onInsert(item: ResearchProjectItem): void;
  onRetry(): void;
  onClose(): void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const items = workspace?.lanes.flatMap((lane) => lane.items.map((item) => ({
    item,
    laneTitle: lane.title,
  }))).filter(({ item, laneTitle }) => {
    if (!normalizedQuery) return true;
    return [
      item.stepLabel,
      item.snapshot.title,
      item.snapshot.app,
      item.snapshot.platform,
      item.snapshot.flow,
      item.note,
      laneTitle,
      ...item.tags,
    ].filter(Boolean).some((value) => (
      String(value).toLocaleLowerCase().includes(normalizedQuery)
    ));
  }) ?? [];

  return (
    <aside className="project-playground__references" aria-label="Project references">
      <header className="project-playground__references-header">
        <div>
          <h2>Project references</h2>
          <p>Add collected evidence to this canvas.</p>
        </div>
        <Button label="Close" variant="ghost" size="sm" onClick={onClose} />
      </header>
      <TextInput
        label="Search project references"
        isLabelHidden
        value={query}
        onChange={onQueryChange}
        placeholder="Search references…"
        width="100%"
      />
      {message && (
        <p className="project-playground__reference-message" role="status">
          {message}
        </p>
      )}
      {state === "loading" && (
        <p className="project-playground__reference-empty" role="status">
          Loading references…
        </p>
      )}
      {state === "error" && (
        <div className="project-playground__reference-empty" role="alert">
          <p>References could not be loaded.</p>
          <Button label="Retry" variant="secondary" size="sm" clickAction={onRetry} />
        </div>
      )}
      {state === "ready" && (
        <div className="project-playground__reference-list">
          {items.map(({ item, laneTitle }) => (
            <Card key={item.id} padding={2} className="project-playground__reference-card">
              <div className="project-playground__reference-preview">
                {item.mediaUrl && !item.restricted
                  ? <img src={item.mediaUrl} alt="" loading="lazy" decoding="async" />
                  : <span>Preview unavailable</span>}
              </div>
              <div className="project-playground__reference-copy">
                <strong>{item.stepLabel || item.snapshot.title}</strong>
                <span>
                  {[item.snapshot.app, item.snapshot.platform, laneTitle]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <Button
                label={insertingId === item.id ? "Adding…" : "Add to canvas"}
                variant="secondary"
                size="sm"
                isDisabled={!item.mediaUrl || item.restricted || insertingId !== undefined}
                clickAction={() => onInsert(item)}
              />
            </Card>
          ))}
          {!items.length && (
            <p className="project-playground__reference-empty">
              No matching references in this project.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
