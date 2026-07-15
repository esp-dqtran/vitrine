import { DropdownMenu } from '@astryxdesign/core';
import { navigate, useRoute, type Route } from '../router';

const NAV_ITEMS: Array<{ label: string; route: Route; match: (route: Route) => boolean }> = [
  { label: 'Apps', route: { name: 'apps' }, match: (r) => r.name === 'apps' || r.name === 'app' },
];

interface SidebarProps {
  email: string;
  collectionsCount: number;
  onOpenCollections: () => void;
  onOpenSettings: () => void;
  onLogout: () => void | Promise<void>;
}

export function Sidebar({ email, collectionsCount, onOpenCollections, onOpenSettings, onLogout }: SidebarProps) {
  const route = useRoute();
  return (
    <div
      style={{
        width: 200,
        flex: '0 0 auto',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-background-surface)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 18px' }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-background-surface)' }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Vitrine</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.match(route);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.route)}
            style={{
              display: 'flex',
              alignItems: 'center',
              textAlign: 'left',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 500,
              background: active ? 'var(--color-background-muted)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {item.label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
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
    </div>
  );
}
