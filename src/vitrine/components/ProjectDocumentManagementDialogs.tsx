import { useEffect, useState } from "react";
import { Button, Heading, Icon, Text } from "@astryxdesign/core";

import type { ProjectDocumentPublic } from "../../projectDocument.ts";
import type { ProjectDocumentSeedBlock } from "../projectDocumentRuntime.ts";
import { AstryxModal } from "./AstryxModal.tsx";

export interface ProjectDocumentStarterTemplate {
  id: string;
  kind: "starter";
  title: string;
  description: string;
  blocks: readonly ProjectDocumentSeedBlock[];
}

export interface ProjectDocumentSavedTemplate {
  id: string;
  kind: "document";
  title: string;
  description: string;
  documentId: number;
}

export type ProjectDocumentTemplate =
  | ProjectDocumentStarterTemplate
  | ProjectDocumentSavedTemplate;

export const projectDocumentTemplates: readonly ProjectDocumentStarterTemplate[] =
  [
  {
    id: "product-brief",
    kind: "starter",
    title: "Product brief",
    description: "Frame the problem, users, scope, and measurable outcome.",
    blocks: [
      { type: "h1", text: "Problem" },
      { type: "text", text: "What problem are we solving, and for whom?" },
      { type: "h1", text: "Context" },
      { type: "text", text: "Evidence, constraints, and relevant links." },
      { type: "h1", text: "Scope" },
      { type: "bulleted", text: "In scope" },
      { type: "bulleted", text: "Out of scope" },
      { type: "h1", text: "Success measures" },
      { type: "text", text: "How will we know this worked?" },
    ],
  },
  {
    id: "decision-record",
    kind: "starter",
    title: "Decision record",
    description: "Capture a decision, alternatives, rationale, and follow-up.",
    blocks: [
      { type: "h1", text: "Decision" },
      { type: "text", text: "What did we decide?" },
      { type: "h1", text: "Status" },
      { type: "text", text: "Proposed" },
      { type: "h1", text: "Options considered" },
      { type: "numbered", text: "Option A" },
      { type: "numbered", text: "Option B" },
      { type: "h1", text: "Rationale" },
      { type: "text", text: "Why is this the best choice now?" },
      { type: "h1", text: "Follow-up" },
      { type: "bulleted", text: "Owner and next action" },
    ],
  },
  {
    id: "meeting-notes",
    kind: "starter",
    title: "Meeting notes",
    description: "Collect agenda items, notes, decisions, and action owners.",
    blocks: [
      { type: "h1", text: "Attendees" },
      { type: "bulleted", text: "Name" },
      { type: "h1", text: "Agenda" },
      { type: "numbered", text: "Topic" },
      { type: "h1", text: "Notes" },
      { type: "text", text: "Discussion notes" },
      { type: "h1", text: "Decisions" },
      { type: "bulleted", text: "Decision" },
      { type: "h1", text: "Actions" },
      { type: "bulleted", text: "Owner — action — due date" },
    ],
  },
  ];

export function ProjectDocumentImportDialog({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose(): void;
  onSubmit(file: File): void;
}) {
  const [file, setFile] = useState<File>();

  useEffect(() => {
    if (isOpen) setFile(undefined);
  }, [isOpen]);

  return (
    <AstryxModal
      className="project-document-organizer-dialog project-document-import-dialog"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={620}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Import</Heading>
          <Text color="secondary">
            Bring an existing Markdown or HTML document into this project.
          </Text>
        </div>
        <label className="project-document-import-dropzone">
          <Icon icon="arrowDown" size="md" />
          <strong>{file?.name ?? "Choose a document"}</strong>
          <small>Markdown (.md) or HTML (.html)</small>
          <input
            aria-label="Import document file"
            type="file"
            accept=".md,.markdown,.html,.htm,text/markdown,text/html"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">
            Content is copied into a new private Project Document.
          </Text>
          <div className="project-document-organizer-dialog-actions">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              label="Import document"
              variant="primary"
              isDisabled={!file}
              onClick={() => {
                if (file) onSubmit(file);
              }}
            />
          </div>
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectDocumentTemplateDialog({
  isOpen,
  savedTemplates = [],
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  savedTemplates?: readonly ProjectDocumentPublic[];
  onClose(): void;
  onSelect(template: ProjectDocumentTemplate): void;
}) {
  const reusableTemplates: ProjectDocumentSavedTemplate[] = savedTemplates.map(
    (document) => ({
      id: `document-${document.id}`,
      kind: "document",
      title: document.title,
      description: "Reusable project document with its full Page and Canvas.",
      documentId: document.id,
    }),
  );
  const templates: readonly ProjectDocumentTemplate[] = [
    ...reusableTemplates,
    ...projectDocumentTemplates,
  ];
  return (
    <AstryxModal
      className="project-document-organizer-dialog project-document-template-dialog"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={680}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Create from a template</Heading>
          <Text color="secondary">
            Reuse a project document or start with a practical BA/PO structure.
          </Text>
        </div>
        <div className="project-document-template-list">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="project-document-template-option"
              onClick={() => onSelect(template)}
            >
              <span
                className="project-document-library-icon"
                aria-hidden="true"
              >
                <Icon icon="viewColumns" size="sm" />
              </span>
              <span>
                <strong>{template.title}</strong>
                <small>{template.description}</small>
              </span>
              {template.kind === "document" ? (
                <small className="project-document-template-badge">
                  Project template
                </small>
              ) : null}
            </button>
          ))}
        </div>
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">
            Templates copy content into a new independent Project Document.
          </Text>
          <Button label="Cancel" variant="ghost" onClick={onClose} />
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectDocumentDeleteDialog({
  document,
  onClose,
  onConfirm,
}: {
  document?: ProjectDocumentPublic;
  onClose(): void;
  onConfirm(documentId: number): void;
}) {
  return (
    <AstryxModal
      className="project-document-organizer-dialog"
      isOpen={document !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={480}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Delete permanently?</Heading>
          <Text color="secondary">
            {document
              ? `${document.title} and its saved canvas will be removed. This cannot be undone.`
              : ""}
          </Text>
        </div>
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">
            Restore the document instead if you may need it later.
          </Text>
          <div className="project-document-organizer-dialog-actions">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              label="Delete permanently"
              variant="primary"
              onClick={() => {
                if (document) onConfirm(document.id);
              }}
            />
          </div>
        </div>
      </div>
    </AstryxModal>
  );
}
