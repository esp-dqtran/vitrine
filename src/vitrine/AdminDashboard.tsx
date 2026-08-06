import { lazy, Suspense, type ReactNode } from 'react';
import { Spinner } from '@astryxdesign/core';
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
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onBack: () => void;
  page: ReactNode;
}

export function AdminDashboardShell({
  section,
  onSectionChange,
  onBack,
  page,
}: AdminDashboardShellProps) {
  useWorkspaceChrome(
    () => ({
      className: 'admin-workspace',
      dataset: { 'data-admin-dashboard': 'true' },
      /*
       * Rail is nav only: no workspace row (Admin has none to switch to) and no
       * footer (no account block, no back action). The Vitrines brand link at the
       * top is the way back to the app, and Log out lives in the account menu
       * there — so leaving Admin is still one click.
       */
      nav: workspaceNav({
        active: section,
        label: 'Admin',
        admin: true,
        onUsers: () => onSectionChange('users'),
        onInsights: () => onSectionChange('insights'),
        onSettings: null,
      }),
      onBrandSelect: onBack,
    }),
    [section, onSectionChange],
  );

  return (
    <>
      {page}
    </>
  );
}

export function AdminDashboard() {
  const route = useRoute();
  const section: AdminSection =
    route.name === 'admin' && route.section === 'insights' ? 'insights' : 'users';
  return (
    <AdminDashboardShell
      section={section}
      onSectionChange={(next) =>
        navigate(next === 'insights' ? { name: 'admin', section: 'insights' } : { name: 'admin' })
      }
      onBack={() => navigate({ name: 'apps' })}
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
