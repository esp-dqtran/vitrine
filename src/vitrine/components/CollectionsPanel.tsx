import { useEffect, useState } from 'react';
import { Button, Card, TextArea, TextInput } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db';
import { createCollection, deleteCollection, listCollections, removeCollectionItem, updateCollectionItemNotes } from '../researchApi';
import { useSlidePanel } from '../useSlidePanel';

interface CollectionsPanelProps {
  collections: ResearchCollection[];
  plan: 'free' | 'pro';
  onUpgrade: () => void;
  onChange: (collections: ResearchCollection[]) => void;
  onClose: () => void;
  onOpenApp: (app: string) => void;
}

export function CollectionsPanel({ collections, plan, onUpgrade, onChange, onClose, onOpenApp }: CollectionsPanelProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { overlayRef, panelRef } = useSlidePanel();
  const refresh = async () => onChange(await listCollections());
  const create = async () => {
    if (!name.trim()) return;
    try {
      await createCollection(name.trim());
      setName('');
      await refresh();
    } catch (reason) { setError((reason as Error).message); }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div ref={overlayRef} onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'var(--color-background-overlay, rgba(0,0,0,0.3))' }}>
    <aside ref={panelRef} role="dialog" aria-label="Research collections" onMouseDown={(event) => event.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 45, width: 'min(460px, 100vw)', overflowY: 'auto', background: 'var(--color-background-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-high)', padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>Research collections</h2><div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Save evidence and keep product-design notes together.</div></div>
        <Button label="Close" variant="secondary" size="sm" onClick={onClose} />
      </div>
      {plan === 'pro' || collections.length === 0 ? (
        <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
          <div style={{ flex: 1 }}><TextInput label="New collection name" isLabelHidden value={name} onChange={setName} onEnter={() => void create()} placeholder="New collection name" width="100%" /></div>
          <Button label="Create" variant="primary" clickAction={create} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', padding: 12, borderRadius: 10, background: 'var(--color-background-muted)' }}>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Free includes one collection.</span>
          <Button label="Upgrade for more collections" variant="primary" size="sm" onClick={onUpgrade} />
        </div>
      )}
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {collections.map((collection) => (
          <Card key={collection.id} padding={3}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ flex: 1, margin: 0, fontSize: 15 }}>{collection.name} <span style={{ color: 'var(--color-text-disabled)', fontWeight: 500 }}>({collection.items.length})</span></h3>
              <Button label="Delete" variant="destructive" size="sm" clickAction={async () => { await deleteCollection(collection.id); await refresh(); }} />
            </div>
            {collection.items.length === 0 ? <p style={{ color: 'var(--color-text-disabled)', fontSize: 12.5 }}>No saved evidence yet.</p> : collection.items.map((item) => (
              <article key={item.id} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                  <div style={{ flex: 1 }}><Button label={item.title} variant="ghost" size="sm" onClick={() => onOpenApp(item.app)} /><span style={{ display: 'block', marginTop: 2, color: 'var(--color-text-disabled)', fontSize: 11 }}>{item.kind} · {item.app}</span></div>
                  <Button label="Remove" variant="ghost" size="sm" clickAction={async () => { await removeCollectionItem(collection.id, item.id); await refresh(); }} />
                </div>
                {plan === 'pro'
                  ? <CollectionItemNotes collectionId={collection.id} itemId={item.id} title={item.title} notes={item.notes} onSaved={refresh} />
                  : <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}><strong>Notes require Pro.</strong>{item.notes ? <p style={{ margin: '4px 0 0' }}>{item.notes}</p> : null}</div>}
              </article>
            ))}
          </Card>
        ))}
      </div>
    </aside>
    </div>
  );
}

function CollectionItemNotes({ collectionId, itemId, title, notes, onSaved }: { collectionId: number; itemId: number; title: string; notes: string; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(notes);
  return <div style={{ marginTop: 8 }}><TextArea label={`Notes for ${title}`} isLabelHidden value={value} onChange={setValue} placeholder="Add a research note…" rows={3} width="100%" onBlur={async () => { await updateCollectionItemNotes(collectionId, itemId, value); await onSaved(); }} /></div>;
}
