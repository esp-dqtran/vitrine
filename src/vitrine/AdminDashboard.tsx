import { lazy, Suspense, useState, type ReactNode } from 'react';
import { AppShell, Spinner } from '@astryxdesign/core';
import type { AuthUser } from './authApi.ts';
import { navigate } from './router.ts';
import {
  AdminSidebar,
  type AdminSection,
} from './components/AdminSidebar.tsx';

const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({
  default: module.UsersPage,
})));
const CategoriesPage = lazy(() => import('./components/CategoriesPage').then((module) => ({
  default: module.CategoriesPage,
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
  return (
    <div data-admin-dashboard="true" style={{ display: 'contents' }}>
      <AppShell
        variant="section"
        sideNav={(
          <AdminSidebar
            email={email}
            section={section}
            onSectionChange={onSectionChange}
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
  const [section, setSection] = useState<AdminSection>('users');
  return (
    <AdminDashboardShell
      email={user.email}
      section={section}
      onSectionChange={setSection}
      onBack={() => navigate({ name: 'apps' })}
      onLogout={onLogout}
      page={(
        <Suspense fallback={<AdminPageSpinner />}>
          {section === 'users' ? <UsersPage /> : <CategoriesPage />}
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
