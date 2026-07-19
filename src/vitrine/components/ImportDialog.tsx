import { useState } from 'react';
import { Button, Dialog, Heading, Selector, Text, TextInput } from '@astryxdesign/core';
import type { App, Job, RowStatus } from '../types';
import { groupPipelines } from '../jobs';
import { isPlatform, platformFromUrl, PLATFORM_LABEL, PLATFORMS, type Platform } from '../../platformFromUrl';

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
// Import dialog — pick a Mobbin screens URL + platform, queue the import
// ------------------------------------------------------------------

// Derive an app slug from a pasted Mobbin (or plain website) URL, for the import form.
function deriveSlug(raw: string): string {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (u.hostname.includes('mobbin.com')) {
      const seg = u.pathname.split('/').filter(Boolean)[1] ?? '';
      const m = seg.match(/^(.*)-(?:web|ios|android)-[0-9a-f-]{36}$/i);
      return (m ? m[1] : seg).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || '';
    }
    return (u.hostname.replace(/^www\./, '').split('.')[0] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-') || '';
  } catch {
    return '';
  }
}

// Mobbin URLs already encode the platform in their slug (…-ios-<uuid>, …-web-<uuid>) — detect
// it as a starting point, but always let the user confirm/correct it before submitting so a
// hand-typed or unusual URL never silently imports under the wrong platform.
function detectPlatform(url: string): Platform {
  try { return platformFromUrl(url); } catch { return 'web'; }
}

export function ImportDialog({ isOpen, onClose, submitImport, knownPlatforms }: { isOpen: boolean; onClose: () => void; submitImport: (name: string, url: string, platform: Platform) => Promise<void>; knownPlatforms: (name: string) => Platform[] }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [platform, setPlatform] = useState<Platform>('web');
  const [platformEdited, setPlatformEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onUrl = (value: string) => {
    setUrl(value);
    if (!nameEdited) setName(deriveSlug(value));
    if (!platformEdited) setPlatform(detectPlatform(value));
  };
  const reset = () => { setUrl(''); setName(''); setNameEdited(false); setPlatform('web'); setPlatformEdited(false); setError(null); };
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitImport(name.trim(), url.trim(), platform);
      reset();
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const existingPlatforms = name.trim() ? knownPlatforms(name.trim()) : [];

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }} purpose="form" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading level={3}>Import from URL</Heading>
        <Text color="secondary">Paste a Mobbin app screens URL. It&rsquo;s queued for the crawl → describe → extract pipeline.</Text>
        <TextInput label="Mobbin screens URL" value={url} onChange={onUrl} placeholder="https://mobbin.com/apps/…/screens" width="100%" hasClear />
        <TextInput label="App name (slug)" value={name} onChange={(v) => { setName(v); setNameEdited(true); }} placeholder="linear" width="100%" hasClear status={error ? { type: 'error', message: error } : undefined} />
        <Selector
          label="Platform"
          size="sm"
          value={platform}
          onChange={(value) => { setPlatformEdited(true); setPlatform(value as Platform); }}
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
        />
        {existingPlatforms.length > 0 && (
          <Text type="supporting" color="secondary">
            {name.trim()} already has: {existingPlatforms.map((p) => PLATFORM_LABEL[p]).join(', ')}. This import adds {PLATFORM_LABEL[platform]}.
          </Text>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" label="Cancel" clickAction={() => { reset(); onClose(); }} />
          <Button variant="primary" label="Submit" isDisabled={!url.trim() || !name.trim() || busy} isLoading={busy} clickAction={submit} />
        </div>
      </div>
    </Dialog>
  );
}

export function knownPlatformsFor(apps: App[]) {
  return (name: string): Platform[] => {
    const found = apps.find((a) => a.id === name || a.app === name);
    return found ? [...new Set(found.screens.map((s) => s.platform))].filter(isPlatform) : [];
  };
}
