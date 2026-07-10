import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Selector } from '@astryxdesign/core';

const options = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
  { value: 'angular', label: 'Angular' },
];

const meta = {
  title: 'Components/DataDisplay/Selector',
  component: Selector,
  tags: ['autodocs'],
  args: { label: 'Framework', value: '', onChange: () => {}, options },
} satisfies Meta<typeof Selector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState('');
      return (
        <Selector
          label="Framework"
          isLabelHidden
          value={value}
          onChange={setValue}
          placeholder="Choose a framework"
          hasSearch
          options={options}
        />
      );
    }
    return <Demo />;
  },
};
