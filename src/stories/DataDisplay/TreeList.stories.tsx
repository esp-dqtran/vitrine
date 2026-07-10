import type { Meta, StoryObj } from '@storybook/react-vite';
import { TreeList } from '@astryxdesign/core';
import type { TreeListItemData } from '@astryxdesign/core/TreeList';

const items: TreeListItemData[] = [
  {
    id: 'design',
    label: 'Design',
    children: [
      { id: 'gallery', label: 'Browse gallery' },
      { id: 'dark-mode', label: 'Dark mode polish' },
    ],
  },
  {
    id: 'eng',
    label: 'Engineering',
    isExpanded: true,
    children: [
      { id: 'perf', label: 'Virtualize lists', isSelected: true },
      { id: 'a11y', label: 'Keyboard navigation' },
    ],
  },
];

const meta = {
  title: 'Components/DataDisplay/TreeList',
  component: TreeList,
  tags: ['autodocs'],
  args: { items },
} satisfies Meta<typeof TreeList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
