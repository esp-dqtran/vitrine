import type { CSSProperties } from "react";
import figjamStickyNoteTool from "../assets/figjam-sticky-note-tool.svg";
import figjamStickyNoteToolSource from "../assets/figjam-sticky-note-tool.svg?raw";

export interface ProjectStickyNoteColor {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  text: string;
}

export const projectStickyNoteColors: readonly ProjectStickyNoteColor[] = [
  { id: "white", name: "white", fill: "#ffffff", stroke: "#ffffff", text: "#252525" },
  { id: "gray", name: "gray", fill: "#e6e6e6", stroke: "#e6e6e6", text: "#252525" },
  { id: "red", name: "red", fill: "#ffafa3", stroke: "#ffafa3", text: "#252525" },
  { id: "orange", name: "orange", fill: "#ffd3a8", stroke: "#ffd3a8", text: "#252525" },
  { id: "yellow", name: "yellow", fill: "#ffe299", stroke: "#ffe299", text: "#252525" },
  { id: "green", name: "green", fill: "#b3efbd", stroke: "#b3efbd", text: "#252525" },
  { id: "teal", name: "teal", fill: "#b3f4ef", stroke: "#b3f4ef", text: "#252525" },
  { id: "blue", name: "blue", fill: "#a8daff", stroke: "#a8daff", text: "#252525" },
  { id: "violet", name: "violet", fill: "#d3bdff", stroke: "#d3bdff", text: "#252525" },
  { id: "pink", name: "pink", fill: "#ffa8db", stroke: "#ffa8db", text: "#252525" },
];

export const defaultProjectStickyNoteColor = projectStickyNoteColors[4];

export function StickyNoteGlyph({
  color,
  className,
}: {
  color?: ProjectStickyNoteColor;
  className?: string;
}) {
  const src = color
    ? `data:image/svg+xml,${encodeURIComponent(
      figjamStickyNoteToolSource.replaceAll("rgb(255 175 163)", color.fill),
    )}`
    : figjamStickyNoteTool;

  return (
    <img
      src={src}
      width="20"
      height="20"
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}

/** FigJam-style stack preview used by the placement trigger. */
export function StickyNotesCollageGlyph({
  color,
}: {
  color?: ProjectStickyNoteColor;
}) {
  return (
    <span className="project-sticky-notes-collage" aria-hidden="true">
      <StickyNoteGlyph
        color={color}
        className="project-sticky-notes-collage__note project-sticky-notes-collage__note--back"
      />
      <StickyNoteGlyph
        color={color}
        className="project-sticky-notes-collage__note project-sticky-notes-collage__note--middle"
      />
      <StickyNoteGlyph
        color={color}
        className="project-sticky-notes-collage__note project-sticky-notes-collage__note--front"
      />
    </span>
  );
}

export function ProjectStickyNotePicker({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: ProjectStickyNoteColor;
  onSelectColor(color: ProjectStickyNoteColor): void;
}) {
  return (
    <div className="project-sticky-note-picker" role="toolbar" aria-label="Sticky options">
      <div className="project-sticky-note-picker__colors" role="radiogroup" aria-label="Sticky color">
        {projectStickyNoteColors.map((color) => (
          <button
            key={color.id}
            type="button"
            className="project-sticky-note-picker__swatch"
            role="radio"
            aria-label={color.name}
            aria-checked={selectedColor.id === color.id}
            title={color.name}
            style={{ "--sticky-fill": color.fill, "--sticky-stroke": color.stroke } as CSSProperties}
            onClick={() => onSelectColor(color)}
          />
        ))}
      </div>
    </div>
  );
}
