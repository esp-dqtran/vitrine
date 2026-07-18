import { useEffect, useState } from 'react';
import type { ResearchCollection } from '../../db';
import { createCollection, deleteCollection, listCollections, removeCollectionItem, updateCollectionItemNotes } from '../researchApi';
import { useSlidePanel } from '../useSlidePanel';

interface CollectionsPanelProps {
  collections: ResearchCollection[];
  onChange: (collections: ResearchCollection[]) => void;
  onClose: () => void;
  onOpenApp: (app: string) => void;
}

export function CollectionsPanel({ collections, onChange, onClose, onOpenApp }: CollectionsPanelProps) {
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
        <button type="button" onClick={onClose} style={buttonStyle}>Close</button>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
        <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void create(); }} placeholder="New collection name" style={{ flex: 1, height: 38, border: '1px solid var(--color-border)', borderRadius: 9, padding: '0 11px', background: 'var(--color-background-body)', color: 'var(--color-text-primary)' }} />
        <button type="button" onClick={() => void create()} style={buttonStyle}>Create</button>
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-text-danger)', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {collections.map((collection) => (
          <section key={collection.id} style={{ border: '1px solid var(--color-border)', borderRadius: 13, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ flex: 1, margin: 0, fontSize: 15 }}>{collection.name} <span style={{ color: 'var(--color-text-disabled)', fontWeight: 500 }}>({collection.items.length})</span></h3>
              <button type="button" onClick={async () => { await deleteCollection(collection.id); await refresh(); }} style={linkStyle}>Delete</button>
            </div>
            {collection.items.length === 0 ? <p style={{ color: 'var(--color-text-disabled)', fontSize: 12.5 }}>No saved evidence yet.</p> : collection.items.map((item) => (
              <article key={item.id} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                  <button type="button" onClick={() => onOpenApp(item.app)} style={{ ...linkStyle, flex: 1, textAlign: 'left' }}>
                    <strong>{item.title}</strong><span style={{ display: 'block', marginTop: 2, color: 'var(--color-text-disabled)', fontSize: 11 }}>{item.kind} · {item.app}</span>
                  </button>
                  <button type="button" onClick={async () => { await removeCollectionItem(collection.id, item.id); await refresh(); }} style={linkStyle}>Remove</button>
                </div>
                <textarea
                  aria-label={`Notes for ${item.title}`}
                  defaultValue={item.notes}
                  placeholder="Add a research note…"
                  onBlur={async (event) => { await updateCollectionItemNotes(collection.id, item.id, event.target.value); await refresh(); }}
                  style={{ width: '100%', minHeight: 64, resize: 'vertical', marginTop: 8, border: '1px solid var(--color-border)', borderRadius: 8, padding: 9, background: 'var(--color-background-body)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 12.5 }}
                />
              </article>
            ))}
          </section>
        ))}
      </div>
    </aside>
    </div>
  );
}

const buttonStyle = { border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 12px', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600 };
const linkStyle = { border: 0, padding: 0, background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', font: 'inherit', fontSize: 12 };
