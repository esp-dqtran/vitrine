import { DropdownMenu, SideNav, SideNavHeading, SideNavItem } from '@astryxdesign/core';
import { navigate, useRoute, type Route } from '../router';

const NAV_ITEMS: Array<{ label: string; route: Route; match: (route: Route) => boolean }> = [
  { label: 'Apps', route: { name: 'apps' }, match: (r) => r.name === 'apps' || r.name === 'app' },
  ...((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RESEARCH_PROJECTS_ENABLED === 'true'
    ? [{ label: 'Projects', route: { name: 'projects' } as Route, match: (r: Route) => r.name === 'projects' || r.name === 'project' }]
    : []),
  { label: 'Users', route: { name: 'admin' }, match: (r) => r.name === 'admin' },
];

interface SidebarProps {
  email: string;
  collectionsCount: number;
  onOpenCollections: () => void;
  onOpenSettings: () => void;
  onLogout: () => void | Promise<void>;
}

function WordmarkIcon() {
  return (
    <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-background-surface)' }} />
    </div>
  );
}

// SideNav gives us the collapse-behind-a-hamburger-on-mobile behavior for free via
// AppShell (which renders this in its `sideNav` slot) — no manual breakpoint logic here.
export function Sidebar({ email, collectionsCount, onOpenCollections, onOpenSettings, onLogout }: SidebarProps) {
  const route = useRoute();
  return (
    <SideNav
      header={<SideNavHeading icon={<WordmarkIcon />} heading="Vitrine" />}
      footerIcons={
        <DropdownMenu
          button={{ label: email, size: 'sm', variant: 'ghost', style: { width: '100%', justifyContent: 'flex-start' } }}
          hasChevron
          items={[
            { label: `Collections${collectionsCount ? ` (${collectionsCount})` : ''}`, onClick: onOpenCollections },
            { label: 'Settings', onClick: onOpenSettings },
            { type: 'divider' },
            { label: 'Log out', onClick: onLogout },
          ]}
        />
      }
    >
      {NAV_ITEMS.map((item) => (
        <SideNavItem
          key={item.label}
          label={item.label}
          isSelected={item.match(route)}
          onClick={() => navigate(item.route)}
        />
      ))}
    </SideNav>
  );
}
