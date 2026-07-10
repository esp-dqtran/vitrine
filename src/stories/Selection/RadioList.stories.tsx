import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioList, RadioListItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Selection/RadioList',
  component: RadioList,
  tags: ['autodocs'],
  args: { label: 'Plan', value: 'pro', onChange: () => {}, children: null },
} satisfies Meta<typeof RadioList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [radio, setRadio] = useState('pro');
      return (
        <RadioList label="Plan" value={radio} onChange={setRadio}>
          <RadioListItem label="Starter" value="starter" />
          <RadioListItem label="Pro" value="pro" />
          <RadioListItem label="Enterprise" value="ent" />
        </RadioList>
      );
    }
    return <Demo />;
  },
};
