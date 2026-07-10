import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, Item } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Item',
  component: Item,
  tags: ['autodocs'],
  args: { label: 'Maya Chen', description: 'Product Design' },
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithStartContent: Story = {
  name: 'With start content',
  args: { startContent: <Avatar name="Maya Chen" size="small" /> },
};
