import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, OverflowList } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/OverflowList',
  component: OverflowList,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof OverflowList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div style={{ width: 260, border: '1px dashed var(--color-border-emphasized)', padding: 8 }}>
      <OverflowList gap={1}>
        {['Design', 'Engineering', 'Product', 'Data', 'Marketing', 'Sales', 'Support'].map((t) => (
          <Badge key={t} variant="neutral" label={t} />
        ))}
      </OverflowList>
    </div>
  ),
};
