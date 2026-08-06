import { useState } from 'react';
import { Heading, Text } from '@astryxdesign/core';
import { UsersDirectoryContainer } from './UsersDirectoryContainer.tsx';
import type { ReactNode } from 'react';
import type { UsageRangeKey } from '../types.ts';

interface UsersPageViewProps {
  total: number;
  directory: ReactNode;
}

export function UsersPageView({ total, directory }: UsersPageViewProps) {
  return (
    <>
      <header className="projects-workspace__page-header">
        <div>
          <Heading level={1}>Users</Heading>
          <Text color="secondary">Manage access and understand what members use most.</Text>
        </div>
        <div className="projects-workspace__page-header-actions">
          {/* Held back until the directory reports a count, so the header never
              flashes "0 members" while the first page is still loading. */}
          {total > 0 && (
            <Text color="secondary">{total} {total === 1 ? 'member' : 'members'}</Text>
          )}
        </div>
      </header>
      {directory}
    </>
  );
}

export function UsersPage() {
  /*
   * The member count comes from the directory page itself — Users no longer
   * loads growth/usage/referrals just to render a total; those moved to Insights.
   */
  const [total, setTotal] = useState(0);
  const [range] = useState<UsageRangeKey>('30d');

  return (
    <UsersPageView
      total={total}
      directory={<UsersDirectoryContainer range={range} onTotalChange={setTotal} />}
    />
  );
}
