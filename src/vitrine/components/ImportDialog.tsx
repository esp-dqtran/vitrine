import { useState } from 'react';
import { Button, Dialog, Heading, Text, TextInput } from '@astryxdesign/core';
import type { App, Job, RowStatus } from '../types';
import { groupPipelines } from '../jobs';

// ------------------------------------------------------------------
// Per-app row view-model (real apps + in-flight import jobs) — shared by
// the Apps grid for status badges and progress labels on each card.
// ------------------------------------------------------------------
export interface RowVM {
  slug: string;
  name: string;
  cat: string;
  accent: string;
  iconUrl?: string | null;
  captured: number;
  analyzed: number;
  lastSynced: string | null;
  status: RowStatus;
  app?: App;
}

export function appRow(a: App): RowVM {
  const captured = a.totalScreens;
  const analyzed = a.analyzedScreens ?? a.screens.filter((s) => s.confidence != null).length;
  const lastSynced = a.lastCapturedAt ?? a.screens.reduce<string | null>((m, s) => (s.capturedAt && (!m || s.capturedAt > m) ? s.capturedAt : m), null);
  return { slug: a.id, name: a.app, cat: a.cat, accent: a.accent, iconUrl: a.iconUrl, captured, analyzed, lastSynced, status: captured > 0 && analyzed >= captured ? 'Complete' : 'In progress', app: a };
}

export const ROW_STATUS_VARIANT: Record<RowStatus, 'neutral' | 'blue' | 'green' | 'red'> = { Queued: 'neutral', 'In progress': 'blue', Complete: 'green', 'Needs attention': 'red', Cancelled: 'neutral' };

// Real apps + synthetic "Queued/In progress" rows for imports still in the pipeline (no
// screens synced yet, so no real App object exists for them).
export function buildPipelineRows(apps: App[], jobs: Job[]): RowVM[] {
  const real = apps.map(appRow);
  const known = new Set(real.map((r) => r.slug));
  const pipelineRows: RowVM[] = groupPipelines(jobs)
    .filter((pipeline) => Boolean(pipeline.root.payload.name) && !known.has(pipeline.root.payload.name!))
    .filter((pipeline, index, all) => all.findIndex((candidate) => candidate.root.payload.name === pipeline.root.payload.name) === index)
    .map((pipeline) => {
      const name = pipeline.root.payload.name!;
      const stages = pipeline.stages;
      const active = stages.find((s) => s.status === 'running') ?? stages.find((s) => s.status === 'queued');
      const status: RowStatus = stages.some((stage) => stage.status === 'error')
        ? 'Needs attention'
        : active
          ? (active.type === 'import-app' ? 'Queued' : 'In progress')
          : stages.some((stage) => stage.status === 'cancelled')
            ? 'Cancelled'
            : 'Complete';
      return { slug: name, name, cat: 'Importing', accent: '#a3a3ab', captured: 0, analyzed: 0, lastSynced: null, status };
    });
  return [...pipelineRows, ...real];
}

// ------------------------------------------------------------------
// Import dialog — one URL; jobsApi preserves Mobbin Apps imports and sends other public
// websites to the isolated rendered-page crawler.
// ------------------------------------------------------------------
export function ImportDialog({ isOpen, onClose, submitImport }: { isOpen: boolean; onClose: () => void; submitImport: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setUrl(''); setError(null); };
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitImport(url.trim());
      reset();
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }} purpose="form" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading level={3}>Import from URL</Heading>
        <Text color="secondary">Paste any public website URL. We render the page, detect its sections from HTML, capture the full page, and record a continuous scrolling preview.</Text>
        <TextInput label="Website or Mobbin URL" value={url} onChange={setUrl} placeholder="https://example.com" width="100%" hasClear status={error ? { type: 'error', message: error } : undefined} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" label="Cancel" clickAction={() => { reset(); onClose(); }} />
          <Button variant="primary" label="Submit" isDisabled={!url.trim() || busy} isLoading={busy} clickAction={submit} />
        </div>
      </div>
    </Dialog>
  );
}
