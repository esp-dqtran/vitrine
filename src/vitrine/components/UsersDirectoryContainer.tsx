import { useState } from 'react';
import { Button, Spinner } from '@astryxdesign/core';
import type { AdminUser, UsageRangeKey, UserFilter } from '../types.ts';
import { setAdminUserActive } from '../usersApi.ts';
import { useUsersDirectory } from '../useUsersDirectory.ts';
import { UserDirectory } from './UserDirectory.tsx';
import { UserUsageDialog } from './UserUsageDialog.tsx';

interface UsersDirectoryContainerProps {
  range: UsageRangeKey;
}

export function UsersDirectoryContainer({ range }: UsersDirectoryContainerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const directory = useUsersDirectory(query, filter);

  const updateActive = async (user: AdminUser, active: boolean) => {
    const updated = await setAdminUserActive(user.id, active);
    directory.updateUser(updated);
    setSelectedUser((selected) => selected?.id === updated.id ? updated : selected);
  };

  if (directory.loading && directory.users.length === 0) {
    return (
      <section className="admin-users-directory">
        <div className="admin-users-state" aria-label="Loading member directory"><Spinner size="lg" /></div>
      </section>
    );
  }

  if (directory.error) {
    return (
      <section className="admin-users-directory">
        <div className="admin-users-state admin-users-error">
          <h2>Could not load members</h2>
          <p>{directory.error}</p>
          <Button label="Try again" clickAction={() => void directory.refresh()} />
        </div>
      </section>
    );
  }

  return (
    <>
      <UserDirectory
        users={directory.users}
        total={directory.total}
        hasMore={directory.hasMore}
        loadingMore={directory.loadingMore}
        refreshing={directory.loading}
        query={query}
        filter={filter}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onLoadMore={() => void directory.loadMore()}
        onSetActive={updateActive}
        onSelectUser={setSelectedUser}
      />
      <UserUsageDialog user={selectedUser} range={range} onClose={() => setSelectedUser(null)} />
    </>
  );
}
