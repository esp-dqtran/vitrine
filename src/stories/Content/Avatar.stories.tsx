import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, StatusDot } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { name: 'Ada Lovelace', size: 'medium' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <Avatar name="Ada Lovelace" size="tiny" />
      <Avatar name="Grace Hopper" size="xsmall" />
      <Avatar name="Alan Turing" size="small" />
      <Avatar name="Katherine Johnson" size="medium" />
      <Avatar name="Linus Torvalds" size="large" status={<StatusDot variant="success" label="Online" />} />
    </div>
  ),
};
