import { useState } from 'react';
import { Heading, Text } from '@astryxdesign/core';
import { UsersDirectoryContainer } from './UsersDirectoryContainer.tsx';
import type { ReactNode } from 'react';
import type { UsageRangeKey } from '../types.ts';

interface UsersPageViewProps {
  directory: ReactNode;
}

export function UsersPageView({ directory }: UsersPageViewProps) {
  return (
    <>
      <header className="projects-workspace__page-header">
        <div>
          <Heading level={1}>Users</Heading>
          <Text color="secondary">Manage access and understand what members use most.</Text>
        </div>
      </header>
      {directory}
    </>
  );
}

export function UsersPage() {
  const [range] = useState<UsageRangeKey>('30d');

  return <UsersPageView directory={<UsersDirectoryContainer range={range} />} />;
}
