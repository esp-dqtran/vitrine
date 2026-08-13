import { Button } from '@astryxdesign/core';
import type { ReactNode } from 'react';
import type { FeatureDocumentRevisionView } from '../../featureDocument.ts';
import type {
  DocumentFlowEvidenceLink,
  DocumentFlowPresentation,
} from '../documentFlowModel.ts';
import { PlaceholderImage } from './PlaceholderImage.tsx';

export type DocumentFlowSection = 'requirements' | 'questions' | 'handoff';

export interface DocumentFlowReadyViewProps {
  presentation: DocumentFlowPresentation;
  revision: FeatureDocumentRevisionView;
  activeSection: DocumentFlowSection;
  onSectionChange(section: DocumentFlowSection): void;
  onOpenVisualStep(stepNumber: number): void;
  handoff?: ReactNode;
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
          <span className="document-flow__evidence-card-content">
            <span className="document-flow__evidence-image">
              <PlaceholderImage
                src={evidence.thumbnailUrl ?? evidence.imageUrl}
                style={{ objectFit: 'contain' }}
              />
              <span className="document-flow__evidence-step">
                Step {evidence.stepNumber}
              </span>
            </span>
            <span className="document-flow__evidence-copy">
              <strong>{evidence.stepLabel ?? evidence.label}</strong>
              {evidence.description && <span>{evidence.description}</span>}
            </span>
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
      <header className="document-flow__evidence-header">
        <h5>Evidence flow ({evidence.length})</h5>
        <span>Select a screen to open it in Visual Flow</span>
      </header>
      <ol className="document-flow__evidence-list" aria-label="Evidence flow">
        {evidence.map((item) => (
          <li key={item.evidenceId} className="document-flow__evidence-node">
            <EvidenceCard
              evidence={item}
              onOpenVisualStep={onOpenVisualStep}
            />
          </li>
        ))}
      </ol>
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
        {content.documentedContext && (
          <section className="document-flow__detail-group">
            <h3>Official documentation</h3>
            {content.documentedContext.status === 'not-found'
              ? <p>No matching official documentation was found.</p>
              : (
                  <ul>
                    {content.documentedContext.sources.map((source) => (
                      <li key={source.id}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                        {` · ${source.platform} · ${source.region}`}
                      </li>
                    ))}
                  </ul>
                )}
            {content.documentedContext.claims.length > 0 && (
              <ul>
                {content.documentedContext.claims.map((claim) => (
                  <li key={claim.id}>
                    <strong>{claim.relationship}</strong>
                    {`: ${claim.text}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {content.unscopedEvidence && content.unscopedEvidence.length > 0 && (
          <section className="document-flow__detail-group">
            <h3>Unscoped evidence</h3>
            <ul>
              {content.unscopedEvidence.map((item) => (
                <li key={item.evidenceId}>
                  <strong>{item.evidenceId}</strong>
                  {`: ${item.reason}`}
                </li>
              ))}
            </ul>
          </section>
        )}
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
  handoff,
}: DocumentFlowReadyViewProps) {
  const { summary } = presentation;
  const sections: Array<{ id: DocumentFlowSection; label: string }> = [
    { id: 'requirements', label: 'Requirements' },
    { id: 'questions', label: `Open questions (${summary.openQuestionCount})` },
    ...(handoff ? [{ id: 'handoff' as const, label: 'Handoff' }] : []),
  ];
  return (
    <section className="document-flow document-flow--ready" aria-label="Document Flow">
      <header className="document-flow__summary">
        <div className="document-flow__summary-main">
          <div className="document-flow__summary-heading">
            <p className="document-flow__eyebrow">Feature brief</p>
            <span className="document-flow__review-status">{summary.reviewStatus}</span>
          </div>
          <h3>{summary.goal}</h3>
          <dl className="document-flow__counts">
            <div><dd>{summary.requirementCount}</dd><dt>Requirements</dt></div>
            <div>
              <dd>{summary.acceptanceCriteriaCount}</dd>
              <dt>Acceptance criteria</dt>
            </div>
            <div>
              <dd>{summary.supportedRequirementCount}/{summary.requirementCount}</dd>
              <dt>Supported</dt>
            </div>
          </dl>
        </div>

        <div className="document-flow__journey" aria-label="Observed journey">
          <div>
            <span>Start</span>
            <p>{summary.entryPoint}</p>
          </div>
          <div>
            <span>End</span>
            <p>{summary.completionPoint}</p>
          </div>
        </div>

        {summary.captureType && (
          <details className="document-flow__capture">
            <summary>
              <span>Capture quality</span>
              <strong>{summary.captureType} · {summary.completeness}</strong>
            </summary>
            {summary.captureRationale && <p>{summary.captureRationale}</p>}
          </details>
        )}
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
                    <div className="document-flow__requirement-heading">
                      <p className="document-flow__requirement-meta">{requirement.id}</p>
                      {requirement.priority !== 'unranked' && (
                        <span className="document-flow__priority">
                          {requirement.priority}
                        </span>
                      )}
                    </div>
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
                <section className="document-flow__questions">
                  <header>
                    <p className="document-flow__eyebrow">Evidence gaps</p>
                    <h3>Questions to validate</h3>
                    <p>These points are not confirmed by the captured screens.</p>
                  </header>
                  <ol className="document-flow__questions-list">
                    {presentation.openQuestions.map((claim, index) => (
                      <li key={claim.id}>
                        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <p>{claim.text}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )
            : <p>No open questions identified in this revision.</p>
        )}

        {activeSection === 'handoff' && handoff}
      </div>

      <TechnicalDetails revision={revision} />
    </section>
  );
}
