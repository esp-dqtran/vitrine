import { ToggleButton } from '@astryxdesign/core';
import { navigate } from '../router.ts';

export type ReferenceType = 'apps' | 'sites' | 'color' | 'flows' | 'projects';

interface ReferenceTypeTabsProps {
  active: ReferenceType;
  onChange?: (value: ReferenceType) => void;
  className?: string;
  values?: readonly ReferenceType[];
}

export function ReferenceTypeTabs({
  active,
  onChange = (value) => navigate(
    value === 'apps'
      ? { name: 'apps' }
      : value === 'sites'
        ? { name: 'sites' }
        : value === 'color'
          ? { name: 'color' }
          : value === 'flows'
            ? { name: 'flows' }
            : { name: 'projects' },
  ),
  className,
  values = ['apps', 'sites', 'flows', 'color'],
}: ReferenceTypeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Reference type"
      className={className}
      style={className ? undefined : { display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 14px' }}
    >
      {values.map((value) => (
        <ToggleButton
          key={value}
          label={value === 'apps'
            ? 'Apps'
            : value === 'sites'
              ? 'Sites'
              : value === 'color'
                ? 'Colors'
                : value === 'flows' ? 'Flows' : 'Projects'}
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
