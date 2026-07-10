import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: { width: 200, height: 12 },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const CardPreview: Story = {
  name: 'Card preview',
  render: () => (
    <div
      style={{
        background: 'var(--color-background-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        boxShadow: 'var(--shadow-low)',
        padding: 24,
        maxWidth: 340,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <Skeleton width={44} height={44} radius="rounded" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <Skeleton height={12} width="40%" index={0} />
          <Skeleton height={12} width="65%" index={1} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton height={12} width="100%" index={2} />
        <Skeleton height={12} width="92%" index={3} />
        <Skeleton height={12} width="70%" index={4} />
      </div>
    </div>
  ),
};
