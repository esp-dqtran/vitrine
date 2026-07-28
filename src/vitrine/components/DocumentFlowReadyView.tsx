import { Button } from '@astryxdesign/core';
import type { FeatureDocumentRevisionView } from '../../featureDocument.ts';
import type {
  DocumentFlowEvidenceLink,
  DocumentFlowPresentation,
} from '../documentFlowModel.ts';
import { PlaceholderImage } from './PlaceholderImage.tsx';

export type DocumentFlowSection = 'requirements' | 'questions';

export interface DocumentFlowReadyViewProps {
  presentation: DocumentFlowPresentation;
  revision: FeatureDocumentRevisionView;
  activeSection: DocumentFlowSection;
  onSectionChange(section: DocumentFlowSection): void;
  onOpenVisualStep(stepNumber: number): void;
}

function EvidenceCard({
  evidence,
  onOpenVisualStep,
}: {
  evidence: DocumentFlowEvidenceLink;
  onOpenVisualStep(stepNumber: number): void;
}) {
  return evidence.stepNumber === undefined
    ? <span className="document-flow__evidence-chip is-unresolved">{evidence.label}</span>
    : (
        <Button
          label={`Open evidence ${evidence.label} in Visual Flow`}
          variant="ghost"
          className="document-flow__evidence-card"
          clickAction={() => onOpenVisualStep(evidence.stepNumber!)}
        >
          <span className="document-flow__evidence-image">
            <PlaceholderImage
              src={evidence.thumbnailUrl ?? evidence.imageUrl}
              style={{ objectFit: 'contain' }}
            />
          </span>
          <span className="document-flow__evidence-copy">
            <span className="document-flow__requirement-meta">
              Step {evidence.stepNumber} · {evidence.evidenceId}
            </span>
            <strong>{evidence.stepLabel ?? evidence.label}</strong>
            {evidence.description && <span>{evidence.description}</span>}
          </span>
        </Button>
      );
}

function EvidenceList({
  evidence,
  onOpenVisualStep,
}: {
  evidence: DocumentFlowEvidenceLink[];
  onOpenVisualStep(stepNumber: number): void;
}) {
  if (evidence.length === 0) {
    return <span className="document-flow__no-evidence">No evidence</span>;
  }
  return (
    <section className="document-flow__evidence">
      <h5>Evidence steps ({evidence.length})</h5>
      <div className="document-flow__evidence-list" aria-label="Evidence">
        {evidence.map((item) => (
          <EvidenceCard
            key={item.evidenceId}
            evidence={item}
            onOpenVisualStep={onOpenVisualStep}
          />
        ))}
      </div>
    </section>
  );
}

function TechnicalClaimList({
  title,
  claims,
}: {
  title: string;
  claims: FeatureDocumentRevisionView['content']['edgeCases'];
}) {
  if (claims.length === 0) return null;
  return (
    <section className="document-flow__detail-group">
      <h3>{title}</h3>
      <ul>
        {claims.map((claim) => <li key={claim.id}>{claim.text}</li>)}
      </ul>
    </section>
  );
}

function TechnicalDetails({ revision }: { revision: FeatureDocumentRevisionView }) {
  const { content, evidenceManifest } = revision;
  return (
    <details className="document-flow__details">
      <summary>Technical appendix</summary>
      <div className="document-flow__details-content">
        <TechnicalClaimList
          title="Risks and assumptions"
          claims={content.flowAnalysis.risksAndAssumptions}
        />
        <TechnicalClaimList title="Edge cases" claims={content.edgeCases} />
        <TechnicalClaimList
          title="Metrics and analytics"
          claims={[
            ...content.successMetrics,
            ...content.guardrailMetrics,
            ...content.analyticsEvents,
          ]}
        />
        <TechnicalClaimList title="Dependencies" claims={content.dependencies} />
        <section className="document-flow__detail-group">
          <h3>Generation</h3>
          <p>
            Revision {revision.revisionNumber}
            {' · '}
            Prompt {revision.promptVersion}
            {' · '}
            {revision.providerModel}
          </p>
        </section>
        <section className="document-flow__detail-group">
          <h3>Evidence sources</h3>
          {evidenceManifest.length > 0
            ? (
                <ul>
                  {evidenceManifest.map((item) => (
                    <li key={item.evidenceId}>
                      <strong>{item.evidenceId}</strong>
                      {`: Step ${item.stepIndex + 1} — ${item.stepLabel}`}
                    </li>
                  ))}
                </ul>
              )
            : <p>No evidence sources recorded.</p>}
        </section>
      </div>
    </details>
  );
}

export function DocumentFlowReadyView({
  presentation,
  revision,
  activeSection,
  onSectionChange,
  onOpenVisualStep,
}: DocumentFlowReadyViewProps) {
  const { summary } = presentation;
  const sections: Array<{ id: DocumentFlowSection; label: string }> = [
    { id: 'requirements', label: 'Requirements' },
    { id: 'questions', label: `Open questions (${summary.openQuestionCount})` },
  ];
  return (
    <section className="document-flow document-flow--ready" aria-label="Document Flow">
      <header className="document-flow__summary">
        <div>
          <p className="document-flow__eyebrow">
            Feature overview · {summary.reviewStatus}
          </p>
          <h3>{summary.goal}</h3>
          <p><strong>Starts:</strong> {summary.entryPoint}</p>
          <p><strong>Ends:</strong> {summary.completionPoint}</p>
        </div>
        <dl className="document-flow__counts">
          <div><dt>Requirements</dt><dd>{summary.requirementCount}</dd></div>
          <div>
            <dt>Acceptance criteria</dt>
            <dd>{summary.acceptanceCriteriaCount}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{summary.supportedRequirementCount}/{summary.requirementCount} supported</dd>
          </div>
        </dl>
      </header>

      <div role="tablist" aria-label="Document Flow sections" className="document-flow__nav">
        {sections.map((section) => (
          <Button
            key={section.id}
            id={`document-flow-${section.id}-tab`}
            label={section.label}
            variant="ghost"
            role="tab"
            aria-selected={activeSection === section.id}
            aria-controls={`document-flow-${section.id}-panel`}
            clickAction={() => onSectionChange(section.id)}
          />
        ))}
      </div>

      <div
        id={`document-flow-${activeSection}-panel`}
        role="tabpanel"
        aria-labelledby={`document-flow-${activeSection}-tab`}
        className="document-flow__content"
      >
        {activeSection === 'requirements' && (
          <div className="document-flow__requirements">
            {presentation.requirements.map((requirement) => (
              <article
                key={requirement.id}
                className="document-flow__requirement"
                aria-labelledby={`document-requirement-${requirement.id}`}
              >
                <header>
                  <div>
                    <p className="document-flow__requirement-meta">
                      {requirement.id} · {requirement.priority.toUpperCase()}
                    </p>
                    <h4 id={`document-requirement-${requirement.id}`}>{requirement.text}</h4>
                  </div>
                </header>
                {requirement.userStory && (
                  <p className="document-flow__user-story">
                    <strong>User story</strong>
                    {requirement.userStory}
                  </p>
                )}
                {requirement.businessRules.length > 0 && (
                  <section className="document-flow__business-rules">
                    <h5>Business rules</h5>
                    <ul>
                      {requirement.businessRules.map((rule) => <li key={rule}>{rule}</li>)}
                    </ul>
                  </section>
                )}
                <div className="document-flow__scenarios">
                  <h5>Acceptance criteria ({requirement.scenarios.length})</h5>
                  {requirement.scenarios.map((scenario) => (
                    <section key={scenario.id} className="document-flow__scenario">
                      <h5>{scenario.id}</h5>
                      <dl>
                        <div><dt>GIVEN</dt><dd>{scenario.given}</dd></div>
                        <div><dt>WHEN</dt><dd>{scenario.when}</dd></div>
                        <div><dt>THEN</dt><dd>{scenario.then}</dd></div>
                      </dl>
                    </section>
                  ))}
                </div>
                <EvidenceList
                  evidence={requirement.evidence}
                  onOpenVisualStep={onOpenVisualStep}
                />
              </article>
            ))}
          </div>
        )}

        {activeSection === 'questions' && (
          presentation.openQuestions.length > 0
            ? (
                <ul className="document-flow__questions-list">
                  {presentation.openQuestions.map((claim) => (
                    <li key={claim.id}>{claim.text}</li>
                  ))}
                </ul>
              )
            : <p>No open questions identified in this revision.</p>
        )}
      </div>

      <TechnicalDetails revision={revision} />
    </section>
  );
}
