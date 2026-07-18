import { useSlidingIndicator } from '../useSlidingIndicator';

interface FilterChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
}

export function FilterChips<T extends string>({ options, value, onChange, counts }: FilterChipsProps<T>) {
  const { indicatorRef, registerItem } = useSlidingIndicator(value, { wraps: true });
  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div ref={indicatorRef} style={{ position: 'absolute', top: 0, left: 0, borderRadius: 9, background: 'var(--color-text-primary)', pointerEvents: 'none' }} />
      {options.map((option) => {
        const active = value === option;
        const count = counts?.[option];
        return (
          <button
            key={option}
            ref={registerItem(option)}
            type="button"
            onClick={() => onChange(option)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: count == null ? '7px 14px' : '7px 8px 7px 14px',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              fontFamily: 'inherit',
              background: 'transparent',
              border: `1px solid ${active ? 'transparent' : 'var(--color-border)'}`,
              color: active ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
              transition: 'color .12s ease, border-color .12s ease',
            }}
          >
            {option}
            {count != null && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: active ? 'color-mix(in srgb, var(--color-background-surface) 22%, transparent)' : 'var(--color-background-muted)',
                  color: active ? 'inherit' : 'var(--color-text-disabled)',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
