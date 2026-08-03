import { useState } from 'react';
import { Button, Heading, Text } from '@astryxdesign/core';
import { AstryxModal } from './AstryxModal.tsx';

export function UnlockModal({
  appId,
  remaining,
  onConfirm,
  onClose,
  onUpgrade,
}: {
  appId: string;
  remaining: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const limitReached = remaining < 1;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AstryxModal isOpen onOpenChange={(open) => { if (!open) onClose(); }} purpose="form" width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {limitReached ? (
          <>
            <Heading level={3}>Free unlocks used</Heading>
            <Text color="secondary">Your three free app unlocks are used. Upgrade to Pro to inspect this complete observed system.</Text>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="ghost" label="Close" clickAction={onClose} />
              <Button variant="primary" label="Upgrade to Pro" clickAction={onUpgrade} />
            </div>
          </>
        ) : (
          <>
            <Heading level={3}>Unlock full app analysis</Heading>
            <Text color="secondary">{`Use one of ${remaining} remaining permanent Free unlocks to inspect every observed screen, UI element, flow, and evidence item for ${appId}.`}</Text>
            {error ? (
              <div role="alert" style={{ color: 'var(--color-text-danger)' }}>
                <Text color="inherit">{error}</Text>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="ghost" label="Cancel" clickAction={onClose} isDisabled={busy} />
              <Button variant="primary" label="Unlock full analysis" isLoading={busy} clickAction={confirm} />
            </div>
          </>
        )}
      </div>
    </AstryxModal>
  );
}
