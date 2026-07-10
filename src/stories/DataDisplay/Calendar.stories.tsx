import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Calendar } from '@astryxdesign/core';
import type { ISODateString } from '@astryxdesign/core/Calendar';

const meta = {
  title: 'Components/DataDisplay/Calendar',
  component: Calendar,
  tags: ['autodocs'],
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'inline-block',
        background: 'var(--color-background-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        boxShadow: 'var(--shadow-low)',
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}

export const Single: Story = {
  render: () => {
    function Demo() {
      const [date, setDate] = useState<ISODateString>('2026-07-15');
      return (
        <Panel>
          <Calendar mode="single" value={date} onChange={setDate} />
        </Panel>
      );
    }
    return <Demo />;
  },
};

export const Range: Story = {
  render: () => (
    <Panel>
      <Calendar mode="range" />
    </Panel>
  ),
};
