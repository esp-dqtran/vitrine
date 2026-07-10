import type { Meta, StoryObj } from '@storybook/react-vite';
import { AspectRatio } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/AspectRatio',
  component: AspectRatio,
  tags: ['autodocs'],
  args: { ratio: 16 / 9, children: null },
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Widescreen: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <AspectRatio ratio={16 / 9}>
        <div style={{ width: '100%', height: '100%', background: 'var(--color-accent-muted)' }} />
      </AspectRatio>
    </div>
  ),
};

export const Ellipse: Story = {
  render: () => (
    <div style={{ width: 120 }}>
      <AspectRatio ratio={1} shape="ellipse">
        <div style={{ width: '100%', height: '100%', background: 'var(--color-accent-muted)' }} />
      </AspectRatio>
    </div>
  ),
};
