import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core';

interface ReferenceDiscoveryToolbarOption<T extends string> {
  value: T;
  label: string;
}

interface ReferenceDiscoveryToolbarProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<ReferenceDiscoveryToolbarOption<T>>;
  onChange: (value: T) => void;
  leading?: ReactNode;
}

export function ReferenceDiscoveryToolbar<T extends string>({
  label,
  value,
  options,
  onChange,
  leading,
}: ReferenceDiscoveryToolbarProps<T>) {
  return (
    <div
      data-reference-component="toolbar"
      data-reference-discovery-toolbar="true"
      className="reference-discovery-toolbar"
    >
      {leading}
      <div role="tablist" aria-label={label} className="reference-discovery-toolbar__sort">
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
