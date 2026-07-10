import type { Meta, StoryObj } from '@storybook/react-vite';
import { SideNav, SideNavItem, SideNavSection, Text } from '@astryxdesign/core';

const meta = {
  title: 'Components/Layout/SideNav',
  component: SideNav,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: null },
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div style={{ height: 420, width: 260, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', overflow: 'hidden' }}>
      <SideNav
        header={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--color-accent)', flex: '0 0 auto' }} />
            <Text weight="bold">Vitrine</Text>
          </div>
        }
      >
        <SideNavItem label="Inbox" />
        <SideNavItem label="My Issues" isSelected />
        <SideNavSection title="Workspace">
          <SideNavItem label="Projects" />
          <SideNavItem label="Views" />
          <SideNavItem label="Members" />
        </SideNavSection>
      </SideNav>
    </div>
  ),
};
