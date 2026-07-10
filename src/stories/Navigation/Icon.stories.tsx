import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '@astryxdesign/core';

const names = ['close', 'chevronDown', 'check', 'search', 'menu', 'calendar', 'clock', 'warning', 'error', 'success', 'info', 'copy'] as const;

const meta = {
  title: 'Components/Navigation/Icon',
  component: Icon,
  tags: ['autodocs'],
  args: { icon: 'search', size: 'md', color: 'inherit' },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Gallery: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {names.map((n) => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 72 }}>
          <Icon icon={n} size="lg" />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{n}</span>
        </div>
      ))}
    </div>
  ),
};
