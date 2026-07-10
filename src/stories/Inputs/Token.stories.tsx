import type { Meta, StoryObj } from '@storybook/react-vite';
import { Token } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/Token',
  component: Token,
  tags: ['autodocs'],
  args: { label: 'design-system' },
} satisfies Meta<typeof Token>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {(['default', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'purple', 'pink', 'gray'] as const).map((c) => (
        <Token key={c} label={c} color={c} onRemove={() => {}} />
      ))}
    </div>
  ),
};
