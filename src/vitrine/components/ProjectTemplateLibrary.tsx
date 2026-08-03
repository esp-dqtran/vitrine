import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, TextInput } from "@astryxdesign/core";

export type ProjectTemplateCategory =
  | "Moodboards"
  | "Research"
  | "Flows"
  | "Wireframes";

export interface ProjectTemplateElement {
  type: "rectangle" | "text" | "arrow";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "solid";
  strokeWidth?: number;
  roundness?: { type: 3 };
  points?: readonly (readonly [number, number])[];
}

export interface ProjectCanvasTemplate {
  id: string;
  title: string;
  category: ProjectTemplateCategory;
  description: string;
  elements: readonly ProjectTemplateElement[];
}

const ink = "#1f2937";
const mutedInk = "#64748b";
const border = "#94a3b8";
const panel = "#f8fafc";
const accent = "#dbeafe";
const highlight = "#fef3c7";

export const projectCanvasTemplates: readonly ProjectCanvasTemplate[] = [
  {
    id: "moodboard-starter",
    title: "Moodboard starter",
    category: "Moodboards",
    description: "A title, three inspiration zones, and space for a visual direction.",
    elements: [
      { type: "text", x: 0, y: 0, text: "Moodboard", fontSize: 32, strokeColor: ink },
      { type: "text", x: 0, y: 52, text: "Collect references, patterns, and decisions.", fontSize: 18, strokeColor: mutedInk },
      { type: "rectangle", x: 0, y: 110, width: 260, height: 220, strokeColor: border, backgroundColor: accent, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 22, y: 132, text: "Visual references", fontSize: 20, strokeColor: ink },
      { type: "rectangle", x: 280, y: 110, width: 260, height: 220, strokeColor: border, backgroundColor: panel, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 302, y: 132, text: "Patterns to keep", fontSize: 20, strokeColor: ink },
      { type: "rectangle", x: 560, y: 110, width: 260, height: 220, strokeColor: border, backgroundColor: highlight, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 582, y: 132, text: "Direction", fontSize: 20, strokeColor: ink },
    ],
  },
  {
    id: "design-critique",
    title: "Design critique",
    category: "Research",
    description: "Frame feedback around the goal, evidence, open questions, and next moves.",
    elements: [
      { type: "text", x: 0, y: 0, text: "Design critique", fontSize: 32, strokeColor: ink },
      { type: "rectangle", x: 0, y: 72, width: 380, height: 150, strokeColor: border, backgroundColor: accent, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 22, y: 94, text: "Goal and context", fontSize: 20, strokeColor: ink },
      { type: "rectangle", x: 400, y: 72, width: 380, height: 150, strokeColor: border, backgroundColor: panel, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 422, y: 94, text: "Evidence", fontSize: 20, strokeColor: ink },
      { type: "rectangle", x: 0, y: 242, width: 380, height: 150, strokeColor: border, backgroundColor: panel, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 22, y: 264, text: "Open questions", fontSize: 20, strokeColor: ink },
      { type: "rectangle", x: 400, y: 242, width: 380, height: 150, strokeColor: border, backgroundColor: highlight, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 422, y: 264, text: "Next actions", fontSize: 20, strokeColor: ink },
    ],
  },
  {
    id: "user-flow",
    title: "User flow",
    category: "Flows",
    description: "A simple entry, decision, and outcome flow ready to rename and expand.",
    elements: [
      { type: "text", x: 0, y: 0, text: "User flow", fontSize: 32, strokeColor: ink },
      { type: "rectangle", x: 0, y: 110, width: 190, height: 96, strokeColor: border, backgroundColor: accent, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 45, y: 142, text: "Entry", fontSize: 22, strokeColor: ink },
      { type: "arrow", x: 200, y: 158, points: [[0, 0], [100, 0]], strokeColor: ink, strokeWidth: 2 },
      { type: "rectangle", x: 310, y: 110, width: 190, height: 96, strokeColor: border, backgroundColor: highlight, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 342, y: 142, text: "Decision", fontSize: 22, strokeColor: ink },
      { type: "arrow", x: 510, y: 158, points: [[0, 0], [100, 0]], strokeColor: ink, strokeWidth: 2 },
      { type: "rectangle", x: 620, y: 110, width: 190, height: 96, strokeColor: border, backgroundColor: panel, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 657, y: 142, text: "Outcome", fontSize: 22, strokeColor: ink },
    ],
  },
  {
    id: "journey-map",
    title: "Journey map",
    category: "Research",
    description: "Four stages for actions, thoughts, friction, and opportunity mapping.",
    elements: [
      { type: "text", x: 0, y: 0, text: "Journey map", fontSize: 32, strokeColor: ink },
      ...["Discover", "Explore", "Choose", "Use"].flatMap((label, index) => {
        const x = index * 210;
        return [
          { type: "rectangle" as const, x, y: 80, width: 190, height: 270, strokeColor: border, backgroundColor: index === 0 ? accent : panel, fillStyle: "solid" as const, roundness: { type: 3 as const } },
          { type: "text" as const, x: x + 18, y: 102, text: label, fontSize: 20, strokeColor: ink },
          { type: "text" as const, x: x + 18, y: 154, text: "Actions\n\nThoughts\n\nFriction\n\nOpportunity", fontSize: 16, strokeColor: mutedInk },
        ];
      }),
    ],
  },
  {
    id: "wireframe-review",
    title: "Wireframe review",
    category: "Wireframes",
    description: "A desktop frame with an annotation lane for focused review.",
    elements: [
      { type: "text", x: 0, y: 0, text: "Wireframe review", fontSize: 32, strokeColor: ink },
      { type: "rectangle", x: 0, y: 72, width: 560, height: 360, strokeColor: border, backgroundColor: panel, fillStyle: "solid", roundness: { type: 3 } },
      { type: "rectangle", x: 24, y: 96, width: 512, height: 44, strokeColor: border, backgroundColor: accent, fillStyle: "solid", roundness: { type: 3 } },
      { type: "rectangle", x: 24, y: 164, width: 320, height: 108, strokeColor: border, backgroundColor: "#ffffff", fillStyle: "solid", roundness: { type: 3 } },
      { type: "rectangle", x: 24, y: 292, width: 156, height: 112, strokeColor: border, backgroundColor: "#ffffff", fillStyle: "solid", roundness: { type: 3 } },
      { type: "rectangle", x: 200, y: 292, width: 156, height: 112, strokeColor: border, backgroundColor: "#ffffff", fillStyle: "solid", roundness: { type: 3 } },
      { type: "rectangle", x: 580, y: 72, width: 260, height: 360, strokeColor: border, backgroundColor: highlight, fillStyle: "solid", roundness: { type: 3 } },
      { type: "text", x: 602, y: 96, text: "Review notes", fontSize: 20, strokeColor: ink },
    ],
  },
  {
    id: "competitive-comparison",
    title: "Competitive comparison",
    category: "Research",
    description: "Compare three product directions against shared evaluation criteria.",
    elements: [
      { type: "text", x: 0, y: 0, text: "Competitive comparison", fontSize: 32, strokeColor: ink },
      ...["Direction A", "Direction B", "Direction C"].flatMap((label, index) => {
        const x = index * 280;
        return [
          { type: "rectangle" as const, x, y: 82, width: 260, height: 300, strokeColor: border, backgroundColor: index === 1 ? accent : panel, fillStyle: "solid" as const, roundness: { type: 3 as const } },
          { type: "text" as const, x: x + 20, y: 106, text: label, fontSize: 22, strokeColor: ink },
          { type: "text" as const, x: x + 20, y: 166, text: "Strengths\n\nWeaknesses\n\nPatterns to borrow", fontSize: 16, strokeColor: mutedInk },
        ];
      }),
    ],
  },
];

const categories = ["All templates", "Moodboards", "Research", "Flows", "Wireframes"] as const;

export function ProjectTemplateLibrary({
  onClose,
  onInsert,
}: {
  onClose(): void;
  onInsert(template: ProjectCanvasTemplate): void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All templates");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const templates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return projectCanvasTemplates.filter((template) => {
      if (category !== "All templates" && template.category !== category) return false;
      if (!normalizedQuery) return true;
      return [template.title, template.category, template.description]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <div
      className="project-template-library__backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="project-template-library"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-template-library-title"
      >
        <aside className="project-template-library__navigation" aria-label="Template categories">
          <div className="project-template-library__navigation-heading">
            <span>Canvas library</span>
            <strong>Templates</strong>
          </div>
          <nav>
            {categories.map((item) => (
              <Button
                key={item}
                label={item}
                variant={category === item ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCategory(item)}
              />
            ))}
          </nav>
          <p>Built for moodboards, research synthesis, and design reviews.</p>
        </aside>
        <div className="project-template-library__content">
          <header className="project-template-library__header">
            <div>
              <span>Start with structure</span>
              <h2 id="project-template-library-title">Designer templates</h2>
            </div>
            <Button label="Close" variant="ghost" size="sm" onClick={onClose} />
          </header>
          <TextInput
            ref={searchRef}
            label="Search templates"
            isLabelHidden
            value={query}
            onChange={setQuery}
            placeholder="Search templates…"
            width="100%"
          />
          <div className="project-template-library__results-heading">
            <strong>{category}</strong>
            <span>{templates.length} {templates.length === 1 ? "template" : "templates"}</span>
          </div>
          <div className="project-template-library__grid">
            {templates.map((template) => (
              <Card key={template.id} padding={4} className="project-template-library__card">
                <span>{template.category}</span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <Button
                  label="Use template"
                  variant="secondary"
                  size="sm"
                  clickAction={() => onInsert(template)}
                />
              </Card>
            ))}
            {!templates.length && (
              <div className="project-template-library__empty" role="status">
                <strong>No matching templates</strong>
                <p>Try another keyword or template category.</p>
                <Button
                  label="Clear search"
                  variant="secondary"
                  size="sm"
                  clickAction={() => {
                    setQuery("");
                    setCategory("All templates");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
