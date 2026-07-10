import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  args: { keys: 'mod+k' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Combos: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Kbd keys="mod+k" />
      <Kbd keys="mod+shift+p" />
    </div>
  ),
};
