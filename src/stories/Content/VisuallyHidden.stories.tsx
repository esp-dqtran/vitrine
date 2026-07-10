import type { Meta, StoryObj } from '@storybook/react-vite';
import { VisuallyHidden } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/VisuallyHidden',
  component: VisuallyHidden,
  tags: ['autodocs'],
  args: { children: 'Close dialog' },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <button type="button" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', padding: '6px 10px' }}>
      ×<VisuallyHidden>Close dialog</VisuallyHidden>
    </button>
  ),
};
