import { ToggleButton } from '@astryxdesign/core';
import { navigate } from '../router.ts';

export type ReferenceType = 'apps' | 'sites';

interface ReferenceTypeTabsProps {
  active: ReferenceType;
  onChange?: (value: ReferenceType) => void;
}

export function ReferenceTypeTabs({
  active,
  onChange = (value) => navigate(value === 'apps' ? { name: 'apps' } : { name: 'sites' }),
}: ReferenceTypeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Reference type"
      style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 14px' }}
    >
      {(['apps', 'sites'] as const).map((value) => (
        <ToggleButton
          key={value}
          label={value === 'apps' ? 'Apps' : 'Sites'}
          isPressed={active === value}
          onPressedChange={() => onChange(value)}
          role="tab"
          aria-pressed={undefined}
          aria-selected={active === value}
          size="sm"
        />
      ))}
    </div>
  );
}
