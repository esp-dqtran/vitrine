import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, Badge, Button, Card, Divider, Heading, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Content/Card',
  component: Card,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPersonProfile: Story = {
  name: 'Person profile',
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar name="Maya Chen" size="small" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Text weight="semibold">Maya Chen</Text>
              <Text type="supporting">Product Design</Text>
            </div>
          </div>
          <Text type="body" color="secondary">
            Owns the design system and component reviews.
          </Text>
          <Divider />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="secondary" label="Message" />
            <Button size="sm" variant="ghost" label="Profile" />
          </div>
        </div>
      </Card>
    </div>
  ),
};

export const ColorVariants: Story = {
  name: 'Color variants',
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
      <Card variant="blue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Badge variant="blue" label="Category" />
          <Heading level={4}>Colored card</Heading>
          <Text type="body" color="secondary">
            Non-semantic variants tint the surface for grouping.
          </Text>
        </div>
      </Card>
      <Card variant="muted">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Heading level={4}>Muted card</Heading>
          <Text type="body" color="secondary">
            De-emphasised background for secondary content.
          </Text>
        </div>
      </Card>
    </div>
  ),
};
