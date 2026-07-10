import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClickableCard, Heading, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/ClickableCard',
  component: ClickableCard,
  tags: ['autodocs'],
  args: { label: 'Open project', onClick: () => {} },
} satisfies Meta<typeof ClickableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div style={{ maxWidth: 260 }}>
      <ClickableCard {...args}>
        <Heading level={4}>Vitrine</Heading>
        <Text type="body" color="secondary">
          Design inspiration platform.
        </Text>
      </ClickableCard>
    </div>
  ),
};
