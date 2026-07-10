import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, Button, TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/TopNav',
  component: TopNav,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { children: null },
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <TopNav
      heading={<TopNavHeading heading="Vitrine" />}
      startContent={
        <>
          <TopNavItem label="Home" href="#" isSelected />
          <TopNavItem label="Projects" href="#" />
          <TopNavItem label="Settings" href="#" />
        </>
      }
      endContent={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button size="sm" variant="secondary" label="Invite" />
          <Avatar name="Maya Chen" size="small" />
        </div>
      }
    />
  ),
};
