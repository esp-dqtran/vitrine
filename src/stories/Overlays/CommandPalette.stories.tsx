import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandPalette } from '@astryxdesign/core';
import { createStaticSource } from '@astryxdesign/core/Typeahead';

const items = [
  { id: 'new', label: 'New project', auxiliaryData: { group: 'Actions' } },
  { id: 'invite', label: 'Invite teammate', auxiliaryData: { group: 'Actions' } },
  { id: 'import', label: 'Import screens', auxiliaryData: { group: 'Actions' } },
  { id: 'settings', label: 'Open settings', auxiliaryData: { group: 'Navigate' } },
  { id: 'billing', label: 'Billing & plans', auxiliaryData: { group: 'Navigate' } },
  { id: 'docs', label: 'Documentation', auxiliaryData: { group: 'Navigate' } },
];
const source = createStaticSource(items);

const meta = {
  title: 'Components/Overlays/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  args: { isOpen: true, onOpenChange: () => {}, searchSource: source },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  args: { isInline: true },
};
