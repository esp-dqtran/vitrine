import { Button, SideNav, SideNavHeading, SideNavItem } from '@astryxdesign/core';

export type AdminSection = 'users' | 'categories';

interface AdminSidebarProps {
  email: string;
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
}

function AdminWordmarkIcon() {
  return <img src="/favicon.svg" alt="" aria-hidden="true" width={22} />;
}

export function AdminSidebar({
  email,
  section,
  onSectionChange,
  onBack,
  onLogout,
}: AdminSidebarProps) {
  return (
    <SideNav
      header={<SideNavHeading icon={<AdminWordmarkIcon />} heading="Vitrines Admin" />}
      footerIcons={(
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
            {email}
          </span>
          <Button label="Log out" variant="ghost" size="sm" onClick={onLogout} />
        </div>
      )}
    >
      <SideNavItem
        label="Users"
        isSelected={section === 'users'}
        onClick={() => onSectionChange('users')}
      />
      <SideNavItem
        label="Categories"
        isSelected={section === 'categories'}
        onClick={() => onSectionChange('categories')}
      />
      <SideNavItem label="Back to Vitrines" isSelected={false} onClick={onBack} />
    </SideNav>
  );
}
