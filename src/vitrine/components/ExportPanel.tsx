import { useState } from 'react';
import type { DesignSystemSnapshot, EvidenceView, TokenKind } from '../../designSystem';
import type { ExportFormat, ExportScope } from '../../exportEngine';
import { requestExport } from '../researchApi';
import type { Screen } from '../types';

const secondary: Array<[ExportFormat, string]> = [
  ['json', 'JSON tokens'], ['css', 'CSS variables'], ['tailwind', 'Tailwind theme'], ['component-spec', 'Component specs'], ['react', 'React scaffold'],
];
const categoryIds: Record<TokenKind, string> = { color: 'colors', typography: 'typography', spacing: 'spacing', radius: 'radii', border: 'borders', effect: 'effects' };

export function ExportPanel({ app, snapshot, screens = [] }: { app: string; snapshot?: DesignSystemSnapshot<EvidenceView> | null; screens?: Screen[] }) {
  const [scope, setScope] = useState<ExportScope>({ kind: 'design-system' });
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<number[]>([]);
  const run = async (format: ExportFormat) => {
    setBusy(format); setMessage('');
    try {
      const { blob, filename } = await requestExport(app, format, scope);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
      setMessage(`${filename} is ready.`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(null); }
  };
  const options: Array<{ value: string; label: string }> = [{ value: 'design-system', label: 'Complete observed design system' }];
  for (const kind of [...new Set(snapshot?.tokens.map(({ kind }) => kind) ?? [])]) options.push({ value: `foundation:${categoryIds[kind]}`, label: `Foundation · ${categoryIds[kind]}` });
  for (const component of snapshot?.components ?? []) options.push({ value: `component:${component.id}`, label: `Component · ${component.name}` });
  const changeScope = (value: string) => {
    if (value === 'design-system') setScope({ kind: 'design-system' });
    else if (value === 'selected') setScope({ kind: 'selected', componentIds: selectedComponents, screenIds: selectedScreens });
    else if (value.startsWith('foundation:')) setScope({ kind: 'foundation-category', id: value.slice(11) });
    else setScope({ kind: 'component-family', id: value.slice(10) });
  };
  if (scope.kind === 'selected') options.push({ value: 'selected', label: `${scope.componentIds.length} components · ${scope.screenIds.length} screens` });
  const scopeValue = scope.kind === 'design-system' ? 'design-system' : scope.kind === 'foundation-category' ? `foundation:${scope.id}` : scope.kind === 'component-family' ? `component:${scope.id}` : 'selected';
  return (
    <section style={{ display: 'grid', gap: 20, paddingTop: 28 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>Editable design handoff</h2><p style={{ margin: '7px 0 0', color: 'var(--color-text-secondary)' }}>Every generated asset keeps its observed evidence IDs. Missing states are never added.</p></div>
        <label style={{ display: 'grid', gap: 5, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>Export scope<select value={scopeValue} onChange={(event) => changeScope(event.target.value)} style={{ height: 38, minWidth: 250, border: '1px solid var(--color-border)', borderRadius: 9, background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', padding: '0 10px' }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <div style={{ padding: 22, borderRadius: 16, background: 'linear-gradient(135deg,#5b38f0,#8b5cf6)', color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .8 }}>Primary export</div>
        <h3 style={{ margin: '8px 0 6px', fontSize: 22 }}>Figma editable library</h3>
        <p style={{ margin: '0 0 18px', maxWidth: 680, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>Variable collections, text/effect documentation, auto-layout components, observed variant sets, and source-reference frames in a Figma development plugin.</p>
        <button type="button" onClick={() => void run('figma')} disabled={busy !== null} style={{ border: 0, borderRadius: 999, padding: '11px 18px', background: '#fff', color: '#35208f', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}>Export editable Figma library</button>
        <div style={{ marginTop: 10, fontSize: 11.5, opacity: .75 }}>Unzip, create a Figma development plugin to receive its ID, replace its code.js with the exported file, then run it in a blank design file.</div>
      </div>
      <div><h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Secondary formats</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{secondary.map(([format, label]) => <button key={format} type="button" disabled={busy !== null} onClick={() => void run(format)} style={{ border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 12px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5 }}>{label}</button>)}</div></div>
      <details style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}><summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>Selected components and screens</summary><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18, marginTop: 14 }}><div><strong style={{ fontSize: 12 }}>Components</strong>{(snapshot?.components ?? []).map((component) => <label key={component.id} style={{ display: 'block', marginTop: 7, fontSize: 12 }}><input type="checkbox" checked={selectedComponents.includes(component.id)} onChange={(event) => setSelectedComponents((current) => event.target.checked ? [...current, component.id] : current.filter((id) => id !== component.id))} /> {component.name}</label>)}</div><div><strong style={{ fontSize: 12 }}>Screens</strong>{screens.map((screen) => <label key={screen.id} style={{ display: 'block', marginTop: 7, fontSize: 12 }}><input type="checkbox" checked={selectedScreens.includes(screen.id)} onChange={(event) => setSelectedScreens((current) => event.target.checked ? [...current, screen.id] : current.filter((id) => id !== screen.id))} /> {screen.type} · {screen.productArea}</label>)}</div></div><button type="button" disabled={selectedComponents.length + selectedScreens.length === 0} onClick={() => setScope({ kind: 'selected', componentIds: selectedComponents, screenIds: selectedScreens })} style={{ marginTop: 14, border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 11px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)' }}>Use selected scope</button></details>
      {message && <div role="status" style={{ fontSize: 12.5, color: message.includes('ready') ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{message}</div>}
    </section>
  );
}
