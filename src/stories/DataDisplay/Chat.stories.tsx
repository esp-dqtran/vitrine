import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatComposer } from '@astryxdesign/core';

const meta = {
  title: 'Components/DataDisplay/Chat',
  component: ChatComposer,
  tags: ['autodocs'],
  args: { onSubmit: () => {}, placeholder: 'Message Astryx…' },
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState('');
      return (
        <div style={{ maxWidth: 480 }}>
          <ChatComposer value={value} onChange={setValue} onSubmit={() => setValue('')} placeholder="Message Astryx…" />
        </div>
      );
    }
    return <Demo />;
  },
};
