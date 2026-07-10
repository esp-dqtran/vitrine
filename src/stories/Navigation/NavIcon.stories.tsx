import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, NavIcon } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/NavIcon',
  component: NavIcon,
  tags: ['autodocs'],
  args: { icon: <Icon icon="menu" /> },
} satisfies Meta<typeof NavIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
