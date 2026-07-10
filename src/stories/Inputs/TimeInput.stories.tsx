import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeInput } from '@astryxdesign/core';
import type { ISOTimeString } from '@astryxdesign/core/TimeInput';

const meta = {
  title: 'Components/Inputs/TimeInput',
  component: TimeInput,
  tags: ['autodocs'],
  args: { label: 'Start time' },
} satisfies Meta<typeof TimeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [time, setTime] = useState<ISOTimeString | undefined>(undefined);
      return <TimeInput label="Start time" value={time} onChange={setTime} />;
    }
    return <Demo />;
  },
};
