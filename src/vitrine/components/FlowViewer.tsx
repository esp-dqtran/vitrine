import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Icon } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';
import { Lightbox } from './Lightbox';
import type { Platform } from '../../platformFromUrl.ts';
import { FeatureDocumentSetupDialog } from './FeatureDocumentSetupDialog.tsx';

type LightboxState = { index: number } | null;

export function flowStepItems(flow: DesignFlow<EvidenceView>) {
  return flow.steps.flatMap((step, stepIndex) => {
    const evidence = step.evidence[0];
    return evidence ? [{ evidence, stepNumber: stepIndex + 1 }] : [];
  });
}

export function FlowViewer({
  flow,
  app,
  platform,
  version,
  initialStep,
  onBack,
  onStepChange,
}: {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  initialStep?: number;
  onBack: () => void;
  onStepChange?: (step?: number) => void;
}) {
  const stepItems = useMemo(() => flowStepItems(flow), [flow]);
  const initialLightboxIndex = initialStep
    ? stepItems.findIndex(({ stepNumber }) => stepNumber === initialStep)
    : -1;
  const [lightbox, setLightbox] = useState<LightboxState>(
    initialLightboxIndex >= 0 ? { index: initialLightboxIndex } : null,
  );
  const [featureDocumentOpen, setFeatureDocumentOpen] = useState(false);

  useEffect(() => {
    const index = initialStep
      ? stepItems.findIndex(({ stepNumber }) => stepNumber === initialStep)
      : -1;
    setLightbox(index >= 0 ? { index } : null);
  }, [flow.id, initialStep, stepItems]);

  const openStep = (stepNumber: number) => {
    const index = stepItems.findIndex((item) => item.stepNumber === stepNumber);
    if (index < 0) return;
    setLightbox({ index });
    onStepChange?.(stepNumber);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Button label="Back to all flows" icon={<Icon icon="chevronLeft" size="sm" />} variant="ghost" size="sm" onClick={onBack} />
        {app && platform && version && <Button label="Create Feature Document" variant="primary" size="sm" clickAction={() => setFeatureDocumentOpen(true)} />}
      </div>
      {flow.category && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{flow.category}</div>}
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10 }}>{flow.title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }}>
        {flow.tags.map((tag) => <Badge key={tag} variant="neutral" label={tag} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
        {flow.steps.map((step, index) => (
          <div key={`${step.label}-${step.evidence[0]?.imageId ?? index}`} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                onClick={() => openStep(index + 1)}
                style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 'var(--radius-container)', overflow: 'hidden', background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-low)', cursor: step.evidence[0] ? 'zoom-in' : 'default' }}
              >
                <PlaceholderImage src={step.evidence[0]?.imageUrl} />
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 22, height: 22, borderRadius: 11, background: '#18181b', color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{index + 1}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{step.label}</div>
                {step.interaction && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    <span aria-hidden style={{ flex: '0 0 auto', color: 'var(--color-text-disabled)' }}>&rarr;</span>
                    <span>{step.interaction}</span>
                  </div>
                )}
              </div>
            </div>
            {index < flow.steps.length - 1 && <div style={{ height: 146, padding: '0 10px', display: 'flex', alignItems: 'center' }}><Icon icon="chevronRight" size="sm" color="secondary" /></div>}
          </div>
        ))}
      </div>
      {lightbox !== null && (() => {
        const item = stepItems[lightbox.index]?.evidence;
        if (!item) return null;
        return (
          <Lightbox
            item={{ url: item.imageUrl, type: 'Flow step', caption: item.description ?? flow.title }}
            index={lightbox.index}
            total={stepItems.length}
            onClose={() => {
              setLightbox(null);
              onStepChange?.(undefined);
            }}
            onNavigate={(requestedIndex) => {
              const index = ((requestedIndex % stepItems.length) + stepItems.length)
                % stepItems.length;
              setLightbox({ index });
              onStepChange?.(stepItems[index].stepNumber);
            }}
          />
        );
      })()}
      {app && platform && version && (
        <FeatureDocumentSetupDialog
          isOpen={featureDocumentOpen}
          onClose={() => setFeatureDocumentOpen(false)}
          flow={flow}
          app={app}
          platform={platform}
          version={version}
        />
      )}
    </div>
  );
}
