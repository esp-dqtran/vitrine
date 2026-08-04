import { useRef } from "react";
import { Button, Icon, IconButton, TextInput } from "@astryxdesign/core";

export type ProjectMoodboardSectionId =
  | "unsorted"
  | "direction-a"
  | "direction-b"
  | "direction-c"
  | "final-direction";

export type ProjectMoodboardDecision = "keep" | "maybe" | "reject";

export interface ProjectMoodboardReference {
  elementId: string;
  sourceKind: "project-reference" | "screen" | "upload";
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  caption: string;
  decision: ProjectMoodboardDecision;
  sectionId?: ProjectMoodboardSectionId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectMoodboardSectionPreset {
  id: ProjectMoodboardSectionId;
  title: string;
  description: string;
}

export function layoutMoodboardReferenceInSection({
  image,
  section,
  occupiedCount,
}: {
  image: { width: number; height: number };
  section: { x: number; y: number; width: number; height: number };
  occupiedCount: number;
}) {
  const horizontalPadding = 32;
  const columnGap = 24;
  const rowGap = 34;
  const headerSpace = 64;
  const cellWidth = Math.max(
    120,
    (section.width - horizontalPadding * 2 - columnGap) / 2,
  );
  const cellHeight = 230;
  const scale = Math.min(
    1,
    cellWidth / Math.max(1, image.width),
    cellHeight / Math.max(1, image.height),
  );
  const width = Math.max(80, Math.round(image.width * scale));
  const height = Math.max(80, Math.round(image.height * scale));
  const column = occupiedCount % 2;
  const row = Math.floor(occupiedCount / 2);
  const x = section.x + horizontalPadding + column * (cellWidth + columnGap);
  const y = section.y + headerSpace + row * (cellHeight + rowGap);
  return {
    x,
    y,
    width,
    height,
    requiredFrameHeight: Math.max(
      section.height,
      headerSpace + row * (cellHeight + rowGap) + height + horizontalPadding,
    ),
  };
}

export const projectMoodboardSectionPresets: readonly ProjectMoodboardSectionPreset[] = [
  {
    id: "unsorted",
    title: "Unsorted",
    description: "New references land here before they have a direction.",
  },
  {
    id: "direction-a",
    title: "Direction A",
    description: "Explore the first coherent visual territory.",
  },
  {
    id: "direction-b",
    title: "Direction B",
    description: "Keep a meaningfully different alternative visible.",
  },
  {
    id: "direction-c",
    title: "Direction C",
    description: "Use only when the project needs a third route.",
  },
  {
    id: "final-direction",
    title: "Final direction",
    description: "Collect the references that define the chosen language.",
  },
];

export function ProjectMoodboardPanel({
  sectionIds,
  referenceCount,
  decisionCounts,
  message,
  onOpenProjectReferences,
  onOpenScreens,
  onUpload,
  onCreateSection,
  onCreateStarter,
  onClose,
  readOnly,
}: {
  sectionIds: readonly ProjectMoodboardSectionId[];
  referenceCount: number;
  decisionCounts: Record<ProjectMoodboardDecision, number>;
  message: string;
  onOpenProjectReferences(): void;
  onOpenScreens(): void;
  onUpload(files: readonly File[]): void;
  onCreateSection(section: ProjectMoodboardSectionPreset): void;
  onCreateStarter(): void;
  onClose(): void;
  readOnly: boolean;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const hasStarter = sectionIds.includes("unsorted")
    && sectionIds.includes("direction-a")
    && sectionIds.includes("direction-b")
    && sectionIds.includes("final-direction");

  return (
    <aside
      className="project-moodboard-panel"
      role="dialog"
      aria-label="Moodboard mode"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="project-moodboard-panel__header">
        <div>
          <span>Vitrines canvas</span>
          <h2>Moodboard</h2>
          <p>Collect visual evidence, shape directions, and record what belongs.</p>
        </div>
        <IconButton
          label="Close moodboard"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          clickAction={onClose}
        />
      </header>

      <section className="project-moodboard-panel__section">
        <div className="project-moodboard-panel__section-heading">
          <div>
            <span>01</span>
            <strong>Inspiration inbox</strong>
          </div>
          <small>{referenceCount} on this board</small>
        </div>
        <p>Everything enters through Unsorted with its source attached.</p>
        <div className="project-moodboard-panel__source-actions">
          <Button
            label="Project references"
            variant="secondary"
            size="sm"
            clickAction={onOpenProjectReferences}
            isDisabled={readOnly}
          />
          <Button
            label="Browse screens"
            variant="secondary"
            size="sm"
            clickAction={onOpenScreens}
            isDisabled={readOnly}
          />
          <Button
            label="Upload images"
            variant="secondary"
            size="sm"
            clickAction={() => uploadRef.current?.click()}
            isDisabled={readOnly}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            disabled={readOnly}
            onChange={(event) => {
              const files = [...(event.currentTarget.files ?? [])];
              if (files.length > 0) onUpload(files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </section>

      <section className="project-moodboard-panel__section">
        <div className="project-moodboard-panel__section-heading">
          <div>
            <span>02</span>
            <strong>Board structure</strong>
          </div>
          {!hasStarter ? (
            <Button
              label="Set up board"
              variant="primary"
              size="sm"
              clickAction={onCreateStarter}
              isDisabled={readOnly}
            />
          ) : <small>Ready</small>}
        </div>
        <div className="project-moodboard-panel__sections">
          {projectMoodboardSectionPresets.map((section) => {
            const exists = sectionIds.includes(section.id);
            return (
              <button
                key={section.id}
                type="button"
                disabled={readOnly || exists}
                onClick={() => onCreateSection(section)}
              >
                <span aria-hidden="true">{exists ? "Added" : "Add"}</span>
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="project-moodboard-panel__section project-moodboard-panel__decisions">
        <div className="project-moodboard-panel__section-heading">
          <div>
            <span>03</span>
            <strong>Reference decisions</strong>
          </div>
        </div>
        <div className="project-moodboard-panel__decision-counts" aria-label="Moodboard decisions">
          <span data-decision="keep"><strong>{decisionCounts.keep}</strong> Keep</span>
          <span data-decision="maybe"><strong>{decisionCounts.maybe}</strong> Maybe</span>
          <span data-decision="reject"><strong>{decisionCounts.reject}</strong> Reject</span>
        </div>
        <p>Select a reference on the canvas to add context and decide whether it belongs.</p>
      </section>

      {readOnly ? (
        <p className="project-moodboard-panel__readonly" role="status">
          View-only access. Ask a project editor to change this moodboard.
        </p>
      ) : null}

      {message ? <p className="project-moodboard-panel__message" role="status">{message}</p> : null}
    </aside>
  );
}

export function ProjectMoodboardReferenceInspector({
  reference,
  onCaptionChange,
  onDecisionChange,
  sections,
  onSectionChange,
  onOpenSource,
  onClose,
  readOnly,
}: {
  reference: ProjectMoodboardReference;
  onCaptionChange(value: string): void;
  onDecisionChange(value: ProjectMoodboardDecision): void;
  sections: readonly { id: ProjectMoodboardSectionId; title: string }[];
  onSectionChange(value: ProjectMoodboardSectionId): void;
  onOpenSource?(): void;
  onClose(): void;
  readOnly: boolean;
}) {
  const sourceKindLabel = reference.sourceKind === "project-reference"
    ? "Project reference"
    : reference.sourceKind === "screen"
      ? "Vitrines screen"
      : "Uploaded image";

  return (
    <aside className="project-moodboard-reference" aria-label="Selected moodboard reference">
      <header className="project-screen-inspector__header">
        <span className="project-screen-inspector__icon" aria-hidden="true">
          <Icon icon="viewColumns" size="sm" />
        </span>
        <div>
          <span>{sourceKindLabel}</span>
          <strong>{reference.sourceLabel}</strong>
        </div>
        <IconButton
          label="Close reference inspector"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          clickAction={onClose}
        />
      </header>

      <TextInput
        label="Why I saved this"
        value={reference.caption}
        onChange={onCaptionChange}
        placeholder="Add the design signal or reason…"
        width="100%"
        isDisabled={readOnly}
      />

      <div className="project-moodboard-reference__decisions" role="group" aria-label="Reference decision">
        {(["keep", "maybe", "reject"] as const).map((decision) => (
          <Button
            key={decision}
            label={decision[0].toUpperCase() + decision.slice(1)}
            variant={reference.decision === decision ? "primary" : "secondary"}
            size="sm"
            clickAction={() => onDecisionChange(decision)}
            isDisabled={readOnly}
          />
        ))}
      </div>

      <label className="project-moodboard-reference__section-field">
        <span>Move to section</span>
        <select
          value={reference.sectionId ?? ""}
          disabled={readOnly || sections.length === 0}
          onChange={(event) => {
            if (event.currentTarget.value) {
              onSectionChange(event.currentTarget.value as ProjectMoodboardSectionId);
            }
          }}
        >
          <option value="" disabled>Choose a section</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>{section.title}</option>
          ))}
        </select>
      </label>

      {readOnly ? (
        <p className="project-moodboard-reference__readonly" role="status">
          View-only access. Decisions and placement are locked.
        </p>
      ) : null}

      {onOpenSource ? (
        <Button
          label="Open source"
          variant="secondary"
          size="sm"
          clickAction={onOpenSource}
        />
      ) : null}
    </aside>
  );
}
