import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/Stack',
  component: Stack,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: () => (
    <Stack direction="vertical" gap={2}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 32, borderRadius: 'var(--radius-element)', background: 'var(--color-accent-muted)' }} />
      ))}
    </Stack>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Stack direction="horizontal" gap={2}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 56, height: 40, borderRadius: 'var(--radius-element)', background: 'var(--color-accent-muted)' }} />
      ))}
    </Stack>
  ),
};
