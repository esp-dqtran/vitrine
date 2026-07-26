import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type {
  FeatureClaim,
  FeatureDocumentRevisionView,
  FeatureDocumentView,
} from '../../featureDocument.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { buildDocumentFlowNarrative } from '../documentFlowModel.ts';
import {
  cancelFeatureDocumentJob,
  getFeatureDocument,
  getFeatureDocumentByFlow,
  retryFeatureDocumentJob,
  subscribeFeatureDocumentJob,
} from '../featureDocumentsApi.ts';
import { FeatureDocumentProgress } from './FeatureDocumentProgress.tsx';
import { FeatureDocumentWorkspace } from './FeatureDocumentPage.tsx';
import { FeatureDocumentSetupDialog } from './FeatureDocumentSetupDialog.tsx';

export interface DocumentFlowPanelProps {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  selectedStep?: number;
  onOpenVisualStep(step: number): void;
}

export type DocumentFlowState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'pending'; document: FeatureDocumentView }
  | { kind: 'ready'; document: FeatureDocumentView; revision: FeatureDocumentRevisionView }
  | { kind: 'error'; message: string; retryable: boolean };

export interface DocumentFlowPanelViewProps {
  flow: DesignFlow<EvidenceView>;
  state: DocumentFlowState;
  userRole: 'admin' | 'user';
  selectedStep?: number;
  editing?: boolean;
  connectionError?: string;
  onOpenVisualStep(step: number): void;
  onEdit?(): void;
  onDocumentChange?(document: FeatureDocumentView): void;
  onGenerate?(): void;
  onCancel?(): void;
  onRetry?(): void;
  onReconnect?(): void;
}

export function classifyDocumentFlow(document: FeatureDocumentView): DocumentFlowState {
  const revision = document.currentRevision ?? document.revisions[0];
  if (revision) return { kind: 'ready', document, revision };
  if (document.currentJob) return { kind: 'pending', document };
  return {
    kind: 'error',
    message: 'Document Flow has no revision or active generation.',
    retryable: false,
  };
}

function Claim({ claim }: { claim: FeatureClaim }) {
  return (
    <div className="document-flow__claim">
      <span className={`document-flow__claim-kind is-${claim.kind}`}>{claim.kind}</span>
      <p>{claim.text}</p>
    </div>
  );
}

export function DocumentFlowPanelView({
  flow,
  state,
  userRole,
  selectedStep,
  editing = false,
  connectionError,
  onOpenVisualStep,
  onEdit,
  onDocumentChange,
  onGenerate,
  onCancel,
  onRetry,
  onReconnect,
}: DocumentFlowPanelViewProps) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (selectedStep === undefined) return;
    globalThis.document
      ?.getElementById(`document-flow-step-${selectedStep}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedStep]);

  if (state.kind === 'loading') {
    return (
      <section className="document-flow document-flow--loading" aria-label="Document Flow">
        <div role="status" aria-label="Loading Document Flow"><Spinner size="lg" /></div>
      </section>
    );
  }

  if (state.kind === 'missing') {
    return (
      <section className="document-flow document-flow--missing" aria-label="Document Flow">
        <EmptyState
          title="Document Flow unavailable"
          description="This Flow does not have a text representation yet."
        />
        {userRole === 'admin' && onGenerate && (
          <Button label="Generate Document Flow" variant="primary" clickAction={onGenerate} />
        )}
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="document-flow document-flow--error" aria-label="Document Flow">
        <div role="alert">{state.message}</div>
        {state.retryable && onRetry && (
          <Button label="Retry Document Flow" variant="primary" clickAction={onRetry} />
        )}
      </section>
    );
  }

  if (state.kind === 'pending') {
    return (
      <section className="document-flow document-flow--pending" aria-label="Document Flow">
        <h3>Generating Document Flow</h3>
        {state.document.currentJob
          ? (
              <FeatureDocumentProgress
                job={state.document.currentJob}
                connectionError={connectionError}
                onCancel={onCancel}
                onRetry={onRetry}
                onReconnect={onReconnect}
              />
            )
          : (
              <div role="status">Preparing Document Flow…</div>
            )}
      </section>
    );
  }

  if (editing) {
    return (
      <section className="document-flow document-flow--editing" aria-label="Document Flow">
        <Button
          label="Back to Document Flow"
          variant="ghost"
          clickAction={onEdit}
        />
        <FeatureDocumentWorkspace
          initialDocument={state.document}
          embedded
          onDocumentChange={onDocumentChange}
        />
      </section>
    );
  }

  const narrative = buildDocumentFlowNarrative(flow, state.revision);
  return (
    <section className="document-flow document-flow--ready" aria-label="Document Flow">
      {userRole === 'admin' && onEdit && (
        <div className="document-flow__actions">
          <Button label="Edit Document Flow" variant="secondary" clickAction={onEdit} />
        </div>
      )}
      <section className="document-flow__section" aria-labelledby="document-flow-overview">
        <h3 id="document-flow-overview">Overview</h3>
        <Claim claim={narrative.overview.purpose} />
        <Claim claim={narrative.overview.userValue} />
      </section>
      <section className="document-flow__section" aria-labelledby="document-flow-trigger">
        <h3 id="document-flow-trigger">Trigger</h3>
        <Claim claim={narrative.trigger} />
      </section>
      <section className="document-flow__section" aria-labelledby="document-flow-steps">
        <h3 id="document-flow-steps">Ordered steps</h3>
        <ol className="document-flow__steps">
          {narrative.steps.map((step) => (
            <li
              key={step.number}
              id={`document-flow-step-${step.number}`}
              className="document-flow__step"
              aria-current={selectedStep === step.number ? 'step' : undefined}
            >
              <div>
                <strong>{String(step.number).padStart(2, '0')} · {step.label}</strong>
                <span className={`document-flow__claim-kind is-${step.kind}`}>{step.kind}</span>
                <p>{step.text}</p>
              </div>
              <Button
                label={`View visual step ${step.number}`}
                variant="ghost"
                size="sm"
                clickAction={() => onOpenVisualStep(step.number)}
              />
            </li>
          ))}
        </ol>
      </section>
      <section className="document-flow__section" aria-labelledby="document-flow-outcome">
        <h3 id="document-flow-outcome">Outcome</h3>
        <Claim claim={narrative.outcome} />
      </section>
      <section className="document-flow__section" aria-labelledby="document-flow-alternates">
        <h3 id="document-flow-alternates">Alternate and error paths</h3>
        {narrative.alternates.length > 0
          ? narrative.alternates.map((claim) => <Claim key={claim.id} claim={claim} />)
          : <p>No alternate or error paths documented.</p>}
      </section>
    </section>
  );
}

function unavailable(error: unknown): boolean {
  const candidate = error as { code?: string; status?: number };
  return candidate.status === 404 && candidate.code === 'document_flow_unavailable';
}

export function DocumentFlowPanel(props: DocumentFlowPanelProps) {
  const { app, platform, version, flow } = props;
  const [state, setState] = useState<DocumentFlowState>({ kind: 'loading' });
  const [setupOpen, setSetupOpen] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const [editing, setEditing] = useState(false);

  const loadBySource = useCallback(async () => {
    if (!app || !platform || !version) {
      setState({ kind: 'missing' });
      return;
    }
    setState({ kind: 'loading' });
    setConnectionError('');
    try {
      setState(classifyDocumentFlow(await getFeatureDocumentByFlow({
        app,
        platform,
        version,
        flowId: flow.id,
      })));
    } catch (error) {
      if (unavailable(error)) {
        setState({ kind: 'missing' });
      } else {
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load Document Flow.',
          retryable: true,
        });
      }
    }
  }, [app, flow.id, platform, version]);

  useEffect(() => {
    void loadBySource();
  }, [loadBySource]);

  useEffect(() => {
    if (state.kind !== 'pending' || !state.document.currentJob) return;
    const job = state.document.currentJob;
    if (job.status !== 'queued' && job.status !== 'running') return;
    setConnectionError('');
    return subscribeFeatureDocumentJob(
      job.id,
      (nextJob) => {
        if (nextJob.status === 'done') {
          void getFeatureDocument(nextJob.documentId)
            .then((next) => setState(classifyDocumentFlow(next)))
            .catch((error: Error) => setState({ kind: 'error', message: error.message, retryable: true }));
          return;
        }
        setState((current) => current.kind === 'pending'
          ? {
              kind: 'pending',
              document: { ...current.document, currentJob: nextJob },
            }
          : current);
      },
      (error) => setConnectionError(error.message),
    );
  }, [state.kind === 'pending' ? state.document.currentJob?.id : undefined, subscriptionVersion]);

  const currentJob = state.kind === 'pending' ? state.document.currentJob : undefined;
  const cancel = async () => {
    if (!currentJob) return;
    const job = await cancelFeatureDocumentJob(currentJob.id);
    setState((current) => current.kind === 'pending'
      ? { kind: 'pending', document: { ...current.document, currentJob: job } }
      : current);
  };
  const retry = async () => {
    if (state.kind === 'error') {
      await loadBySource();
      return;
    }
    if (!currentJob) return;
    const job = await retryFeatureDocumentJob(currentJob.id);
    setState((current) => current.kind === 'pending'
      ? { kind: 'pending', document: { ...current.document, currentJob: job } }
      : current);
    setSubscriptionVersion((current) => current + 1);
  };
  const created = (documentId: number) => {
    setSetupOpen(false);
    setState({ kind: 'loading' });
    void getFeatureDocument(documentId)
      .then((next) => setState(classifyDocumentFlow(next)))
      .catch((error: Error) => setState({ kind: 'error', message: error.message, retryable: true }));
  };

  return (
    <>
      <DocumentFlowPanelView
        flow={flow}
        state={state}
        userRole={props.userRole}
        selectedStep={props.selectedStep}
        editing={editing}
        connectionError={connectionError}
        onOpenVisualStep={props.onOpenVisualStep}
        onEdit={() => setEditing((current) => !current)}
        onDocumentChange={(next) => setState(classifyDocumentFlow(next))}
        onGenerate={() => setSetupOpen(true)}
        onCancel={() => void cancel()}
        onRetry={() => void retry()}
        onReconnect={() => setSubscriptionVersion((current) => current + 1)}
      />
      {app && platform && version && setupOpen && (
        <FeatureDocumentSetupDialog
          isOpen
          onClose={() => setSetupOpen(false)}
          flow={flow}
          app={app}
          platform={platform}
          version={version}
          onCreated={created}
        />
      )}
    </>
  );
}
