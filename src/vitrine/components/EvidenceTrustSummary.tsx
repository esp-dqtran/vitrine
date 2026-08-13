import { Button } from '@astryxdesign/core';
import { useState } from 'react';
import { CopyButton } from './CopyButton.tsx';

export type EvidenceCompleteness = 'complete' | 'uncertain' | 'incomplete' | 'not_assessed';

const completenessLabel: Record<EvidenceCompleteness, string> = {
  complete: 'Complete',
  uncertain: 'Uncertain',
  incomplete: 'Incomplete',
  not_assessed: 'Not assessed',
};

function confidenceLabel(confidence?: number | null): string {
  if (confidence === undefined || confidence === null || !Number.isFinite(confidence)) {
    return 'Not scored';
  }
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

export function evidenceCorrectionBrief({
  evidenceId,
  sourceUrl,
  capturedAt,
}: {
  evidenceId: string;
  sourceUrl?: string | null;
  capturedAt?: string | null;
}): string {
  return [
    'Vitrines evidence correction',
    `Evidence: ${evidenceId}`,
    sourceUrl ? `Source: ${sourceUrl}` : 'Source: unavailable',
    capturedAt ? `Captured: ${capturedAt}` : 'Captured: unavailable',
    typeof window === 'undefined' ? null : `Vitrines URL: ${window.location.href}`,
    'Correction needed:',
  ].filter(Boolean).join('\n');
}

export function EvidenceTrustSummary({
  evidenceId,
  sourceLabel = 'Vitrines catalog capture',
  sourceUrl,
  capturedAt,
  confidence,
  completeness = 'not_assessed',
  evidenceCount = 1,
}: {
  evidenceId: string;
  sourceLabel?: string;
  sourceUrl?: string | null;
  capturedAt?: string | null;
  confidence?: number | null;
  completeness?: EvidenceCompleteness;
  evidenceCount?: number;
}) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const capturedLabel = capturedAt
    ? new Date(capturedAt).toLocaleDateString()
    : 'Date unavailable';
  return (
    <aside className="evidence-trust-summary" aria-label="Evidence trust details">
      <dl>
        <div>
          <dt>Provenance</dt>
          <dd>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceLabel}</a> : sourceLabel}</dd>
        </div>
        <div><dt>Captured</dt><dd>{capturedLabel}</dd></div>
        <div><dt>Confidence</dt><dd>{confidenceLabel(confidence)}</dd></div>
        <div><dt>Completeness</dt><dd data-completeness={completeness}>{completenessLabel[completeness]}</dd></div>
        <div><dt>Evidence</dt><dd>{evidenceCount} {evidenceCount === 1 ? 'screen' : 'screens'}</dd></div>
      </dl>
      <Button
        label={correctionOpen ? 'Hide correction help' : 'Correct this evidence'}
        variant="ghost"
        size="sm"
        aria-expanded={correctionOpen}
        onClick={() => setCorrectionOpen((value) => !value)}
      />
      {correctionOpen ? (
        <div className="evidence-trust-summary__correction">
          <p>Copy the traceable evidence brief, add what is wrong and share it with your Vitrines workspace owner.</p>
          <CopyButton
            label="Copy correction brief"
            successMessage="Correction brief copied"
            action={() => navigator.clipboard.writeText(evidenceCorrectionBrief({ evidenceId, sourceUrl, capturedAt }))}
          />
        </div>
      ) : null}
    </aside>
  );
}
