import { useEffect, useState } from "react";
import {
  Button,
  CheckboxInput,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextInput,
} from "@astryxdesign/core";

import type {
  ProjectDocumentCollectionMode,
  ProjectDocumentCollectionRule,
  ProjectDocumentPublic,
  ProjectDocumentSmartCollection,
  ProjectDocumentTag,
} from "../../projectDocument.ts";
import { AstryxModal } from "./AstryxModal.tsx";

export function ProjectDocumentCollectionPickerDialog({
  collection,
  documents,
  isOpen,
  onClose,
  onSubmit,
}: {
  collection?: ProjectDocumentSmartCollection;
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
    setSelected(collection?.documentIds ?? []);
  }, [collection, isOpen]);

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
          <Heading level={3}>
            Add docs to {collection?.name ?? "collection"}
          </Heading>
          <Text color="secondary">
            Manual collections keep the selected documents together.
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
          aria-label="Collection documents"
        >
          {visibleDocuments.map((document) => {
            const checked = selected.includes(document.id);
            return (
              <CheckboxInput
                key={document.id}
                label={document.title}
                description={
                  document.journalDate
                    ? `Journal · ${document.journalDate}`
                    : `Updated ${new Date(document.updatedAt).toLocaleDateString()}`
                }
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

export function ProjectDocumentCollectionRulesDialog({
  collection,
  tags,
  isOpen,
  onClose,
  onSubmit,
}: {
  collection?: ProjectDocumentSmartCollection;
  tags: readonly ProjectDocumentTag[];
  isOpen: boolean;
  onClose(): void;
  onSubmit(input: {
    mode: ProjectDocumentCollectionMode;
    rules: ProjectDocumentCollectionRule[];
  }): void;
}) {
  const [mode, setMode] = useState<ProjectDocumentCollectionMode>("rules");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [journalOnly, setJournalOnly] = useState(false);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [documentMode, setDocumentMode] = useState<
    "any" | "page" | "edgeless"
  >("any");
  const [pageWidth, setPageWidth] = useState<
    "any" | "standard" | "full"
  >("any");
  const [createdAfter, setCreatedAfter] = useState("");
  const [updatedAfter, setUpdatedAfter] = useState("");

  useEffect(() => {
    if (!isOpen || !collection) return;
    const modeRule = collection.rules.find((rule) => rule.field === "mode");
    const widthRule = collection.rules.find(
      (rule) => rule.field === "pageWidth",
    );
    const createdRule = collection.rules.find(
      (rule) => rule.field === "createdAfter",
    );
    const updatedRule = collection.rules.find(
      (rule) => rule.field === "updatedAfter",
    );
    setMode(collection.mode);
    setFavoriteOnly(
      collection.rules.some(
        (rule) => rule.field === "favorite" && rule.value,
      ),
    );
    setJournalOnly(
      collection.rules.some(
        (rule) => rule.field === "journal" && rule.value,
      ),
    );
    setTagIds(
      collection.rules.flatMap((rule) =>
        rule.field === "tag" ? [rule.value] : [],
      ),
    );
    setDocumentMode(modeRule?.field === "mode" ? modeRule.value : "any");
    setPageWidth(
      widthRule?.field === "pageWidth" ? widthRule.value : "any",
    );
    setCreatedAfter(
      createdRule?.field === "createdAfter" ? createdRule.value : "",
    );
    setUpdatedAfter(
      updatedRule?.field === "updatedAfter" ? updatedRule.value : "",
    );
  }, [collection, isOpen]);

  const submit = () => {
    const rules: ProjectDocumentCollectionRule[] = [];
    if (favoriteOnly) rules.push({ field: "favorite", value: true });
    if (journalOnly) rules.push({ field: "journal", value: true });
    for (const tagId of tagIds) rules.push({ field: "tag", value: tagId });
    if (documentMode !== "any") {
      rules.push({ field: "mode", value: documentMode });
    }
    if (pageWidth !== "any") {
      rules.push({ field: "pageWidth", value: pageWidth });
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(createdAfter)) {
      rules.push({ field: "createdAfter", value: createdAfter });
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(updatedAfter)) {
      rules.push({ field: "updatedAfter", value: updatedAfter });
    }
    onSubmit({ mode, rules });
  };

  return (
    <AstryxModal
      className="project-document-organizer-dialog project-document-collection-rules"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={720}
    >
      <div className="project-document-organizer-dialog-content">
        <div>
          <Heading level={3}>Collection contents</Heading>
          <Text color="secondary">
            Select documents manually or include matching documents
            automatically.
          </Text>
        </div>
        <SegmentedControl
          label="Collection mode"
          value={mode}
          onChange={(value) =>
            setMode(value as ProjectDocumentCollectionMode)
          }
        >
          <SegmentedControlItem label="Docs" value="manual" />
          <SegmentedControlItem label="Rules" value="rules" />
        </SegmentedControl>
        {mode === "manual" ? (
          <Text color="secondary">
            Save this mode, then use Add docs from the collection page.
          </Text>
        ) : (
          <div className="project-document-collection-rule-grid">
            <CheckboxInput
              label="Favorites only"
              description="Include favorited documents."
              value={favoriteOnly}
              onChange={() => setFavoriteOnly((value) => !value)}
            />
            <CheckboxInput
              label="Journals only"
              description="Include daily journal documents."
              value={journalOnly}
              onChange={() => setJournalOnly((value) => !value)}
            />
            <div>
              <Text type="label" weight="semibold">
                Tags
              </Text>
              <div className="project-document-collection-tag-rules">
                {tags.map((tag) => (
                  <CheckboxInput
                    key={tag.id}
                    label={tag.name}
                    value={tagIds.includes(tag.id)}
                    onChange={() =>
                      setTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id],
                      )
                    }
                  />
                ))}
                {tags.length === 0 ? (
                  <Text color="secondary">No workspace tags yet.</Text>
                ) : null}
              </div>
            </div>
            <div>
              <Text type="label" weight="semibold">
                Document mode
              </Text>
              <SegmentedControl
                label="Document mode"
                value={documentMode}
                onChange={(value) =>
                  setDocumentMode(value as typeof documentMode)
                }
              >
                <SegmentedControlItem label="Any" value="any" />
                <SegmentedControlItem label="Page" value="page" />
                <SegmentedControlItem label="Canvas" value="edgeless" />
              </SegmentedControl>
            </div>
            <div>
              <Text type="label" weight="semibold">
                Page width
              </Text>
              <SegmentedControl
                label="Page width"
                value={pageWidth}
                onChange={(value) =>
                  setPageWidth(value as typeof pageWidth)
                }
              >
                <SegmentedControlItem label="Any" value="any" />
                <SegmentedControlItem label="Standard" value="standard" />
                <SegmentedControlItem label="Full" value="full" />
              </SegmentedControl>
            </div>
            <div className="project-document-collection-date-rules">
              <TextInput
                label="Created after"
                value={createdAfter}
                onChange={setCreatedAfter}
                placeholder="YYYY-MM-DD"
                width="100%"
              />
              <TextInput
                label="Updated after"
                value={updatedAfter}
                onChange={setUpdatedAfter}
                placeholder="YYYY-MM-DD"
                width="100%"
              />
            </div>
          </div>
        )}
        <div className="project-document-organizer-dialog-footer">
          <Text color="secondary">
            {mode === "rules" ? "All active rules must match." : "Manual mode"}
          </Text>
          <div className="project-document-organizer-dialog-actions">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button label="Save" variant="primary" onClick={submit} />
          </div>
        </div>
      </div>
    </AstryxModal>
  );
}
