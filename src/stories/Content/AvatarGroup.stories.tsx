import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarGroup } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/AvatarGroup',
  component: AvatarGroup,
  tags: ['autodocs'],
  args: { size: 'medium', children: null },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <AvatarGroup size="medium">
      <Avatar name="Maya Chen" />
      <Avatar name="Devin Park" />
      <Avatar name="Sam Rivera" />
      <Avatar name="Jo Kim" />
      <Avatar name="Lee Wong" />
    </AvatarGroup>
  ),
};
