import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoreMenu } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/MoreMenu',
  component: MoreMenu,
  tags: ['autodocs'],
  args: { items: [{ label: 'Edit' }, { label: 'Duplicate' }, { type: 'divider' }, { label: 'Delete' }] },
} satisfies Meta<typeof MoreMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
