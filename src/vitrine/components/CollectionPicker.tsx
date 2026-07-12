import { useState } from 'react';
import type { ResearchCollection } from '../../db';
import { createCollection, listCollections, saveCollectionItem, type SaveReference } from '../researchApi';

interface CollectionPickerProps {
  reference: SaveReference;
  collections: ResearchCollection[];
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  dark?: boolean;
}

export function CollectionPicker({ reference, collections, onCollectionsChange, dark }: CollectionPickerProps) {
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
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        aria-expanded={open}
        style={{ border: `1px solid ${dark ? 'rgba(255,255,255,.3)' : 'var(--color-border)'}`, borderRadius: 999, padding: '7px 12px', background: dark ? 'rgba(255,255,255,.08)' : 'var(--color-background-surface)', color: dark ? '#fff' : 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600 }}
      >
        {message === 'Saved' ? 'Saved to collection' : 'Save to collection'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30, width: 230, padding: 8, border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-surface)', boxShadow: 'var(--shadow-med)' }}>
          {collections.map((collection) => (
            <button key={collection.id} type="button" onClick={() => void save(collection.id)} style={menuButtonStyle}>
              {collection.name} <span style={{ color: 'var(--color-text-disabled)' }}>{collection.items.length}</span>
            </button>
          ))}
          <button type="button" onClick={() => void createAndSave()} style={{ ...menuButtonStyle, color: 'var(--color-accent)' }}>+ New collection</button>
        </div>
      )}
      {message && message !== 'Saved' && <span role="alert" style={{ fontSize: 11, color: 'var(--color-text-danger)' }}>{message}</span>}
    </div>
  );
}

const menuButtonStyle = { display: 'flex', justifyContent: 'space-between', width: '100%', border: 0, background: 'transparent', borderRadius: 8, padding: '9px 10px', cursor: 'pointer', font: 'inherit', fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'left' as const };
