import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Tooltip } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  args: { content: 'Saved to your library', children: null },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="secondary" label="Hover me" />
    </Tooltip>
  ),
};
