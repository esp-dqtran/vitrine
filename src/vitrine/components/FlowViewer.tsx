import { useState } from 'react';
import { Badge, Button, Icon } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem';
import { PlaceholderImage } from './PlaceholderImage';
import { Lightbox } from './Lightbox';
import type { Platform } from '../../platformFromUrl.ts';
import { FeatureDocumentSetupDialog } from './FeatureDocumentSetupDialog.tsx';

type LightboxState = { index: number } | null;

export function FlowViewer({
  flow,
  app,
  platform,
  version,
  initialStep,
  onBack,
}: {
  flow: DesignFlow<EvidenceView>;
  app?: string;
  platform?: Platform;
  version?: number;
  initialStep?: number;
  onBack: () => void;
}) {
  const stepImages = flow.steps.map((step) => step.evidence[0]).filter((evidence) => evidence !== undefined);
  const initialEvidence = initialStep ? flow.steps[initialStep - 1]?.evidence[0] : undefined;
  const [lightbox, setLightbox] = useState<LightboxState>(
    initialEvidence ? { index: stepImages.indexOf(initialEvidence) } : null,
  );
  const [featureDocumentOpen, setFeatureDocumentOpen] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Button label="Back to flows" icon={<Icon icon="chevronLeft" size="sm" />} variant="ghost" size="sm" onClick={onBack} />
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
                onClick={() => step.evidence[0] && setLightbox({ index: stepImages.indexOf(step.evidence[0]) })}
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
        const item = stepImages[lightbox.index];
        if (!item) return null;
        return (
          <Lightbox
            item={{ url: item.imageUrl, type: 'Flow step', caption: item.description ?? flow.title }}
            index={lightbox.index}
            total={stepImages.length}
            onClose={() => setLightbox(null)}
            onNavigate={(i) => setLightbox({ index: ((i % stepImages.length) + stepImages.length) % stepImages.length })}
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
