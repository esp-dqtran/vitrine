import { useState } from "react";
import { Button, HStack, Icon, IconButton, Text } from "@astryxdesign/core";

import type { ProjectDocumentVersion } from "../../projectDocument.ts";

function versionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function versionSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentHistoryPanel({
  versions,
  error,
  loading = false,
  saving = false,
  restoringVersionId,
  readOnly = false,
  onClose,
  onCreate,
  onRestore,
}: {
  versions: readonly ProjectDocumentVersion[];
  error?: string;
  loading?: boolean;
  saving?: boolean;
  restoringVersionId?: number;
  readOnly?: boolean;
  onClose(): void;
  onCreate(label: string): boolean | Promise<boolean>;
  onRestore(versionId: number): void | Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [confirmVersionId, setConfirmVersionId] = useState<number>();
  const create = async () => {
    const nextLabel = label.trim() || "Manual version";
    if (saving || !(await onCreate(nextLabel))) return;
    setLabel("");
  };

  return (
    <aside
      className="project-document-history-panel"
      aria-label="Document version history"
    >
      <header>
        <HStack gap={2} align="center">
          <Icon icon="calendar" size="sm" />
          <div>
            <Text as="h2" type="label" weight="semibold">
              Version history
            </Text>
            <Text type="supporting">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </Text>
          </div>
        </HStack>
        <IconButton
          label="Close version history"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </header>

      <div className="project-document-history-composer">
        {error ? (
          <Text
            className="project-document-history-error"
            color="secondary"
            type="supporting"
          >
            {error}
          </Text>
        ) : null}
        {readOnly ? (
          <Text type="supporting">
            View-only access. Editors can save and restore versions.
          </Text>
        ) : (
          <>
            <label htmlFor="project-document-version-label">
              Save current state
            </label>
            <input
              id="project-document-version-label"
              value={label}
              maxLength={120}
              placeholder="Version name (optional)"
              onChange={(event) => setLabel(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void create();
                }
              }}
            />
            <Button
              label={saving ? "Saving version…" : "Save version"}
              variant="primary"
              size="sm"
              isDisabled={saving || Boolean(restoringVersionId)}
              onClick={() => void create()}
            />
          </>
        )}
      </div>

      <div className="project-document-history-list" aria-live="polite">
        {loading ? (
          <div className="project-document-history-empty">
            <Text type="supporting">Loading version history…</Text>
          </div>
        ) : versions.length === 0 ? (
          <div className="project-document-history-empty">
            <Icon icon="document" size="md" />
            <Text type="label" weight="semibold">
              No saved versions
            </Text>
            <Text type="supporting">
              Save a named checkpoint before a major edit or review.
            </Text>
          </div>
        ) : (
          versions.map((version) => {
            const confirming = confirmVersionId === version.id;
            const restoring = restoringVersionId === version.id;
            return (
              <article key={version.id} className="project-document-version">
                <div>
                  <Text type="label" weight="semibold">
                    {version.label}
                  </Text>
                  <Text type="supporting">
                    {versionDate(version.createdAt)}
                  </Text>
                </div>
                <Text type="supporting">
                  {version.createdByEmail} · {versionSize(version.byteSize)}
                </Text>
                {readOnly ? null : confirming ? (
                  <div className="project-document-version-confirm">
                    <Text type="supporting">
                      The current state will be saved automatically before
                      restoring this version.
                    </Text>
                    <HStack gap={1} justify="end">
                      <Button
                        label="Cancel"
                        variant="ghost"
                        size="sm"
                        isDisabled={Boolean(restoringVersionId)}
                        onClick={() => setConfirmVersionId(undefined)}
                      />
                      <Button
                        label={restoring ? "Restoring…" : "Restore version"}
                        variant="primary"
                        size="sm"
                        isDisabled={Boolean(restoringVersionId)}
                        onClick={() => void onRestore(version.id)}
                      />
                    </HStack>
                  </div>
                ) : (
                  <Button
                    className="project-document-version-restore"
                    label="Restore"
                    variant="secondary"
                    size="sm"
                    isDisabled={saving || Boolean(restoringVersionId)}
                    onClick={() => setConfirmVersionId(version.id)}
                  />
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
