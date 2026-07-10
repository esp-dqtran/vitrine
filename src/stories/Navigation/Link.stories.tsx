import type { Meta, StoryObj } from '@storybook/react-vite';
import { Link } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/Link',
  component: Link,
  tags: ['autodocs'],
  args: { href: '#', children: 'View documentation' },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ExternalLink: Story = {
  name: 'External link',
  args: { isExternalLink: true, children: 'Open in a new tab' },
};
