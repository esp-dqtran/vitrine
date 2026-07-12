import { useState } from 'react';
import type { AppVersion } from '../../db';
import { createAppVersion, getVersionBlockers, listAppVersions, publishVersion, submitVersion } from '../researchApi';

interface VersionPanelProps {
  app: string;
  role: 'admin' | 'user';
  versions: AppVersion[];
  selectedVersion?: number;
  onVersionsChange: (versions: AppVersion[]) => void;
  onSelect: (version: number) => void;
}

export function VersionPanel({ app, role, versions, selectedVersion, onVersionsChange, onSelect }: VersionPanelProps) {
  const [recapture, setRecapture] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const active = versions.find(({ status }) => status === 'draft' || status === 'in_review');
  const refresh = async () => onVersionsChange(await listAppVersions(app));
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
    try { await createAppVersion(app, sourceUrl.trim()); setRecapture(false); setSourceUrl(''); setMessage('Recapture pipeline started.'); await refresh(); }
    catch (error) { setMessage((error as Error).message); }
  };
  return (
    <section style={{ margin: '0 0 22px', padding: 14, border: '1px solid rgba(255,255,255,.13)', borderRadius: 13, background: 'rgba(255,255,255,.055)', color: '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#a1a1aa' }}>Capture versions</span>
        {versions.map((version) => (
          <button key={version.id} type="button" onClick={() => onSelect(version.version_number)} style={{ border: `1px solid ${selectedVersion === version.version_number ? '#fff' : 'rgba(255,255,255,.18)'}`, borderRadius: 999, padding: '6px 10px', background: selectedVersion === version.version_number ? '#fff' : 'transparent', color: selectedVersion === version.version_number ? '#18181b' : '#d4d4d8', cursor: 'pointer', font: 'inherit', fontSize: 11.5 }}>
            {version.label} · {version.status === 'published' ? 'Published' : version.status.replace('_', ' ')}
          </button>
        ))}
        {role === 'admin' && <button type="button" disabled={Boolean(active)} title={active ? 'Finish the active version first' : undefined} onClick={() => setRecapture(true)} style={{ ...darkButton, opacity: active ? .45 : 1 }}>Start recapture</button>}
      </div>
      {versions[0] && <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, color: '#a1a1aa', fontSize: 11.5 }}>
        <span>{versions[0].screen_count} screens</span><span>{versions[0].analyzed_count} analyzed</span><span>{versions[0].component_count} components</span><span>{versions[0].token_count} tokens</span><span>{versions[0].flow_count} flows</span><span>{new Date(versions[0].captured_at).toLocaleDateString()}</span>
      </div>}
      {role === 'admin' && active && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {active.status === 'draft' && <button type="button" onClick={() => void act('submit')} style={darkButton}>Submit for review</button>}
        {active.status === 'in_review' && <button type="button" onClick={() => void act('publish')} style={{ ...darkButton, background: '#fff', color: '#18181b' }}>Publish</button>}
      </div>}
      {recapture && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Mobbin web screens URL" style={{ flex: 1, minWidth: 260, border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '8px 10px', background: '#202024', color: '#fff' }} /><button type="button" onClick={() => void start()} style={darkButton}>Create draft</button></div>}
      {message && <div role="status" style={{ marginTop: 10, color: '#d4d4d8', fontSize: 11.5 }}>{message}</div>}
    </section>
  );
}

const darkButton = { marginLeft: 'auto', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '7px 10px', background: 'rgba(255,255,255,.07)', color: '#fff', cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 650 };
