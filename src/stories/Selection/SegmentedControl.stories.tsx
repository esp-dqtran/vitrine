import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Selection/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: { label: 'Timeframe', value: 'week', onChange: () => {}, children: null },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [seg, setSeg] = useState('week');
      return (
        <SegmentedControl label="Timeframe" value={seg} onChange={setSeg}>
          <SegmentedControlItem label="Day" value="day" />
          <SegmentedControlItem label="Week" value="week" />
          <SegmentedControlItem label="Month" value="month" />
        </SegmentedControl>
      );
    }
    return <Demo />;
  },
};
