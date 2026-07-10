import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timestamp } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Timestamp',
  component: Timestamp,
  tags: ['autodocs'],
  args: { value: '2026-07-08T09:00:00Z' },
} satisfies Meta<typeof Timestamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Auto: Story = {};

export const Formats: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Timestamp value="2026-07-08T09:00:00Z" format="relative" />
      <Timestamp value="2026-07-08T09:00:00Z" format="date" />
      <Timestamp value="2026-07-08T09:00:00Z" format="date_time" />
      <Timestamp value="2026-07-08T09:00:00Z" format="time" />
    </div>
  ),
};
