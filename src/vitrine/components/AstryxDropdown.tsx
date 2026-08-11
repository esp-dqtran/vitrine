import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  DropdownMenu,
  Icon,
  type DropdownMenuProps,
} from '@astryxdesign/core';

const PANEL_BREAKPOINT_QUERY = '(max-width: 720px)';

// Anchors a portaled panel under its trigger. Skipped below the 720px
// breakpoint, where CSS takes over and renders the panel as a fixed
// bottom sheet instead (see .astryx-dropdown-panel:has(.apps-filterbar__menu)
// in referenceDiscovery.css).
function usePortalPanelPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      if (window.matchMedia(PANEL_BREAKPOINT_QUERY).matches) {
        setStyle(undefined);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setStyle({ position: 'fixed', top: rect.bottom + 8, left: rect.left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  return style;
}

export type AstryxDropdownVariant = 'primary' | 'secondary';

export interface AstryxDropdownProps {
  label: string;
  ariaLabel: string;
  open: boolean;
  children: ReactNode;
  mode?: 'menu' | 'panel';
  panelAriaLabel?: string;
  /**
   * Render the panel through a portal to document.body instead of inline.
   * Needed when the trigger sits inside a `position: sticky` toolbar over a
   * scrolling results grid — Chromium can paint the sticky ancestor's later
   * siblings above an inline absolutely-positioned panel despite z-index,
   * even at z-index 999999 (verified via elementFromPoint). Off by default
   * since other call sites (e.g. reference-detail tab controls, the sticky
   * note toolbar) already position the inline panel correctly with their
   * own ancestor-scoped CSS, which a portal would bypass.
   */
  panelPortal?: boolean;
  triggerClassName?: string;
  triggerVariant?: AstryxDropdownVariant;
  triggerIcon?: ReactNode;
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
  panelPortal = false,
  triggerClassName,
  triggerVariant = 'secondary',
  triggerIcon,
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
  const portalPosition = usePortalPanelPosition(panelPortal && open, triggerRef);

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
          icon={triggerIcon}
          onClick={() => onOpenChange(!open)}
          endContent={triggerEndContent ?? (hasChevron ? (
            <Icon icon="chevronDown" size="sm" />
          ) : undefined)}
        />
        {open ? (
          <AstryxDropdownPanel
            id={panelId}
            ariaLabel={panelAriaLabel ?? ariaLabel}
            portal={panelPortal}
            style={portalPosition}
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
        icon: triggerIcon,
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
  portal = false,
  style,
}: {
  id?: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  portal?: boolean;
  style?: CSSProperties;
}) {
  const panel = (
    <div
      id={id}
      // "astryx-dropdown" (not just "-panel") so the existing outside-click
      // guard (isInsideAstryxDropdownPortal in AppsFilterBar.tsx) recognizes
      // clicks inside this portaled panel as inside the dropdown, same as it
      // already does for the design system's own portaled DropdownMenu.
      className={`${portal ? 'astryx-dropdown ' : ''}astryx-dropdown-panel ${className}`.trim()}
      role="dialog"
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </div>
  );
  if (!portal || typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
}
