import type { Meta, StoryObj } from '@storybook/react-vite';
import { HStack } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/HStack',
  component: HStack,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof HStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <HStack gap={2}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 56, height: 40, borderRadius: 'var(--radius-element)', background: 'var(--color-accent-muted)' }} />
      ))}
    </HStack>
  ),
};
