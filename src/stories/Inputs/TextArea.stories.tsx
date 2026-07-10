import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextArea } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/TextArea',
  component: TextArea,
  tags: ['autodocs'],
  args: { label: 'Description', value: '', onChange: () => {}, rows: 4, maxLength: 180, placeholder: 'What does this project do?' },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState('');
      return <TextArea {...args} value={value} onChange={setValue} />;
    }
    return <Demo />;
  },
};
