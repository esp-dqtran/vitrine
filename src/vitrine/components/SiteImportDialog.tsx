import { useState } from 'react';
import { Button, Dialog, Heading, Text, TextInput } from '@astryxdesign/core';
import { submitSiteImport } from '../sitesApi.ts';

interface SiteImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExisting: (siteId: number, versionId: number) => void;
}

export function SiteImportDialog({ isOpen, onClose, onExisting }: SiteImportDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reset = () => { setUrl(''); setError(null); };
  const close = () => { reset(); onClose(); };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitSiteImport(url.trim());
      if (result.existing) onExisting(result.siteId, result.versionId);
      close();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) close(); }} purpose="form" width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading level={3}>Analyze one public page</Heading>
        <Text color="secondary">Paste any public page URL. Sites will inspect that page only—its rendered structure, responsive layout, motion, and frontend technology—without clicking links.</Text>
        <TextInput
          label="Public page URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/page"
          width="100%"
          hasClear
          status={error ? { type: 'error', message: error } : undefined}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" label="Cancel" clickAction={close} />
          <Button variant="primary" label="Import Site" isDisabled={!url.trim() || busy} isLoading={busy} clickAction={submit} />
        </div>
      </div>
    </Dialog>
  );
}
