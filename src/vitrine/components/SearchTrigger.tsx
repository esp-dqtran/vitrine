import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Icon } from '@astryxdesign/core';

interface AstryxInputTextProps {
  label: string;
  ariaLabel: string;
  className?: string;
  endContent?: ReactNode;
  onOpen: () => void;
}

const promptsForSearch = (label: string) => {
  if (label.includes('Apps')) return [label, 'Find an AI tool…', 'Browse UI patterns…'];
  if (label.includes('Sites')) return [label, 'Find a pricing page…', 'Browse visual styles…'];
  if (label.includes('Flows')) return [label, 'Find onboarding…', 'Browse checkout flows…'];
  return [label, 'Find real product evidence…', 'Browse patterns and flows…'];
};

function TypedSearchPrompt({ label }: { label: string }) {
  const prompts = useMemo(() => promptsForSearch(label), [label]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(label.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    setPromptIndex(0);
    setCharacterCount(label.length);
    setIsDeleting(false);
  }, [label]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const prompt = prompts[promptIndex] ?? label;
    const isComplete = characterCount === prompt.length;
    const delay = isComplete ? 1_600 : isDeleting ? 26 : 42;
    const timeout = window.setTimeout(() => {
      if (!isDeleting && !isComplete) {
        setCharacterCount((count) => count + 1);
      } else if (!isDeleting) {
        setIsDeleting(true);
      } else if (characterCount > 0) {
        setCharacterCount((count) => count - 1);
      } else {
        setIsDeleting(false);
        setPromptIndex((index) => (index + 1) % prompts.length);
      }
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [characterCount, isDeleting, label, prefersReducedMotion, promptIndex, prompts]);

  const prompt = prefersReducedMotion ? label : prompts[promptIndex]?.slice(0, characterCount);
  return (
    <span className="reference-search-trigger__typed-label" aria-hidden="true">
      {prompt}
      <span className="reference-search-trigger__caret" />
    </span>
  );
}

export function AstryxInputText({
  label,
  ariaLabel,
  className,
  endContent,
  onOpen,
}: AstryxInputTextProps) {
  return (
    <Button
      className={['astryx-input-text', className].filter(Boolean).join(' ')}
      label={ariaLabel}
      aria-label={ariaLabel}
      variant="secondary"
      onClick={onOpen}
      icon={<Icon icon="search" size="sm" color="disabled" />}
      endContent={endContent}
    >
      <TypedSearchPrompt label={label} />
    </Button>
  );
}

interface SearchTriggerProps {
  label: string;
  activeCategory: string | null;
  onOpen: () => void;
  onClearCategory: () => void;
  mode?: 'legacy' | 'advanced';
  activeFilterCount?: number;
}

// Compact header control that replaces both the old inline search input and the
// category pill row — opens the CommandPalette on click, ⌘K, or ⌘Space.
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
      const isSearchShortcut =
        (e.key.toLowerCase() === 'k' || e.key === ' ') && (e.metaKey || e.ctrlKey);
      if (isSearchShortcut) {
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
      <AstryxInputText
        className="reference-search-trigger__button"
        label={displayLabel}
        ariaLabel={actionLabel}
        onOpen={onOpen}
        endContent={<span className="reference-search-trigger__shortcut">⌘K / ⌘Space</span>}
      />
      {activeCategory && activeCategory !== 'All' && (
        <Button
          label={activeCategory}
          variant="primary"
          size="sm"
          className="reference-search-trigger__category"
          onClick={onClearCategory}
          endContent={<Icon icon="close" size="sm" />}
        />
      )}
    </div>
  );
}
