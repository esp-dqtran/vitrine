import { useEffect } from 'react';
import { Button, Icon } from '@astryxdesign/core';

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
      <Button
        label={label}
        variant="secondary"
        onClick={onOpen}
        icon={<Icon icon="search" size="sm" color="disabled" />}
        endContent={<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-disabled)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '2px 5px' }}>⌘K</span>}
        style={{
          flex: 1,
          height: 38,
          borderRadius: 10,
        }}
      />
      {activeCategory && activeCategory !== 'All' && (
        <Button
          label={activeCategory}
          variant="primary"
          size="sm"
          onClick={onClearCategory}
          endContent={<Icon icon="close" size="xsm" />}
          style={{
            borderRadius: 9,
            flex: '0 0 auto',
          }}
        />
      )}
    </div>
  );
}
