import { useEffect, useState, type CSSProperties } from "react";
import { Button, Icon, IconButton, TextArea, TextInput } from "@astryxdesign/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ProjectCanvasDocumentTemplateId =
  | "retrospective-summary"
  | "product-brief"
  | "research-synthesis"
  | "meeting-notes";

export interface ProjectCanvasDocumentData {
  documentId: string;
  title: string;
  body: string;
  templateId?: ProjectCanvasDocumentTemplateId;
  expanded: boolean;
}

interface ProjectCanvasDocumentTemplate {
  id: ProjectCanvasDocumentTemplateId;
  title: string;
  body: string;
}

export const projectCanvasDocumentTemplates: readonly ProjectCanvasDocumentTemplate[] = [
  {
    id: "retrospective-summary",
    title: "Retrospective Summary",
    body: "## What worked\n- Add the strongest outcome\n\n## What was difficult\n- Add the main friction\n\n## What we will try next\n- Add one concrete action",
  },
  {
    id: "product-brief",
    title: "Product Brief",
    body: "## Problem\nDescribe the user problem and why it matters.\n\n## Audience\nWho experiences this problem?\n\n## Outcome\nWhat should change for the user?\n\n## Open questions\n- Add the riskiest assumption",
  },
  {
    id: "research-synthesis",
    title: "Research Synthesis",
    body: "## Research question\nWhat did we need to learn?\n\n## Signals\n- Add an observed behavior\n- Add a recurring pain point\n\n## Insight\nExplain the pattern behind the evidence.\n\n## Design implication\nDescribe what the product should do next.",
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    body: "## Context\nAdd the purpose of the conversation.\n\n## Notes\n- Add a discussion point\n\n## Decisions\n- Add a decision\n\n## Actions\n- Owner — next step",
  },
];

export function ProjectCanvasDocumentEditor({
  document,
  style,
  isSelected,
  onCommit,
  onDismiss,
}: {
  document: ProjectCanvasDocumentData;
  style: CSSProperties;
  isSelected: boolean;
  onCommit(document: ProjectCanvasDocumentData): void;
  onDismiss(): void;
}) {
  const [draft, setDraft] = useState(document);
  const [isSourceEditing, setIsSourceEditing] = useState(false);

  useEffect(() => {
    setDraft(document);
  }, [
    document.body,
    document.documentId,
    document.expanded,
    document.templateId,
    document.title,
  ]);

  useEffect(() => {
    if (!isSelected) setIsSourceEditing(false);
  }, [isSelected]);

  const applyTemplate = (template: ProjectCanvasDocumentTemplate) => {
    setDraft((current) => ({
      ...current,
      title: current.title.trim() && current.title !== "Untitled doc" ? current.title : template.title,
      body: template.body,
      templateId: template.id,
    }));
  };

  const showStarters = !draft.body.trim() || draft.body.trim() === "/";
  const isEditing = isSelected && isSourceEditing;

  return (
    <form
      className={`project-canvas-document-editor${
        draft.expanded ? " project-canvas-document-editor--expanded" : ""
      }${isSelected ? " project-canvas-document-editor--selected" : ""}${
        isEditing ? " project-canvas-document-editor--editing" : " project-canvas-document-editor--preview"
      }`}
      style={style}
      aria-label={isEditing ? "Canvas document editor" : "Canvas document preview"}
      aria-hidden={isSelected ? undefined : true}
      inert={isSelected ? undefined : true}
      onPointerDown={(event) => {
        if (isEditing) event.stopPropagation();
      }}
      onWheel={(event) => {
        if (isEditing) event.stopPropagation();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isEditing) return;
        onCommit({ ...draft, title: draft.title.trim() || "Untitled doc" });
        setIsSourceEditing(false);
      }}
    >
      <header
        className="project-canvas-document-editor__toolbar"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <strong>Document</strong>
        <div>
          <Button
            label={isSourceEditing ? "Preview Markdown" : "Edit Markdown"}
            variant="ghost"
            size="sm"
            clickAction={() => setIsSourceEditing((editing) => !editing)}
          />
          <IconButton
            label={draft.expanded ? "Collapse document" : "Expand document"}
            icon={<Icon icon={draft.expanded ? "chevronDown" : "externalLink"} size="sm" />}
            variant="ghost"
            size="sm"
            clickAction={() => setDraft((current) => ({ ...current, expanded: !current.expanded }))}
          />
          <IconButton
            label="Close document"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            clickAction={() => {
              setIsSourceEditing(false);
              onDismiss();
            }}
          />
        </div>
      </header>
      <div className="project-canvas-document-editor__page">
        {isSourceEditing ? (
          <TextInput
            label="Document title"
            isLabelHidden
            value={draft.title}
            onChange={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="Untitled doc"
            width="100%"
          />
        ) : (
          <h2 className="project-canvas-document-editor__title">
            {draft.title.trim() || "Untitled doc"}
          </h2>
        )}
        <p>Press / for options or start writing</p>
        {isSourceEditing ? (
          <TextArea
            label="Document content"
            isLabelHidden
            value={draft.body}
            onChange={(body) => setDraft((current) => ({ ...current, body }))}
            placeholder="Start writing or type / for options"
            rows={draft.expanded ? 18 : 9}
            width="100%"
          />
        ) : draft.body.trim() ? (
          <div className="project-canvas-document-editor__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body}</ReactMarkdown>
          </div>
        ) : (
          <p className="project-canvas-document-editor__empty">Start writing or type / for options</p>
        )}
        {isSourceEditing && showStarters && (
          <section className="project-canvas-document-editor__starters" aria-label="Document templates">
            <span>Choose a starting template</span>
            {projectCanvasDocumentTemplates.map((template) => (
              <Button
                key={template.id}
                label={template.title}
                variant="ghost"
                size="sm"
                clickAction={() => applyTemplate(template)}
              />
            ))}
          </section>
        )}
      </div>
      <footer>
        <span>Structured notes stay attached to this project.</span>
        <Button label="Done" variant="primary" size="sm" type="submit" />
      </footer>
    </form>
  );
}
