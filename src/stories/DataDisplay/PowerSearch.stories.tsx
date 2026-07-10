import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PowerSearch } from '@astryxdesign/core';
import { createPowerSearchConfig } from '@astryxdesign/core/PowerSearch';
import type { PowerSearchFilter } from '@astryxdesign/core/PowerSearch';

const { config } = createPowerSearchConfig([
  { key: 'title', type: 'string', label: 'Title' },
  {
    key: 'status',
    type: 'enum',
    label: 'Status',
    enumValues: [
      { value: 'in_progress', label: 'In Progress' },
      { value: 'todo', label: 'Todo' },
      { value: 'backlog', label: 'Backlog' },
    ],
  },
  { key: 'priority', type: 'number', label: 'Priority' },
] as const);

const meta = {
  title: 'Components/DataDisplay/PowerSearch',
  component: PowerSearch,
  tags: ['autodocs'],
  args: { config, filters: [], onChange: () => {}, isLabelHidden: false, label: 'Search issues' },
} satisfies Meta<typeof PowerSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [filters, setFilters] = useState<ReadonlyArray<PowerSearchFilter>>([]);
      return <PowerSearch config={config} filters={filters} onChange={setFilters} label="Search issues" isLabelHidden={false} />;
    }
    return <Demo />;
  },
};
