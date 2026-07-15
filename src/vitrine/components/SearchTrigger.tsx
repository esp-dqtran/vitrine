import { useEffect } from 'react';
import { Icon } from '@astryxdesign/core';

interface SearchTriggerProps {
  label: string;
  activeCategory: string | null;
  onOpen: () => void;
  onClearCategory: () => void;
}

// Compact header control that replaces both the old inline search input and the
// category pill row — opens the CommandPalette on click or ⌘K/Ctrl+K from anywhere.
export function SearchTrigger({ label, activeCategory, onOpen, onClearCategory }: SearchTriggerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, maxWidth: 420 }}>
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          background: 'var(--color-background-surface)',
          padding: '0 10px 0 14px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color .12s ease, box-shadow .12s ease',
        }}
      >
        <Icon icon="search" size="sm" color="disabled" />
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: 14,
            color: 'var(--color-text-disabled)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-disabled)',
            border: '1px solid var(--color-border)',
            borderRadius: 5,
            padding: '2px 5px',
          }}
        >
          ⌘K
        </span>
      </button>
      {activeCategory && activeCategory !== 'All' && (
        <button
          type="button"
          onClick={onClearCategory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 8px 7px 14px',
            borderRadius: 9,
            border: 'none',
            background: 'var(--color-text-primary)',
            color: 'var(--color-background-surface)',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flex: '0 0 auto',
          }}
        >
          {activeCategory}
          <Icon icon="close" size="xsm" />
        </button>
      )}
    </div>
  );
}
