import type { Meta, StoryObj } from '@storybook/react-vite';
import { Center, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/Center',
  component: Center,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Center>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Center width="100%" height={160} style={{ background: 'var(--color-background-muted)', borderRadius: 'var(--radius-element)' }}>
      <Text>Centered content</Text>
    </Center>
  ),
};
