import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetadataList, MetadataListItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/MetadataList',
  component: MetadataList,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof MetadataList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <MetadataList>
      <MetadataListItem label="Owner">Maya Chen</MetadataListItem>
      <MetadataListItem label="Created">Jul 8, 2026</MetadataListItem>
      <MetadataListItem label="Status">Active</MetadataListItem>
    </MetadataList>
  ),
};
