import type { Meta, StoryObj } from '@storybook/react-vite';
import { Code } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Code',
  component: Code,
  tags: ['autodocs'],
  args: { children: 'npm install @astryxdesign/core' },
} satisfies Meta<typeof Code>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
