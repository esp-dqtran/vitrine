import { Button, SideNav, SideNavHeading, SideNavItem } from '@astryxdesign/core';

interface AdminSidebarProps {
  email: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
}

function AdminWordmarkIcon() {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        background: 'var(--color-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: 3, background: '#FFFFFF' }} />
    </div>
  );
}

export function AdminSidebar({ email, onBack, onLogout }: AdminSidebarProps) {
  return (
    <SideNav
      header={<SideNavHeading icon={<AdminWordmarkIcon />} heading="Vitrine Admin" />}
      footerIcons={(
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
            {email}
          </span>
          <Button label="Log out" variant="ghost" size="sm" onClick={onLogout} />
        </div>
      )}
    >
      <SideNavItem label="Users" isSelected onClick={() => undefined} />
      <SideNavItem label="Back to Vitrine" isSelected={false} onClick={onBack} />
    </SideNav>
  );
}
