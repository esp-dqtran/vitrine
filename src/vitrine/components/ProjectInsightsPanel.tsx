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
    <aside className="research-side-panel project-insights-panel">
      <header className="research-side-panel__header">
        <div>
          <span className="research-project-kicker">Decision brief</span>
          <h2>Designer decision</h2>
          <p>Capture the reasoning you want the team to carry forward.</p>
        </div>
      </header>
      <div className="project-insights-panel__fields">
        <TextArea label="Constraints" value={constraints} onChange={setConstraints} isDisabled={disabled} rows={2} width="100%" />
        <TextArea label="Decision" value={decision} onChange={setDecision} isDisabled={disabled} rows={3} width="100%" />
        <TextArea label="Rationale" value={rationale} onChange={setRationale} isDisabled={disabled} rows={2} width="100%" />
        <TextArea label="Open questions" value={openQuestions} onChange={setOpenQuestions} isDisabled={disabled} rows={2} width="100%" />
      </div>
      <Button label="Save designer decision" variant="primary" size="sm" isDisabled={disabled} clickAction={() => actions.save({ constraints, decision, rationale, openQuestions })} />

      <div className="project-insights-panel__synthesis">
        <strong>AI-generated draft</strong>
        <p>Generated only from references placed in at least two directions.</p>
        <Button label={synthesis ? 'Regenerate synthesis' : 'Synthesize selected evidence'} size="sm" isDisabled={disabled || !canSynthesize} tooltip={canSynthesize ? undefined : 'Add evidence to at least two lanes'} clickAction={actions.synthesize} />
        {synthesis?.stale && <p className="project-insights-panel__warning" role="status">Synthesis is stale because the project changed.</p>}
      </div>

      {synthesis && !synthesis.stale && (
        <section className="project-insights-panel__result">
          <p>{synthesis.result.executiveRead}</p>
          <div><strong>Observed evidence</strong>{synthesis.result.observations.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Meaningful differences</strong>{synthesis.result.differences.map((item, index) => <Cited key={index} item={item} />)}</div>
          <div><strong>Recommendation</strong><Cited item={synthesis.result.recommendation} /></div>
          <Button label="Accept recommendation into decision" size="sm" isDisabled={disabled} onClick={() => setDecision(synthesis.result.recommendation.text)} />
        </section>
      )}

      <Button label="Download DESIGN.md" variant="secondary" size="sm" isDisabled={disabled} clickAction={actions.exportMarkdown} />
    </aside>
  );
}

function Cited({ item }: { item: { text: string; evidenceIds: string[] } }) {
  return <p>{item.text} {item.evidenceIds.map((id) => <a key={id} href={`#${id}`}>{id}</a>)}</p>;
}
