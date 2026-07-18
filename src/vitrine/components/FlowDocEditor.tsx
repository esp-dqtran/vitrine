import { useEffect, useMemo, useState } from 'react';
import type { Platform } from '../../platformFromUrl';
import { markdownToHtml } from '../markdownToHtml';
import { loadFlowDoc, saveFlowDoc } from '../researchApi';

const btn = (primary?: boolean) => ({
  border: '1px solid var(--color-border)', borderRadius: 999, padding: '8px 16px', font: 'inherit',
  fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  background: primary ? 'var(--color-text-primary)' : 'transparent',
  color: primary ? 'var(--color-background-surface)' : 'var(--color-text-primary)',
});

export function FlowDocEditor({ app, platform, onBack }: { app: string; platform: Platform; onBack: () => void }) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState<string>(''); // last-persisted text; empty until loaded
  const [status, setStatus] = useState('Loading…');
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => markdownToHtml(body), [body]);

  useEffect(() => {
    let live = true;
    loadFlowDoc(app, platform)
      .then((doc) => { if (!live) return; setBody(doc.body); setSaved(doc.saved ? doc.body : ''); setStatus(doc.saved ? `Saved ${new Date(doc.updatedAt!).toLocaleString()}` : 'Generated draft — not saved yet'); })
      .catch((error: Error) => { if (live) setStatus(error.message); });
    return () => { live = false; };
  }, [app, platform]);

  const dirty = body !== saved;
  const save = async () => {
    setBusy(true);
    try { const { updatedAt } = await saveFlowDoc(app, platform, body); setSaved(body); setStatus(`Saved ${new Date(updatedAt).toLocaleString()}`); }
    catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }));
    const a = document.createElement('a'); a.href = url; a.download = `${app}-FLOW.md`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={btn()}>← Flows</button>
        <strong style={{ fontSize: 14 }}>Edit FLOW.md</strong>
        <span role="status" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{dirty ? 'Unsaved changes' : status}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={download} style={btn()}>Download</button>
          <button type="button" onClick={() => void save()} disabled={busy || !dirty} style={{ ...btn(true), opacity: busy || !dirty ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 480 }}>
        <textarea
          aria-label="FLOW.md source"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
          style={{ font: '13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', resize: 'vertical' }}
        />
        <div
          className="flow-doc-preview"
          style={{ padding: '4px 18px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', overflow: 'auto', fontSize: 14, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </div>
    </div>
  );
}
