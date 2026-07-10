import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/Grid',
  component: Grid,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Grid columns={3} gap={2}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ height: 56, borderRadius: 'var(--radius-element)', background: 'var(--color-accent-muted)' }} />
      ))}
    </Grid>
  ),
};
