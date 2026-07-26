import { lazy, Suspense, type ReactNode } from 'react';
import { AppShell, Spinner } from '@astryxdesign/core';
import type { AuthUser } from './authApi.ts';
import { navigate } from './router.ts';
import { AdminSidebar } from './components/AdminSidebar.tsx';

const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({
  default: module.UsersPage,
})));

interface AdminDashboardShellProps {
  email: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  page: ReactNode;
}

export function AdminDashboardShell({
  email,
  onBack,
  onLogout,
  page,
}: AdminDashboardShellProps) {
  return (
    <div data-admin-dashboard="true" style={{ display: 'contents' }}>
      <AppShell
        variant="section"
        sideNav={(
          <AdminSidebar
            email={email}
            onBack={onBack}
            onLogout={onLogout}
          />
        )}
      >
        {page}
      </AppShell>
    </div>
  );
}

export function AdminDashboard({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <AdminDashboardShell
      email={user.email}
      onBack={() => navigate({ name: 'apps' })}
      onLogout={onLogout}
      page={(
        <Suspense fallback={<AdminPageSpinner />}>
          <UsersPage />
        </Suspense>
      )}
    />
  );
}

function AdminPageSpinner() {
  return (
    <main
      className="vitrine-page admin-users-state"
      role="status"
      aria-label="Loading users"
    >
      <Spinner size="lg" />
    </main>
  );
}
