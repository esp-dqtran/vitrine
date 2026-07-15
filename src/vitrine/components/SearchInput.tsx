import { useState, type KeyboardEvent, type Ref } from 'react';
import { Icon } from '@astryxdesign/core';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  shortcutHint?: string;
  inputRef?: Ref<HTMLInputElement>;
}

// The shared pill-shaped search field: icon, clear button, optional keyboard-shortcut
// hint. Used standalone by simpler filters (Import Management).
export function SearchInput({ value, onChange, placeholder, onFocus, onBlur, onKeyDown, shortcutHint, inputRef }: SearchInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2,
          pointerEvents: 'none',
          color: focused ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
          transition: 'color .12s ease',
          display: 'flex',
        }}
      >
        <Icon icon="search" size="sm" />
      </div>
      <input
        ref={inputRef}
        value={value}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 38,
          border: `1px solid ${focused ? 'var(--color-border-emphasized)' : 'var(--color-border)'}`,
          borderRadius: 10,
          background: 'var(--color-background-surface)',
          padding: value ? '0 34px 0 36px' : shortcutHint ? '0 52px 0 36px' : '0 12px 0 36px',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          outline: 'none',
          transition: 'border-color .12s ease',
          boxShadow: focused ? '0 0 0 3px var(--color-accent-muted)' : 'none',
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 18,
            height: 18,
            borderRadius: 9,
            border: 'none',
            background: 'var(--color-background-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            color: 'var(--color-text-secondary)',
          }}
        >
          <Icon icon="close" size="xsm" />
        </button>
      ) : shortcutHint ? (
        <span
          style={{
            position: 'absolute',
            right: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-disabled)',
            border: '1px solid var(--color-border)',
            borderRadius: 5,
            padding: '2px 5px',
            pointerEvents: 'none',
          }}
        >
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
}
