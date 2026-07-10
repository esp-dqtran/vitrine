import type { Meta, StoryObj } from '@storybook/react-vite';
import { Thumbnail } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Thumbnail',
  component: Thumbnail,
  tags: ['autodocs'],
  args: { label: 'artwork.png' },
} satisfies Meta<typeof Thumbnail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const Removable: Story = {
  args: { onRemove: () => {} },
};
