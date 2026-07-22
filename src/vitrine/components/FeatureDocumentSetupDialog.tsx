import { useState } from 'react';
import { Button, Dialog, Heading, Text, TextArea } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { Platform } from '../../platformFromUrl.ts';
import { createFeatureDocument } from '../featureDocumentsApi.ts';
import { navigate } from '../router.ts';

export function FeatureDocumentSetupDialog({
  isOpen,
  onClose,
  flow,
  app,
  platform,
  version,
  onCreated,
  create = createFeatureDocument,
}: {
  isOpen: boolean;
  onClose: () => void;
  flow: DesignFlow<EvidenceView>;
  app: string;
  platform: Platform;
  version: number;
  onCreated?: (documentId: number, jobId: number) => void;
  create?: typeof createFeatureDocument;
}) {
  const [focusInstruction, setFocusInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stepCount = flow.steps.length;
  const imageCount = flow.steps.reduce((sum, step) => sum + step.evidence.length, 0);
  const missingSteps = flow.steps.flatMap((step, index) => step.evidence.length ? [] : [index + 1]);

  const close = () => {
    if (busy) return;
    setError('');
    onClose();
  };
  const analyze = async () => {
    if (busy || missingSteps.length > 0 || imageCount === 0) return;
    setBusy(true);
    setError('');
    try {
      const result = await create({ app, platform, version, flowId: flow.id, focusInstruction: focusInstruction.trim() });
      onCreated?.(result.documentId, result.jobId);
      if (!onCreated) navigate({ name: 'feature-document', documentId: result.documentId });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feature Document generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) close(); }} purpose="form" width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading level={3}>Create Feature Document</Heading>
        <Text color="secondary">Analyze {flow.title} as structured product evidence and generate requirements with traceable citations.</Text>
        <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-muted)' }}>
          <strong>{imageCount} images across {stepCount} steps</strong>
          {missingSteps.length > 0 && (
            <div role="alert" style={{ color: 'var(--color-text-danger)', marginTop: 6 }}>
              Add evidence to {missingSteps.length === 1 ? `step ${missingSteps[0]}` : `steps ${missingSteps.join(', ')}`} before analysis.
            </div>
          )}
        </div>
        <TextArea
          label="Focus instruction"
          value={focusInstruction}
          onChange={(value) => setFocusInstruction(value.slice(0, 2_000))}
          placeholder="Optional: focus on recovery, edge cases, or handoff risks"
          rows={4}
          width="100%"
          isDisabled={busy}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right' }}>{focusInstruction.length}/2000</div>
        {error && <div role="alert" style={{ color: 'var(--color-text-danger)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button label="Cancel" variant="ghost" isDisabled={busy} clickAction={close} />
          <Button label="Analyze Flow" variant="primary" isDisabled={busy || missingSteps.length > 0 || imageCount === 0} isLoading={busy} clickAction={analyze} />
        </div>
      </div>
    </Dialog>
  );
}
