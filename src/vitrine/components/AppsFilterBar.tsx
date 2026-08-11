import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Button, CheckboxInput, Icon, IconButton, TextInput } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl.ts';
import { PLATFORM_LABEL } from '../../platformFromUrl.ts';
import {
  AstryxDropdown,
  AstryxDropdownItem,
} from './AstryxDropdown.tsx';
import { ControlRail } from './ControlRail.tsx';

type DiscoveryFilterMenuContainer = Pick<HTMLElement, 'contains'>;
type DiscoveryDropdownPortalTarget = EventTarget & {
  closest?: (selector: string) => unknown;
};

export function isOutsideDiscoveryFilterMenu(
  container: DiscoveryFilterMenuContainer | null,
  target: EventTarget | null,
) {
  return Boolean(container && target && !container.contains(target as Node));
}

export function isInsideAstryxDropdownPortal(target: EventTarget | null) {
  return Boolean(
    target
    && typeof (target as DiscoveryDropdownPortalTarget).closest === 'function'
    && (target as DiscoveryDropdownPortalTarget).closest?.('.astryx-dropdown'),
  );
}

export type DiscoveryOpenMenu =
  | { type: 'platform' }
  | { type: 'sort' }
  | { type: 'merged' }
  | { type: 'filter'; id: string }
  | null;

type DiscoveryMenuTarget = Exclude<DiscoveryOpenMenu, null>;

function isSameDiscoveryMenu(
  current: DiscoveryOpenMenu,
  next: DiscoveryMenuTarget,
) {
  return current?.type === next.type
    && (current.type !== 'filter' || (next.type === 'filter' && current.id === next.id));
}

export function toggleDiscoveryMenu(
  current: DiscoveryOpenMenu,
  next: DiscoveryMenuTarget,
): DiscoveryOpenMenu {
  return isSameDiscoveryMenu(current, next) ? null : next;
}

export function closeDiscoveryMenuForKey(
  event: Pick<KeyboardEvent, 'key'>,
  onClose: () => void,
) {
  if (event.key !== 'Escape') return false;
  onClose();
  return true;
}

export function closeDiscoveryMenuForPointerDown(
  container: DiscoveryFilterMenuContainer | null,
  target: EventTarget | null,
  onClose: () => void,
) {
  if (!isOutsideDiscoveryFilterMenu(container, target)) return false;
  onClose();
  return true;
}

// Compatibility alias while detail pages still import the Apps-named helper.
export const isOutsideAppsFilterMenu = isOutsideDiscoveryFilterMenu;

interface DiscoveryFilterOptionCheckboxProps {
  option: DiscoveryFilterOption;
  selected: boolean;
  onPreview: () => void;
  onToggle: () => void;
}

export function DiscoveryFilterOptionCheckbox({
  option,
  selected,
  onPreview,
  onToggle,
}: DiscoveryFilterOptionCheckboxProps) {
  return (
    <div
      className="apps-filterbar__checkbox-option"
      data-selected={selected ? 'true' : undefined}
      onMouseEnter={onPreview}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('input, label')) return;
        onToggle();
      }}
    >
      <CheckboxInput
        label={option.value}
        value={selected}
        size="sm"
        width="100%"
        onFocus={onPreview}
        onChange={onToggle}
      />
    </div>
  );
}

const PLATFORM_ORDER: readonly Platform[] = ['web', 'ios', 'android'];

function DiscoveryFilterSearch({
  label,
  query,
  onQueryChange,
}: {
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="apps-filterbar__search">
      <TextInput
        label={`Search ${label}`}
        isLabelHidden
        value={query}
        onChange={onQueryChange}
        placeholder={`Search ${label.toLowerCase()}…`}
        startIcon={<Icon icon="search" size="sm" />}
        hasClear
        hasAutoFocus
        width="100%"
      />
    </div>
  );
}

function DiscoverySingleSelectOptions({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: readonly DiscoveryFilterSortOption[];
  onSelect: (value: string) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <AstryxDropdownItem
          key={option.value}
          label={option.label}
          selected={value === option.value}
          onSelect={() => onSelect(option.value)}
        />
      ))}
    </>
  );
}

export function DiscoverySortDropdown({
  value,
  options,
  open,
  containerRef,
  onOpenChange,
  onChange,
}: {
  value: string;
  options: readonly DiscoveryFilterSortOption[];
  open: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const label = options.find((option) => option.value === value)?.label ?? value;
  return (
    <div
      className="apps-filterbar__filter apps-filterbar__filter--sort apps-filterbar__sort"
      ref={containerRef}
    >
      <AstryxDropdown
        label={label}
        ariaLabel={`Sort: ${label}`}
        open={open}
        triggerClassName="apps-filterbar__filter-button"
        onOpenChange={onOpenChange}
      >
        <DiscoverySingleSelectOptions
          value={value}
          options={options}
          onSelect={(nextValue) => {
            onChange(nextValue);
            onOpenChange(false);
          }}
        />
      </AstryxDropdown>
    </div>
  );
}

export function DiscoveryPlatformFilterOptions({
  value,
  platforms = PLATFORM_ORDER,
  onSelect,
}: {
  value: Platform;
  platforms?: readonly Platform[];
  onSelect: (platform: Platform) => void;
}) {
  return (
    <DiscoverySingleSelectOptions
      value={value}
      options={PLATFORM_ORDER
        .filter((platform) => platforms.includes(platform))
        .map((platform) => ({ value: platform, label: PLATFORM_LABEL[platform] }))}
      onSelect={(platform) => onSelect(platform as Platform)}
    />
  );
}

export interface DiscoveryFilterOption {
  value: string;
  section: string;
  count?: number;
  previewUrl?: string | null;
  previewLabel?: string;
  description?: string;
  aliases?: string[];
  sectionPosition?: number;
  position?: number;
}

export interface DiscoveryFilterGroup {
  id: string;
  label: string;
  selected: string[];
  options: DiscoveryFilterOption[];
  loadOptions?: (
    query: string,
    signal: AbortSignal,
  ) => Promise<DiscoveryFilterOption[]>;
}

export interface DiscoveryFilterSortOption {
  value: string;
  label: string;
}

interface DiscoveryFilterMenuProps {
  group: DiscoveryFilterGroup;
  open: boolean;
  query: string;
  preview: DiscoveryFilterOption | null;
  containerRef?: RefObject<HTMLDivElement | null>;
  onToggleOpen: () => void;
  onQueryChange: (query: string) => void;
  onPreview: (option: DiscoveryFilterOption) => void;
  onToggleOption: (option: DiscoveryFilterOption) => void;
  onClear: () => void;
}

export const DISCOVERY_FILTER_OPTION_RENDER_LIMIT = 200;

export function discoveryFilterVisibleOptions(
  options: readonly DiscoveryFilterOption[],
  query: string,
  selected: readonly string[],
  limit = DISCOVERY_FILTER_OPTION_RENDER_LIMIT,
): DiscoveryFilterOption[] {
  const boundedLimit = Math.max(1, Math.trunc(limit));
  const needle = query.trim().toLowerCase();
  if (needle) {
    return options
      .filter(({ value, section, description, aliases }) =>
        [section, value, description, ...(aliases ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle))
      .slice(0, boundedLimit);
  }
  const selectedSet = new Set(selected);
  const selectedOptions = options.filter(({ value }) => selectedSet.has(value));
  const defaults = options.filter(({ value }) => !selectedSet.has(value));
  return [...selectedOptions, ...defaults].slice(0, boundedLimit);
}

export function DiscoveryFilterMenu({
  group,
  open,
  query,
  preview,
  containerRef,
  onToggleOpen,
  onQueryChange,
  onPreview,
  onToggleOption,
  onClear,
}: DiscoveryFilterMenuProps) {
  const selectedCount = group.selected.length;
  const selectedKey = group.selected.join('\0');
  const loadOptionsRef = useRef(group.loadOptions);
  loadOptionsRef.current = group.loadOptions;
  const [remoteOptions, setRemoteOptions] = useState<{
    groupId: string;
    options: DiscoveryFilterOption[];
  }>({ groupId: group.id, options: [] });
  const [loadingOptions, setLoadingOptions] = useState(false);
  useEffect(() => {
    const loadOptions = loadOptionsRef.current;
    if (!open || !loadOptions) return;
    const controller = new AbortController();
    const run = () => {
      setLoadingOptions(true);
      void loadOptions(query, controller.signal)
        .then((options) => {
          if (!controller.signal.aborted) {
            setRemoteOptions({ groupId: group.id, options });
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoadingOptions(false);
        });
    };
    const timeout = query.trim() ? window.setTimeout(run, 150) : undefined;
    if (timeout === undefined) run();
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      controller.abort();
    };
  }, [group.id, open, query, selectedKey]);
  const options = useMemo(() => {
    const merged = new Map(
      group.options.map((option) => [option.value, option] as const),
    );
    if (remoteOptions.groupId === group.id) {
      for (const option of remoteOptions.options) {
        merged.set(option.value, {
          ...merged.get(option.value),
          ...option,
        });
      }
    }
    return [...merged.values()];
  }, [group.id, group.options, remoteOptions]);
  const visibleOptions = useMemo(
    () => discoveryFilterVisibleOptions(options, query, group.selected),
    [group.selected, options, query],
  );
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, DiscoveryFilterOption[]>();
    for (const option of visibleOptions) {
      groups.set(option.section, [...(groups.get(option.section) ?? []), option]);
    }
    return [...groups.entries()];
  }, [visibleOptions]);

  return (
    <div
      className={`apps-filterbar__filter ${selectedCount ? 'apps-filterbar__filter--selected' : ''}`}
      data-filter-group={group.id}
      ref={containerRef}
    >
      <AstryxDropdown
        mode="panel"
        label={selectedCount === 1 ? group.selected[0]! : group.label}
        ariaLabel={selectedCount
          ? `Filter (${selectedCount} selected): ${selectedCount === 1 ? group.selected[0] : group.label}`
          : `Open ${group.label} filters`}
        panelAriaLabel={`${group.label} filters`}
        panelPortal
        open={open}
        triggerClassName="apps-filterbar__filter-button"
        triggerEndContent={selectedCount > 1
          ? <span className="apps-filterbar__selection-count">{selectedCount}</span>
          : undefined}
        hasChevron={!selectedCount}
        onOpenChange={(nextOpen) => {
          if (nextOpen !== open) onToggleOpen();
        }}
      >
        <div className="apps-filterbar__menu">
          <DiscoveryFilterSearch
            label={group.label}
            query={query}
            onQueryChange={onQueryChange}
          />
          <div className="apps-filterbar__options" role="group" aria-label={`${group.label} suggestions`}>
            {groupedOptions.map(([section, sectionOptions]) => (
              <section key={section} className="apps-filterbar__option-group">
                <h3>{section}</h3>
                {sectionOptions.map((option) => (
                  <DiscoveryFilterOptionCheckbox
                    key={option.value}
                    option={option}
                    selected={group.selected.includes(option.value)}
                    onPreview={() => onPreview(option)}
                    onToggle={() => onToggleOption(option)}
                  />
                ))}
              </section>
            ))}
            {loadingOptions && groupedOptions.length === 0
              ? <p>Loading filters…</p>
              : groupedOptions.length === 0
                ? <p>No matching filters</p>
                : null}
          </div>
        </div>
        <aside className="apps-filterbar__preview">
          {preview?.previewUrl ? (
            <img src={preview.previewUrl} alt="" />
          ) : (
            <Icon icon="viewColumns" size="lg" color="disabled" />
          )}
          <p>
            {preview?.description
              ?? preview?.previewLabel
              ?? `Choose a ${group.label.toLowerCase()} filter`}
          </p>
        </aside>
      </AstryxDropdown>
      {selectedCount ? (
        <IconButton
          label={`Clear ${group.label} ${selectedCount === 1 ? 'filter' : 'filters'}`}
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          size="sm"
          className="apps-filterbar__clear"
          onClick={onClear}
        />
      ) : null}
    </div>
  );
}

export interface DiscoveryFilterBarProps {
  kind: 'apps' | 'sites' | 'flows';
  ariaLabel: string;
  platform: {
    value: Platform;
    platforms?: readonly Platform[];
    ariaLabel: string;
    onChange: (platform: Platform) => void;
  };
  filters: DiscoveryFilterGroup[];
  resultCount: number;
  resultLabels: readonly [string, string];
  showResultCount?: boolean;
  showSort?: boolean;
  sort: string;
  sortOptions: readonly DiscoveryFilterSortOption[];
  onSortChange: (sort: string) => void;
  onToggleFilter: (group: string, value: string) => void;
  onClearFilter: (group: string) => void;
}

export function DiscoveryFilterBar({
  kind,
  ariaLabel,
  platform,
  filters,
  resultCount,
  resultLabels,
  showResultCount = false,
  showSort = true,
  sort,
  sortOptions,
  onSortChange,
  onToggleFilter,
  onClearFilter,
}: DiscoveryFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<DiscoveryOpenMenu>(null);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<DiscoveryFilterOption | null>(null);
  const openMenuContainerRef = useRef<HTMLDivElement>(null);
  const resultLabel = resultCount === 1 ? resultLabels[0] : resultLabels[1];
  const selectedFilterCount = filters.reduce(
    (count, group) => count + group.selected.length,
    0,
  );

  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      closeDiscoveryMenuForKey(event, () => setOpenMenu(null));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isInsideAstryxDropdownPortal(event.target)) return;
      closeDiscoveryMenuForPointerDown(openMenuContainerRef.current, event.target, () => setOpenMenu(null));
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openMenu]);

  const toggleMenu = (menu: DiscoveryMenuTarget) => {
    setQuery('');
    setPreview(null);
    setOpenMenu((current) => toggleDiscoveryMenu(current, menu));
  };

  const isMenuOpen = (menu: DiscoveryMenuTarget) => isSameDiscoveryMenu(openMenu, menu);
  const setSingleSelectOpen = (menu: DiscoveryMenuTarget, open: boolean) => {
    if (open) {
      setQuery('');
      setPreview(null);
      setOpenMenu(menu);
      return;
    }
    setOpenMenu((current) => isSameDiscoveryMenu(current, menu) ? null : current);
  };

  return (
    <ControlRail
      className="apps-filterbar"
      ariaLabel={ariaLabel}
      dataAttributes={{
        'data-discovery-filterbar': kind,
        'data-apps-filterbar': kind === 'apps' ? 'true' : undefined,
        'data-sites-filterbar': kind === 'sites' ? 'true' : undefined,
        'data-flows-filterbar': kind === 'flows' ? 'true' : undefined,
      }}
    >
      <div className="apps-filterbar__controls">
        <div
          className="apps-filterbar__filter apps-filterbar__filter--platform"
          aria-label={platform.ariaLabel}
          ref={isMenuOpen({ type: 'platform' }) ? openMenuContainerRef : undefined}
        >
          <AstryxDropdown
            label={PLATFORM_LABEL[platform.value]}
            ariaLabel={`${platform.ariaLabel}: ${PLATFORM_LABEL[platform.value]}`}
            open={isMenuOpen({ type: 'platform' })}
            triggerClassName="apps-filterbar__filter-button"
            triggerVariant="primary"
            onOpenChange={(open) => setSingleSelectOpen({ type: 'platform' }, open)}
          >
            <DiscoveryPlatformFilterOptions
              value={platform.value}
              platforms={platform.platforms}
              onSelect={(value) => {
                platform.onChange(value);
                setOpenMenu(null);
              }}
            />
          </AstryxDropdown>
        </div>
        <span className="apps-filterbar__divider" aria-hidden="true" />
        <div className="apps-filterbar__filter apps-filterbar__filter--merged">
          <AstryxDropdown
            label="Filters"
            ariaLabel={selectedFilterCount
              ? `Filters (${selectedFilterCount} selected)`
              : 'Filters'}
            open={isMenuOpen({ type: 'merged' })}
            triggerClassName="apps-filterbar__filter-button"
            triggerEndContent={selectedFilterCount ? (
              <>
                <span className="apps-filterbar__selection-count">
                  {selectedFilterCount}
                </span>
                <Icon icon="chevronDown" size="sm" />
              </>
            ) : undefined}
            menuWidth={200}
            onOpenChange={(open) => setSingleSelectOpen({ type: 'merged' }, open)}
          >
            {filters.map((group) => (
              <AstryxDropdownItem
                key={group.id}
                label={group.selected.length
                  ? `${group.label} (${group.selected.length})`
                  : group.label}
                selected={group.selected.length > 0}
                onSelect={() => setOpenMenu({ type: 'filter', id: group.id })}
              />
            ))}
          </AstryxDropdown>
        </div>
        {filters.map((group) => (
          <DiscoveryFilterMenu
            key={group.id}
            group={group}
            open={isMenuOpen({ type: 'filter', id: group.id })}
            query={query}
            preview={preview}
            containerRef={isMenuOpen({ type: 'filter', id: group.id }) ? openMenuContainerRef : undefined}
            onToggleOpen={() => toggleMenu({ type: 'filter', id: group.id })}
            onQueryChange={setQuery}
            onPreview={setPreview}
            onToggleOption={(option) => onToggleFilter(group.id, option.value)}
            onClear={() => onClearFilter(group.id)}
          />
        ))}
      </div>
      <div className="apps-filterbar__meta">
        {showResultCount ? (
          <>
            <span className="apps-filterbar__count" aria-live="polite">
              <small>Showing</small>
              <strong>{resultCount} {resultLabel}</strong>
            </span>
            <span className="apps-filterbar__divider" aria-hidden="true" />
          </>
        ) : null}
        {showSort ? (
          <DiscoverySortDropdown
            value={sort}
            options={sortOptions}
            open={isMenuOpen({ type: 'sort' })}
            containerRef={isMenuOpen({ type: 'sort' }) ? openMenuContainerRef : undefined}
            onOpenChange={(open) => setSingleSelectOpen({ type: 'sort' }, open)}
            onChange={onSortChange}
          />
        ) : null}
      </div>
    </ControlRail>
  );
}
