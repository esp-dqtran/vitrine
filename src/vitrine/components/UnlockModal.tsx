import { useState } from 'react';
import { Button, Dialog, Heading, Text } from '@astryxdesign/core';

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
  const limitReached = remaining < 1;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} purpose="form" width={420}>
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
            <Heading level={3}>Unlock {appId}</Heading>
            <Text color="secondary">{`This uses one of ${remaining} remaining free app unlocks.`}</Text>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="ghost" label="Cancel" clickAction={onClose} isDisabled={busy} />
              <Button variant="primary" label="Unlock" isLoading={busy} clickAction={confirm} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
