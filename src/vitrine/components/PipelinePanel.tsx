import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Text, TextInput } from '@astryxdesign/core';
import { groupPipelines } from '../jobs';
import type { Job } from '../types';
import { useJobs } from '../useJobs';

const STAGE_LABEL: Record<Job['type'], string> = {
  'import-app': 'Import screenshots',
  'caption-app': 'Caption screens',
  'synthesize-app': 'Synthesize design system',
  'discover-catalog': 'Discover catalog',
  'research-app': 'Research crawl plan',
  'smart-crawl-app': 'Run intelligent crawler',
};

const STATUS_VARIANT: Record<Job['status'], 'neutral' | 'info' | 'success' | 'error'> = {
  queued: 'neutral',
  running: 'info',
  done: 'success',
  error: 'error',
  cancelled: 'neutral',
};

export function PipelinePanel({ onPipelineDone }: { onPipelineDone: () => void | Promise<void> }) {
  const { jobs, error, submitImport, cancelJob } = useJobs();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const seenDone = useRef(new Set<number>());
  const pipelines = groupPipelines(jobs);

  useEffect(() => {
    for (const job of jobs) {
      if (job.type === 'synthesize-app' && job.status === 'done' && !seenDone.current.has(job.id)) {
        seenDone.current.add(job.id);
        void onPipelineDone();
      }
    }
  }, [jobs, onPipelineDone]);

  const submit = async () => {
    setSubmitError(null);
    try {
      await submitImport(name.trim(), url.trim());
      setUrl('');
    } catch (cause) {
      setSubmitError((cause as Error).message);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text weight="semibold">Import a Mobbin app</Text>
          <Text type="supporting" color="secondary">
            Crawl screenshots, caption them, and synthesize a design system.
          </Text>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <TextInput
            label="App name"
            value={name}
            onChange={setName}
            placeholder="linear"
            isRequired
            hasClear
            width="100%"
          />
          <TextInput
            label="Mobbin screens URL"
            value={url}
            onChange={setUrl}
            placeholder="https://mobbin.com/apps/.../screens"
            isRequired
            hasClear
            width="100%"
            status={submitError ? { type: 'error', message: submitError } : undefined}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              label="Import app"
              variant="primary"
              clickAction={submit}
              isDisabled={!name.trim() || !url.trim()}
            />
          </div>
        </div>

        {error ? <div style={{ color: 'var(--color-text-danger, #b42318)', fontSize: 13 }}>{error}</div> : null}

        {pipelines.slice(0, 5).map((pipeline) => (
          <div key={pipeline.root.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <Text weight="semibold">{pipeline.root.payload.name ?? `Pipeline ${pipeline.root.id}`}</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {pipeline.stages.map((stage) => (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Badge label={stage.status} variant={STATUS_VARIANT[stage.status]} />
                  <Text type="supporting">{STAGE_LABEL[stage.type]}</Text>
                  {stage.message ? (
                    <Text type="supporting" color="secondary">
                      {stage.message}
                    </Text>
                  ) : null}
                  <div style={{ flex: 1 }} />
                  {stage.status === 'queued' || stage.status === 'running' ? (
                    <Button
                      label="Cancel"
                      size="sm"
                      variant="destructive"
                      clickAction={() => cancelJob(stage.id)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
