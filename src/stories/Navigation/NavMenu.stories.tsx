import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavHeadingMenu, NavHeadingMenuItem, SideNavHeading } from '@astryxdesign/core';

const meta = {
  title: 'Components/Navigation/NavMenu',
  component: NavHeadingMenu,
  tags: ['autodocs'],
  args: { children: null },
} satisfies Meta<typeof NavHeadingMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InSideNavHeading: Story = {
  name: 'In SideNavHeading',
  render: () => (
    <div style={{ width: 260, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 8 }}>
      <SideNavHeading
        heading="Vitrine"
        superheading="Acme Inc."
        menu={
          <NavHeadingMenu>
            <NavHeadingMenuItem label="Switch workspace" />
            <NavHeadingMenuItem label="Invite teammates" />
            <NavHeadingMenuItem label="Settings" />
          </NavHeadingMenu>
        }
      />
    </div>
  ),
};
