import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading, SelectableCard, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/SelectableCard',
  component: SelectableCard,
  tags: ['autodocs'],
  args: { label: 'Pro plan', isSelected: false, onChange: () => {} },
} satisfies Meta<typeof SelectableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [selected, setSelected] = useState(true);
      return (
        <div style={{ maxWidth: 220 }}>
          <SelectableCard label="Pro plan" isSelected={selected} onChange={setSelected}>
            <Heading level={4}>Pro</Heading>
            <Text type="body" color="secondary">
              $29/month
            </Text>
          </SelectableCard>
        </div>
      );
    }
    return <Demo />;
  },
};
