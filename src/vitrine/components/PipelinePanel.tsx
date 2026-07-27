import { useEffect, useRef } from 'react';
import { Badge, Button, Card, Text } from '@astryxdesign/core';
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
  'crawl-public-page': 'Crawl public page',
};

const STATUS_VARIANT: Record<Job['status'], 'neutral' | 'info' | 'success' | 'error'> = {
  queued: 'neutral',
  running: 'info',
  done: 'success',
  error: 'error',
  cancelled: 'neutral',
};

export function PipelinePanel({ onPipelineDone }: { onPipelineDone: () => void | Promise<void> }) {
  const { jobs, error, cancelJob } = useJobs();
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

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text weight="semibold">Pipeline activity</Text>
          <Text type="supporting" color="secondary">
            Monitor and cancel existing processing jobs.
          </Text>
        </div>

        {error ? <div style={{ color: 'var(--color-text-danger)', fontSize: 13 }}>{error}</div> : null}

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
