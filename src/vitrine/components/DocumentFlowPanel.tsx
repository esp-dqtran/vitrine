import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, Spinner } from '@astryxdesign/core';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type {
  FeatureDocumentRevisionView,
  FeatureDocumentView,
} from '../../featureDocument.ts';
import type { Platform } from '../../platformFromUrl.ts';
import {
  cancelFeatureDocumentJob,
  getFeatureDocument,
  getFeatureDocumentByFlow,
  getFeatureDocumentMarkdown,
  retryFeatureDocumentJob,
  subscribeFeatureDocumentJob,
} from '../featureDocumentsApi.ts';
import { FeatureDocumentProgress } from './FeatureDocumentProgress.tsx';
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

export type DocumentFlowMarkdownState =
  | { kind: 'loading' }
  | { kind: 'ready'; content: string }
  | { kind: 'error'; message: string };

export interface DocumentFlowPanelViewProps {
  state: DocumentFlowState;
  userRole: 'admin' | 'user';
  markdown?: DocumentFlowMarkdownState;
  connectionError?: string;
  onGenerate?(): void;
  onCancel?(): void;
  onRetry?(): void;
  onReconnect?(): void;
  onMarkdownRetry?(): void;
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

export function DocumentFlowPanelView({
  state,
  userRole,
  markdown = { kind: 'loading' },
  connectionError,
  onGenerate,
  onCancel,
  onRetry,
  onReconnect,
  onMarkdownRetry,
}: DocumentFlowPanelViewProps) {
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

  if (markdown.kind === 'loading') {
    return (
      <section className="document-flow document-flow--loading" aria-label="Document Flow">
        <div role="status" aria-label="Loading Document Flow Markdown"><Spinner size="lg" /></div>
      </section>
    );
  }

  if (markdown.kind === 'error') {
    return (
      <section className="document-flow document-flow--error" aria-label="Document Flow">
        <div role="alert">{markdown.message}</div>
        {onMarkdownRetry && (
          <Button label="Retry Markdown" variant="primary" clickAction={onMarkdownRetry} />
        )}
      </section>
    );
  }

  return (
    <section className="document-flow document-flow--ready" aria-label="Document Flow">
      <article className="document-flow__markdown">
        <Markdown remarkPlugins={[remarkGfm]}>{markdown.content}</Markdown>
      </article>
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
  const [markdown, setMarkdown] = useState<DocumentFlowMarkdownState>({ kind: 'loading' });
  const [markdownReloadVersion, setMarkdownReloadVersion] = useState(0);

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

  const readyDocumentId = state.kind === 'ready' ? state.document.id : undefined;
  const readyRevisionId = state.kind === 'ready' ? state.revision.id : undefined;

  useEffect(() => {
    if (readyDocumentId === undefined || readyRevisionId === undefined) {
      setMarkdown({ kind: 'loading' });
      return;
    }
    let live = true;
    setMarkdown({ kind: 'loading' });
    void getFeatureDocumentMarkdown(readyDocumentId, readyRevisionId)
      .then((content) => {
        if (live) setMarkdown({ kind: 'ready', content });
      })
      .catch((error: Error) => {
        if (live) {
          setMarkdown({
            kind: 'error',
            message: error.message || 'Could not load Document Flow Markdown.',
          });
        }
      });
    return () => {
      live = false;
    };
  }, [markdownReloadVersion, readyDocumentId, readyRevisionId]);

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
        state={state}
        userRole={props.userRole}
        markdown={markdown}
        connectionError={connectionError}
        onGenerate={() => setSetupOpen(true)}
        onCancel={() => void cancel()}
        onRetry={() => void retry()}
        onReconnect={() => setSubscriptionVersion((current) => current + 1)}
        onMarkdownRetry={() => setMarkdownReloadVersion((current) => current + 1)}
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
