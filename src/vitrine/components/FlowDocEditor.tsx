import { useEffect, useMemo, useState } from 'react';
import { Button, TextArea } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl';
import { markdownToHtml } from '../markdownToHtml';
import { loadFlowDoc, saveFlowDoc } from '../researchApi';

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
        <Button label="Flows" variant="ghost" size="sm" onClick={onBack} />
        <strong style={{ fontSize: 14 }}>Edit FLOW.md</strong>
        <span role="status" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{dirty ? 'Unsaved changes' : status}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button label="Download" size="sm" onClick={download} />
          <Button label="Save" variant="primary" size="sm" isDisabled={busy || !dirty} isLoading={busy} clickAction={save} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 480 }}>
        <TextArea
          label="FLOW.md source"
          isLabelHidden
          value={body}
          onChange={setBody}
          hasSpellCheck={false}
          rows={30}
          width="100%"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6 }}
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
