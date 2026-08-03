import { Button } from "@astryxdesign/core";
import type { CSSProperties } from "react";

export interface ProjectStickyNoteColor {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  text: string;
}

export const projectStickyNoteColors: readonly ProjectStickyNoteColor[] = [
  { id: "light-yellow", name: "light yellow", fill: "#fff4a3", stroke: "#e3d16a", text: "#252525" },
  { id: "yellow", name: "yellow", fill: "#ffd966", stroke: "#dfba4d", text: "#252525" },
  { id: "orange", name: "orange", fill: "#ffb36b", stroke: "#dc9252", text: "#252525" },
  { id: "red", name: "red", fill: "#f08a8a", stroke: "#cf6c6c", text: "#252525" },
  { id: "light-pink", name: "light pink", fill: "#f6c1e8", stroke: "#d6a1c8", text: "#252525" },
  { id: "pink", name: "pink", fill: "#ec8bd8", stroke: "#c96fb6", text: "#252525" },
  { id: "light-blue", name: "light blue", fill: "#a9c7f5", stroke: "#89a7d4", text: "#252525" },
  { id: "violet", name: "violet", fill: "#ad99eb", stroke: "#8e78cc", text: "#252525" },
  { id: "blue", name: "blue", fill: "#78a7e8", stroke: "#5f88c1", text: "#252525" },
  { id: "dark-blue", name: "dark blue", fill: "#4f79c8", stroke: "#3c60a3", text: "#ffffff" },
  { id: "cyan", name: "cyan", fill: "#83d5e7", stroke: "#62b5c7", text: "#252525" },
  { id: "dark-green", name: "dark green", fill: "#61c7b8", stroke: "#46a797", text: "#252525" },
  { id: "light-green", name: "light green", fill: "#bfe68c", stroke: "#9fc26f", text: "#252525" },
  { id: "green", name: "green", fill: "#7ccf83", stroke: "#5caf64", text: "#252525" },
  { id: "gray", name: "gray", fill: "#e5e7eb", stroke: "#c4c7ce", text: "#252525" },
  { id: "black", name: "black", fill: "#222222", stroke: "#090909", text: "#ffffff" },
];

export function StickyNoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M5.5 3.75h13v10.5l-5.75 5.75H5.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12.75 20v-5.75h5.75" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function ProjectStickyNotePicker({
  onSelectColor,
  onCreateStack,
}: {
  onSelectColor(color: ProjectStickyNoteColor): void;
  onCreateStack(color: ProjectStickyNoteColor): void;
}) {
  return (
    <div className="project-sticky-note-picker" role="dialog" aria-label="Sticky notes">
      <div className="project-sticky-note-picker__header">
        <strong>Sticky notes</strong>
        <span>Choose a color, then click the canvas.</span>
      </div>
      <div className="project-sticky-note-picker__colors" aria-label="Sticky note color choices">
        {projectStickyNoteColors.map((color) => (
          <button
            key={color.id}
            type="button"
            className="project-sticky-note-picker__swatch"
            aria-label={`Place ${color.name} sticky note`}
            title={color.name}
            style={{ "--sticky-fill": color.fill, "--sticky-stroke": color.stroke } as CSSProperties}
            onClick={() => onSelectColor(color)}
          />
        ))}
      </div>
      <div className="project-sticky-note-picker__actions">
        <Button
          label="Place a stack"
          variant="secondary"
          size="sm"
          clickAction={() => onCreateStack(projectStickyNoteColors[0])}
        />
      </div>
    </div>
  );
}
