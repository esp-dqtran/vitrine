import { useEffect } from 'react';
import { Button, Icon } from '@astryxdesign/core';

interface SearchTriggerProps {
  label: string;
  activeCategory: string | null;
  onOpen: () => void;
  onClearCategory: () => void;
  mode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
}

// Compact header control that replaces both the old inline search input and the
// category pill row — opens the CommandPalette on click or ⌘K/Ctrl+K from anywhere.
export function SearchTrigger({
  label,
  activeCategory,
  onOpen,
  onClearCategory,
  mode = 'legacy',
  activeFilterCount = 0,
}: SearchTriggerProps) {
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
  const displayLabel = activeFilterCount
    ? `${label} · ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`
    : label;
  const actionLabel = mode === 'advanced'
    ? `${displayLabel}, Open Quick Search`
    : `${displayLabel}, Open search and filters`;

  return (
    <div className="reference-search-trigger" data-reference-component="search-trigger">
      <Button
        className="reference-search-trigger__button"
        label={displayLabel}
        aria-label={actionLabel}
        variant="secondary"
        onClick={onOpen}
        icon={<Icon icon="search" size="sm" color="disabled" />}
        endContent={<span className="reference-search-trigger__shortcut">⌘K</span>}
      />
      {activeCategory && activeCategory !== 'All' && (
        <Button
          label={activeCategory}
          variant="primary"
          size="sm"
          className="reference-search-trigger__category"
          onClick={onClearCategory}
          endContent={<Icon icon="close" size="xsm" />}
        />
      )}
    </div>
  );
}
