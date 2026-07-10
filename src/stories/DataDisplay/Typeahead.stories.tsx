import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typeahead } from '@astryxdesign/core';
import { createStaticSource } from '@astryxdesign/core/Typeahead';
import type { SearchableItem } from '@astryxdesign/core/Typeahead';

const items: SearchableItem[] = [
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'solid', label: 'Solid' },
  { id: 'angular', label: 'Angular' },
  { id: 'qwik', label: 'Qwik' },
  { id: 'preact', label: 'Preact' },
  { id: 'lit', label: 'Lit' },
  { id: 'astro', label: 'Astro' },
];
const source = createStaticSource(items);

const meta = {
  title: 'Components/DataDisplay/Typeahead',
  component: Typeahead,
  tags: ['autodocs'],
  args: { label: 'Framework', searchSource: source, value: null, onChange: () => {} },
} satisfies Meta<typeof Typeahead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<SearchableItem | null>(null);
      return (
        <Typeahead
          label="Framework"
          isLabelHidden
          placeholder="Search frameworks…"
          searchSource={source}
          value={value}
          onChange={setValue}
          hasEntriesOnFocus
        />
      );
    }
    return <Demo />;
  },
};
