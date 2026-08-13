import { useEffect, useMemo, useState } from "react";
import { Button, TextArea } from "@astryxdesign/core";

import type {
  FeatureDocumentContent,
  FeatureDocumentJobView,
  FeatureDocumentRevisionView,
  FeatureDocumentReviewStatus,
  FeatureDocumentView,
} from "../../featureDocument.ts";
import {
  acknowledgeFeatureDocumentSourceChange,
  createFeatureDocumentShare,
  downloadFeatureDocumentMarkdown,
  getFeatureDocument,
  regenerateFeatureDocument,
  restoreFeatureDocumentRevision,
  revokeFeatureDocumentShare,
  saveFeatureDocumentRevision,
  setFeatureDocumentReviewStatus,
} from "../featureDocumentsApi.ts";
import { assessFeatureDocumentReadiness } from "../../featureDocumentReadiness.ts";
import { copyShareLink } from "../screenActions.ts";
import { CopyButton } from "./CopyButton.tsx";
import { FeatureDocumentEditor } from "./FeatureDocumentEditor.tsx";
import { useApplicationToast } from "./ApplicationToast.tsx";

const statusLabel: Record<FeatureDocumentReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  superseded: "Superseded",
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FeatureDocumentHandoffPanel({
  document,
  revision,
  onDocumentChange,
  onJobStarted,
  onOpenVisualStep,
}: {
  document: FeatureDocumentView;
  revision: FeatureDocumentRevisionView;
  onDocumentChange(document: FeatureDocumentView): void;
  onJobStarted(job: FeatureDocumentJobView): void;
  onOpenVisualStep(stepNumber: number): void;
}) {
  const showToast = useApplicationToast();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FeatureDocumentContent>(() => structuredClone(revision.content));
  const [focusInstruction, setFocusInstruction] = useState(revision.focusInstruction);
  const [newShareUrl, setNewShareUrl] = useState("");
  const readiness = useMemo(
    () => assessFeatureDocumentReadiness(document, revision),
    [document.sourceChanged, revision],
  );
  const activeShares = document.shares.filter(({ revokedAt }) => !revokedAt);

  useEffect(() => {
    setDraft(structuredClone(revision.content));
    setFocusInstruction(revision.focusInstruction);
    setEditing(false);
  }, [revision.id]);

  const run = async (name: string, action: () => Promise<void>, success?: string) => {
    setBusy(name);
    setError("");
    try {
      await action();
      if (success) showToast(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document Flow action failed");
    } finally {
      setBusy("");
    }
  };

  const refresh = async () => onDocumentChange(await getFeatureDocument(document.id));

  const saveDraft = () => run("save", async () => {
    await saveFeatureDocumentRevision(document.id, revision.id, draft);
    await refresh();
    setEditing(false);
  }, "Draft revision saved");

  const changeStatus = (status: FeatureDocumentReviewStatus) => run(`status-${status}`, async () => {
    onDocumentChange(await setFeatureDocumentReviewStatus(document.id, revision.id, status));
  }, status === "approved" ? "Feature brief approved" : status === "in_review" ? "Review requested" : "Returned to draft");

  const regenerate = () => run("regenerate", async () => {
    const job = await regenerateFeatureDocument(document.id, focusInstruction.trim());
    onJobStarted(job);
  }, "Regeneration started");

  const acknowledgeSource = () => run("acknowledge", async () => {
    onDocumentChange(await acknowledgeFeatureDocumentSourceChange(document.id));
  }, "Source change acknowledged");

  const restore = (revisionId: number) => run(`restore-${revisionId}`, async () => {
    await restoreFeatureDocumentRevision(document.id, revisionId);
    await refresh();
  }, "Revision restored as a new draft");

  const createShare = () => run("share", async () => {
    const share = await createFeatureDocumentShare(document.id, revision.id);
    setNewShareUrl(share.url ?? "");
    await refresh();
  }, "Review link created");

  const revokeShare = (shareId: number) => run(`revoke-${shareId}`, async () => {
    await revokeFeatureDocumentShare(document.id, shareId);
    setNewShareUrl("");
    await refresh();
  }, "Review link revoked");

  const exportMarkdown = () => run("export", async () => {
    const file = await downloadFeatureDocumentMarkdown(document.id, revision.id);
    downloadBlob(file.blob, file.filename);
  }, "Markdown exported");

  const openEvidence = (evidenceId: string) => {
    const evidence = revision.evidenceManifest.find((item) => item.evidenceId === evidenceId);
    if (evidence) onOpenVisualStep(evidence.stepIndex + 1);
  };

  return (
    <section className="feature-document-handoff" aria-label="Feature handoff">
      <header className="feature-document-handoff__header">
        <div>
          <p className="document-flow__eyebrow">Product handoff</p>
          <h3>Review, approve, and share this feature brief</h3>
          <p>Keep the generated requirements traceable to the selected Flow while your team turns them into approved work.</p>
        </div>
        <span className={`feature-document-handoff__status is-${revision.reviewStatus}`}>
          {statusLabel[revision.reviewStatus]}
        </span>
      </header>

      {document.sourceChanged ? (
        <section className="feature-document-handoff__source-alert" role="alert">
          <div>
            <strong>Source Flow changed</strong>
            <p>Regenerate from the latest evidence, or acknowledge the change before approval.</p>
          </div>
          <Button label="Acknowledge" variant="secondary" size="sm" isLoading={busy === "acknowledge"} onClick={acknowledgeSource} />
        </section>
      ) : null}

      <section className="feature-document-handoff__readiness" aria-label="Approval readiness">
        <header>
          <div>
            <strong>{readiness.canApprove ? "Ready for human approval" : "Approval needs attention"}</strong>
            <span>
              {countLabel(readiness.requirementCount, "requirement")} · {countLabel(readiness.acceptanceCriteriaCount, "acceptance criterion", "acceptance criteria")} · {countLabel(readiness.supportedRequirementCount, "evidence-supported requirement")}
            </span>
          </div>
        </header>
        {readiness.blockers.length || readiness.warnings.length ? (
          <ul>
            {readiness.blockers.map((issue) => <li key={issue.id} className="is-blocker"><strong>Blocker</strong>{issue.label}</li>)}
            {readiness.warnings.map((issue) => <li key={issue.id} className="is-warning"><strong>Check</strong>{issue.label}</li>)}
          </ul>
        ) : <p>No readiness issues detected. Approval remains a human decision.</p>}
      </section>

      <section className="feature-document-handoff__actions" aria-label="Review lifecycle">
        <div>
          <strong>Review lifecycle</strong>
          <span>Content is editable only while the current revision is Draft.</span>
        </div>
        <div className="feature-document-handoff__button-row">
          {revision.reviewStatus === "draft" ? (
            <>
              <Button label={editing ? "Close editor" : "Edit draft"} variant="secondary" onClick={() => setEditing((value) => !value)} />
              <Button label="Request review" variant="primary" isLoading={busy === "status-in_review"} onClick={() => void changeStatus("in_review")} />
            </>
          ) : null}
          {revision.reviewStatus === "in_review" ? (
            <>
              <Button label="Return to draft" variant="secondary" isLoading={busy === "status-draft"} onClick={() => void changeStatus("draft")} />
              <Button label="Approve" variant="primary" isDisabled={!readiness.canApprove} isLoading={busy === "status-approved"} onClick={() => void changeStatus("approved")} />
            </>
          ) : null}
          <Button label="Export Markdown" variant="secondary" isLoading={busy === "export"} onClick={() => void exportMarkdown()} />
          <Button label="Create review link" variant="secondary" isLoading={busy === "share"} onClick={() => void createShare()} />
        </div>
      </section>

      {newShareUrl ? (
        <section className="feature-document-handoff__share-created" aria-label="New review link">
          <div><strong>Review link created</strong><span>Expires in seven days. Copy it now; the full URL is not shown again after reload.</span></div>
          <CopyButton label="Copy review link" successMessage="Review link copied" action={() => copyShareLink(newShareUrl)} variant="primary" />
        </section>
      ) : null}

      {activeShares.length ? (
        <section className="feature-document-handoff__shares" aria-label="Active review links">
          <strong>Active review links</strong>
          <ul>{activeShares.map((share) => (
            <li key={share.id}>
              <span>Revision {document.revisions.find(({ id }) => id === share.revisionId)?.revisionNumber ?? share.revisionId} · expires {formatDate(share.expiresAt)}</span>
              <Button label="Revoke" variant="ghost" size="sm" isLoading={busy === `revoke-${share.id}`} onClick={() => void revokeShare(share.id)} />
            </li>
          ))}</ul>
        </section>
      ) : null}

      {editing ? (
        <section className="feature-document-handoff__editor" aria-label="Edit Feature brief">
          <header><div><strong>Edit draft</strong><span>Saving creates a new immutable Draft revision.</span></div></header>
          <FeatureDocumentEditor content={draft} onChange={setDraft} onEvidence={openEvidence} />
          <footer>
            <Button label="Cancel" variant="secondary" onClick={() => { setDraft(structuredClone(revision.content)); setEditing(false); }} />
            <Button label="Save new revision" variant="primary" isLoading={busy === "save"} onClick={() => void saveDraft()} />
          </footer>
        </section>
      ) : null}

      <section className="feature-document-handoff__regenerate" aria-label="Regenerate feature brief">
        <div><strong>Regenerate from the source Flow</strong><span>Creates a new generated revision without deleting prior human edits.</span></div>
        <TextArea label="Focus instruction" value={focusInstruction} onChange={setFocusInstruction} rows={3} width="100%" />
        <Button label="Regenerate" variant="secondary" isLoading={busy === "regenerate"} onClick={() => void regenerate()} />
      </section>

      <section className="feature-document-handoff__history" aria-label="Revision history">
        <strong>Revision history</strong>
        <ol>{document.revisions.map((item) => (
          <li key={item.id} className={item.id === revision.id ? "is-current" : ""}>
            <div>
              <span>Revision {item.revisionNumber} · {statusLabel[item.reviewStatus]}</span>
              <small>{item.authorType} · {formatDate(item.createdAt)}</small>
            </div>
            {item.id !== revision.id ? (
              <Button label="Restore as draft" variant="ghost" size="sm" isLoading={busy === `restore-${item.id}`} onClick={() => void restore(item.id)} />
            ) : <span>Current</span>}
          </li>
        ))}</ol>
      </section>

      {error ? <p className="feature-document-handoff__error" role="alert">{error}</p> : null}
    </section>
  );
}
