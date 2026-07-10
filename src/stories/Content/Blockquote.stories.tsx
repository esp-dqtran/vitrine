import type { Meta, StoryObj } from '@storybook/react-vite';
import { Blockquote } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Blockquote',
  component: Blockquote,
  tags: ['autodocs'],
  args: { children: 'Design is not just what it looks like — design is how it works.' },
} satisfies Meta<typeof Blockquote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithCitation: Story = {
  name: 'With citation',
  args: { cite: '— Steve Jobs' },
};
