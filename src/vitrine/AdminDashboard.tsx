import { lazy, Suspense, type ReactNode } from 'react';
import { Button, Spinner } from '@astryxdesign/core';
import { ArrowLeftIcon } from '@storybook/icons';
import type { AuthUser } from './authApi.ts';
import { navigate, useRoute } from './router.ts';
import { useWorkspaceChrome } from './components/WorkspaceChromeContext.tsx';
import { workspaceNav } from './components/workspaceNav.tsx';

export type AdminSection = 'users' | 'insights';

const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({
  default: module.UsersPage,
})));
const InsightsPage = lazy(() => import('./components/InsightsPage').then((module) => ({
  default: module.InsightsPage,
})));

interface AdminDashboardShellProps {
  email: string;
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  page: ReactNode;
}

export function AdminDashboardShell({
  email,
  section,
  onSectionChange,
  onBack,
  onLogout,
  page,
}: AdminDashboardShellProps) {
  useWorkspaceChrome(
    () => ({
      className: 'admin-workspace',
      dataset: { 'data-admin-dashboard': 'true' },
      workspace: {
        label: 'Vitrines Admin',
        name: 'Admin',
        initial: email.trim().charAt(0).toUpperCase() || 'A',
        onSelect: onBack,
      },
      nav: workspaceNav({
        active: section,
        label: 'Admin',
        admin: true,
        onUsers: () => onSectionChange('users'),
        onInsights: () => onSectionChange('insights'),
        settingsLabel: 'Back to Vitrines',
        settingsIcon: <ArrowLeftIcon aria-hidden="true" />,
        onSettings: onBack,
      }),
      railFooter: (
        <div className="admin-workspace__account">
          <span title={email}>{email}</span>
          <Button label="Log out" variant="ghost" size="sm" onClick={onLogout} />
        </div>
      ),
      onBrandSelect: onBack,
    }),
    [email, section, onSectionChange],
  );

  return (
    <>
      {page}
    </>
  );
}

export function AdminDashboard({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void | Promise<void>;
}) {
  const route = useRoute();
  const section: AdminSection =
    route.name === 'admin' && route.section === 'insights' ? 'insights' : 'users';
  return (
    <AdminDashboardShell
      email={user.email}
      section={section}
      onSectionChange={(next) =>
        navigate(next === 'insights' ? { name: 'admin', section: 'insights' } : { name: 'admin' })
      }
      onBack={() => navigate({ name: 'apps' })}
      onLogout={onLogout}
      page={(
        <Suspense fallback={<AdminPageSpinner />}>
          {section === 'insights' ? <InsightsPage /> : <UsersPage />}
        </Suspense>
      )}
    />
  );
}

function AdminPageSpinner() {
  return (
    <div
      className="projects-workspace__loading"
      role="status"
      aria-label="Loading users"
    >
      <Spinner size="lg" />
    </div>
  );
}
