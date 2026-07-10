import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Heading, Toolbar } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  args: { label: 'Screens toolbar' },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Toolbar
      label="Screens toolbar"
      startContent={<Heading level={4}>Screens</Heading>}
      endContent={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary" label="Filter" />
          <Button size="sm" variant="primary" label="Add screen" />
        </div>
      }
    />
  ),
};
