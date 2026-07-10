import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, IconButton } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: { label: 'Settings', icon: <Icon icon="wrench" />, variant: 'ghost' },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <IconButton label="Settings" icon={<Icon icon="wrench" />} variant="primary" />
      <IconButton label="Search" icon={<Icon icon="search" />} variant="secondary" />
      <IconButton label="Close" icon={<Icon icon="close" />} variant="ghost" />
      <IconButton label="Delete" icon={<Icon icon="close" />} variant="destructive" />
    </div>
  ),
};
