import { useState } from 'react';
import type { AppVersion } from '../../db';
import type { Platform } from '../../platformFromUrl';
import { createAppVersion, getVersionBlockers, listAppVersions, publishVersion, submitVersion } from '../researchApi';

interface VersionPanelProps {
  app: string;
  platform: Platform;
  role: 'admin' | 'user';
  versions: AppVersion[];
  selectedVersion?: number;
  onVersionsChange: (versions: AppVersion[]) => void;
  onSelect: (version: number) => void;
}

export function VersionPanel({ app, platform, role, versions, selectedVersion, onVersionsChange, onSelect }: VersionPanelProps) {
  const [recapture, setRecapture] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const active = versions.find(({ status }) => status === 'draft' || status === 'in_review');
  const refresh = async () => onVersionsChange(await listAppVersions(app, platform));
  const act = async (action: 'submit' | 'publish') => {
    if (!active) return;
    try {
      if (action === 'submit') {
        const { blockers } = await getVersionBlockers(active.id);
        if (blockers.length) { setMessage(blockers.map(({ message: text }) => text).join(' ')); return; }
        await submitVersion(active.id);
      } else await publishVersion(active.id);
      setMessage(action === 'submit' ? 'Submitted for review.' : 'Published to the catalog.');
      await refresh();
    } catch (error) { setMessage((error as Error).message); }
  };
  const start = async () => {
    if (!sourceUrl.trim()) return;
    try { await createAppVersion(app, platform, sourceUrl.trim()); setRecapture(false); setSourceUrl(''); setMessage('Recapture pipeline started.'); await refresh(); }
    catch (error) { setMessage((error as Error).message); }
  };
  return (
    <section style={{ margin: '0 0 20px', padding: 10, border: '1px solid var(--color-border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--color-text-disabled)' }}>Capture versions</span>
        {versions.map((version) => (
          <button key={version.id} type="button" onClick={() => onSelect(version.version_number)} style={{ border: `1px solid ${selectedVersion === version.version_number ? 'var(--color-text-primary)' : 'var(--color-border)'}`, borderRadius: 999, padding: '5px 9px', background: selectedVersion === version.version_number ? 'var(--color-text-primary)' : 'transparent', color: selectedVersion === version.version_number ? 'var(--color-background-surface)' : 'var(--color-text-secondary)', cursor: 'pointer', font: 'inherit', fontSize: 11 }}>
            {version.label} · {version.status === 'published' ? 'Published' : version.status.replace('_', ' ')}
          </button>
        ))}
        {role === 'admin' && <button type="button" disabled={Boolean(active)} title={active ? 'Finish the active version first' : undefined} onClick={() => setRecapture(true)} style={{ ...lightButton, opacity: active ? .45 : 1 }}>Start recapture</button>}
      </div>
      {versions[0] && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, color: 'var(--color-text-disabled)', fontSize: 11 }}>
        <span>{versions[0].screen_count} screens</span><span>{versions[0].analyzed_count} analyzed</span><span>{versions[0].component_count} components</span><span>{versions[0].token_count} tokens</span><span>{versions[0].flow_count} flows</span><span>{new Date(versions[0].captured_at).toLocaleDateString()}</span>
      </div>}
      {role === 'admin' && active && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {active.status === 'draft' && <button type="button" onClick={() => void act('submit')} style={lightButton}>Submit for review</button>}
        {active.status === 'in_review' && <button type="button" onClick={() => void act('publish')} style={{ ...lightButton, background: 'var(--color-text-primary)', color: 'var(--color-background-surface)' }}>Publish</button>}
      </div>}
      {recapture && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Mobbin web screens URL" style={{ flex: 1, minWidth: 260, border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 9px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12 }} /><button type="button" onClick={() => void start()} style={lightButton}>Create draft</button></div>}
      {message && <div role="status" style={{ marginTop: 8, color: 'var(--color-text-secondary)', fontSize: 11 }}>{message}</div>}
    </section>
  );
}

const lightButton = { marginLeft: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 9px', background: 'var(--color-background-muted)', color: 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 600 };
