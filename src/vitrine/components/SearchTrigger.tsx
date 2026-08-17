import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
  if (label.includes('Colors')) return [label, 'Find a cinematic palette…', 'Browse warm neutrals…'];
  if (label.includes('Flows')) return [label, 'Find onboarding…', 'Browse checkout flows…'];
  return [label, 'Find real product evidence…', 'Browse patterns and flows…'];
};

const promptLetters = (prompt: string) => Array.from(prompt).map((letter, index) => (
  <span
    key={`${prompt}-${index}`}
    className="reference-search-trigger__letter"
    style={{ '--letter-index': index } as CSSProperties}
  >
    {letter === ' ' ? '\u00a0' : letter}
  </span>
));

function AnimatedSearchPrompt({ label }: { label: string }) {
  const prompts = useMemo(() => promptsForSearch(label), [label]);
  const [promptState, setPromptState] = useState<{ current: number; previous: number | null }>({
    current: 0,
    previous: null,
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    setPromptState({ current: 0, previous: null });
  }, [label]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setPromptState(({ current }) => ({
        previous: current,
        current: (current + 1) % prompts.length,
      }));
    }, 2_400);
    return () => window.clearInterval(interval);
  }, [prefersReducedMotion, prompts]);

  const currentIndex = prefersReducedMotion ? 0 : promptState.current;
  const previousIndex = prefersReducedMotion ? null : promptState.previous;
  const currentPrompt = prompts[currentIndex] ?? label;
  const previousPrompt = previousIndex === null ? null : prompts[previousIndex];

  return (
    <span className="reference-search-trigger__animated-label" aria-hidden="true">
      {previousPrompt ? (
        <span
          key={`leaving-${previousPrompt}-${currentIndex}`}
          className="reference-search-trigger__line reference-search-trigger__line--leave"
        >
          {promptLetters(previousPrompt)}
        </span>
      ) : null}
      <span
        key={`entering-${currentPrompt}-${currentIndex}`}
        className="reference-search-trigger__line reference-search-trigger__line--enter"
      >
        {promptLetters(currentPrompt)}
      </span>
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
      <AnimatedSearchPrompt label={label} />
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
