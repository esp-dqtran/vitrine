import { useState } from 'react';
import { Selector } from '@astryxdesign/core';
import type { DesignSystemSnapshot, EvidenceView, TokenKind } from '../../designSystem';
import type { ExportFormat, ExportScope } from '../../exportEngine';
import type { Platform } from '../../platformFromUrl';
import { requestExport } from '../researchApi';
import type { Screen } from '../types';

const secondary: Array<[ExportFormat, string]> = [
  ['json', 'JSON tokens'], ['css', 'CSS variables'], ['tailwind', 'Tailwind theme'], ['component-spec', 'Component specs'], ['react', 'React scaffold'], ['design-md', 'DESIGN.md'],
];
const categoryIds: Record<TokenKind, string> = { color: 'colors', typography: 'typography', spacing: 'spacing', radius: 'radii', border: 'borders', effect: 'effects' };

export function ExportPanel({ app, platform = 'web', snapshot, screens = [] }: { app: string; platform?: Platform; snapshot?: DesignSystemSnapshot<EvidenceView> | null; screens?: Screen[] }) {
  const [scope, setScope] = useState<ExportScope>({ kind: 'design-system' });
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<number[]>([]);
  // flow-md is a whole-app PM document, so it always exports at design-system scope
  // regardless of the panel's selected scope; every other format honours the selection.
  const run = async (format: ExportFormat, scopeOverride?: ExportScope) => {
    setBusy(format); setMessage('');
    try {
      const { blob, filename } = await requestExport(app, platform, format, scopeOverride ?? scope);
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
        <Selector label="Export scope" value={scopeValue} onChange={changeScope} options={options} width={250} />
      </div>
      <div style={{ padding: 22, borderRadius: 16, background: 'linear-gradient(135deg,#5b38f0,#8b5cf6)', color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .8 }}>Primary export</div>
        <h3 style={{ margin: '8px 0 6px', fontSize: 22 }}>Figma editable library</h3>
        <p style={{ margin: '0 0 18px', maxWidth: 680, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>Variable collections, text/effect documentation, auto-layout components, observed variant sets, and source-reference frames in a Figma development plugin.</p>
        <button type="button" onClick={() => void run('figma')} disabled={busy !== null} style={{ border: 0, borderRadius: 999, padding: '11px 18px', background: '#fff', color: '#35208f', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}>Export editable Figma library</button>
        <div style={{ marginTop: 10, fontSize: 11.5, opacity: .75 }}>Unzip, create a Figma development plugin to receive its ID, replace its code.js with the exported file, then run it in a blank design file.</div>
      </div>
      <div style={{ padding: 20, borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-secondary)' }}>For product managers</div>
        <h3 style={{ margin: '8px 0 6px', fontSize: 18 }}>Product flow documentation</h3>
        <p style={{ margin: '0 0 16px', maxWidth: 680, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>Every observed user flow as an ordered, evidence-cited Markdown doc — a PRD-ready reference. Each step names the screen it was seen on and its verification status.</p>
        <button type="button" onClick={() => void run('flow-md', { kind: 'design-system' })} disabled={busy !== null} style={{ border: '1px solid var(--color-border)', borderRadius: 999, padding: '11px 18px', background: 'var(--color-text-primary)', color: 'var(--color-background-surface)', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}>Export FLOW.md</button>
      </div>
      <div><h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Secondary formats</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{secondary.map(([format, label]) => <button key={format} type="button" disabled={busy !== null} onClick={() => void run(format)} style={{ border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 12px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5 }}>{label}</button>)}</div></div>
      <details style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}><summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>Selected components and screens</summary><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18, marginTop: 14 }}><div><strong style={{ fontSize: 12 }}>Components</strong>{(snapshot?.components ?? []).map((component) => <label key={component.id} style={{ display: 'block', marginTop: 7, fontSize: 12 }}><input type="checkbox" checked={selectedComponents.includes(component.id)} onChange={(event) => setSelectedComponents((current) => event.target.checked ? [...current, component.id] : current.filter((id) => id !== component.id))} /> {component.name}</label>)}</div><div><strong style={{ fontSize: 12 }}>Screens</strong>{screens.map((screen) => <label key={screen.id} style={{ display: 'block', marginTop: 7, fontSize: 12 }}><input type="checkbox" checked={selectedScreens.includes(screen.id)} onChange={(event) => setSelectedScreens((current) => event.target.checked ? [...current, screen.id] : current.filter((id) => id !== screen.id))} /> {screen.type} · {screen.productArea}</label>)}</div></div><button type="button" disabled={selectedComponents.length + selectedScreens.length === 0} onClick={() => setScope({ kind: 'selected', componentIds: selectedComponents, screenIds: selectedScreens })} style={{ marginTop: 14, border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 11px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)' }}>Use selected scope</button></details>
      {message && <div role="status" style={{ fontSize: 12.5, color: message.includes('ready') ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{message}</div>}
    </section>
  );
}
