import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import {
  copyScreenImageAsPng,
  copyShareLink,
  flowShareUrl,
} from '../screenActions.ts';
import { CopyButton } from './CopyButton.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';
import { scrollToAdjacentFlowScreen } from './flowCarousel.ts';

export interface VisualFlowPanelProps {
  flow: DesignFlow<EvidenceView>;
  platform?: Platform;
  selectedStep?: number;
  onStepChange?(step?: number): void;
}

export function flowStepItems(flow: DesignFlow<EvidenceView>) {
  return flow.steps.flatMap((step, stepIndex) => {
    const evidence = step.evidence[0];
    return evidence ? [{ evidence, stepNumber: stepIndex + 1 }] : [];
  });
}

export function VisualFlowPanel({
  flow,
  platform,
  selectedStep,
  onStepChange,
}: VisualFlowPanelProps) {
  const screenItems = useMemo(
    () => flow.steps.length
      ? flow.steps.map((step, stepIndex) => ({
        evidence: step.evidence[0],
        label: step.label,
        analysis: step.analysis,
        stepNumber: stepIndex + 1,
      }))
      : [{ evidence: undefined, label: flow.title, analysis: undefined, stepNumber: 1 }],
    [flow],
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const screenCount = screenItems.length;
  const isWeb = platform === 'web';
  const imageBackground = isWeb ? 'transparent' : '#fff';

  useEffect(() => {
    if (selectedStep === undefined) return;
    const selectedCard = trackRef.current
      ?.querySelector<HTMLElement>(`[data-flow-step="${selectedStep}"]`);
    selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    selectedCard?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [screenItems.length, selectedStep]);

  const scrollScreens = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    scrollToAdjacentFlowScreen(track, direction);
  };

  const copyFlowLink = async () => {
    if (typeof window === 'undefined') throw new Error('Clipboard is unavailable');
    await copyShareLink(flowShareUrl(
      window.location.href,
      flow.id,
      Math.max(0, (selectedStep ?? 1) - 1),
    ));
  };

  return (
    <section
      className={`visual-flow-panel${platform ? ` visual-flow-panel--${platform}` : ''}`}
      aria-label={`${flow.title} Visual Flow`}
    >
      {flow.insights && (
        <section className="visual-flow-panel__analysis" aria-label="Flow analysis">
          <div className="visual-flow-panel__analysis-summary">
            <strong>{flow.insights.purpose}</strong>
            <span>{Math.round(flow.insights.confidence * 100)}% confidence</span>
          </div>
          <ol className="visual-flow-panel__analysis-steps">
            {screenItems.map(({ label, analysis, stepNumber }) => (
              <li key={`${stepNumber}-${label}`}>
                <strong>{stepNumber}. {label}</strong>
                {analysis && (
                  <span>
                    {[
                      analysis.interaction,
                      ...analysis.visibleStates,
                      ...analysis.systemFeedback,
                    ].join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {flow.insights.feedback.map((item) => (
            <span key={item} className="visual-flow-panel__analysis-note">{item}</span>
          ))}
          {flow.insights.openQuestions.map((item) => (
            <span key={item} className="visual-flow-panel__analysis-question">{item}</span>
          ))}
        </section>
      )}

      <div className="visual-flow-panel__stage">
        {screenItems.length > 1 && (
          <IconButton
            label="Previous flow screens"
            icon={<Icon icon="chevronLeft" size="lg" />}
            variant="secondary"
            className="visual-flow-panel__arrow visual-flow-panel__arrow--left"
            onClick={() => scrollScreens(-1)}
          />
        )}
        <div ref={trackRef} className="visual-flow-panel__track" aria-label={`${flow.title} flow screens`}>
          {screenItems.map(({ evidence, label, stepNumber }) => (
            <article
              key={`${label}-${evidence?.imageId ?? stepNumber}`}
              className={`visual-flow-panel__screen-card${isWeb ? ' visual-flow-panel__screen-card--web' : ''}`}
              aria-label={`Flow screen ${stepNumber}: ${label}`}
              aria-current={selectedStep === stepNumber ? 'step' : undefined}
              data-flow-step={stepNumber}
              data-flow-carousel-item
            >
              <Button
                label={`Select visual step ${stepNumber}: ${label}`}
                variant="ghost"
                className="visual-flow-panel__screen-focus"
                clickAction={() => onStepChange?.(stepNumber)}
              >
                <PlaceholderImage
                  src={evidence?.imageUrl}
                  style={{ objectFit: 'contain', background: imageBackground }}
                />
              </Button>
              <div className="visual-flow-panel__screen-actions">
                <Button label="Save" variant="primary" size="sm" clickAction={() => setSaved(true)} />
                <CopyButton
                  label="Copy image"
                  successMessage="Image copied as PNG"
                  action={async () => {
                    if (!evidence?.imageUrl) throw new Error('No screen image is available');
                    await copyScreenImageAsPng(evidence.imageUrl);
                  }}
                  variant="secondary"
                  size="sm"
                />
              </div>
            </article>
          ))}
        </div>
        {screenItems.length > 1 && (
          <IconButton
            label="Next flow screens"
            icon={<Icon icon="chevronRight" size="lg" />}
            variant="secondary"
            className="visual-flow-panel__arrow visual-flow-panel__arrow--right"
            onClick={() => scrollScreens(1)}
          />
        )}
      </div>

      <footer className="visual-flow-panel__footer">
        <div className="visual-flow-panel__meta">
          <h3>{flow.title}</h3>
          <p>{screenCount} {screenCount === 1 ? 'screen' : 'screens'}</p>
        </div>
        <div className="visual-flow-panel__actions">
          <Button
            label={saved ? 'Saved' : 'Save'}
            variant="primary"
            size="lg"
            className="visual-flow-panel__save"
            clickAction={() => setSaved((value) => !value)}
          />
          <CopyButton
            label="Copy flow link"
            successMessage="Flow link copied"
            action={copyFlowLink}
            variant="secondary"
            size="lg"
            className="visual-flow-panel__copy"
          />
        </div>
      </footer>
    </section>
  );
}
