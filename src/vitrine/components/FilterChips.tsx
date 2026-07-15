interface FilterChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
}

export function FilterChips<T extends string>({ options, value, onChange, counts }: FilterChipsProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((option) => {
        const active = value === option;
        const count = counts?.[option];
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
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
              border: `1px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
              background: active ? 'var(--color-text-primary)' : 'var(--color-background-surface)',
              color: active ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
              transition: 'background .12s ease, border-color .12s ease',
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
