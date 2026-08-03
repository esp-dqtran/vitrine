import { Button, Icon, IconButton } from "@astryxdesign/core";

export type ProjectResearchFrameType =
  | "question"
  | "evidence"
  | "insights"
  | "concepts"
  | "decision"
  | "handoff"
  | "custom";

export interface ProjectResearchFramePreset {
  id: Exclude<ProjectResearchFrameType, "custom">;
  title: string;
  description: string;
}

export interface ProjectResearchFrameItem {
  elementId: string;
  type: ProjectResearchFrameType;
  title: string;
  itemCount: number;
}

export const projectResearchFramePresets: readonly ProjectResearchFramePreset[] = [
  {
    id: "question",
    title: "Research question",
    description: "Frame the problem, audience, and assumptions to validate.",
  },
  {
    id: "evidence",
    title: "Evidence",
    description: "Collect screens, flows, references, and observed behavior.",
  },
  {
    id: "insights",
    title: "Insights",
    description: "Cluster repeated patterns, friction, and opportunity signals.",
  },
  {
    id: "concepts",
    title: "Concepts",
    description: "Explore candidate directions before committing to one.",
  },
  {
    id: "decision",
    title: "Decision",
    description: "Record the chosen direction, rationale, and open risks.",
  },
  {
    id: "handoff",
    title: "Developer handoff",
    description: "Keep final screens, states, notes, and implementation context together.",
  },
];

function framePositionLabel(index: number, total: number): string {
  if (!total) return "No frames yet";
  return `${index + 1} of ${total}`;
}

export function ProjectResearchFramePicker({
  frames,
  selectedFrameId,
  onCreate,
  onDraw,
  onFocus,
  onClose,
}: {
  frames: readonly ProjectResearchFrameItem[];
  selectedFrameId?: string;
  onCreate(preset: ProjectResearchFramePreset): void;
  onDraw(): void;
  onFocus(elementId: string): void;
  onClose(): void;
}) {
  const selectedIndex = Math.max(0, frames.findIndex((frame) => frame.elementId === selectedFrameId));
  const activeFrame = frames[selectedIndex];
  const canNavigate = frames.length > 0;

  const focusRelativeFrame = (offset: number) => {
    if (!frames.length) return;
    const nextIndex = (selectedIndex + offset + frames.length) % frames.length;
    onFocus(frames[nextIndex].elementId);
  };

  return (
    <aside className="project-research-frames" role="dialog" aria-label="Research frames">
      <header className="project-research-frames__header">
        <div>
          <span>Organize the canvas</span>
          <h2>Research frames</h2>
          <p>Group evidence and decisions into navigable stages.</p>
        </div>
        <IconButton
          label="Close research frames"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          clickAction={onClose}
        />
      </header>

      <div className="project-research-frames__presets" aria-label="Research frame presets">
        {projectResearchFramePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="project-research-frames__preset"
            data-frame-type={preset.id}
            onClick={() => onCreate(preset)}
          >
            <span className="project-research-frames__preset-mark" aria-hidden="true" />
            <span>
              <strong>{preset.title}</strong>
              <small>{preset.description}</small>
            </span>
          </button>
        ))}
      </div>

      <Button
        label="Draw custom frame"
        variant="secondary"
        size="sm"
        clickAction={onDraw}
      />

      <section className="project-research-frames__navigator" aria-label="Frame navigator">
        <div className="project-research-frames__navigator-heading">
          <span>Canvas frames</span>
          <small>{framePositionLabel(selectedIndex, frames.length)}</small>
        </div>
        {activeFrame ? (
          <button
            type="button"
            className="project-research-frames__active-frame"
            onClick={() => onFocus(activeFrame.elementId)}
          >
            <span className="project-research-frames__preset-mark" data-frame-type={activeFrame.type} aria-hidden="true" />
            <span>
              <strong>{activeFrame.title}</strong>
              <small>{activeFrame.itemCount} {activeFrame.itemCount === 1 ? "item" : "items"}</small>
            </span>
          </button>
        ) : (
          <p className="project-research-frames__empty">
            Start with a preset or draw a frame around existing canvas work.
          </p>
        )}
        <div className="project-research-frames__navigation-actions">
          <Button
            label="Previous"
            variant="ghost"
            size="sm"
            isDisabled={!canNavigate}
            clickAction={() => focusRelativeFrame(-1)}
          />
          <Button
            label="Next"
            variant="ghost"
            size="sm"
            isDisabled={!canNavigate}
            clickAction={() => focusRelativeFrame(1)}
          />
        </div>
      </section>
    </aside>
  );
}
