import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from '@astryxdesign/core';

const meta = {
  title: 'Components/Feedback/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  args: { label: 'Upload', value: 72, hasValueLabel: true, variant: 'accent' },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Stack: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 460 }}>
      <ProgressBar label="Upload" value={72} hasValueLabel variant="accent" />
      <ProgressBar label="Storage" value={90} hasValueLabel variant="warning" />
      <ProgressBar label="Syncing" isIndeterminate variant="accent" />
    </div>
  ),
};
