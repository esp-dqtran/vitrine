import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/Slider',
  component: Slider,
  tags: ['autodocs'],
  args: { label: 'Monthly budget', value: 40, onChange: () => {}, min: 0, max: 100 },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState(40);
      return (
        <div style={{ maxWidth: 320 }}>
          <Slider
            label="Monthly budget"
            value={value}
            onChange={setValue}
            min={0}
            max={100}
            valueDisplay="text"
            formatValue={(v: number) => '$' + v}
          />
        </div>
      );
    }
    return <Demo />;
  },
};
