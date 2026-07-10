import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: { size: 'md' },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};
