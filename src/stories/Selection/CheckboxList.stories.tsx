import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Selection/CheckboxList',
  component: CheckboxList,
  tags: ['autodocs'],
  args: { label: 'Email me about', value: ['updates'], onChange: () => {}, children: null },
} satisfies Meta<typeof CheckboxList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [checks, setChecks] = useState(['updates']);
      return (
        <CheckboxList label="Email me about" value={checks} onChange={setChecks}>
          <CheckboxListItem label="Product updates" value="updates" />
          <CheckboxListItem label="Security alerts" value="security" />
          <CheckboxListItem label="Weekly digest" value="digest" />
        </CheckboxList>
      );
    }
    return <Demo />;
  },
};
