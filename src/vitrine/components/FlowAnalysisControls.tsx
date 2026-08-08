import { Spinner } from './Spinner.tsx';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core';
import type { AppKnowledgeJobView } from '../../appKnowledgeStore.ts';
import type { Platform } from '../../platformFromUrl.ts';
import type { AppKnowledgeState } from '../appKnowledgeStore.ts';
import { useAppKnowledge } from '../useAppKnowledge.ts';

interface FlowAnalysisActions {
  start?(): Promise<unknown>;
  cancel?(jobId: number): Promise<unknown>;
  resume?(jobId: number): Promise<unknown>;
  retryFailed?(jobId: number): Promise<unknown>;
  regenerate?(snapshotId: number): Promise<unknown>;
}

export function FlowAnalysisControlsView(props: {
  userRole: 'admin' | 'user';
  version?: number;
  status: AppKnowledgeState['status'];
  currentJob: AppKnowledgeJobView | null;
  snapshotId?: number;
  actions: FlowAnalysisActions | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (props.userRole !== 'admin') return null;

  const run = (operation: (() => Promise<unknown>) | undefined) => {
    if (!operation || pending) return;
    setPending(true);
    setError('');
    void operation()
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setPending(false));
  };
  const job = props.currentJob;
  const active = job?.status === 'queued' || job?.status === 'running';
  const analyze = props.snapshotId && props.actions?.regenerate
    ? () => props.actions!.regenerate!(props.snapshotId!)
    : props.actions?.start;

  return (
    <section className="flow-analysis-controls" aria-label="Flow analysis controls">
      <div>
        <strong>Flow analysis</strong>
        <span>
          {active
            ? `${job.doneCount}/${job.totalCount} steps · ${job.stage.replaceAll('_', ' ')}`
            : job?.status === 'done'
              ? 'Analysis saved to this Flow version'
              : 'Analyze ordered Flow steps and keep the results with each Flow'}
        </span>
      </div>
      <div className="flow-analysis-controls__actions">
        {(props.status === 'idle' || props.status === 'loading') && !job ? (
          <Spinner size="sm" />
        ) : active ? (
          <Button
            label="Cancel"
            variant="secondary"
            size="sm"
            isDisabled={pending}
            clickAction={() => run(() => props.actions!.cancel!(job.id))}
          />
        ) : job?.status === 'cancelled' || job?.status === 'stale' ? (
          <Button
            label="Resume flow analysis"
            size="sm"
            isDisabled={pending}
            clickAction={() => run(() => props.actions!.resume!(job.id))}
          />
        ) : job?.status === 'error' && job.failedCount > 0 ? (
          <Button
            label="Retry failed steps"
            size="sm"
            isDisabled={pending}
            clickAction={() => run(() => props.actions!.retryFailed!(job.id))}
          />
        ) : (
          <Button
            label={job?.status === 'done' ? 'Analyze again' : 'Analyze flows'}
            variant="primary"
            size="sm"
            isDisabled={!props.version || pending || !analyze}
            clickAction={() => run(analyze)}
          />
        )}
      </div>
      {error && <span role="alert" className="flow-analysis-controls__error">{error}</span>}
    </section>
  );
}

export function FlowAnalysisControls(props: {
  app: string;
  platform: Platform;
  version?: number;
  userRole: 'admin' | 'user';
  onComplete?(): void;
}) {
  const knowledge = useAppKnowledge({
    app: props.app,
    platform: props.platform,
    version: props.version,
    role: 'designer',
    userRole: props.userRole,
  });
  const completedJob = useRef<number | null>(null);
  useEffect(() => {
    if (
      knowledge.currentJob?.status === 'done'
      && completedJob.current !== knowledge.currentJob.id
    ) {
      completedJob.current = knowledge.currentJob.id;
      props.onComplete?.();
    }
  }, [knowledge.currentJob?.id, knowledge.currentJob?.status, props.onComplete]);
  const snapshotId = knowledge.data && 'snapshot' in knowledge.data
    ? knowledge.data.snapshot.id
    : undefined;

  return (
    <FlowAnalysisControlsView
      userRole={props.userRole}
      version={props.version}
      status={knowledge.status}
      currentJob={knowledge.currentJob}
      snapshotId={snapshotId}
      actions={knowledge.actions}
    />
  );
}
