import { useState } from 'react';
import type { ProjectPatch, ResearchProjectWorkspace } from '../../researchProject.ts';

export interface ProjectInsightsActions {
  save(patch: ProjectPatch): Promise<void>;
  synthesize(): Promise<void>;
  exportMarkdown(): Promise<void>;
}

export function ProjectInsightsPanel({ workspace, disabled, actions }: {
  workspace: ResearchProjectWorkspace;
  disabled: boolean;
  actions: ProjectInsightsActions;
}) {
  const [constraints, setConstraints] = useState(workspace.constraints);
  const [decision, setDecision] = useState(workspace.decision);
  const [rationale, setRationale] = useState(workspace.rationale);
  const [openQuestions, setOpenQuestions] = useState(workspace.openQuestions);
  const populatedLanes = workspace.lanes.filter(({ items }) => items.length > 0).length;
  const canSynthesize = populatedLanes >= 2;
  const synthesis = workspace.synthesis;

  return (
    <aside style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 13, background: 'var(--color-background-surface)', alignSelf: 'start', display: 'grid', gap: 12 }}>
      <div><strong>Designer decision</strong><div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 3 }}>Your words stay separate from generated analysis.</div></div>
      <label style={labelStyle}>Constraints<textarea value={constraints} disabled={disabled} onChange={(event) => setConstraints(event.target.value)} style={fieldStyle} /></label>
      <label style={labelStyle}>Decision<textarea value={decision} disabled={disabled} onChange={(event) => setDecision(event.target.value)} style={fieldStyle} /></label>
      <label style={labelStyle}>Rationale<textarea value={rationale} disabled={disabled} onChange={(event) => setRationale(event.target.value)} style={fieldStyle} /></label>
      <label style={labelStyle}>Open questions<textarea value={openQuestions} disabled={disabled} onChange={(event) => setOpenQuestions(event.target.value)} style={fieldStyle} /></label>
      <button type="button" disabled={disabled} onClick={() => void actions.save({ constraints, decision, rationale, openQuestions })} style={buttonStyle}>Save designer decision</button>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <strong>AI-generated draft</strong>
        <p style={{ margin: '5px 0 10px', color: 'var(--color-text-secondary)', fontSize: 12 }}>Generated only from the evidence selected above.</p>
        <button type="button" disabled={disabled || !canSynthesize} title={canSynthesize ? undefined : 'Add evidence to at least two lanes'} onClick={() => void actions.synthesize()} style={buttonStyle}>
          {synthesis ? 'Regenerate synthesis' : 'Synthesize selected evidence'}
        </button>
        {synthesis?.stale && <p role="status" style={{ color: 'var(--color-text-danger)', fontSize: 12 }}>Synthesis is stale because the project changed.</p>}
      </div>

      {synthesis && !synthesis.stale && (
        <section style={{ display: 'grid', gap: 10, fontSize: 12 }}>
          <p style={{ margin: 0 }}>{synthesis.result.executiveRead}</p>
          <div><strong>Observed evidence</strong>{synthesis.result.observations.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Meaningful differences</strong>{synthesis.result.differences.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Recommendation</strong><Cited item={synthesis.result.recommendation} /></div>
          <button type="button" disabled={disabled} onClick={() => setDecision(synthesis.result.recommendation.text)} style={buttonStyle}>Accept recommendation into decision</button>
        </section>
      )}

      <button type="button" disabled={disabled} onClick={() => void actions.exportMarkdown()} style={buttonStyle}>Download DESIGN.md</button>
    </aside>
  );
}

function Cited({ item }: { item: { text: string; evidenceIds: string[] } }) {
  return <p style={{ margin: '5px 0' }}>{item.text} {item.evidenceIds.map((id) => <a key={id} href={`#${id}`} style={{ marginLeft: 4 }}>{id}</a>)}</p>;
}

const labelStyle = { display: 'grid', gap: 5, color: 'var(--color-text-secondary)', fontSize: 12 } as const;
const fieldStyle = { width: '100%', boxSizing: 'border-box', minHeight: 58, resize: 'vertical', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, background: 'var(--color-background-body)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12 } as const;
const buttonStyle = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 12 } as const;
