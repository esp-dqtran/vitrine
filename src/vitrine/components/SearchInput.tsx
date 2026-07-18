import type { KeyboardEvent, Ref } from 'react';
import { Icon, TextInput } from '@astryxdesign/core';

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
  return (
    <div style={{ position: 'relative' }}>
      <TextInput
        ref={inputRef}
        label="Search"
        isLabelHidden
        value={value}
        onKeyDown={onKeyDown}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        startIcon={<Icon icon="search" size="sm" />}
        hasClear={Boolean(value)}
        width="100%"
      />
      {!value && shortcutHint ? (
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
