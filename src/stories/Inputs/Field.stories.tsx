import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/Field',
  component: Field,
  tags: ['autodocs'],
  args: {
    label: 'Custom control',
    description: "Wraps any custom input with a consistent label.",
    inputID: 'custom-control',
    children: null,
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Field {...args}>
      <input
        id="custom-control"
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 'var(--radius-element)',
          border: '1px solid var(--color-border-emphasized)',
        }}
      />
    </Field>
  ),
};
