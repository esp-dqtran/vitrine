import { useEffect, useState } from "react";
import {
  Button,
  CheckboxInput,
  Heading,
  Text,
  TextInput,
} from "@astryxdesign/core";

import type {
  ProjectDocumentFolder,
  ProjectDocumentPublic,
  ProjectDocumentTag,
} from "../../projectDocument.ts";
import { AstryxModal } from "./AstryxModal.tsx";

export function ProjectDocumentNameDialog({
  isOpen,
  title,
  description,
  label,
  initialValue = "",
  submitLabel,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onClose(): void;
  onSubmit(value: string): void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [initialValue, isOpen]);

  const submit = () => {
    const normalized = value.trim();
    if (!normalized) return;
    onSubmit(normalized);
  };

  return (
    <AstryxModal
      className="project-document-organizer-dialog"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={520}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>{title}</Heading>
          <Text color="secondary">{description}</Text>
        </div>
        <TextInput
          label={label}
          value={value}
          onChange={(next) => setValue(next.slice(0, 80))}
          placeholder={label}
          width="100%"
        />
        <div className="project-document-organizer-dialog-actions">
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label={submitLabel}
            variant="primary"
            isDisabled={!value.trim()}
            onClick={submit}
          />
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectDocumentFolderPickerDialog({
  folder,
  documents,
  isOpen,
  onClose,
  onSubmit,
}: {
  folder?: ProjectDocumentFolder;
  documents: readonly ProjectDocumentPublic[];
  isOpen: boolean;
  onClose(): void;
  onSubmit(documentIds: number[]): void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelected(folder?.documentIds ?? []);
  }, [folder, isOpen]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleDocuments = documents.filter((document) =>
    document.title.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <AstryxModal
      className="project-document-organizer-dialog project-document-organizer-picker"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={760}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Add docs to {folder?.name ?? "folder"}</Heading>
          <Text color="secondary">
            Documents can belong to more than one folder.
          </Text>
        </div>
        <TextInput
          label="Search documents"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Search docs…"
          width="100%"
        />
        <div
          className="project-document-organizer-picker-list"
          aria-label="Folder documents"
        >
          {visibleDocuments.map((document) => {
            const checked = selected.includes(document.id);
            return (
              <CheckboxInput
                key={document.id}
                label={document.title}
                description={`Updated ${new Date(document.updatedAt).toLocaleDateString()}`}
                value={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== document.id)
                      : [...current, document.id],
                  )
                }
              />
            );
          })}
          {visibleDocuments.length === 0 ? (
            <Text color="secondary">No documents match your search.</Text>
          ) : null}
        </div>
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">Selected {selected.length}</Text>
          <div className="project-document-organizer-dialog-actions">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              label="Confirm"
              variant="primary"
              onClick={() => onSubmit(selected)}
            />
          </div>
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectDocumentTagPickerDialog({
  document,
  tags,
  isOpen,
  onClose,
  onSubmit,
}: {
  document?: ProjectDocumentPublic;
  tags: readonly ProjectDocumentTag[];
  isOpen: boolean;
  onClose(): void;
  onSubmit(tagIds: number[]): void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen || !document) return;
    setQuery("");
    setSelected(
      tags
        .filter((tag) => tag.documentIds.includes(document.id))
        .map((tag) => tag.id),
    );
  }, [document, isOpen, tags]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTags = tags.filter((tag) =>
    tag.name.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <AstryxModal
      className="project-document-organizer-dialog"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={520}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Manage document tags</Heading>
          <Text color="secondary">
            Organize {document?.title ?? "this document"} with workspace tags.
          </Text>
        </div>
        <TextInput
          label="Search tags"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Type here…"
          width="100%"
        />
        <div
          className="project-document-organizer-picker-list"
          aria-label="Document tags"
        >
          {visibleTags.map((tag) => {
            const checked = selected.includes(tag.id);
            return (
              <CheckboxInput
                key={tag.id}
                label={tag.name}
                description={`${tag.documentIds.length} documents`}
                value={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== tag.id)
                      : [...current, tag.id],
                  )
                }
              />
            );
          })}
          {visibleTags.length === 0 ? (
            <Text color="secondary">
              {tags.length
                ? "No tags match your search."
                : "Nothing here yet. Create a tag from the Tags view."}
            </Text>
          ) : null}
        </div>
        <div className="project-document-organizer-dialog-actions">
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label="Save tags"
            variant="primary"
            onClick={() => onSubmit(selected)}
          />
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectDocumentLinkPickerDialog({
  document,
  documents,
  linkedDocumentIds,
  isOpen,
  onClose,
  onSubmit,
}: {
  document?: ProjectDocumentPublic;
  documents: readonly ProjectDocumentPublic[];
  linkedDocumentIds: readonly number[];
  isOpen: boolean;
  onClose(): void;
  onSubmit(documentIds: number[]): void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const linkedDocumentKey = linkedDocumentIds.join(",");

  useEffect(() => {
    if (!isOpen || !document) return;
    setQuery("");
    setSelected([...linkedDocumentIds]);
  }, [document?.id, isOpen, linkedDocumentKey]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleDocuments = documents.filter(
    (candidate) =>
      candidate.id !== document?.id &&
      candidate.title.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <AstryxModal
      className="project-document-organizer-dialog project-document-organizer-picker"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={680}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Link related documents</Heading>
          <Text color="secondary">
            Connect requirements, decisions, research, and delivery notes.
          </Text>
        </div>
        <TextInput
          label="Search documents"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Search docs…"
          width="100%"
        />
        <div
          className="project-document-organizer-picker-list"
          aria-label="Linked documents"
        >
          {visibleDocuments.map((candidate) => {
            const checked = selected.includes(candidate.id);
            return (
              <CheckboxInput
                key={candidate.id}
                label={candidate.title}
                description={`Updated ${new Date(candidate.updatedAt).toLocaleDateString()}`}
                value={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== candidate.id)
                      : [...current, candidate.id],
                  )
                }
              />
            );
          })}
          {visibleDocuments.length === 0 ? (
            <Text color="secondary">
              {documents.length > 1
                ? "No documents match your search."
                : "Create another document to add a link."}
            </Text>
          ) : null}
        </div>
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">Selected {selected.length}</Text>
          <div className="project-document-organizer-dialog-actions">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              label="Save links"
              variant="primary"
              onClick={() => onSubmit(selected)}
            />
          </div>
        </div>
      </div>
    </AstryxModal>
  );
}
