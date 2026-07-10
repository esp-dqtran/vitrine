import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Divider',
  component: Divider,
  tags: ['autodocs'],
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Text>Section one</Text>
      <div style={{ margin: '12px 0' }}>
        <Divider />
      </div>
      <Text>Section two</Text>
    </div>
  ),
};
