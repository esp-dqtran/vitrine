import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Text',
  component: Text,
  tags: ['autodocs'],
  args: { type: 'body', children: 'The quick brown fox jumps over the lazy dog.' },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Types: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Text type="large">Large — intro and lead paragraphs.</Text>
      <Text type="body">Body — the default paragraph size for reading.</Text>
      <Text type="label">Label — form labels and dense UI.</Text>
      <Text type="supporting">Supporting — captions and secondary metadata.</Text>
      <Text type="code">Code — mono for inline values.</Text>
    </div>
  ),
};
