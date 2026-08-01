import { useEffect, useRef, useState } from "react";
import {
  EmptyState,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  StatusDot,
  Text,
} from "@astryxdesign/core";

import type {
  ProjectDocumentMode,
  PublicProjectDocumentShare,
} from "../../projectDocument.ts";
import {
  createProjectDocumentRuntime,
  type ProjectDocumentRuntime,
} from "../projectDocumentRuntime.ts";
import { getPublicProjectDocumentShare } from "../projectDocumentsApi.ts";
import { installProjectDocumentEditorEffects } from "./ProjectDocumentWorkspace.tsx";

export function ProjectDocumentSharePage({
  token,
  initialShare,
}: {
  token: string;
  initialShare?: PublicProjectDocumentShare;
}) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const [share, setShare] = useState<PublicProjectDocumentShare | undefined>(
    initialShare,
  );
  const [runtime, setRuntime] = useState<ProjectDocumentRuntime | undefined>();
  const [mode, setMode] = useState<ProjectDocumentMode>(
    initialShare?.document.lastEditorMode ?? "page",
  );
  const [connection, setConnection] = useState("Loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialShare) return;
    let active = true;
    getPublicProjectDocumentShare(token)
      .then((value) => {
        if (!active) return;
        setShare(value);
        setMode(value.document.lastEditorMode);
      })
      .catch(() => {
        if (active) setError("Project document share unavailable");
      });
    return () => {
      active = false;
    };
  }, [initialShare, token]);

  useEffect(() => {
    if (!share) return;
    const next = createProjectDocumentRuntime(
      {
        document: share.document,
        created: false,
        syncBaseUrl: share.syncBaseUrl,
        blobBaseUrl: share.blobBaseUrl,
        syncInstanceId: share.syncInstanceId,
      },
      {
        readOnly: true,
        presence: { name: "Guest viewer", color: "#64748b" },
        indexedDbName: `astryx-public-project-document-${share.document.id}-${share.syncInstanceId}`,
      },
    );
    setRuntime(next);
    setConnection(next.snapshot());
    const unsubscribe = next.subscribe(() => {
      setConnection(next.snapshot());
    });
    return () => {
      unsubscribe();
      next.dispose();
      setRuntime(undefined);
    };
  }, [share]);

  useEffect(() => {
    if (!runtime || !editorHostRef.current) return;
    let active = true;
    let editor: HTMLElement | undefined;
    Promise.all([
      import("@blocksuite/blocks/effects"),
      import("@blocksuite/presets/effects"),
      import("@blocksuite/blocks"),
      import("../projectDocumentTableBlock.ts"),
      import("../projectDocumentCalloutBlock.ts"),
      import("../projectDocumentEmbedBlock.ts"),
      import("../projectDocumentTextAlignment.ts"),
      import("../projectDocumentCalendarView.ts"),
      import("../projectDocumentSlashMenu.ts"),
    ])
      .then(
        ([
          blockEffects,
          presetEffects,
          blocks,
          tableBlock,
          calloutBlock,
          embedBlock,
          textAlignment,
          calendarView,
          slashMenu,
        ]) => {
          if (!active || !editorHostRef.current) return;
          installProjectDocumentEditorEffects(
            customElements,
            blockEffects.effects,
            presetEffects.effects,
          );
          tableBlock.registerProjectDocumentTableBlock(customElements);
          calloutBlock.registerProjectDocumentCalloutBlock(customElements);
          embedBlock.registerProjectDocumentEmbedBlock(customElements);
          textAlignment.registerProjectDocumentTextAlignmentBlocks(
            customElements,
          );
          calendarView.registerProjectDocumentDatabaseBlock(customElements);
          slashMenu.registerProjectDocumentSlashMenu();
          editor = document.createElement(
            mode === "page" ? "page-editor" : "edgeless-editor",
          );
          if (mode === "page") {
            (editor as typeof editor & { specs: unknown[] }).specs = [
              ...blocks.PageEditorBlockSpecs,
              ...tableBlock.ProjectDocumentTableBlockSpec,
              ...calloutBlock.ProjectDocumentCalloutBlockSpec,
              ...embedBlock.ProjectDocumentEmbedBlockSpec,
              ...textAlignment.ProjectDocumentTextAlignmentBlockSpec,
            ];
          } else {
            (editor as typeof editor & { specs: unknown[] }).specs = [
              ...blocks.EdgelessEditorBlockSpecs,
              ...tableBlock.ProjectDocumentTableBlockSpec,
              ...calloutBlock.ProjectDocumentCalloutBlockSpec,
              ...embedBlock.ProjectDocumentEmbedBlockSpec,
              ...textAlignment.ProjectDocumentTextAlignmentBlockSpec,
            ];
          }
          (editor as typeof editor & { doc: typeof runtime.doc }).doc =
            runtime.doc;
          editorHostRef.current.replaceChildren(editor);
        },
      )
      .catch(() => {
        if (active) setError("Unable to display this shared document");
      });
    return () => {
      active = false;
      editor?.remove();
    };
  }, [mode, runtime]);

  if (error) {
    return (
      <main className="vitrine-page project-document-public-share">
        <EmptyState
          title="Project document share unavailable"
          description="This link may have been revoked or the document was removed."
        />
      </main>
    );
  }

  if (!share || !runtime) {
    return (
      <main
        className="vitrine-page project-document-public-share-loading"
        role="status"
        aria-label="Loading shared Project document"
      >
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="vitrine-page project-document-public-share">
      <header className="project-document-public-share-header">
        <a href="/" className="project-document-public-share-brand">
          Astryx
        </a>
        <div className="project-document-public-share-identity">
          <Text type="supporting">Read-only Project document</Text>
          <strong>{share.document.title}</strong>
        </div>
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as ProjectDocumentMode)}
          label="Shared document view"
          size="sm"
        >
          <SegmentedControlItem value="page" label="Page" />
          <SegmentedControlItem value="edgeless" label="Canvas" />
        </SegmentedControl>
        <HStack gap={1} align="center">
          <StatusDot
            variant={connection === "Saved" ? "success" : "neutral"}
            label={`${connection === "Saved" ? "Live" : connection} status`}
            aria-hidden="true"
          />
          <Text type="supporting">
            {connection === "Saved" ? "Live" : connection}
          </Text>
        </HStack>
      </header>
      <section
        className={
          mode === "page"
            ? "project-document-public-share-editor project-document-public-share-page-editor"
            : "project-document-public-share-editor project-document-public-share-canvas-editor"
        }
        ref={editorHostRef}
        aria-label={mode === "page" ? "Read-only Page" : "Read-only Canvas"}
      />
    </main>
  );
}
