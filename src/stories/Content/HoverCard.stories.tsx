import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, Button, HoverCard, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
  args: { children: null, content: null },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <HoverCard
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 250, padding: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar name="Maya Chen" size="medium" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Text weight="semibold">Maya Chen</Text>
              <Text type="supporting">Product Design</Text>
            </div>
          </div>
          <Text type="body" color="secondary">
            Leads the design-system team. 42 projects shipped.
          </Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <Button size="sm" variant="primary" label="Follow" />
            <Button size="sm" variant="secondary" label="Message" />
          </div>
        </div>
      }
    >
      <span style={{ cursor: 'pointer', borderBottom: '1px dashed var(--color-border-emphasized)' }}>Maya Chen</span>
    </HoverCard>
  ),
};
