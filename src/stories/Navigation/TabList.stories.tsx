import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabList, Tab, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/TabList',
  component: TabList,
  tags: ['autodocs'],
  args: { value: 'components', onChange: () => {}, children: null },
} satisfies Meta<typeof TabList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [tab, setTab] = useState('components');
      return (
        <div>
          <TabList value={tab} onChange={setTab} hasDivider>
            <Tab label="Components" value="components" />
            <Tab label="Tokens" value="tokens" />
            <Tab label="Templates" value="templates" />
          </TabList>
          <div style={{ paddingTop: 14 }}>
            <Text color="secondary">Selected: {tab}</Text>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};
