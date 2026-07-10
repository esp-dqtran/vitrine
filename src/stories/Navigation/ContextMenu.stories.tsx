import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextMenu, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  args: {
    items: [{ label: 'Copy' }, { label: 'Paste' }, { label: 'Rename' }, { type: 'divider' }, { label: 'Delete' }],
    children: null,
  },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <div
        style={{
          padding: '40px 20px',
          border: '1px dashed var(--color-border-emphasized)',
          borderRadius: 'var(--radius-element)',
          textAlign: 'center',
          background: 'var(--color-background-muted)',
        }}
      >
        <Text color="secondary">Right-click anywhere in this box</Text>
      </div>
    </ContextMenu>
  ),
};
