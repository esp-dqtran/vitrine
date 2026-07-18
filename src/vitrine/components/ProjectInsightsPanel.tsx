import { useState } from 'react';
import { Button, TextArea } from '@astryxdesign/core';
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
      <TextArea label="Constraints" value={constraints} onChange={setConstraints} isDisabled={disabled} rows={3} width="100%" />
      <TextArea label="Decision" value={decision} onChange={setDecision} isDisabled={disabled} rows={3} width="100%" />
      <TextArea label="Rationale" value={rationale} onChange={setRationale} isDisabled={disabled} rows={3} width="100%" />
      <TextArea label="Open questions" value={openQuestions} onChange={setOpenQuestions} isDisabled={disabled} rows={3} width="100%" />
      <Button label="Save designer decision" variant="primary" size="sm" isDisabled={disabled} clickAction={() => actions.save({ constraints, decision, rationale, openQuestions })} />

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <strong>AI-generated draft</strong>
        <p style={{ margin: '5px 0 10px', color: 'var(--color-text-secondary)', fontSize: 12 }}>Generated only from the evidence selected above.</p>
        <Button label={synthesis ? 'Regenerate synthesis' : 'Synthesize selected evidence'} size="sm" isDisabled={disabled || !canSynthesize} tooltip={canSynthesize ? undefined : 'Add evidence to at least two lanes'} clickAction={actions.synthesize} />
        {synthesis?.stale && <p role="status" style={{ color: 'var(--color-text-danger)', fontSize: 12 }}>Synthesis is stale because the project changed.</p>}
      </div>

      {synthesis && !synthesis.stale && (
        <section style={{ display: 'grid', gap: 10, fontSize: 12 }}>
          <p style={{ margin: 0 }}>{synthesis.result.executiveRead}</p>
          <div><strong>Observed evidence</strong>{synthesis.result.observations.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Meaningful differences</strong>{synthesis.result.differences.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Recommendation</strong><Cited item={synthesis.result.recommendation} /></div>
          <Button label="Accept recommendation into decision" size="sm" isDisabled={disabled} onClick={() => setDecision(synthesis.result.recommendation.text)} />
        </section>
      )}

      <Button label="Download DESIGN.md" size="sm" isDisabled={disabled} clickAction={actions.exportMarkdown} />
    </aside>
  );
}

function Cited({ item }: { item: { text: string; evidenceIds: string[] } }) {
  return <p style={{ margin: '5px 0' }}>{item.text} {item.evidenceIds.map((id) => <a key={id} href={`#${id}`} style={{ marginLeft: 4 }}>{id}</a>)}</p>;
}
