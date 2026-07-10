import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Outline } from '@astryxdesign/core';

const items = [
  { id: 'intro', label: 'Introduction', level: 1 },
  { id: 'install', label: 'Installation', level: 1 },
  { id: 'usage', label: 'Usage', level: 1 },
  { id: 'theming', label: 'Theming', level: 2 },
  { id: 'dark-mode', label: 'Dark mode', level: 2 },
];

const meta = {
  title: 'Components/Content/Outline',
  component: Outline,
  tags: ['autodocs'],
  args: { items },
} satisfies Meta<typeof Outline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [activeId, setActiveId] = useState('intro');
      return <Outline items={items} activeId={activeId} onActiveIdChange={setActiveId} />;
    }
    return <Demo />;
  },
};
