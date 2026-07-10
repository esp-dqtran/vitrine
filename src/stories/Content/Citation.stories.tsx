import type { Meta, StoryObj } from '@storybook/react-vite';
import { Citation } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Citation',
  component: Citation,
  tags: ['autodocs'],
  args: { source: { title: 'Astryx docs', url: 'https://example.com' }, number: 1 },
} satisfies Meta<typeof Citation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const NumberVariant: Story = {
  name: 'Number variant',
  args: { variant: 'number' },
};
