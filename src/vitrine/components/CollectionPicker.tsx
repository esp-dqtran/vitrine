import { useState } from 'react';
import { DropdownMenu, DropdownMenuItem } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db';
import { createCollection, listCollections, saveCollectionItem, type SaveReference } from '../researchApi';

interface CollectionPickerProps {
  reference: SaveReference;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  plan: 'free' | 'pro';
  onUpgrade?: () => void;
  dark?: boolean;
}

export function CollectionPicker({ reference, collections, onCollectionsChange, plan, onUpgrade, dark }: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const save = async (collectionId: number) => {
    setBusy(true);
    try {
      await saveCollectionItem(collectionId, reference);
      onCollectionsChange(await listCollections());
      setMessage('Saved');
      setOpen(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createAndSave = async () => {
    const name = window.prompt('Collection name')?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const collection = await createCollection(name);
      await saveCollectionItem(collection.id, reference);
      onCollectionsChange(await listCollections());
      setMessage('Saved');
      setOpen(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        isMenuOpen={open}
        onOpenChange={setOpen}
        button={{
          label: message === 'Saved' ? 'Saved to collection' : 'Save to collection',
          size: 'sm',
          variant: 'ghost',
          isDisabled: busy,
          style: dark
            ? { border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.08)', color: '#fff', borderRadius: 999 }
            : { borderRadius: 999 },
        }}
      >
        {collections.map((collection) => (
          <DropdownMenuItem key={collection.id} label={collection.name} endContent={collection.items.length} onClick={() => void save(collection.id)} isDisabled={busy} />
        ))}
        {plan === 'pro' || collections.length === 0
          ? <DropdownMenuItem label="+ New collection" onClick={() => void createAndSave()} isDisabled={busy} />
          : <DropdownMenuItem label="Upgrade for more collections" onClick={onUpgrade} isDisabled={busy} />}
      </DropdownMenu>
      {message && message !== 'Saved' && <span role="alert" style={{ fontSize: 11, color: 'var(--color-text-danger)' }}>{message}</span>}
    </div>
  );
}
