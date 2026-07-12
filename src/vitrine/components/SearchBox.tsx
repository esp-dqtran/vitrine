import { useEffect, useRef, useState } from 'react';
import { Icon } from '@astryxdesign/core';
import type { App } from '../types';

interface SearchBoxProps {
  apps: App[];
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ apps, value, onChange }: SearchBoxProps) {
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const matches = query ? apps.filter((a) => `${a.app} ${a.cat}`.toLowerCase().includes(query)).slice(0, 6) : [];
  const showDropdown = focused && matches.length > 0;

  useEffect(() => setActiveIdx(0), [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        wrapRef.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectMatch = (a: App) => {
    onChange(a.app);
    setFocused(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectMatch(matches[activeIdx]);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 420 }}>
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
          value={value}
          onKeyDown={onKeyDown}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search screens, flows, components, tokens…"
          style={{
            width: '100%',
            height: 38,
            border: `1px solid ${focused ? 'var(--color-border-emphasized)' : 'var(--color-border)'}`,
            borderRadius: 10,
            background: 'var(--color-background-surface)',
            padding: value ? '0 34px 0 36px' : '0 52px 0 36px',
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
        ) : (
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
            ⌘K
          </span>
        )}
      </div>
      {showDropdown ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--color-background-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-med)',
            padding: 6,
            zIndex: 20,
          }}
        >
          {matches.map((a, i) => (
            <div
              key={a.id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMatch(a);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 9px',
                borderRadius: 8,
                cursor: 'pointer',
                background: i === activeIdx ? 'var(--color-background-muted)' : 'transparent',
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 6, background: a.accent, flex: '0 0 auto' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>{a.app}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-disabled)' }}>{a.cat}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
