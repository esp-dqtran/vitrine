import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading, Text } from '@astryxdesign/core';

const meta = {
  title: 'Foundations/Typography',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: "Figtree across body and headings on a 14px / 1.2 scale." } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
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

export const TextTypes: Story = {
  name: 'Text types',
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
