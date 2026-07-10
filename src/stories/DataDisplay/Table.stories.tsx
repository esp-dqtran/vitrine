import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, Badge, Table, Text } from '@astryxdesign/core';

type Member = { name: string; role: string; status: 'Active' | 'Away' | 'Invited' };

const data: Member[] = [
  { name: 'Maya Chen', role: 'Design', status: 'Active' },
  { name: 'Devin Park', role: 'Engineering', status: 'Active' },
  { name: 'Sam Rivera', role: 'Product', status: 'Away' },
  { name: 'Jo Kim', role: 'Data', status: 'Invited' },
];

const meta = {
  title: 'Components/DataDisplay/Table',
  component: Table<Member>,
  tags: ['autodocs'],
  args: { data, columns: [] },
} satisfies Meta<typeof Table<Member>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    hasHover: true,
    columns: [
      {
        key: 'name',
        header: 'Member',
        renderCell: (row) => (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar name={row.name} size="small" />
            <Text weight="medium">{row.name}</Text>
          </div>
        ),
      },
      { key: 'role', header: 'Team' },
      {
        key: 'status',
        header: 'Status',
        renderCell: (row) => (
          <Badge variant={row.status === 'Active' ? 'success' : row.status === 'Away' ? 'warning' : 'neutral'} label={row.status} />
        ),
      },
    ],
  },
};
