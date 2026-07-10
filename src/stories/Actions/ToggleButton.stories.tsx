import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleButton } from '@astryxdesign/core';

const meta = {
  title: 'Components/Actions/ToggleButton',
  component: ToggleButton,
  tags: ['autodocs'],
  args: { label: 'Bold' },
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled() {
  const [pressed, setPressed] = useState(true);
  return <ToggleButton label="Bold" isPressed={pressed} onPressedChange={setPressed} />;
}

export const Playground: Story = { render: () => <Controlled /> };

export const Group: Story = {
  render: () => {
    function Demo() {
      const [bold, setBold] = useState(true);
      const [italic, setItalic] = useState(false);
      const [underline, setUnderline] = useState(false);
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ToggleButton label="Bold" isPressed={bold} onPressedChange={setBold} />
          <ToggleButton label="Italic" isPressed={italic} onPressedChange={setItalic} />
          <ToggleButton label="Underline" isPressed={underline} onPressedChange={setUnderline} />
        </div>
      );
    }
    return <Demo />;
  },
};
