import type { CatalogComparison, ComparisonRow } from '../../catalogResearch';

export function ComparisonPanel({ comparison, onClose }: { comparison: CatalogComparison; onClose: () => void }) {
  const section = (title: string, rows: ComparisonRow[]) => rows.length > 0 && (
    <section style={{ marginTop: 26 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{title}</h3>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
          <thead><tr><th style={headerStyle}>Observed pattern</th>{comparison.apps.map((app) => <th key={app} style={headerStyle}>{app}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <th style={labelStyle}>{row.label}</th>
            {row.values.map((value, index) => <td key={comparison.apps[index]} style={cellStyle}>
              {value ?? <span style={{ color: 'var(--color-text-disabled)' }}>Not observed</span>}
              {value && <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--color-text-disabled)' }}>{row.evidenceIds[index].length} source{row.evidenceIds[index].length === 1 ? '' : 's'}</div>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Compare design systems" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', padding: 28, overflow: 'auto' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: 28, borderRadius: 18, background: 'var(--color-background-surface)', boxShadow: 'var(--shadow-high)' }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: 16 }}>
          <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>Compare design systems</h2><p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>Only captured, evidence-backed values are shown. Empty cells are not inferred.</p></div>
          <button type="button" onClick={onClose} style={closeStyle}>Close</button>
        </div>
        {section('Foundations', comparison.foundations)}
        {section('Components and variants', comparison.components)}
        {section('Curated flows', comparison.flows)}
      </div>
    </div>
  );
}

const headerStyle = { textAlign: 'left' as const, padding: 12, borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-muted)', fontSize: 12 };
const labelStyle = { ...headerStyle, width: 180, background: 'transparent', borderRight: '1px solid var(--color-border)' };
const cellStyle = { padding: 12, borderBottom: '1px solid var(--color-border)', fontSize: 13, verticalAlign: 'top' as const };
const closeStyle = { border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 12px', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer' };
