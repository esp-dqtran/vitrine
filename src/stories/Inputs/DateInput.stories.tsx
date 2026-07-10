import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateInput } from '@astryxdesign/core';
import type { ISODateString } from '@astryxdesign/core/Calendar';

const meta = {
  title: 'Components/Inputs/DateInput',
  component: DateInput,
  tags: ['autodocs'],
  args: { label: 'Start date' },
} satisfies Meta<typeof DateInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [date, setDate] = useState<ISODateString | undefined>('2026-07-15');
      return <DateInput label="Start date" value={date} onChange={setDate} />;
    }
    return <Demo />;
  },
};
