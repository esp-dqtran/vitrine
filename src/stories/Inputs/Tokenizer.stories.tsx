import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tokenizer } from '@astryxdesign/core';
import { createStaticSource } from '@astryxdesign/core/Typeahead';
import type { SearchableItem } from '@astryxdesign/core/Typeahead';

const people: SearchableItem[] = [
  { id: 'maya', label: 'Maya Chen' },
  { id: 'devin', label: 'Devin Park' },
  { id: 'sam', label: 'Sam Rivera' },
  { id: 'jo', label: 'Jo Kim' },
];
const source = createStaticSource(people);

const meta = {
  title: 'Components/Inputs/Tokenizer',
  component: Tokenizer,
  tags: ['autodocs'],
  args: { label: 'Team members', searchSource: source, value: [], onChange: () => {} },
} satisfies Meta<typeof Tokenizer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [members, setMembers] = useState<SearchableItem[]>([people[0]]);
      return <Tokenizer label="Team members" searchSource={source} value={members} onChange={(items) => setMembers(items)} />;
    }
    return <Demo />;
  },
};
