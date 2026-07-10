import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateRangeInput } from '@astryxdesign/core';
import type { DateRange } from '@astryxdesign/core/Calendar';

const meta = {
  title: 'Components/Inputs/DateRangeInput',
  component: DateRangeInput,
  tags: ['autodocs'],
  args: { label: 'Trip dates', value: null, onChange: () => {} },
} satisfies Meta<typeof DateRangeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [range, setRange] = useState<DateRange | null>(null);
      return <DateRangeInput label="Trip dates" value={range} onChange={setRange} />;
    }
    return <Demo />;
  },
};
