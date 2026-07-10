import type { Meta, StoryObj } from '@storybook/react-vite';
import { VStack } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/VStack',
  component: VStack,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof VStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <VStack gap={2}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 160, height: 32, borderRadius: 'var(--radius-element)', background: 'var(--color-accent-muted)' }} />
      ))}
    </VStack>
  ),
};
