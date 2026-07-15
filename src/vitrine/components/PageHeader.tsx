import type { ReactNode } from 'react';
import { Heading, Text } from '@astryxdesign/core';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div style={{ padding: '32px 0 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <Heading level={1}>{title}</Heading>
        {description && (
          <div style={{ marginTop: 8, maxWidth: 560 }}>
            <Text type="large" color="secondary">{description}</Text>
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
