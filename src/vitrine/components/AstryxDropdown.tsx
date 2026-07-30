import { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  Icon,
  type ButtonVariant,
} from '@astryxdesign/core';

export interface AstryxDropdownProps {
  label: string;
  ariaLabel: string;
  open: boolean;
  children: ReactNode;
  mode?: 'menu' | 'panel';
  panelAriaLabel?: string;
  triggerClassName?: string;
  triggerVariant?: ButtonVariant;
  triggerEndContent?: ReactNode;
  hasChevron?: boolean;
  menuWidth?: number | string;
  onOpenChange: (open: boolean) => void;
}

export function AstryxDropdown({
  label,
  ariaLabel,
  open,
  children,
  mode = 'menu',
  panelAriaLabel,
  triggerClassName,
  triggerVariant = 'ghost',
  triggerEndContent,
  hasChevron = true,
  menuWidth = 184,
  onOpenChange,
}: AstryxDropdownProps) {
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
          className={triggerClassName}
          onClick={() => onOpenChange(!open)}
          endContent={triggerEndContent ?? (hasChevron ? (
            <Icon icon="chevronDown" size="xsm" />
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
    <DropdownMenu
      button={{
        label,
        'aria-label': ariaLabel,
        variant: triggerVariant,
        size: 'sm',
        className: triggerClassName,
        endContent: triggerEndContent,
      }}
      isMenuOpen={open}
      onOpenChange={onOpenChange}
      hasChevron={hasChevron}
      menuWidth={menuWidth}
      className="astryx-dropdown"
    >
      {children}
    </DropdownMenu>
  );
}

export function AstryxDropdownItem({
  label,
  selected = false,
  onSelect,
}: {
  label: string;
  selected?: boolean;
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
      className={`astryx-dropdown__item ${selected ? 'astryx-dropdown__item--selected' : ''}`}
      onClick={onSelect}
      endContent={selected ? (
        <span className="astryx-dropdown__check" aria-label="Selected">
          <Icon icon="check" size="xsm" />
        </span>
      ) : undefined}
    />
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
