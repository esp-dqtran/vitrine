import { Icon } from '@astryxdesign/core';
import { useEffect, useState, type ReactNode } from 'react';
import { navigate, routeToPath } from '../router.ts';
import { AstryxDropdownItem, AstryxMenu } from './AstryxDropdown.tsx';
import { ReferenceTypeTabs, type ReferenceType } from './ReferenceTypeTabs.tsx';

interface ApplicationHeaderProps {
  active: ReferenceType;
  className: string;
  search: ReactNode;
  accountControls?: ReactNode;
  contextIconUrl?: string | null;
}

const REFERENCE_TYPES = ['apps', 'sites', 'flows', 'components', 'color'] as const;

function referenceTypeLabel(value: ReferenceType) {
  return value === 'apps'
    ? 'Apps'
    : value === 'sites'
      ? 'Sites'
      : value === 'color'
        ? 'Colors'
        : value === 'flows'
          ? 'Flows'
          : value === 'components' ? 'Components' : 'Projects';
}

function referenceTypeRoute(value: ReferenceType) {
  return value === 'apps'
    ? { name: 'apps' } as const
    : value === 'sites'
      ? { name: 'sites' } as const
      : value === 'color'
        ? { name: 'color' } as const
        : value === 'flows'
          ? { name: 'flows' } as const
          : value === 'components'
            ? { name: 'components' } as const
            : { name: 'projects' } as const;
}

export function ApplicationHeader({
  active,
  className,
  search,
  accountControls,
  contextIconUrl,
}: ApplicationHeaderProps) {
  const [showContextIcon, setShowContextIcon] = useState(false);
  const [mobileReferenceMenuOpen, setMobileReferenceMenuOpen] = useState(false);
  useEffect(() => {
    if (!contextIconUrl) {
      setShowContextIcon(false);
      return;
    }
    const updateContextIcon = () => setShowContextIcon(window.scrollY > 16);
    updateContextIcon();
    window.addEventListener('scroll', updateContextIcon, { passive: true });
    return () => window.removeEventListener('scroll', updateContextIcon);
  }, [contextIconUrl]);
  const activeRoute = referenceTypeRoute(active);
  const activeLabel = referenceTypeLabel(active);
  const referenceTypes = active === 'projects' ? ['projects'] as const : REFERENCE_TYPES;
  return (
    <header
      data-reference-component="top-nav"
      className={`reference-discovery-nav ${className}`}
    >
      <div className={`reference-discovery-nav__left ${className}__left`}>
        <a
          href={routeToPath(activeRoute)}
          aria-label={`Vitrines ${activeLabel}`}
          className={`reference-discovery-nav__brand ${className}__brand`}
          data-reference-gallery-identity="true"
          onClick={(event) => {
            event.preventDefault();
            navigate(activeRoute);
          }}
        >
          <span
            className={`reference-discovery-nav__identity${showContextIcon ? ' is-context-visible' : ''}`}
          >
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              width="32"
              className="reference-discovery-nav__brand-icon"
            />
            {contextIconUrl ? (
              <img
                src={contextIconUrl}
                alt=""
                aria-hidden="true"
                width="32"
                className="reference-discovery-nav__context-icon"
                onError={(event) => { event.currentTarget.classList.add('is-unavailable'); }}
              />
            ) : null}
          </span>
        </a>
        <ReferenceTypeTabs
          active={active}
          className={`reference-discovery-nav__types ${className}__types`}
          values={active === 'projects' ? ['projects'] : undefined}
        />
      </div>
      <div className={`reference-discovery-nav__search ${className}__search`}>{search}</div>
      <div className={`reference-discovery-nav__actions ${className}__actions`}>
        {accountControls}
      </div>
      <div
        className={`reference-discovery-nav__mobile-switcher ${className}__mobile-switcher`}
        data-reference-mobile-switcher="true"
      >
        <AstryxMenu
          button={{
            label: `Switch reference type: ${activeLabel}`,
            'aria-label': `Switch reference type: ${activeLabel}`,
            icon: <Icon icon="menu" size="sm" />,
            isIconOnly: true,
            variant: 'ghost',
            size: 'sm',
            className: 'reference-discovery-nav__mobile-switcher-trigger',
          }}
          isMenuOpen={mobileReferenceMenuOpen}
          onOpenChange={setMobileReferenceMenuOpen}
          hasChevron={false}
          menuWidth={220}
        >
          {referenceTypes.map((value) => (
            <AstryxDropdownItem
              key={value}
              label={referenceTypeLabel(value)}
              selected={active === value}
              onSelect={() => {
                setMobileReferenceMenuOpen(false);
                navigate(referenceTypeRoute(value));
              }}
            />
          ))}
        </AstryxMenu>
      </div>
    </header>
  );
}
