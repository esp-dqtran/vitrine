import { Button, TextArea } from '@astryxdesign/core';
import type {
  FeatureClaim,
  FeatureDocumentContent,
  FeatureRequirement,
} from '../../featureDocument.ts';

function EvidenceLinks({ claim, onEvidence }: { claim: FeatureClaim; onEvidence: (evidenceId: string) => void }) {
  if (claim.evidenceIds.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {claim.evidenceIds.map((evidenceId) => (
        <Button key={evidenceId} label={evidenceId} variant="ghost" size="sm" className="feature-document-evidence-link" onClick={() => onEvidence(evidenceId)} />
      ))}
    </div>
  );
}

function ClaimField({
  label,
  claim,
  onText,
  onEvidence,
  readOnly,
}: {
  label: string;
  claim: FeatureClaim;
  onText: (text: string) => void;
  onEvidence: (evidenceId: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="feature-document-field">
      <TextArea label={label} value={claim.text} onChange={onText} rows={2} width="100%" isDisabled={readOnly} />
      <div className="feature-document-claim-meta"><span>{claim.kind}</span>{claim.confidence !== undefined && <span>{Math.round(claim.confidence * 100)}% confidence</span>}</div>
      <EvidenceLinks claim={claim} onEvidence={onEvidence} />
    </div>
  );
}

function ClaimList({
  title,
  claims,
  onText,
  onEvidence,
  readOnly,
}: {
  title: string;
  claims: FeatureClaim[];
  onText: (index: number, text: string) => void;
  onEvidence: (evidenceId: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="feature-document-list">
      <h4>{title}</h4>
      {claims.length === 0 ? <p className="feature-document-empty">None recorded</p> : claims.map((claim, index) => (
        <ClaimField key={claim.id} label={`${title} ${index + 1}`} claim={claim} onText={(text) => onText(index, text)} onEvidence={onEvidence} readOnly={readOnly} />
      ))}
    </div>
  );
}

function RequirementField({
  requirement,
  index,
  update,
  onEvidence,
  readOnly,
}: {
  requirement: FeatureRequirement;
  index: number;
  update: (mutate: (requirement: FeatureRequirement) => void) => void;
  onEvidence: (evidenceId: string) => void;
  readOnly: boolean;
}) {
  return (
    <article className="feature-document-requirement">
      <div className="feature-document-requirement-heading">Requirement {index + 1} · {requirement.priority}</div>
      <ClaimField label={`Requirement ${index + 1}`} claim={requirement} onText={(text) => update((draft) => { draft.text = text; })} onEvidence={onEvidence} readOnly={readOnly} />
      <TextArea label="User story" value={requirement.userStory} onChange={(text) => update((draft) => { draft.userStory = text; })} rows={2} width="100%" isDisabled={readOnly} />
      <TextArea label="Preconditions" value={requirement.preconditions.join('\n')} onChange={(text) => update((draft) => { draft.preconditions = text.split('\n').map((item) => item.trim()).filter(Boolean); })} rows={2} width="100%" isDisabled={readOnly} />
      {requirement.acceptanceCriteria.map((criterion, criterionIndex) => (
        <fieldset key={criterion.id} className="feature-document-criterion">
          <legend>Acceptance criterion {criterionIndex + 1}</legend>
          {(['given', 'when', 'then'] as const).map((key) => (
            <TextArea
              key={key}
              label={key[0].toUpperCase() + key.slice(1)}
              value={criterion[key]}
              onChange={(text) => update((draft) => { draft.acceptanceCriteria[criterionIndex][key] = text; })}
              rows={2}
              width="100%"
              isDisabled={readOnly}
            />
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {criterion.evidenceIds.map((evidenceId) => <Button key={evidenceId} label={evidenceId} variant="ghost" size="sm" className="feature-document-evidence-link" onClick={() => onEvidence(evidenceId)} />)}
          </div>
        </fieldset>
      ))}
    </article>
  );
}

export function FeatureDocumentEditor({
  content,
  onChange,
  onEvidence,
  readOnly = false,
}: {
  content: FeatureDocumentContent;
  onChange: (content: FeatureDocumentContent) => void;
  onEvidence: (evidenceId: string) => void;
  readOnly?: boolean;
}) {
  const change = (mutate: (draft: FeatureDocumentContent) => void) => {
    const draft = structuredClone(content);
    mutate(draft);
    onChange(draft);
  };
  const claim = (label: string, value: FeatureClaim, mutate: (draft: FeatureDocumentContent, text: string) => void) => (
    <ClaimField label={label} claim={value} onText={(text) => change((draft) => mutate(draft, text))} onEvidence={onEvidence} readOnly={readOnly} />
  );
  const list = (
    title: string,
    values: FeatureClaim[],
    select: (draft: FeatureDocumentContent) => FeatureClaim[],
  ) => <ClaimList title={title} claims={values} onText={(index, text) => change((draft) => { select(draft)[index].text = text; })} onEvidence={onEvidence} readOnly={readOnly} />;

  return (
    <div className="feature-document-editor">
      <section><h3>Executive summary</h3>
        {claim('Purpose', content.executiveSummary.purpose, (draft, text) => { draft.executiveSummary.purpose.text = text; })}
        {claim('User value', content.executiveSummary.userValue, (draft, text) => { draft.executiveSummary.userValue.text = text; })}
        {claim('Recommendation', content.executiveSummary.recommendation, (draft, text) => { draft.executiveSummary.recommendation.text = text; })}
      </section>
      <section><h3>Observed flow</h3>
        {claim('User goal', content.observedFlow.userGoal, (draft, text) => { draft.observedFlow.userGoal.text = text; })}
        {claim('Entry point', content.observedFlow.entryPoint, (draft, text) => { draft.observedFlow.entryPoint.text = text; })}
        {claim('Completion point', content.observedFlow.completionPoint, (draft, text) => { draft.observedFlow.completionPoint.text = text; })}
        {list('Journey', content.observedFlow.journey, (draft) => draft.observedFlow.journey)}
        {list('Actors', content.observedFlow.actors, (draft) => draft.observedFlow.actors)}
        {list('Visible states', content.observedFlow.visibleStates, (draft) => draft.observedFlow.visibleStates)}
      </section>
      <section><h3>Flow analysis</h3>
        {list('Effective patterns', content.flowAnalysis.effectivePatterns, (draft) => draft.flowAnalysis.effectivePatterns)}
        {list('Friction', content.flowAnalysis.friction, (draft) => draft.flowAnalysis.friction)}
        {list('Missing states', content.flowAnalysis.missingStates, (draft) => draft.flowAnalysis.missingStates)}
        {list('Inconsistencies', content.flowAnalysis.inconsistencies, (draft) => draft.flowAnalysis.inconsistencies)}
        {list('Risks and assumptions', content.flowAnalysis.risksAndAssumptions, (draft) => draft.flowAnalysis.risksAndAssumptions)}
      </section>
      <section><h3>Proposed feature</h3>
        {claim('Problem statement', content.proposedFeature.problem, (draft, text) => { draft.proposedFeature.problem.text = text; })}
        {list('Target users', content.proposedFeature.targetUsers, (draft) => draft.proposedFeature.targetUsers)}
        {list('Goals', content.proposedFeature.goals, (draft) => draft.proposedFeature.goals)}
        {list('Non-goals', content.proposedFeature.nonGoals, (draft) => draft.proposedFeature.nonGoals)}
        {list('Behavior', content.proposedFeature.behavior, (draft) => draft.proposedFeature.behavior)}
        {list('Proposed journey', content.proposedFeature.journey, (draft) => draft.proposedFeature.journey)}
      </section>
      <section><h3>Requirements</h3>{content.requirements.map((requirement, index) => (
        <RequirementField key={requirement.id} requirement={requirement} index={index} onEvidence={onEvidence} readOnly={readOnly} update={(mutate) => change((draft) => mutate(draft.requirements[index]))} />
      ))}</section>
      <section><h3>Edge cases</h3>{list('Edge cases', content.edgeCases, (draft) => draft.edgeCases)}</section>
      <section><h3>Success metrics</h3>{list('Success metrics', content.successMetrics, (draft) => draft.successMetrics)}</section>
      <section><h3>Guardrail metrics</h3>{list('Guardrail metrics', content.guardrailMetrics, (draft) => draft.guardrailMetrics)}</section>
      <section><h3>Analytics events</h3>{list('Analytics events', content.analyticsEvents, (draft) => draft.analyticsEvents)}</section>
      <section><h3>Dependencies</h3>{list('Dependencies', content.dependencies, (draft) => draft.dependencies)}</section>
      <section><h3>Open questions</h3>{list('Open questions', content.openQuestions, (draft) => draft.openQuestions)}</section>
    </div>
  );
}
