import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  Icon,
  type DropdownMenuProps,
} from '@astryxdesign/core';

export type AstryxDropdownVariant = 'primary' | 'secondary';

export interface AstryxDropdownProps {
  label: string;
  ariaLabel: string;
  open: boolean;
  children: ReactNode;
  mode?: 'menu' | 'panel';
  panelAriaLabel?: string;
  triggerClassName?: string;
  triggerVariant?: AstryxDropdownVariant;
  triggerEndContent?: ReactNode;
  hasChevron?: boolean;
  menuWidth?: number | string;
  onOpenChange: (open: boolean) => void;
}

export function AstryxMenu(props: DropdownMenuProps) {
  const className = ['astryx-dropdown', props.className]
    .filter(Boolean)
    .join(' ');
  return <DropdownMenu {...props} className={className} />;
}

export function AstryxDropdown({
  label,
  ariaLabel,
  open,
  children,
  mode = 'menu',
  panelAriaLabel,
  triggerClassName,
  triggerVariant = 'secondary',
  triggerEndContent,
  hasChevron = true,
  menuWidth = 184,
  onOpenChange,
}: AstryxDropdownProps) {
  const triggerClasses = [
    'astryx-dropdown-trigger',
    `astryx-dropdown-trigger--${triggerVariant}`,
    triggerClassName,
  ].filter(Boolean).join(' ');
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (mode === 'panel' && wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [mode, open]);

  if (mode === 'panel') {
    return (
      <>
        <Button
          ref={triggerRef}
          label={label}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          variant={triggerVariant}
          size="sm"
          className={triggerClasses}
          onClick={() => onOpenChange(!open)}
          endContent={triggerEndContent ?? (hasChevron ? (
            <Icon icon="chevronDown" size="sm" />
          ) : undefined)}
        />
        {open ? (
          <AstryxDropdownPanel
            id={panelId}
            ariaLabel={panelAriaLabel ?? ariaLabel}
          >
            {children}
          </AstryxDropdownPanel>
        ) : null}
      </>
    );
  }

  return (
    <AstryxMenu
      button={{
        label,
        'aria-label': ariaLabel,
        variant: triggerVariant,
        size: 'sm',
        className: triggerClasses,
        endContent: triggerEndContent,
      }}
      isMenuOpen={open}
      onOpenChange={onOpenChange}
      hasChevron={hasChevron}
      menuWidth={menuWidth}
    >
      {children}
    </AstryxMenu>
  );
}

export function AstryxDropdownItem({
  label,
  selected = false,
  tone = 'default',
  onSelect,
}: {
  label: string;
  selected?: boolean;
  tone?: 'default' | 'destructive';
  onSelect: () => void;
}) {
  return (
    <Button
      label={label}
      role="menuitem"
      aria-current={selected ? 'true' : undefined}
      tabIndex={-1}
      variant="ghost"
      size="sm"
      className={[
        'astryx-dropdown__item',
        selected ? 'astryx-dropdown__item--selected' : '',
        tone === 'destructive' ? 'astryx-dropdown__item--destructive' : '',
      ].filter(Boolean).join(' ')}
      onClick={onSelect}
      endContent={selected ? (
        <span className="astryx-dropdown__check" aria-label="Selected">
          <Icon icon="check" size="sm" />
        </span>
      ) : undefined}
    />
  );
}

export function AstryxSingleSelectDropdown({
  ariaLabel,
  value,
  options,
  triggerClassName,
  triggerVariant,
  menuWidth,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  triggerClassName?: string;
  triggerVariant?: AstryxDropdownVariant;
  menuWidth?: number | string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <AstryxDropdown
      label={selectedLabel}
      ariaLabel={`${ariaLabel}: ${selectedLabel}`}
      open={open}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
      menuWidth={menuWidth}
      onOpenChange={setOpen}
    >
      {options.map((option) => (
        <AstryxDropdownItem
          key={option.value}
          label={option.label}
          selected={option.value === value}
          onSelect={() => {
            onChange(option.value);
            setOpen(false);
          }}
        />
      ))}
    </AstryxDropdown>
  );
}

export function AstryxDropdownDivider() {
  return <div className="astryx-dropdown__divider" role="separator" />;
}

export function AstryxDropdownPanel({
  id,
  ariaLabel,
  children,
  className = '',
}: {
  id?: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={`astryx-dropdown-panel ${className}`.trim()}
      role="dialog"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
