import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Heading',
  component: Heading,
  tags: ['autodocs'],
  args: { level: 1, children: 'Heading' },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Scale: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Heading level={1} type="display-3">Display 3</Heading>
      <Heading level={1}>Heading 1</Heading>
      <Heading level={2}>Heading 2</Heading>
      <Heading level={3}>Heading 3</Heading>
      <Heading level={4}>Heading 4</Heading>
    </div>
  ),
};
