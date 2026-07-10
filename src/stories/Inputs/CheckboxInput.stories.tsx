import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckboxInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/CheckboxInput',
  component: CheckboxInput,
  tags: ['autodocs'],
  args: { label: 'Accept terms', value: false, onChange: () => {} },
} satisfies Meta<typeof CheckboxInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<boolean | 'indeterminate'>(false);
      return <CheckboxInput label="Accept terms" value={value} onChange={setValue} />;
    }
    return <Demo />;
  },
};

export const Indeterminate: Story = {
  args: { value: 'indeterminate' },
};
