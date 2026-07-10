import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pagination } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: { page: 1, onChange: () => {}, totalItems: 240, pageSize: 20, variant: 'pages' },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Demo() {
      const [page, setPage] = useState(1);
      return <Pagination page={page} onChange={setPage} totalItems={240} pageSize={20} variant="pages" />;
    }
    return <Demo />;
  },
};
