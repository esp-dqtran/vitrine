import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, Carousel, Heading, Text } from '@astryxdesign/core';

const items: [string, string][] = [
  ['Dashboard', 'Analytics overview'],
  ['Settings', 'Account & billing'],
  ['Inbox', 'Unified messages'],
  ['Kanban', 'Task board'],
  ['Checkout', 'Payment flow'],
  ['Gallery', 'Media grid'],
];

const meta = {
  title: 'Components/DataDisplay/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Carousel aria-label="Templates" gap={2} hasSnap>
      {items.map(([title, desc], i) => (
        <div key={title} style={{ flex: '0 0 220px' }}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  height: 80,
                  borderRadius: 'var(--radius-element)',
                  background: i % 2 ? 'var(--color-accent-muted)' : 'var(--color-background-blue)',
                }}
              />
              <Heading level={4}>{title}</Heading>
              <Text type="supporting">{desc}</Text>
            </div>
          </Card>
        </div>
      ))}
    </Carousel>
  ),
};
