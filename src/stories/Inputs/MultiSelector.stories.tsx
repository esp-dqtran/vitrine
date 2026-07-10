import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MultiSelector } from '@astryxdesign/core';

const options = [
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'data', label: 'Data' },
];

const meta = {
  title: 'Components/Inputs/MultiSelector',
  component: MultiSelector,
  tags: ['autodocs'],
  args: { label: 'Teams', value: [], onChange: () => {}, options },
} satisfies Meta<typeof MultiSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<string[]>(['design']);
      return <MultiSelector label="Teams" value={value} onChange={setValue} options={options} hasSelectAll />;
    }
    return <Demo />;
  },
};
