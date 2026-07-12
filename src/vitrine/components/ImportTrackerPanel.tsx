import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Button, Dialog, Heading, Spinner, Text, TextInput } from '@astryxdesign/core';
import type { App, Screen } from '../types';
import { groupPipelines } from '../jobs';
import { useJobs } from '../useJobs';
import { useDesignSystem } from '../useDesignSystem';

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const wrap = { maxWidth: 1360, margin: '0 auto', padding: '0 28px' } as const;

// The four automated pipeline stages, mapped to the real backend job types:
//   Crawl Mobbin              → a screen row exists (import-app)
//   Describe images (ChatGPT) → screen has an analysis / confidence (caption-app)
//   Extract design system     → the app has a synthesized snapshot (synthesize-app)
//   Finished                  → described + extracted
const STAGES = ['Crawl Mobbin', 'Describe images (ChatGPT)', 'Extract design system component', 'Finished'] as const;
const WORK = '#2563eb';
const DONE = '#16a34a';

const colLabel = {
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
} as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ------------------------------------------------------------------
// Per-app row view-model (real apps + in-flight import jobs)
// ------------------------------------------------------------------
type RowStatus = 'Queued' | 'In progress' | 'Complete';
interface RowVM {
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

function appRow(a: App): RowVM {
  const captured = a.totalScreens;
  const analyzed = a.screens.filter((s) => s.confidence != null).length;
  const lastSynced = a.screens.reduce<string | null>((m, s) => (s.capturedAt && (!m || s.capturedAt > m) ? s.capturedAt : m), null);
  return { slug: a.id, name: a.app, cat: a.cat, accent: a.accent, iconUrl: a.iconUrl, captured, analyzed, lastSynced, status: captured > 0 && analyzed >= captured ? 'Complete' : 'In progress', app: a };
}

// App icon captured at import; the accent square shows through if it's absent or fails to load.
function AppIcon({ iconUrl, accent, size, radius }: { iconUrl?: string | null; accent: string; size: number; radius: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: accent, flex: '0 0 auto', overflow: 'hidden', position: 'relative' }}>
      {iconUrl && <img src={iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  );
}

const ROW_STATUS_VARIANT: Record<RowStatus, 'neutral' | 'blue' | 'green'> = { Queued: 'neutral', 'In progress': 'blue', Complete: 'green' };
const APP_FILTERS = ['All', 'Queued', 'In progress', 'Complete'] as const;

function FilterChips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((f) => {
        const active = value === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            style={{ fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`, borderRadius: 9, padding: '7px 14px', fontSize: 13.5, fontWeight: 500, background: active ? 'var(--color-text-primary)' : 'var(--color-background-surface)', color: active ? 'var(--color-background-surface)' : 'var(--color-text-secondary)' }}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

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

function ImportDialog({ isOpen, onClose, submitImport }: { isOpen: boolean; onClose: () => void; submitImport: (name: string, url: string) => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onUrl = (value: string) => {
    setUrl(value);
    if (!nameEdited) setName(deriveSlug(value));
  };
  const reset = () => { setUrl(''); setName(''); setNameEdited(false); setError(null); };
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitImport(name.trim(), url.trim());
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
        <Text color="secondary">Paste a Mobbin app screens URL. It&rsquo;s queued for the crawl → describe → extract pipeline.</Text>
        <TextInput label="Mobbin screens URL" value={url} onChange={onUrl} placeholder="https://mobbin.com/apps/…/screens" width="100%" hasClear />
        <TextInput label="App name (slug)" value={name} onChange={(v) => { setName(v); setNameEdited(true); }} placeholder="linear" width="100%" hasClear status={error ? { type: 'error', message: error } : undefined} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" label="Cancel" clickAction={() => { reset(); onClose(); }} />
          <Button variant="primary" label="Submit" isDisabled={!url.trim() || !name.trim() || busy} isLoading={busy} clickAction={submit} />
        </div>
      </div>
    </Dialog>
  );
}

const listCols = 'minmax(170px,2fr) minmax(90px,1fr) minmax(200px,2fr) 120px 130px 84px';

function AppListView({ rows, onOpen, onImport }: { rows: RowVM[]; onOpen: (id: string) => void; onImport: () => void }) {
  const [filter, setFilter] = useState<(typeof APP_FILTERS)[number]>('All');
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const shown = rows.filter((r) => (filter === 'All' || r.status === filter) && (!query || `${r.name} ${r.cat}`.toLowerCase().includes(query)));
  const totals = rows.reduce((acc, r) => ({ captured: acc.captured + r.captured, analyzed: acc.analyzed + r.analyzed }), { captured: 0, analyzed: 0 });

  return (
    <div style={wrap}>
      <div style={{ padding: '32px 0 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <Heading level={1}>Import Tracker</Heading>
          <div style={{ marginTop: 8, maxWidth: 560 }}>
            <Text type="large" color="secondary">Track each application&rsquo;s capture and analysis progress from Mobbin.</Text>
          </div>
        </div>
        <Button variant="primary" label="Import from URL" clickAction={onImport} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '20px 0 28px' }}>
        <Stat label="Apps tracked" value={rows.length} />
        <Stat label="Screens captured" value={totals.captured} />
        <Stat label="Analyzed" value={totals.analyzed} />
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '0 0 20px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterChips options={APP_FILTERS} value={filter} onChange={setFilter} />
        <div style={{ width: 240 }}>
          <TextInput label="Search apps" isLabelHidden value={q} onChange={setQ} placeholder="Search apps…" hasClear />
        </div>
      </div>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', overflow: 'auto', background: 'var(--color-background-surface)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: listCols, gap: 10, padding: '10px 16px', minWidth: 900, background: 'var(--color-background-muted)', borderBottom: '1px solid var(--color-border)' }}>
          {['App', 'Category', 'Progress', 'Last synced', 'Status', ''].map((t, i) => <span key={t || `b${i}`} style={colLabel}>{t}</span>)}
        </div>
        {shown.map((r, i) => (
          <div key={r.slug} style={{ display: 'grid', gridTemplateColumns: listCols, gap: 10, alignItems: 'center', padding: '12px 16px', minWidth: 900, borderBottom: i < shown.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AppIcon iconUrl={r.iconUrl} accent={r.accent} size={26} radius={7} />
              <Text weight="semibold">{r.name}</Text>
            </div>
            <Text type="supporting" color="secondary">{r.cat}</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--color-background-muted)', overflow: 'hidden' }}>
                {r.captured > 0 && <div style={{ position: 'absolute', inset: '0 auto 0 0', width: '100%', background: 'var(--color-border)' }} />}
                {r.captured > 0 && <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${(r.analyzed / r.captured) * 100}%`, background: r.accent }} />}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{r.captured > 0 ? `${r.analyzed}/${r.captured} analyzed` : 'Not yet crawled'}</span>
            </div>
            <Text type="supporting" color="secondary">{r.captured > 0 ? fmtDate(r.lastSynced) : 'Just now'}</Text>
            <Badge variant={ROW_STATUS_VARIANT[r.status]} label={r.status} />
            {r.app ? <Button variant="secondary" size="sm" label="View" clickAction={() => onOpen(r.slug)} /> : <span />}
          </div>
        ))}
        {shown.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}><Text color="secondary">No apps match this filter.</Text></div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// App detail — per-screen pipeline cards with a stage timeline
// ------------------------------------------------------------------
type ScreenStatus = 'Describing' | 'Extracting' | 'Finished';
// Active stage index into STAGES (crawl=0 is always done for a captured screen).
function screenStage(s: Screen, synthesized: boolean): { status: ScreenStatus; idx: number } {
  if (s.confidence == null) return { status: 'Describing', idx: 1 };
  if (!synthesized) return { status: 'Extracting', idx: 2 };
  return { status: 'Finished', idx: 3 };
}
const SCREEN_BADGE: Record<ScreenStatus, { variant: 'blue' | 'green'; label: string }> = {
  Describing: { variant: 'blue', label: 'In progress' },
  Extracting: { variant: 'blue', label: 'In progress' },
  Finished: { variant: 'green', label: 'Finished' },
};

const STAGE_COPY: Record<(typeof STAGES)[number], { done: string; active: string }> = {
  'Crawl Mobbin': { done: 'Captured a screenshot from Mobbin.', active: 'Capturing a screenshot from Mobbin…' },
  'Describe images (ChatGPT)': { done: 'Generated a layout + component description via ChatGPT vision.', active: 'Describing layout + components via ChatGPT vision…' },
  'Extract design system component': { done: 'Matched reconstructed components against the observed design system.', active: 'Matching reconstructed components against the observed design system…' },
  Finished: { done: 'Published to the observed design system.', active: 'Publishing to the observed design system…' },
};

function StageTimeline({ screen, synthesized }: { screen: Screen; synthesized: boolean }) {
  const { idx } = screenStage(screen, synthesized);
  return (
    <div style={{ paddingTop: 14 }}>
      {STAGES.map((label, i) => {
        const state: 'done' | 'active' | 'pending' = i < idx ? 'done' : i === idx ? (label === 'Finished' ? 'done' : 'active') : 'pending';
        const dotColor = state === 'done' ? DONE : state === 'active' ? WORK : 'var(--color-border)';
        const desc = state === 'pending' ? 'Waiting on the previous stage.' : STAGE_COPY[label][state === 'active' ? 'active' : 'done'];
        const time = label === 'Crawl Mobbin' && state === 'done' ? fmtDate(screen.capturedAt) : null;
        return (
          <div key={label} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              {state === 'active'
                ? <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size="sm" /></div>
                : <div style={{ width: 9, height: 9, borderRadius: 5, background: dotColor, flex: '0 0 auto', marginTop: 2 }} />}
              {i < STAGES.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--color-border)' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 18, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <Text weight="medium" style={{ fontSize: 13.5 }}>{label}</Text>
                {time && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: MONO }}>{time}</span>}
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Full-screen viewer for the captured UI. Uses object-fit:contain so mobile (tall) and web
// (wide) screens both show in full, unlike the gallery Lightbox's fixed 16/10 frame.
function ScreenLightbox({ screens, index, onClose, onNavigate }: { screens: Screen[]; index: number; onClose: () => void; onNavigate: (i: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + screens.length) % screens.length);
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % screens.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, screens.length, onClose, onNavigate]);

  const s = screens[index];
  if (!s) return null;
  const arrow = (dir: 'left' | 'right', delta: number) => (
    <button type="button" aria-label={dir === 'left' ? 'Previous' : 'Next'} onClick={(e) => { e.stopPropagation(); onNavigate((index + delta + screens.length) % screens.length); }}
      style={{ position: 'absolute', top: '50%', [dir]: 20, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,11,0.94)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <button type="button" aria-label="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'absolute', top: 20, right: 24, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</button>
      {s.url
        ? <img src={s.url} alt={s.type} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: 'var(--color-background-muted)' }} />
        : <div onClick={(e) => e.stopPropagation()} style={{ color: '#d4d4d8' }}>Image unavailable</div>}
      {screens.length > 1 && arrow('left', -1)}
      {screens.length > 1 && arrow('right', 1)}
      <div style={{ marginTop: 16, fontSize: 13.5, color: '#d4d4d8' }}>{s.type} — {index + 1} of {screens.length}</div>
    </div>
  );
}

function ScreenCard({ screen, synthesized, onView }: { screen: Screen; synthesized: boolean; onView: () => void }) {
  const badge = SCREEN_BADGE[screenStage(screen, synthesized).status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-surface)', overflow: 'hidden' }}>
      <button type="button" onClick={onView} aria-label={`View ${screen.type}`} title="View full screen" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', padding: 0, border: 'none', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-muted)', cursor: 'pointer', display: 'block', overflow: 'hidden' }}>
        {screen.url && <img src={screen.url} alt={screen.type} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <span aria-hidden style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 7, background: 'rgba(10,10,11,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
        </span>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <Text weight="semibold" style={{ fontSize: 16 }}>{screen.type}</Text>
            {screen.sourceUrl && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screen.sourceUrl.replace(/^https?:\/\//, '')}</span>}
          </div>
          <Badge variant={badge.variant} label={badge.label} />
        </div>
        <Text type="supporting" color="secondary">Last synced {fmtDate(screen.capturedAt)}</Text>
        <StageTimeline screen={screen} synthesized={synthesized} />
      </div>
    </div>
  );
}

function AppDetailView({ app, onBack }: { app: App; onBack: () => void }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { status } = useDesignSystem(app.id);
  const synthesized = status === 'ready';
  const captured = app.totalScreens;
  const analyzed = app.screens.filter((s) => s.confidence != null).length;

  return (
    <div style={wrap}>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '24px 0 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
        Back to all apps
      </button>
      <div style={{ display: 'flex', gap: 16, padding: '18px 0 24px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AppIcon iconUrl={app.iconUrl} accent={app.accent} size={44} radius={12} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Heading level={2}>{app.app}</Heading>
            <Text type="supporting" color="secondary">{app.cat}</Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          <Stat label="Captured" value={captured} />
          <Stat label="Analyzed" value={analyzed} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, paddingTop: 4 }}>
        {app.screens.map((s, i) => <ScreenCard key={s.id} screen={s} synthesized={synthesized} onView={() => setLightbox(i)} />)}
        {app.screens.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px 16px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-surface)' }}>
            <Text color="secondary">No screens captured yet.</Text>
          </div>
        )}
      </div>
      {lightbox != null && <ScreenLightbox screens={app.screens} index={lightbox} onClose={() => setLightbox(null)} onNavigate={setLightbox} />}
    </div>
  );
}

export function ImportTrackerPanel({ apps, onBack, onRefresh }: { apps: App[]; onBack: () => void; onRefresh?: () => void | Promise<void> }): ReactNode {
  const [openApp, setOpenApp] = useState<string | null>(null);
  const openAppData = useMemo(() => apps.find((a) => a.id === openApp), [apps, openApp]);
  const { jobs, submitImport } = useJobs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const seenDone = useRef<Set<number>>(new Set());

  // Refresh the app list when a synthesize completes (new captured/analyzed screens landed).
  useEffect(() => {
    let fresh = false;
    for (const job of jobs) {
      if (job.type === 'synthesize-app' && job.status === 'done' && !seenDone.current.has(job.id)) { seenDone.current.add(job.id); fresh = true; }
    }
    if (fresh) void onRefresh?.();
  }, [jobs, onRefresh]);

  // Real apps + synthetic "Queued/In progress" rows for imports still in the pipeline.
  const rows = useMemo(() => {
    const real = apps.map(appRow);
    const known = new Set(real.map((r) => r.slug));
    const inflight: RowVM[] = groupPipelines(jobs)
      .filter((p) => p.stages.some((s) => s.status === 'queued' || s.status === 'running'))
      .map((p) => p.root.payload.name)
      .filter((name): name is string => !!name && !known.has(name))
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .map((name) => {
        const stages = groupPipelines(jobs).find((p) => p.root.payload.name === name)?.stages ?? [];
        const active = stages.find((s) => s.status === 'running') ?? stages.find((s) => s.status === 'queued');
        return { slug: name, name, cat: 'Importing', accent: '#a3a3ab', captured: 0, analyzed: 0, lastSynced: null, status: (active && active.type !== 'import-app' ? 'In progress' : 'Queued') as RowStatus };
      });
    return [...inflight, ...real];
  }, [apps, jobs]);

  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text-primary)', paddingBottom: 80 }}>
      <div style={{ background: 'var(--color-background-surface)', borderBottom: '1px solid var(--color-border)', padding: '14px 0' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-background-surface)' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Vitrine</span>
          <Badge variant="neutral" label="Admin" />
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="ghost" size="sm" label="Back to gallery" clickAction={onBack} />
          </div>
        </div>
      </div>
      <ImportDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} submitImport={submitImport} />
      {openAppData
        ? <AppDetailView app={openAppData} onBack={() => setOpenApp(null)} />
        : <AppListView rows={rows} onOpen={setOpenApp} onImport={() => setDialogOpen(true)} />}
    </div>
  );
}
