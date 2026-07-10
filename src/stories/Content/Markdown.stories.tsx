import type { Meta, StoryObj } from '@storybook/react-vite';
import { Markdown } from '@astryxdesign/core';

const sample = `# Astryx

A **design system** for how we build now.

- 150+ accessible components
- Brand-level theming
- Dark mode built in

Learn more at [astryx.dev](https://example.com).`;

const meta = {
  title: 'Components/Content/Markdown',
  component: Markdown,
  tags: ['autodocs'],
  args: { children: sample },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
