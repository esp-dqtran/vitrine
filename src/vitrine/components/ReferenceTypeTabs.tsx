import { ToggleButton } from '@astryxdesign/core';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../router.ts';

export type ReferenceType = 'apps' | 'sites' | 'color' | 'flows' | 'components' | 'projects';

const DEFAULT_REFERENCE_TYPES: readonly ReferenceType[] = [
  'apps',
  'sites',
  'flows',
  'components',
  'color',
];

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
            : value === 'components'
              ? { name: 'components' }
            : { name: 'projects' },
  ),
  className,
  values = DEFAULT_REFERENCE_TYPES,
}: ReferenceTypeTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<ReferenceType, HTMLSpanElement>>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({ opacity: 0 });

  useEffect(() => {
    tablistRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  useLayoutEffect(() => {
    const tablist = tablistRef.current;
    const activeTab = tabRefs.current[active];
    if (!tablist || !activeTab) return;

    const measure = () => {
      const tablistRect = tablist.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      setIndicatorStyle({
        width: activeRect.width,
        opacity: 1,
        transform: `translateX(${activeRect.left - tablistRect.left + tablist.scrollLeft}px)`,
      });
    };

    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(tablist);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active, values]);

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="Reference type"
      className={['reference-type-tabs', className].filter(Boolean).join(' ')}
      style={className ? undefined : { display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 14px' }}
    >
      <span
        className="reference-type-tabs__indicator"
        style={indicatorStyle}
        aria-hidden="true"
      />
      {values.map((value) => (
        <span
          key={value}
          ref={(node) => { tabRefs.current[value] = node ?? undefined; }}
          className="reference-type-tabs__tab"
        >
          <ToggleButton
            label={value === 'apps'
              ? 'Apps'
              : value === 'sites'
                ? 'Sites'
                : value === 'color'
                  ? 'Colors'
                  : value === 'flows'
                    ? 'Flows'
                    : value === 'components' ? 'Components' : 'Projects'}
            isPressed={active === value}
            onPressedChange={() => onChange(value)}
            role="tab"
            aria-pressed={undefined}
            aria-selected={active === value}
            size="sm"
          />
        </span>
      ))}
    </div>
  );
}
