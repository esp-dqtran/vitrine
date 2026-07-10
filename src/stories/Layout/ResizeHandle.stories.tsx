import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResizeHandle } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/ResizeHandle',
  component: ResizeHandle,
  tags: ['autodocs'],
  args: { direction: 'horizontal' },
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div style={{ display: 'flex', height: 120, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)' }}>
      <div style={{ flex: 1, background: 'var(--color-background-muted)' }} />
      <ResizeHandle direction="horizontal" />
      <div style={{ flex: 1 }} />
    </div>
  ),
};
