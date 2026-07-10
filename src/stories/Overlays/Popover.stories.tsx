import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Heading, Popover, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Overlays/Popover',
  component: Popover,
  tags: ['autodocs'],
  args: { children: null, content: null },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Popover
      hasAutoFocus={false}
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 230, padding: 4 }}>
          <Heading level={4}>Share project</Heading>
          <Text type="supporting">Anyone with the link can view this project.</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button size="sm" variant="primary" label="Copy link" />
          </div>
        </div>
      }
    >
      <Button variant="secondary" label="Open popover" />
    </Popover>
  ),
};
