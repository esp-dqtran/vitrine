import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, ListItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/List',
  component: List,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <List>
      <ListItem label="Add your first project" description="Projects hold screens, flows, and collections." />
      <ListItem label="Invite your team" description="Everyone with an @company.com email can join." />
      <ListItem label="Import a screenshot" description="Drag a file anywhere on the page." />
    </List>
  ),
};
