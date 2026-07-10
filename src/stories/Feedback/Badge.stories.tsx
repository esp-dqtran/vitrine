import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@astryxdesign/core';

const meta = {
  title: 'Components/Feedback/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { label: 'Badge', variant: 'neutral' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const StatusVariants: Story = {
  name: 'Status variants',
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge variant="success" label="Active" />
      <Badge variant="warning" label="Degraded" />
      <Badge variant="error" label="Failed" />
      <Badge variant="info" label="Info" />
      <Badge variant="neutral" label="Draft" />
    </div>
  ),
};

export const CategoricalVariants: Story = {
  name: 'Categorical variants',
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'gray'].map((c) => (
        <Badge key={c} variant={c as never} label={c[0].toUpperCase() + c.slice(1)} />
      ))}
    </div>
  ),
};
