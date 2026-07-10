import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusDot } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
  args: { variant: 'success', label: 'Online' },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <StatusDot variant="success" label="Online" />
      <StatusDot variant="warning" label="Away" />
      <StatusDot variant="error" label="Offline" />
      <StatusDot variant="accent" label="Active" />
      <StatusDot variant="neutral" label="Unknown" />
    </div>
  ),
};
