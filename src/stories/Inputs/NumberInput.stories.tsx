import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberInput } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/NumberInput',
  component: NumberInput,
  tags: ['autodocs'],
  args: { label: 'Seats', value: 5, onChange: () => {}, min: 1, max: 50, units: 'seats' },
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<number | null>(5);
      return <NumberInput label="Seats" value={value} onChange={setValue} min={1} max={50} units="seats" />;
    }
    return <Demo />;
  },
};

export const Stepped: Story = {
  render: () => {
    function Demo() {
      const [budget, setBudget] = useState<number | null>(500);
      return <NumberInput label="Budget" value={budget} onChange={setBudget} min={0} step={50} units="USD" />;
    }
    return <Demo />;
  },
};
