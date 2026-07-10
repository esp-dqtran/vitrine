import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@astryxdesign/core';

const meta = {
  title: 'Components/Inputs/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: { label: 'Email notifications', value: false, onChange: () => {} },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState(true);
      return <Switch {...args} value={value} onChange={setValue} description="Send a summary every morning." labelSpacing="spread" />;
    }
    return <Demo />;
  },
};

export const Group: Story = {
  render: () => {
    function Demo() {
      const [notify, setNotify] = useState(true);
      const [beta, setBeta] = useState(false);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Switch label="Email notifications" description="Send a summary every morning." value={notify} onChange={setNotify} labelSpacing="spread" />
          <Switch label="Beta features" description="Opt into unreleased functionality." value={beta} onChange={setBeta} labelSpacing="spread" />
          <Switch label="Maintenance mode" value={false} onChange={() => {}} isDisabled labelSpacing="spread" />
        </div>
      );
    }
    return <Demo />;
  },
};
