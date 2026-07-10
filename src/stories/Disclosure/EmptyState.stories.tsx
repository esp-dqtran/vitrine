import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, EmptyState } from '@astryxdesign/core';

const meta = {
  title: 'Components/Disclosure/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: 'No screens yet',
    description: 'Add your first screen to start building your reference library.',
    actions: <Button variant="primary" label="Add screen" />,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
