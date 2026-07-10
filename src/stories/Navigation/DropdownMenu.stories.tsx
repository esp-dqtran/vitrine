import type { Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenu } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  args: {
    button: { label: 'Actions', variant: 'secondary' },
    items: [{ label: 'Edit' }, { label: 'Duplicate' }, { label: 'Move to…' }, { type: 'divider' }, { label: 'Delete' }],
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
